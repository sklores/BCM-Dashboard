"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Download, Plus, Trash2, X } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import { BidSolicitationModule } from "@/components/modules/bid-solicitation/BidSolicitationModule";
import { LaborMaterialsSection } from "./LaborMaterialsSection";
import {
  STATUS_LABEL,
  STATUS_TEXT,
  fmtUsd,
  type Estimate,
  type EstimateLineItem,
  type EstimateStatus,
  type FeeType,
} from "./types";
import {
  createEstimate,
  createLineItem,
  deleteEstimate,
  deleteLineItem,
  fetchEstimates,
  fetchLineItems,
  updateEstimate,
  updateLineItem,
  type EstimatePatch,
  type LineItemPatch,
} from "./queries";

type Section = "estimates" | "labor_materials" | "bids";

const STATUS_OPTIONS: EstimateStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "archived",
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calcTotals(
  items: EstimateLineItem[],
  feeType: FeeType,
  feeValue: number,
) {
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.total_cost) || 0),
    0,
  );
  const fee =
    feeType === "percent"
      ? (subtotal * (Number(feeValue) || 0)) / 100
      : Number(feeValue) || 0;
  return { subtotal, fee, grand: subtotal + fee };
}

export function EstimatingModule(props: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [section, setSection] = useState<Section>("estimates");
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Estimate | null>(null);

  // Cache totals per estimate for the list view.
  const [listTotals, setListTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchEstimates();
        if (cancelled) return;
        setEstimates(rows);

        // Pull line items for each in parallel — for a beta with a small
        // number of estimates this is fine. Optimize with a join later.
        const totals: Record<string, number> = {};
        await Promise.all(
          rows.map(async (e) => {
            try {
              const items = await fetchLineItems(e.id);
              const { grand } = calcTotals(items, e.fee_type, e.fee_value);
              totals[e.id] = grand;
            } catch {
              totals[e.id] = 0;
            }
          }),
        );
        if (!cancelled) setListTotals(totals);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load estimates",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    try {
      const created = await createEstimate();
      setEstimates((rows) => [created, ...rows]);
      setSelected(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add estimate");
    }
  }

  async function handleUpdate(id: string, patch: EstimatePatch) {
    const prev = estimates;
    setEstimates((rows) =>
      rows.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
    if (selected && selected.id === id) setSelected({ ...selected, ...patch });
    try {
      await updateEstimate(id, patch);
    } catch (err) {
      setEstimates(prev);
      setError(err instanceof Error ? err.message : "Failed to save estimate");
    }
  }

  async function handleDelete(estimate: Estimate) {
    const prev = estimates;
    setEstimates((rows) => rows.filter((e) => e.id !== estimate.id));
    if (selected?.id === estimate.id) setSelected(null);
    try {
      await deleteEstimate(estimate.id);
    } catch (err) {
      setEstimates(prev);
      setError(err instanceof Error ? err.message : "Failed to delete estimate");
    }
  }

  function handleTotalChange(estimateId: string, total: number) {
    setListTotals((prev) => ({ ...prev, [estimateId]: total }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Estimating</h1>
      </div>

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["estimates", "Estimates"],
            ["labor_materials", "Labor & Materials"],
            ["bids", "Bid Solicitation"],
          ] as const
        ).map(([key, label]) => {
          const active = key === section;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded px-4 py-1.5 text-sm transition ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {section === "labor_materials" && (
        <LaborMaterialsSection
          projectId={props.projectId}
          editable={editable}
        />
      )}

      {section === "bids" && (
        <BidSolicitationModule
          projectId={props.projectId}
          moduleKey="bids"
          moduleLabel="Bid Solicitation"
          hideHeader
        />
      )}

      {section === "estimates" && (
        <>
          <p className="text-sm text-zinc-400">
            Pre-construction estimates. Standalone — not tied to any active
            project.
          </p>

          {!editable && (
            <p className="text-xs text-zinc-500">
              View only — your role ({role}) cannot edit estimates.
            </p>
          )}

          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {error && <p className="text-sm text-red-400">Error: {error}</p>}

          {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {estimates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-zinc-500">
                      No estimates yet.
                    </td>
                  </tr>
                )}
                {estimates.map((e) => (
                  <tr
                    key={e.id}
                    className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                    onClick={() => setSelected(e)}
                  >
                    <td className="px-3 py-2 text-zinc-200">
                      {e.estimate_number ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-100">
                      {e.project_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {e.client_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(e.estimate_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-200">
                      {fmtUsd(listTotals[e.id])}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs ${STATUS_TEXT[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      {editable && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (window.confirm("Delete this estimate?"))
                              handleDelete(e);
                          }}
                          className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                          aria-label="Delete estimate"
                          title="Delete estimate"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-4 w-4" />
              New estimate
            </button>
          )}
            </>
          )}

          {selected && (
            <EstimateDetailModal
              estimate={selected}
              editable={editable}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
              onTotalChange={handleTotalChange}
            />
          )}
        </>
      )}
    </div>
  );
}

function EstimateDetailModal({
  estimate,
  editable,
  onClose,
  onUpdate,
  onTotalChange,
}: {
  estimate: Estimate;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: EstimatePatch) => Promise<void>;
  onTotalChange: (id: string, total: number) => void;
}) {
  const [items, setItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchLineItems(estimate.id);
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load line items",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimate.id]);

  const totals = useMemo(
    () => calcTotals(items, estimate.fee_type, estimate.fee_value),
    [items, estimate.fee_type, estimate.fee_value],
  );

  // Push the grand total back to the list as line items change.
  useEffect(() => {
    onTotalChange(estimate.id, totals.grand);
  }, [estimate.id, totals.grand, onTotalChange]);

  async function handleAddLine() {
    const sortOrder = items.length;
    try {
      const created = await createLineItem(estimate.id, sortOrder);
      setItems((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add line item");
    }
  }

  async function handleUpdateLine(id: string, patch: LineItemPatch) {
    const prev = items;
    setItems((rows) =>
      rows.map((it) =>
        it.id === id
          ? {
              ...it,
              ...patch,
              total_cost:
                (patch.quantity ?? it.quantity) *
                (patch.unit_cost ?? it.unit_cost),
            }
          : it,
      ),
    );
    try {
      await updateLineItem(id, patch);
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Failed to save line item");
    }
  }

  async function handleDeleteLine(id: string) {
    const prev = items;
    setItems((rows) => rows.filter((it) => it.id !== id));
    try {
      await deleteLineItem(id);
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Failed to delete line item");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            {estimate.estimate_number || "Estimate"}
            {estimate.project_name ? ` · ${estimate.project_name}` : ""}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
              title="Coming soon"
            >
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Estimate number">
            <TextInput
              value={estimate.estimate_number ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(estimate.id, { estimate_number: v || null })
              }
            />
          </Field>
          <Field label="Date">
            <DateInput
              value={estimate.estimate_date}
              editable={editable}
              onChange={(v) => onUpdate(estimate.id, { estimate_date: v })}
            />
          </Field>
          <Field label="Client name">
            <TextInput
              value={estimate.client_name ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(estimate.id, { client_name: v || null })
              }
            />
          </Field>
          <Field label="Project name">
            <TextInput
              value={estimate.project_name ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(estimate.id, { project_name: v || null })
              }
            />
          </Field>
          <Field label="Project address">
            <TextInput
              value={estimate.project_address ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(estimate.id, { project_address: v || null })
              }
            />
          </Field>
          <Field label="Status">
            <SelectInput
              value={estimate.status}
              editable={editable}
              options={STATUS_OPTIONS.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
              onChange={(v) =>
                onUpdate(estimate.id, { status: v as EstimateStatus })
              }
            />
          </Field>
        </div>

        <div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
          Line items
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">Error: {error}</p>}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto rounded-md border border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="w-24 px-3 py-2 font-medium">Qty</th>
                    <th className="w-20 px-3 py-2 font-medium">Unit</th>
                    <th className="w-32 px-3 py-2 font-medium">Unit cost</th>
                    <th className="w-32 px-3 py-2 font-medium">Total</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-zinc-500">
                        No line items yet.
                      </td>
                    </tr>
                  )}
                  {items.map((it) => (
                    <tr key={it.id} className="group border-b border-zinc-900">
                      <td className="px-3 py-1.5">
                        <TextInput
                          value={it.description ?? ""}
                          editable={editable}
                          onCommit={(v) =>
                            handleUpdateLine(it.id, { description: v || null })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <NumberInput
                          value={it.quantity}
                          editable={editable}
                          onCommit={(v) =>
                            handleUpdateLine(it.id, { quantity: v ?? 0 })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <TextInput
                          value={it.unit ?? ""}
                          editable={editable}
                          onCommit={(v) =>
                            handleUpdateLine(it.id, { unit: v || null })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <NumberInput
                          value={it.unit_cost}
                          editable={editable}
                          onCommit={(v) =>
                            handleUpdateLine(it.id, { unit_cost: v ?? 0 })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5 text-zinc-200">
                        {fmtUsd(it.total_cost)}
                      </td>
                      <td className="w-8 px-2 py-1.5 text-right">
                        {editable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(it.id)}
                            className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                            aria-label="Delete line"
                            title="Delete line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable && (
              <button
                type="button"
                onClick={handleAddLine}
                className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line item
              </button>
            )}
          </>
        )}

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <Field label="Fee type">
            <SelectInput
              value={estimate.fee_type}
              editable={editable}
              options={[
                { value: "percent", label: "% of direct costs" },
                { value: "fixed", label: "Fixed $" },
              ]}
              onChange={(v) =>
                onUpdate(estimate.id, { fee_type: v as FeeType })
              }
            />
          </Field>
          <Field
            label={
              estimate.fee_type === "percent"
                ? "Fee percentage"
                : "Fee amount"
            }
          >
            <NumberInput
              value={estimate.fee_value}
              editable={editable}
              onCommit={(v) =>
                onUpdate(estimate.id, { fee_value: v ?? 0 })
              }
            />
          </Field>
        </div>

        <div className="ml-auto flex w-full max-w-sm flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Subtotal</span>
            <span>{fmtUsd(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>
              Fee
              {estimate.fee_type === "percent"
                ? ` (${estimate.fee_value}% )`
                : ""}
            </span>
            <span>{fmtUsd(totals.fee)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-zinc-800 pt-2 text-base font-semibold text-zinc-100">
            <span>Grand total</span>
            <span>{fmtUsd(totals.grand)}</span>
          </div>
        </div>

        <Field label="Notes (inclusions / exclusions)">
          <textarea
            defaultValue={estimate.notes ?? ""}
            disabled={!editable}
            onBlur={(e) => {
              const next = e.target.value;
              if ((estimate.notes ?? "") !== next) {
                onUpdate(estimate.id, { notes: next || null });
              }
            }}
            rows={4}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function TextInput({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (next: string) => void;
}) {
  if (!editable) {
    return <span className="text-zinc-300">{value || "—"}</span>;
  }
  return (
    <input
      type="text"
      defaultValue={value}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
    />
  );
}

function NumberInput({
  value,
  editable,
  onCommit,
}: {
  value: number;
  editable: boolean;
  onCommit: (next: number | null) => void;
}) {
  if (!editable) {
    return <span className="text-zinc-300">{value}</span>;
  }
  return (
    <input
      type="number"
      step="0.01"
      defaultValue={value}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === "") {
          onCommit(0);
        } else {
          const n = Number(v);
          if (!Number.isNaN(n) && n !== value) onCommit(n);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full rounded bg-transparent px-1 py-1 text-right text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function DateInput({
  value,
  editable,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  onChange: (next: string | null) => void;
}) {
  if (!editable) {
    return <span className="text-zinc-300">{fmtDate(value)}</span>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function SelectInput({
  value,
  editable,
  options,
  onChange,
}: {
  value: string;
  editable: boolean;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  if (!editable) {
    const match = options.find((o) => o.value === value);
    return <span className="text-zinc-300">{match?.label ?? value}</span>;
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
