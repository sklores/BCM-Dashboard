"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building,
  Download,
  FileText,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  STATUS_LABEL,
  STATUS_OPTIONS,
  STATUS_TEXT,
  TYPE_LABEL,
  calcGrandTotal,
  fmtUsd,
  type CompanySettings,
  type EstimateLineItemMin,
  type EstimateOption,
  type Proposal,
  type ProposalStatus,
  type ProposalType,
} from "./types";
import {
  createProposal,
  deleteProposal,
  fetchCompanySettings,
  fetchEstimateLineItems,
  fetchEstimateOptions,
  fetchProposals,
  updateCompanySettings,
  updateProposal,
  type ProposalPatch,
} from "./queries";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProposalsModule({
  hideHeader = false,
}: ModuleProps & { hideHeader?: boolean }) {
  const role = useRole();
  const editable = canEdit(role);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [estimates, setEstimates] = useState<EstimateOption[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [proposalTotals, setProposalTotals] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProposal, setOpenProposal] = useState<Proposal | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [props, ests, cs] = await Promise.all([
          fetchProposals(),
          fetchEstimateOptions(),
          fetchCompanySettings(),
        ]);
        if (cancelled) return;
        setProposals(props);
        setEstimates(ests);
        setSettings(cs);

        // Compute total per proposal in parallel.
        const totals: Record<string, number> = {};
        await Promise.all(
          props.map(async (p) => {
            if (!p.estimate_id) {
              totals[p.id] = 0;
              return;
            }
            const est = ests.find((e) => e.id === p.estimate_id);
            if (!est) {
              totals[p.id] = 0;
              return;
            }
            try {
              const items = await fetchEstimateLineItems(p.estimate_id);
              totals[p.id] = calcGrandTotal(
                items,
                est.fee_type,
                est.fee_value,
              ).grand;
            } catch {
              totals[p.id] = 0;
            }
          }),
        );
        if (!cancelled) setProposalTotals(totals);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load proposals",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const sent = proposals.filter((p) => p.status !== "draft").length;
    const won = proposals.filter((p) => p.status === "won");
    const lost = proposals.filter((p) => p.status === "lost");
    const wonValue = won.reduce(
      (sum, p) => sum + (proposalTotals[p.id] ?? 0),
      0,
    );
    const lostValue = lost.reduce(
      (sum, p) => sum + (proposalTotals[p.id] ?? 0),
      0,
    );
    const decided = won.length + lost.length;
    const winRate = decided > 0 ? (won.length / decided) * 100 : null;
    return {
      sent,
      won: won.length,
      lost: lost.length,
      winRate,
      wonValue,
      lostValue,
    };
  }, [proposals, proposalTotals]);

  async function handleAdd() {
    try {
      // Pre-populate company boilerplate text fields with settings as a hint.
      const created = await createProposal();
      setProposals((rows) => [created, ...rows]);
      setOpenProposal(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add proposal");
    }
  }

  async function handleUpdate(id: string, patch: ProposalPatch) {
    const prev = proposals;
    setProposals((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    if (openProposal?.id === id) {
      setOpenProposal({ ...openProposal, ...patch });
    }
    try {
      await updateProposal(id, patch);
      // If estimate_id changed, refresh that proposal's total.
      if (patch.estimate_id !== undefined) {
        await refreshTotal(id, patch.estimate_id);
      }
    } catch (err) {
      setProposals(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function refreshTotal(
    proposalId: string,
    estimateId: string | null,
  ): Promise<void> {
    if (!estimateId) {
      setProposalTotals((prev) => ({ ...prev, [proposalId]: 0 }));
      return;
    }
    const est = estimates.find((e) => e.id === estimateId);
    if (!est) return;
    try {
      const items = await fetchEstimateLineItems(estimateId);
      const { grand } = calcGrandTotal(items, est.fee_type, est.fee_value);
      setProposalTotals((prev) => ({ ...prev, [proposalId]: grand }));
    } catch {
      // ignore
    }
  }

  async function handleDelete(p: Proposal) {
    const prev = proposals;
    setProposals((rows) => rows.filter((x) => x.id !== p.id));
    if (openProposal?.id === p.id) setOpenProposal(null);
    try {
      await deleteProposal(p.id);
    } catch (err) {
      setProposals(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">Proposals</h1>
        </div>
      )}

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit proposals.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Sent" value={String(stats.sent)} />
        <Stat label="Won" value={String(stats.won)} accent="text-emerald-400" />
        <Stat label="Lost" value={String(stats.lost)} accent="text-red-400" />
        <Stat
          label="Win rate"
          value={stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`}
          accent="text-blue-400"
        />
        <Stat
          label="$ Won"
          value={fmtUsd(stats.wonValue)}
          accent="text-emerald-400"
        />
        <Stat
          label="$ Lost"
          value={fmtUsd(stats.lostValue)}
          accent="text-red-400"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Settings className="h-3.5 w-3.5" />
          Company settings
        </button>
        {editable && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-4 w-4" />
            New proposal
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {proposals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-zinc-500">
                    No proposals yet.
                  </td>
                </tr>
              )}
              {proposals.map((p) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                  onClick={() => setOpenProposal(p)}
                >
                  <td className="px-3 py-2 text-zinc-200">
                    {p.proposal_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-100">
                    {p.project_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {p.client_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {TYPE_LABEL[p.proposal_type]}
                  </td>
                  <td className="px-3 py-2 text-zinc-200">
                    {fmtUsd(proposalTotals[p.id])}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {fmtDate(p.proposal_date)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${STATUS_TEXT[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="w-8 px-2 py-2 text-right">
                    {editable && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (window.confirm("Delete this proposal?"))
                            handleDelete(p);
                        }}
                        className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                        aria-label="Delete"
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
      )}

      {openProposal && (
        <ProposalModal
          proposal={openProposal}
          estimates={estimates}
          settings={settings}
          editable={editable}
          onClose={() => setOpenProposal(null)}
          onUpdate={handleUpdate}
        />
      )}

      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          editable={editable}
          onClose={() => setShowSettings(false)}
          onUpdate={async (patch) => {
            const prev = settings;
            setSettings({ ...settings, ...patch });
            try {
              await updateCompanySettings(settings.id, patch);
            } catch (err) {
              setSettings(prev);
              setError(
                err instanceof Error ? err.message : "Failed to save settings",
              );
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-zinc-100",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`text-base font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function ProposalModal({
  proposal,
  estimates,
  settings,
  editable,
  onClose,
  onUpdate,
}: {
  proposal: Proposal;
  estimates: EstimateOption[];
  settings: CompanySettings | null;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: ProposalPatch) => Promise<void>;
}) {
  const [items, setItems] = useState<EstimateLineItemMin[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const linkedEstimate = useMemo(
    () => estimates.find((e) => e.id === proposal.estimate_id) ?? null,
    [estimates, proposal.estimate_id],
  );

  useEffect(() => {
    let cancelled = false;
    if (!proposal.estimate_id) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    (async () => {
      try {
        const rows = await fetchEstimateLineItems(proposal.estimate_id!);
        if (!cancelled) setItems(rows);
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposal.estimate_id]);

  const totals = useMemo(() => {
    if (!linkedEstimate) return { subtotal: 0, fee: 0, grand: 0 };
    return calcGrandTotal(items, linkedEstimate.fee_type, linkedEstimate.fee_value);
  }, [items, linkedEstimate]);

  // When the user picks a new estimate, offer to backfill blank fields.
  function pullFromEstimate(est: EstimateOption | null) {
    if (!est) return;
    const patch: ProposalPatch = { estimate_id: est.id };
    if (!proposal.client_name && est.client_name)
      patch.client_name = est.client_name;
    if (!proposal.project_name && est.project_name)
      patch.project_name = est.project_name;
    if (!proposal.project_address && est.project_address)
      patch.project_address = est.project_address;
    onUpdate(proposal.id, patch);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            {proposal.proposal_number || "Proposal"}
            {proposal.project_name ? ` · ${proposal.project_name}` : ""}
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
          <Field label="Proposal number">
            <TextInput
              value={proposal.proposal_number ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(proposal.id, { proposal_number: v || null })
              }
            />
          </Field>
          <Field label="Date">
            <DateInput
              value={proposal.proposal_date}
              editable={editable}
              onChange={(v) => onUpdate(proposal.id, { proposal_date: v })}
            />
          </Field>
          <Field label="Type">
            <select
              value={proposal.proposal_type}
              disabled={!editable}
              onChange={(e) =>
                onUpdate(proposal.id, {
                  proposal_type: e.target.value as ProposalType,
                })
              }
              className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
            >
              <option value="simple" className="bg-zinc-900">Simple</option>
              <option value="detailed" className="bg-zinc-900">Detailed</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={proposal.status}
              disabled={!editable}
              onChange={(e) =>
                onUpdate(proposal.id, {
                  status: e.target.value as ProposalStatus,
                })
              }
              className={`cursor-pointer rounded bg-transparent px-1 py-1 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${STATUS_TEXT[proposal.status]}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Linked estimate">
            <select
              value={proposal.estimate_id ?? ""}
              disabled={!editable}
              onChange={(e) => {
                const est =
                  estimates.find((x) => x.id === e.target.value) ?? null;
                if (est) pullFromEstimate(est);
                else
                  onUpdate(proposal.id, { estimate_id: null });
              }}
              className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
            >
              <option value="" className="bg-zinc-900">— None —</option>
              {estimates.map((e) => (
                <option key={e.id} value={e.id} className="bg-zinc-900">
                  {e.estimate_number ?? "(unnumbered)"} ·{" "}
                  {e.project_name ?? "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Client name">
            <TextInput
              value={proposal.client_name ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(proposal.id, { client_name: v || null })
              }
            />
          </Field>
          <Field label="Project name">
            <TextInput
              value={proposal.project_name ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(proposal.id, { project_name: v || null })
              }
            />
          </Field>
          <Field label="Project address">
            <TextInput
              value={proposal.project_address ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(proposal.id, { project_address: v || null })
              }
            />
          </Field>
        </div>

        <Field label="Cover letter">
          <Textarea
            value={proposal.cover_letter ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(proposal.id, { cover_letter: v || null })}
          />
        </Field>
        <Field label="Scope narrative">
          <Textarea
            value={proposal.scope_narrative ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(proposal.id, { scope_narrative: v || null })
            }
          />
        </Field>
        <Field label="Project timeline summary">
          <Textarea
            value={proposal.timeline_summary ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(proposal.id, { timeline_summary: v || null })
            }
          />
        </Field>
        <Field label="Team section">
          <Textarea
            value={proposal.team_section ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(proposal.id, { team_section: v || null })}
          />
        </Field>
        <Field label="Why hire us">
          <Textarea
            value={proposal.why_hire_us ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(proposal.id, { why_hire_us: v || null })}
          />
        </Field>

        {/* Cost section — what the client sees depends on type */}
        <div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
          Cost section ({TYPE_LABEL[proposal.proposal_type]})
        </div>

        {linkedEstimate ? (
          loadingItems ? (
            <p className="text-sm text-zinc-500">Loading line items…</p>
          ) : (
            <>
              {proposal.proposal_type === "detailed" && (
                <div className="overflow-x-auto rounded-md border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="w-20 px-3 py-2 font-medium">Qty</th>
                        <th className="w-16 px-3 py-2 font-medium">Unit</th>
                        <th className="w-28 px-3 py-2 font-medium">Unit cost</th>
                        <th className="w-28 px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-3 text-zinc-500">
                            Linked estimate has no line items.
                          </td>
                        </tr>
                      )}
                      {items.map((it) => (
                        <tr key={it.id} className="border-b border-zinc-900">
                          <td className="px-3 py-1.5 text-zinc-200">
                            {it.description ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-300">
                            {it.quantity}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400">
                            {it.unit ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-300">
                            {fmtUsd(it.unit_cost)}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-200">
                            {fmtUsd(it.total_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="ml-auto flex w-full max-w-sm flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
                {proposal.proposal_type === "simple" ? (
                  <div className="flex items-center justify-between text-zinc-300">
                    <span>Total budget</span>
                    <span className="font-semibold">{fmtUsd(totals.grand)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Subtotal</span>
                      <span>{fmtUsd(totals.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>
                        Fee
                        {linkedEstimate.fee_type === "percent"
                          ? ` (${linkedEstimate.fee_value}% )`
                          : ""}
                      </span>
                      <span>{fmtUsd(totals.fee)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t border-zinc-800 pt-2 text-base font-semibold text-zinc-100">
                      <span>Grand total</span>
                      <span>{fmtUsd(totals.grand)}</span>
                    </div>
                  </>
                )}
              </div>

              {proposal.proposal_type === "detailed" &&
                linkedEstimate.notes && (
                  <Field label="Inclusions / exclusions (from estimate)">
                    <p className="whitespace-pre-wrap text-sm text-zinc-300">
                      {linkedEstimate.notes}
                    </p>
                  </Field>
                )}
            </>
          )
        ) : (
          <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 px-3 py-3 text-sm text-zinc-500">
            Link an estimate above to populate the cost section.
          </p>
        )}

        {/* Boilerplate preview */}
        {settings && (
          <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
              <Building className="h-3.5 w-3.5" />
              Company boilerplate (auto-populates the PDF)
            </div>
            <div className="grid gap-1 md:grid-cols-2">
              <div>
                <span className="text-zinc-500">Company:</span>{" "}
                {settings.company_name ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Years:</span>{" "}
                {settings.years_in_business ?? "—"}
              </div>
              {settings.mission_statement && (
                <div className="md:col-span-2 mt-1 line-clamp-2">
                  <span className="text-zinc-500">Mission:</span>{" "}
                  {settings.mission_statement}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({
  settings,
  editable,
  onClose,
  onUpdate,
}: {
  settings: CompanySettings;
  editable: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<CompanySettings>) => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Company settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Set once — every new proposal pulls these values.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Company name">
            <TextInput
              value={settings.company_name ?? ""}
              editable={editable}
              onCommit={(v) => onUpdate({ company_name: v || null })}
            />
          </Field>
          <Field label="Years in business">
            <TextInput
              value={
                settings.years_in_business !== null
                  ? String(settings.years_in_business)
                  : ""
              }
              editable={editable}
              onCommit={(v) => {
                const n = v.trim() === "" ? null : Number(v);
                if (n === null || !Number.isNaN(n)) {
                  onUpdate({ years_in_business: n });
                }
              }}
            />
          </Field>
          <Field label="Logo URL (paste OneDrive link)">
            <TextInput
              value={settings.logo_url ?? ""}
              editable={editable}
              onCommit={(v) => onUpdate({ logo_url: v || null })}
            />
          </Field>
        </div>

        <Field label="Mission statement">
          <Textarea
            value={settings.mission_statement ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate({ mission_statement: v || null })}
          />
        </Field>
        <Field label="Portfolio highlights">
          <Textarea
            value={settings.portfolio_highlights ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate({ portfolio_highlights: v || null })}
          />
        </Field>
        <Field label="Standard terms and conditions">
          <Textarea
            value={settings.standard_terms ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate({ standard_terms: v || null })}
          />
        </Field>
      </div>
    </div>
  );
}

// ---------- Shared inputs ----------

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
  if (!editable) return <span className="text-zinc-300">{value || "—"}</span>;
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

function DateInput({
  value,
  editable,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  onChange: (next: string | null) => void;
}) {
  if (!editable) return <span className="text-zinc-300">{fmtDate(value)}</span>;
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function Textarea({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (next: string) => void;
}) {
  return (
    <textarea
      defaultValue={value}
      disabled={!editable}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      rows={3}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
    />
  );
}
