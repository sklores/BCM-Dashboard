"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  bulkInsertBudget,
  bulkInsertClarifications,
  createClarification,
  createDivision,
  createLineItem,
  deleteClarification,
  deleteDivision,
  deleteLineItem,
  fetchClarifications,
  fetchDivisions,
  fetchLineItems,
  updateClarification,
  updateDivision,
  updateLineItem,
} from "./queries";
import {
  CLAR_SECTIONS,
  CLAR_SECTION_LABEL,
  divisionTotal,
  fmtUsd,
  lineLaborTotal,
  lineMaterialTotal,
  lineSubtotal,
  type BudgetClarification,
  type BudgetClarificationPatch,
  type BudgetDivision,
  type BudgetDivisionPatch,
  type BudgetLineItem,
  type BudgetLineItemPatch,
  type ClarSection,
} from "./types";

type Section = "budget" | "clarifications";

export function BudgetModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);

  const [section, setSection] = useState<Section>("budget");
  const [divisions, setDivisions] = useState<BudgetDivision[]>([]);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [clarifications, setClarifications] = useState<BudgetClarification[]>(
    [],
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [d, l, c] = await Promise.all([
          fetchDivisions(projectId),
          fetchLineItems(projectId),
          fetchClarifications(projectId),
        ]);
        if (cancelled) return;
        setDivisions(d);
        setLines(l);
        setClarifications(c);
        setExpanded(new Set(d.map((row) => row.id)));
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load budget");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + lineSubtotal(l), 0),
    [lines],
  );

  // ---- Division actions ----

  async function handleAddDivision() {
    try {
      const created = await createDivision(projectId, {
        sort_order: divisions.length,
      });
      setDivisions((rows) => [...rows, created]);
      setExpanded((s) => new Set(s).add(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add division");
    }
  }

  async function handleUpdateDivision(id: string, patch: BudgetDivisionPatch) {
    const prev = divisions;
    setDivisions((rows) =>
      rows.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
    try {
      await updateDivision(id, patch);
    } catch (err) {
      setDivisions(prev);
      setError(err instanceof Error ? err.message : "Failed to save division");
    }
  }

  async function handleDeleteDivision(id: string) {
    if (
      !window.confirm(
        "Delete this division and all its line items? Cannot be undone.",
      )
    )
      return;
    const prevD = divisions;
    const prevL = lines;
    setDivisions((rows) => rows.filter((d) => d.id !== id));
    setLines((rows) => rows.filter((l) => l.division_id !== id));
    try {
      await deleteDivision(id);
    } catch (err) {
      setDivisions(prevD);
      setLines(prevL);
      setError(err instanceof Error ? err.message : "Failed to delete division");
    }
  }

  // ---- Line item actions ----

  async function handleAddLine(divisionId: string) {
    try {
      const sortOrder = lines.filter((l) => l.division_id === divisionId).length;
      const created = await createLineItem(projectId, divisionId, {
        sort_order: sortOrder,
      });
      setLines((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add line");
    }
  }

  async function handleUpdateLine(id: string, patch: BudgetLineItemPatch) {
    const prev = lines;
    setLines((rows) =>
      rows.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
    try {
      await updateLineItem(id, patch);
    } catch (err) {
      setLines(prev);
      setError(err instanceof Error ? err.message : "Failed to save line");
    }
  }

  async function handleDeleteLine(id: string) {
    const prev = lines;
    setLines((rows) => rows.filter((l) => l.id !== id));
    try {
      await deleteLineItem(id);
    } catch (err) {
      setLines(prev);
      setError(err instanceof Error ? err.message : "Failed to delete line");
    }
  }

  // ---- Clarifications actions ----

  async function handleAddClarification(s: ClarSection) {
    try {
      const sortOrder = clarifications.filter((c) => c.section === s).length;
      const created = await createClarification(projectId, s, {
        sort_order: sortOrder,
      });
      setClarifications((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function handleUpdateClarification(
    id: string,
    patch: BudgetClarificationPatch,
  ) {
    const prev = clarifications;
    setClarifications((rows) =>
      rows.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    try {
      await updateClarification(id, patch);
    } catch (err) {
      setClarifications(prev);
      setError(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  async function handleDeleteClarification(id: string) {
    const prev = clarifications;
    setClarifications((rows) => rows.filter((c) => c.id !== id));
    try {
      await deleteClarification(id);
    } catch (err) {
      setClarifications(prev);
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Import ----

  async function handleImport(
    parsed:
      | {
          kind: "budget";
          divisions: Array<{
            csi_code: string | null;
            name: string | null;
            lines: BudgetLineItemPatch[];
          }>;
        }
      | {
          kind: "clarifications";
          items: Array<{
            section: ClarSection;
            seq: string | null;
            parent_seq: string | null;
            body: string;
          }>;
        },
  ) {
    try {
      if (parsed.kind === "budget") {
        const { insertedDivisions, insertedLines } = await bulkInsertBudget(
          projectId,
          parsed.divisions,
        );
        const [d, l] = await Promise.all([
          fetchDivisions(projectId),
          fetchLineItems(projectId),
        ]);
        setDivisions(d);
        setLines(l);
        setExpanded(new Set(d.map((row) => row.id)));
        setError(
          `Imported ${insertedDivisions} divisions and ${insertedLines} line items.`,
        );
      } else {
        const rows = parsed.items.map((it, i) => ({
          section: it.section,
          seq: it.seq,
          parent_seq: it.parent_seq,
          body: it.body,
          sort_order: i,
        }));
        const inserted = await bulkInsertClarifications(projectId, rows);
        const c = await fetchClarifications(projectId);
        setClarifications(c);
        setError(`Imported ${inserted} clarification(s).`);
      }
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Budget</h1>
      </div>

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["budget", `Budget (${divisions.length})`],
            ["clarifications", `Clarifications (${clarifications.length})`],
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

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit the budget.
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {section === "budget" && editable && (
          <button
            type="button"
            onClick={handleAddDivision}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add division
          </button>
        )}
        {section === "clarifications" && editable && (
          <div className="flex items-center gap-2">
            {CLAR_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleAddClarification(s)}
                className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to {CLAR_SECTION_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className={`ml-auto flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition ${
              showImport
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Import {section === "budget" ? "budget CSV" : "clarifications text"}
          </button>
        )}
      </div>

      {showImport && editable && (
        <ImportPanel
          kind={section === "budget" ? "budget" : "clarifications"}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && section === "budget" && (
        <BudgetSection
          divisions={divisions}
          lines={lines}
          expanded={expanded}
          editable={editable}
          grandTotal={grandTotal}
          onToggle={toggleExpand}
          onUpdateDivision={handleUpdateDivision}
          onDeleteDivision={handleDeleteDivision}
          onAddLine={handleAddLine}
          onUpdateLine={handleUpdateLine}
          onDeleteLine={handleDeleteLine}
        />
      )}

      {!loading && section === "clarifications" && (
        <ClarificationsSection
          rows={clarifications}
          editable={editable}
          onUpdate={handleUpdateClarification}
          onDelete={handleDeleteClarification}
        />
      )}
    </div>
  );
}

// ---------- Budget Section ----------

function BudgetSection({
  divisions,
  lines,
  expanded,
  editable,
  grandTotal,
  onToggle,
  onUpdateDivision,
  onDeleteDivision,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
}: {
  divisions: BudgetDivision[];
  lines: BudgetLineItem[];
  expanded: Set<string>;
  editable: boolean;
  grandTotal: number;
  onToggle: (id: string) => void;
  onUpdateDivision: (id: string, patch: BudgetDivisionPatch) => Promise<void>;
  onDeleteDivision: (id: string) => Promise<void>;
  onAddLine: (divisionId: string) => Promise<void>;
  onUpdateLine: (id: string, patch: BudgetLineItemPatch) => Promise<void>;
  onDeleteLine: (id: string) => Promise<void>;
}) {
  if (divisions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
        No divisions yet. Click Add division, or Import a budget CSV.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {divisions.map((d) => {
        const dLines = lines.filter((l) => l.division_id === d.id);
        const total = divisionTotal(dLines);
        const isOpen = expanded.has(d.id);
        return (
          <div
            key={d.id}
            className="rounded-md border border-zinc-800 bg-zinc-900/40"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => onToggle(d.id)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <input
                type="text"
                defaultValue={d.csi_code ?? ""}
                disabled={!editable}
                placeholder="CSI"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (d.csi_code ?? ""))
                    onUpdateDivision(d.id, { csi_code: v || null });
                }}
                className="w-24 rounded-md border border-transparent bg-transparent px-2 py-1 font-mono text-xs text-zinc-300 outline-none focus:border-zinc-800 focus:bg-zinc-950 disabled:opacity-60"
              />
              <input
                type="text"
                defaultValue={d.name ?? ""}
                disabled={!editable}
                placeholder="Division name"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (d.name ?? ""))
                    onUpdateDivision(d.id, { name: v || null });
                }}
                className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 outline-none focus:border-zinc-800 focus:bg-zinc-950 disabled:opacity-60"
              />
              <span className="text-sm font-semibold text-emerald-300">
                {fmtUsd(total)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => onDeleteDivision(d.id)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                  aria-label="Delete division"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isOpen && (
              <div className="border-t border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/40 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                        <th className="px-2 py-1.5 font-medium">
                          Description
                        </th>
                        <th className="w-20 px-2 py-1.5 font-medium">Qty</th>
                        <th className="w-16 px-2 py-1.5 font-medium">Unit</th>
                        <th className="w-24 px-2 py-1.5 font-medium">
                          Allowance
                        </th>
                        <th className="w-24 px-2 py-1.5 font-medium">
                          Mat $
                        </th>
                        <th className="w-24 px-2 py-1.5 font-medium">Mat ttl</th>
                        <th className="w-16 px-2 py-1.5 font-medium">Hr</th>
                        <th className="w-20 px-2 py-1.5 font-medium">Rate</th>
                        <th className="w-24 px-2 py-1.5 font-medium">
                          Labor $
                        </th>
                        <th className="w-24 px-2 py-1.5 font-medium">
                          Contractor
                        </th>
                        <th className="w-24 px-2 py-1.5 font-medium">
                          Subtotal
                        </th>
                        <th className="w-8 px-1 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dLines.length === 0 && (
                        <tr>
                          <td
                            colSpan={12}
                            className="px-2 py-3 text-center text-zinc-500"
                          >
                            No line items.
                          </td>
                        </tr>
                      )}
                      {dLines.map((line) => (
                        <LineRow
                          key={line.id}
                          line={line}
                          editable={editable}
                          onUpdate={(patch) => onUpdateLine(line.id, patch)}
                          onDelete={() => onDeleteLine(line.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {editable && (
                  <div className="border-t border-zinc-800 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onAddLine(d.id)}
                      className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-400 transition hover:border-blue-500 hover:text-blue-400"
                    >
                      <Plus className="h-3 w-3" />
                      Add line
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">
            Project Total
          </span>
          <span className="text-2xl font-semibold text-emerald-300">
            {fmtUsd(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LineRow({
  line,
  editable,
  onUpdate,
  onDelete,
}: {
  line: BudgetLineItem;
  editable: boolean;
  onUpdate: (patch: BudgetLineItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const matTotal = lineMaterialTotal(line);
  const labTotal = lineLaborTotal(line);
  const subtotal = lineSubtotal(line);

  return (
    <tr className="group border-b border-zinc-900 hover:bg-zinc-900/40">
      <td className="px-2 py-1.5">
        <CellInput
          type="text"
          value={line.description ?? ""}
          editable={editable}
          placeholder="Item"
          onCommit={(v) => onUpdate({ description: v || null })}
          className="text-zinc-200"
        />
      </td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.quantity}
          editable={editable}
          onCommit={(v) => onUpdate({ quantity: v })}
        />
      </td>
      <td className="px-2 py-1.5">
        <CellInput
          type="text"
          value={line.unit_measure ?? ""}
          editable={editable}
          placeholder="—"
          onCommit={(v) => onUpdate({ unit_measure: v || null })}
        />
      </td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.material_allowance}
          editable={editable}
          onCommit={(v) => onUpdate({ material_allowance: v })}
          prefix="$"
        />
      </td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.material_unit_price}
          editable={editable}
          onCommit={(v) => onUpdate({ material_unit_price: v })}
          prefix="$"
        />
      </td>
      <td className="px-2 py-1.5 text-zinc-300">{fmtUsd(matTotal)}</td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.hours}
          editable={editable}
          onCommit={(v) => onUpdate({ hours: v })}
        />
      </td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.hourly_rate}
          editable={editable}
          onCommit={(v) => onUpdate({ hourly_rate: v })}
          prefix="$"
        />
      </td>
      <td className="px-2 py-1.5 text-zinc-300">{fmtUsd(labTotal)}</td>
      <td className="px-2 py-1.5">
        <CellNum
          value={line.contractor_cost}
          editable={editable}
          onCommit={(v) => onUpdate({ contractor_cost: v })}
          prefix="$"
        />
      </td>
      <td className="px-2 py-1.5 font-medium text-emerald-300">
        {fmtUsd(subtotal)}
      </td>
      <td className="w-8 px-1 py-1.5 text-right">
        {editable && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
            aria-label="Delete line"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------- Clarifications Section ----------

function ClarificationsSection({
  rows,
  editable,
  onUpdate,
  onDelete,
}: {
  rows: BudgetClarification[];
  editable: boolean;
  onUpdate: (id: string, patch: BudgetClarificationPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
        No clarifications yet. Add inline, or import the Clarifications tab as
        text.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {CLAR_SECTIONS.map((sec) => {
        const items = rows
          .filter((r) => r.section === sec)
          .sort((a, b) => a.sort_order - b.sort_order);
        if (items.length === 0) return null;
        return (
          <div
            key={sec}
            className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              {CLAR_SECTION_LABEL[sec]}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`group flex items-start gap-2 ${
                    it.parent_seq ? "ml-6" : ""
                  }`}
                >
                  <input
                    type="text"
                    defaultValue={it.seq ?? ""}
                    disabled={!editable}
                    placeholder="#"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (it.seq ?? ""))
                        onUpdate(it.id, { seq: v || null });
                    }}
                    className="w-10 rounded bg-transparent px-1 py-0.5 text-right text-xs font-mono text-zinc-500 outline-none focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  <textarea
                    defaultValue={it.body ?? ""}
                    disabled={!editable}
                    rows={Math.max(1, ((it.body ?? "").length / 80) | 0)}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (it.body ?? ""))
                        onUpdate(it.id, { body: v });
                    }}
                    placeholder="Note"
                    className="min-h-[1.5rem] flex-1 resize-none rounded bg-transparent px-1 py-0.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onDelete(it.id)}
                      className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Import Panel ----------

type ImportResult =
  | {
      kind: "budget";
      divisions: Array<{
        csi_code: string | null;
        name: string | null;
        lines: BudgetLineItemPatch[];
      }>;
    }
  | {
      kind: "clarifications";
      items: Array<{
        section: ClarSection;
        seq: string | null;
        parent_seq: string | null;
        body: string;
      }>;
    };

function ImportPanel({
  kind,
  onClose,
  onImport,
}: {
  kind: "budget" | "clarifications";
  onClose: () => void;
  onImport: (parsed: ImportResult) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setErr(
        "Export the relevant Excel tab to CSV first (File → Save As → CSV), then drop or paste it here.",
      );
      return;
    }
    try {
      const t = await file.text();
      setText(t);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read file.");
    }
  }

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setErr(null);
    setParsed(null);
    try {
      const res = await fetch("/api/budget/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Parse failed: ${res.status}`);
      }
      const j = await res.json();
      if (kind === "budget") {
        setParsed({ kind: "budget", divisions: j.divisions ?? [] });
      } else {
        setParsed({ kind: "clarifications", items: j.items ?? [] });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    await onImport(parsed);
    setParsed(null);
    setText("");
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Import {kind === "budget" ? "budget CSV" : "clarifications text"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {kind === "budget"
              ? "Drop a CSV exported from your Excel Commercial tab. Claude detects CSI division headers (e.g. 01.51.00: …) and groups line items beneath each."
              : "Drop or paste the Clarifications tab text. Claude extracts numbered items into Clarifications / Allowances / Exclusions."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!parsed && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 text-xs transition ${
              dragOver
                ? "border-blue-500 bg-blue-500/5 text-blue-300"
                : "border-zinc-700 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            <Upload className="h-4 w-4" />
            Drop a CSV / TXT here, or click to browse
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="…or paste the spreadsheet contents directly"
            className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            >
              {parsing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Parse with Claude
            </button>
            {err && <p className="text-xs text-red-400">{err}</p>}
          </div>
        </>
      )}

      {parsed && parsed.kind === "budget" && (
        <BudgetPreview
          divisions={parsed.divisions}
          onConfirm={handleConfirm}
          onReset={() => setParsed(null)}
        />
      )}
      {parsed && parsed.kind === "clarifications" && (
        <ClarPreview
          items={parsed.items}
          onConfirm={handleConfirm}
          onReset={() => setParsed(null)}
        />
      )}
    </div>
  );
}

function BudgetPreview({
  divisions,
  onConfirm,
  onReset,
}: {
  divisions: Array<{
    csi_code: string | null;
    name: string | null;
    lines: BudgetLineItemPatch[];
  }>;
  onConfirm: () => Promise<void>;
  onReset: () => void;
}) {
  const totalLines = divisions.reduce((s, d) => s + d.lines.length, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          Found {divisions.length} division
          {divisions.length === 1 ? "" : "s"} and {totalLines} line item
          {totalLines === 1 ? "" : "s"}.
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Re-edit
        </button>
      </div>
      <div className="max-h-96 overflow-auto rounded-md border border-zinc-800 p-2">
        {divisions.map((d, i) => (
          <div key={i} className="mb-2">
            <div className="border-b border-zinc-800 py-1 text-xs font-semibold text-zinc-200">
              <span className="font-mono text-zinc-400">
                {d.csi_code ?? "—"}
              </span>{" "}
              {d.name ?? "(unnamed)"}{" "}
              <span className="text-zinc-500">({d.lines.length})</span>
            </div>
            <ul className="ml-2 mt-1 list-disc text-[11px] text-zinc-400">
              {d.lines.slice(0, 6).map((l, j) => (
                <li key={j}>
                  {l.description ?? "(no description)"}{" "}
                  {l.quantity !== null && l.quantity !== undefined && (
                    <span className="text-zinc-500">
                      · {l.quantity} {l.unit_measure ?? ""}
                    </span>
                  )}
                </li>
              ))}
              {d.lines.length > 6 && (
                <li className="text-zinc-600">
                  …and {d.lines.length - 6} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={totalLines === 0}
          className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
        >
          Import {divisions.length} division{divisions.length === 1 ? "" : "s"}
        </button>
        <span className="text-[10px] text-zinc-600">
          New entries are appended; existing data is preserved.
        </span>
      </div>
    </div>
  );
}

function ClarPreview({
  items,
  onConfirm,
  onReset,
}: {
  items: Array<{
    section: ClarSection;
    seq: string | null;
    parent_seq: string | null;
    body: string;
  }>;
  onConfirm: () => Promise<void>;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          Found {items.length} item{items.length === 1 ? "" : "s"}.
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Re-edit
        </button>
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-zinc-800 p-2 text-xs">
        {CLAR_SECTIONS.map((s) => {
          const sectionItems = items.filter((i) => i.section === s);
          if (sectionItems.length === 0) return null;
          return (
            <div key={s} className="mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                {CLAR_SECTION_LABEL[s]}
              </div>
              <ul className="mt-1">
                {sectionItems.slice(0, 8).map((it, j) => (
                  <li
                    key={j}
                    className={`text-zinc-400 ${it.parent_seq ? "ml-4" : ""}`}
                  >
                    <span className="font-mono text-zinc-500">
                      {it.seq ?? "•"}
                    </span>{" "}
                    {it.body.slice(0, 140)}
                    {it.body.length > 140 ? "…" : ""}
                  </li>
                ))}
                {sectionItems.length > 8 && (
                  <li className="text-zinc-600">
                    …and {sectionItems.length - 8} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={items.length === 0}
          className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
        >
          Import {items.length} clarification{items.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

// ---------- Cell Inputs ----------

function CellInput({
  type,
  value,
  editable,
  placeholder,
  onCommit,
  className = "",
}: {
  type: "text";
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => void | Promise<void>;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (!editable) {
    return (
      <span className={className}>
        {value || (placeholder ? <span className="text-zinc-500">{placeholder}</span> : null)}
      </span>
    );
  }
  return (
    <input
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-zinc-600 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}

function CellNum({
  value,
  editable,
  onCommit,
  prefix,
}: {
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
  prefix?: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  if (!editable) {
    return (
      <span className="text-zinc-300">
        {value === null ? <span className="text-zinc-500">—</span> : `${prefix ?? ""}${value}`}
      </span>
    );
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
          {prefix}
        </span>
      )}
      <input
        type="number"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim() === "" ? null : Number(draft);
          if (next === null || !Number.isNaN(next)) {
            if (next !== value) onCommit(next);
          } else {
            setDraft(value === null ? "" : String(value));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setDraft(value === null ? "" : String(value));
            e.currentTarget.blur();
          }
        }}
        className={`w-full rounded bg-transparent py-0.5 text-xs outline-none focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          prefix ? "pl-4 pr-1" : "px-1"
        }`}
      />
    </div>
  );
}
