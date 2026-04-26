"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Download,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import { supabase } from "@/lib/supabase";
import {
  CO_STATUSES,
  CO_STATUS_LABEL,
  CO_STATUS_TEXT,
  PAY_APP_STATUSES,
  PAY_APP_STATUS_LABEL,
  PAY_APP_STATUS_TEXT,
  REQ_STATUSES,
  REQ_STATUS_LABEL,
  REQ_STATUS_TEXT,
  fmtUsd,
  payAppAmountDue,
  type ContractChangeOrder,
  type CoStatus,
  type PayAppStatus,
  type PayApplication,
  type ReqStatus,
  type SubOption,
  type SubRequisition,
} from "./types";
import {
  checkOverbillingForSub,
  createPayApp,
  createSubRequisition,
  deletePayApp,
  deleteSubRequisition,
  fetchChangeOrders,
  fetchPayApplications,
  fetchProjectSubOptions,
  fetchSubRequisitions,
  nextPayAppNumber,
  postOverbillingAlert,
  updatePayApp,
  updateSubRequisition,
} from "./queries";

type Section = "client" | "subs" | "co";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [section, setSection] = useState<Section>("client");
  const [payApps, setPayApps] = useState<PayApplication[]>([]);
  const [reqs, setReqs] = useState<SubRequisition[]>([]);
  const [changeOrders, setChangeOrders] = useState<ContractChangeOrder[]>([]);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [originalContract, setOriginalContract] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPayApp, setOpenPayApp] = useState<PayApplication | null>(null);
  const [openReq, setOpenReq] = useState<SubRequisition | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [pa, sr, co, opts, primeRes] = await Promise.all([
          fetchPayApplications(projectId),
          fetchSubRequisitions(projectId),
          fetchChangeOrders(projectId),
          fetchProjectSubOptions(projectId),
          supabase
            .from("prime_contracts")
            .select("original_contract_value")
            .eq("project_id", projectId),
        ]);
        if (cancelled) return;
        setPayApps(pa);
        setReqs(sr);
        setChangeOrders(co);
        setSubOptions(opts);
        const primeRows = (primeRes.data ?? []) as Array<{
          original_contract_value: number | null;
        }>;
        const primeTotal = primeRows.reduce(
          (sum, r) => sum + (Number(r.original_contract_value) || 0),
          0,
        );
        setOriginalContract(primeTotal);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function nameOfSub(id: string | null): string {
    if (!id) return "—";
    return subOptions.find((s) => s.id === id)?.name ?? "Unknown sub";
  }

  // ---------- derived totals ----------

  const approvedClientCoTotal = useMemo(
    () =>
      changeOrders
        .filter(
          (co) => co.status === "approved" && co.affects_client_contract,
        )
        .reduce((sum, co) => sum + (Number(co.amount) || 0), 0),
    [changeOrders],
  );

  const revisedContract = originalContract + approvedClientCoTotal;

  // Total billed to date = highest WCTD across all pay apps (WCTD is cumulative).
  const totalBilled = useMemo(
    () =>
      payApps.reduce(
        (max, p) => Math.max(max, Number(p.work_completed_to_date) || 0),
        0,
      ),
    [payApps],
  );

  // Total paid = sum of amount_due for pay apps where status === 'paid'
  const totalPaid = useMemo(
    () =>
      payApps
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + payAppAmountDue(p), 0),
    [payApps],
  );

  // Latest pay app's retainage (cumulative).
  const totalRetainage = useMemo(() => {
    const sorted = [...payApps].sort(
      (a, b) => (a.application_number ?? 0) - (b.application_number ?? 0),
    );
    const last = sorted[sorted.length - 1];
    return last ? Number(last.retainage_held) || 0 : 0;
  }, [payApps]);

  const outstanding = revisedContract - totalPaid - totalRetainage;

  // ---------- handlers ----------

  async function handleAddPayApp() {
    try {
      const number = await nextPayAppNumber(projectId);
      const created = await createPayApp(projectId, number);
      setPayApps((rows) => [...rows, created]);
      setOpenPayApp(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function handleUpdatePayApp(id: string, patch: Partial<PayApplication>) {
    const prev = payApps;
    setPayApps((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    if (openPayApp?.id === id) setOpenPayApp({ ...openPayApp, ...patch });
    try {
      await updatePayApp(id, patch);
    } catch (err) {
      setPayApps(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDeletePayApp(id: string) {
    const prev = payApps;
    setPayApps((rows) => rows.filter((p) => p.id !== id));
    if (openPayApp?.id === id) setOpenPayApp(null);
    try {
      await deletePayApp(id);
    } catch (err) {
      setPayApps(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleAddReq() {
    try {
      const created = await createSubRequisition(projectId);
      setReqs((rows) => [created, ...rows]);
      setOpenReq(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function handleUpdateReq(id: string, patch: Partial<SubRequisition>) {
    const prev = reqs;
    setReqs((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    if (openReq?.id === id) setOpenReq({ ...openReq, ...patch });
    try {
      await updateSubRequisition(id, patch);
    } catch (err) {
      setReqs(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDeleteReq(id: string) {
    const prev = reqs;
    setReqs((rows) => rows.filter((r) => r.id !== id));
    if (openReq?.id === id) setOpenReq(null);
    try {
      await deleteSubRequisition(id);
    } catch (err) {
      setReqs(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Billing</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit billing entries.
        </p>
      )}

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["client", "Client Billing"],
            ["subs", "Sub Requisitions"],
            ["co", "Change Orders"],
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

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && section === "client" && (
        <ClientSection
          payApps={payApps}
          editable={editable}
          totals={{
            originalContract,
            approvedClientCoTotal,
            revisedContract,
            totalBilled,
            totalPaid,
            outstanding,
            totalRetainage,
          }}
          onAdd={handleAddPayApp}
          onSelect={setOpenPayApp}
          onDelete={handleDeletePayApp}
        />
      )}

      {!loading && !error && section === "subs" && (
        <SubsSection
          reqs={reqs}
          subOptions={subOptions}
          editable={editable}
          nameOfSub={nameOfSub}
          onAdd={handleAddReq}
          onSelect={setOpenReq}
          onDelete={handleDeleteReq}
        />
      )}

      {!loading && !error && section === "co" && (
        <COSection
          rows={changeOrders}
          nameOfSub={nameOfSub}
        />
      )}

      {openPayApp && (
        <PayAppModal
          payApp={openPayApp}
          editable={editable}
          onClose={() => setOpenPayApp(null)}
          onUpdate={handleUpdatePayApp}
        />
      )}

      {openReq && (
        <ReqModal
          req={openReq}
          subOptions={subOptions}
          editable={editable}
          projectId={projectId}
          onClose={() => setOpenReq(null)}
          onUpdate={handleUpdateReq}
          nameOfSub={nameOfSub}
        />
      )}
    </div>
  );
}

// ---------- Client Billing ----------

function ClientSection({
  payApps,
  editable,
  totals,
  onAdd,
  onSelect,
  onDelete,
}: {
  payApps: PayApplication[];
  editable: boolean;
  totals: {
    originalContract: number;
    approvedClientCoTotal: number;
    revisedContract: number;
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    totalRetainage: number;
  };
  onAdd: () => void;
  onSelect: (p: PayApplication) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Original contract" value={fmtUsd(totals.originalContract)} />
        <Stat
          label="Approved COs"
          value={fmtUsd(totals.approvedClientCoTotal)}
          accent="text-blue-400"
        />
        <Stat
          label="Revised contract"
          value={fmtUsd(totals.revisedContract)}
          accent="text-zinc-100"
        />
        <Stat label="Billed to date" value={fmtUsd(totals.totalBilled)} />
        <Stat
          label="Paid to date"
          value={fmtUsd(totals.totalPaid)}
          accent="text-emerald-400"
        />
        <Stat
          label="Outstanding"
          value={fmtUsd(totals.outstanding)}
          accent="text-amber-400"
        />
        <Stat
          label="Retainage held"
          value={fmtUsd(totals.totalRetainage)}
          accent="text-zinc-300"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="w-12 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Scheduled</th>
              <th className="px-3 py-2 font-medium">Completed (period)</th>
              <th className="px-3 py-2 font-medium">Completed (TD)</th>
              <th className="px-3 py-2 font-medium">Retainage</th>
              <th className="px-3 py-2 font-medium">Amount due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payApps.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-zinc-500">
                  No pay applications yet.
                </td>
              </tr>
            )}
            {payApps.map((p) => (
              <tr
                key={p.id}
                className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                onClick={() => onSelect(p)}
              >
                <td className="px-3 py-2 text-zinc-300">
                  {p.application_number ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(p.scheduled_value)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(p.work_completed_this_period)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(p.work_completed_to_date)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(p.retainage_held)}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-100">
                  {fmtUsd(payAppAmountDue(p))}
                </td>
                <td className={`px-3 py-2 text-xs ${PAY_APP_STATUS_TEXT[p.status]}`}>
                  {PAY_APP_STATUS_LABEL[p.status]}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this pay application?"))
                          onDelete(p.id);
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

      {editable && (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          New pay application
        </button>
      )}
    </div>
  );
}

function PayAppModal({
  payApp,
  editable,
  onClose,
  onUpdate,
}: {
  payApp: PayApplication;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<PayApplication>) => Promise<void>;
}) {
  return (
    <ModalShell
      title={`Pay Application #${payApp.application_number ?? "—"}`}
      onClose={onClose}
      onExportPdf={() => {}}
      pdfLabel="G702 / G703 PDF"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Application number">
          <NumberInput
            value={payApp.application_number}
            editable={editable}
            onCommit={(v) =>
              onUpdate(payApp.id, { application_number: v ?? null })
            }
          />
        </Field>
        <Field label="Status">
          <select
            value={payApp.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(payApp.id, { status: e.target.value as PayAppStatus })
            }
            className={`cursor-pointer rounded bg-transparent px-1 py-1 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${PAY_APP_STATUS_TEXT[payApp.status]}`}
          >
            {PAY_APP_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                {PAY_APP_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period start">
          <DateInput
            value={payApp.period_start}
            editable={editable}
            onChange={(v) => onUpdate(payApp.id, { period_start: v })}
          />
        </Field>
        <Field label="Period end">
          <DateInput
            value={payApp.period_end}
            editable={editable}
            onChange={(v) => onUpdate(payApp.id, { period_end: v })}
          />
        </Field>
        <Field label="Scheduled value">
          <NumberInput
            value={payApp.scheduled_value}
            editable={editable}
            onCommit={(v) => onUpdate(payApp.id, { scheduled_value: v })}
          />
        </Field>
        <Field label="Work completed (this period)">
          <NumberInput
            value={payApp.work_completed_this_period}
            editable={editable}
            onCommit={(v) =>
              onUpdate(payApp.id, { work_completed_this_period: v })
            }
          />
        </Field>
        <Field label="Work completed (to date)">
          <NumberInput
            value={payApp.work_completed_to_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(payApp.id, { work_completed_to_date: v })
            }
          />
        </Field>
        <Field label="Retainage held">
          <NumberInput
            value={payApp.retainage_held}
            editable={editable}
            onCommit={(v) => onUpdate(payApp.id, { retainage_held: v })}
          />
        </Field>
        <Field label="Previous payments">
          <NumberInput
            value={payApp.previous_payments}
            editable={editable}
            onCommit={(v) => onUpdate(payApp.id, { previous_payments: v })}
          />
        </Field>
      </div>

      <div className="ml-auto flex w-full max-w-sm flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Total earned less retainage</span>
          <span>
            {fmtUsd(
              (Number(payApp.work_completed_to_date) || 0) -
                (Number(payApp.retainage_held) || 0),
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Less previous payments</span>
          <span>{fmtUsd(payApp.previous_payments)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-zinc-800 pt-2 text-base font-semibold text-zinc-100">
          <span>Current amount due</span>
          <span>{fmtUsd(payAppAmountDue(payApp))}</span>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- Sub Requisitions ----------

function SubsSection({
  reqs,
  subOptions,
  editable,
  nameOfSub,
  onAdd,
  onSelect,
  onDelete,
}: {
  reqs: SubRequisition[];
  subOptions: SubOption[];
  editable: boolean;
  nameOfSub: (id: string | null) => string;
  onAdd: () => void;
  onSelect: (r: SubRequisition) => void;
  onDelete: (id: string) => void;
}) {
  void subOptions;

  // Per-sub running totals
  const perSub = useMemo(() => {
    const map = new Map<
      string,
      { paid: number; outstanding: number; retainage: number }
    >();
    for (const r of reqs) {
      const key = r.sub_id ?? "—";
      const cur =
        map.get(key) ?? { paid: 0, outstanding: 0, retainage: 0 };
      const due = Number(r.amount_due) || 0;
      const ret = Number(r.retainage_held) || 0;
      if (r.status === "paid") cur.paid += due;
      else cur.outstanding += due;
      cur.retainage += ret;
      map.set(key, cur);
    }
    return map;
  }, [reqs]);

  return (
    <div className="flex flex-col gap-4">
      {/* Per-sub summary */}
      {perSub.size > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-900/40">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Sub</th>
                <th className="px-3 py-2 font-medium">Paid</th>
                <th className="px-3 py-2 font-medium">Outstanding</th>
                <th className="px-3 py-2 font-medium">Retainage</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(perSub.entries()).map(([key, v]) => (
                <tr key={key} className="border-b border-zinc-900">
                  <td className="px-3 py-2 text-zinc-200">
                    {key === "—" ? "(unassigned)" : nameOfSub(key)}
                  </td>
                  <td className="px-3 py-2 text-emerald-400">
                    {fmtUsd(v.paid)}
                  </td>
                  <td className="px-3 py-2 text-amber-400">
                    {fmtUsd(v.outstanding)}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {fmtUsd(v.retainage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Sub</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Scheduled</th>
              <th className="px-3 py-2 font-medium">Completed (TD)</th>
              <th className="px-3 py-2 font-medium">Retainage</th>
              <th className="px-3 py-2 font-medium">Amount due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {reqs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-zinc-500">
                  No requisitions yet.
                </td>
              </tr>
            )}
            {reqs.map((r) => (
              <tr
                key={r.id}
                className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                onClick={() => onSelect(r)}
              >
                <td className="px-3 py-2 text-zinc-100">
                  {nameOfSub(r.sub_id)}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {fmtDate(r.period_start)} – {fmtDate(r.period_end)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(r.scheduled_value)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(r.work_completed_to_date)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {fmtUsd(r.retainage_held)}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-100">
                  {fmtUsd(r.amount_due)}
                </td>
                <td className={`px-3 py-2 text-xs ${REQ_STATUS_TEXT[r.status]}`}>
                  {REQ_STATUS_LABEL[r.status]}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this requisition?"))
                          onDelete(r.id);
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

      {editable && (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          New requisition
        </button>
      )}
    </div>
  );
}

function ReqModal({
  req,
  subOptions,
  editable,
  projectId,
  onClose,
  onUpdate,
  nameOfSub,
}: {
  req: SubRequisition;
  subOptions: SubOption[];
  editable: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<SubRequisition>) => Promise<void>;
  nameOfSub: (id: string | null) => string;
}) {
  const [checking, setChecking] = useState(false);
  const [overbillResult, setOverbillResult] = useState<{
    flagged: boolean;
    incompleteTaskNames: string[];
  } | null>(null);

  async function runOverbillingCheck() {
    if (!req.sub_id) {
      setOverbillResult({
        flagged: false,
        incompleteTaskNames: [],
      });
      return;
    }
    setChecking(true);
    try {
      const result = await checkOverbillingForSub(projectId, req.sub_id);
      setOverbillResult(result);
      if (result.flagged) {
        await postOverbillingAlert(
          projectId,
          nameOfSub(req.sub_id),
          result.incompleteTaskNames,
        );
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <ModalShell
      title={`Sub Requisition — ${nameOfSub(req.sub_id)}`}
      onClose={onClose}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Sub">
          <select
            value={req.sub_id ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(req.id, { sub_id: e.target.value || null })
            }
            className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
          >
            <option value="" className="bg-zinc-900">— Select —</option>
            {subOptions.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={req.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(req.id, { status: e.target.value as ReqStatus })
            }
            className={`cursor-pointer rounded bg-transparent px-1 py-1 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${REQ_STATUS_TEXT[req.status]}`}
          >
            {REQ_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                {REQ_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period start">
          <DateInput
            value={req.period_start}
            editable={editable}
            onChange={(v) => onUpdate(req.id, { period_start: v })}
          />
        </Field>
        <Field label="Period end">
          <DateInput
            value={req.period_end}
            editable={editable}
            onChange={(v) => onUpdate(req.id, { period_end: v })}
          />
        </Field>
        <Field label="Scheduled value">
          <NumberInput
            value={req.scheduled_value}
            editable={editable}
            onCommit={(v) => onUpdate(req.id, { scheduled_value: v })}
          />
        </Field>
        <Field label="Work completed (this period)">
          <NumberInput
            value={req.work_completed_this_period}
            editable={editable}
            onCommit={(v) =>
              onUpdate(req.id, { work_completed_this_period: v })
            }
          />
        </Field>
        <Field label="Work completed (to date)">
          <NumberInput
            value={req.work_completed_to_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(req.id, { work_completed_to_date: v })
            }
          />
        </Field>
        <Field label="Retainage held">
          <NumberInput
            value={req.retainage_held}
            editable={editable}
            onCommit={(v) => onUpdate(req.id, { retainage_held: v })}
          />
        </Field>
        <Field label="Amount due">
          <NumberInput
            value={req.amount_due}
            editable={editable}
            onCommit={(v) => onUpdate(req.id, { amount_due: v })}
          />
        </Field>
      </div>

      {/* Schedule cross-ref */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Schedule cross-reference
          </div>
          <button
            type="button"
            onClick={runOverbillingCheck}
            disabled={checking || !req.sub_id}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" />
            )}
            Check overbilling
          </button>
        </div>
        {overbillResult === null ? (
          <p className="text-xs text-zinc-500">
            Click the button to check this sub&apos;s assigned Schedule tasks
            against this requisition.
          </p>
        ) : overbillResult.flagged ? (
          <div className="flex items-start gap-2 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="font-medium">
                Overbilling flagged — alert written to global alerts table.
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {overbillResult.incompleteTaskNames.length} task(s) not marked
                complete:
                <ul className="ml-4 mt-1 list-disc">
                  {overbillResult.incompleteTaskNames.slice(0, 6).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {overbillResult.incompleteTaskNames.length > 6 && (
                    <li>…and {overbillResult.incompleteTaskNames.length - 6} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            All tasks assigned to this sub are marked complete.
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ---------- Change Orders (read-only mirror of Contracts data) ----------

function COSection({
  rows,
  nameOfSub,
}: {
  rows: ContractChangeOrder[];
  nameOfSub: (id: string | null) => string;
}) {
  const approvedTotal = useMemo(
    () =>
      rows
        .filter((co) => co.status === "approved")
        .reduce((sum, co) => sum + (Number(co.amount) || 0), 0),
    [rows],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-2">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Approved change orders total
        </span>
        <span className="text-base font-semibold text-emerald-400">
          {fmtUsd(approvedTotal)}
        </span>
      </div>

      <p className="text-xs italic text-zinc-500">
        Change orders are managed in the Contracts module. This is a read-only
        view shared with that table — edits there flow through here.
      </p>

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="w-12 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Affects</th>
              <th className="px-3 py-2 font-medium">Sub</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-zinc-500">
                  No change orders yet.
                </td>
              </tr>
            )}
            {rows.map((co) => (
              <tr key={co.id} className="border-b border-zinc-900">
                <td className="px-3 py-2 text-zinc-300">{co.co_number ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{fmtDate(co.co_date)}</td>
                <td className="px-3 py-2 text-zinc-100">
                  {co.description ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-200">{fmtUsd(co.amount)}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {[
                    co.affects_client_contract && "client",
                    co.affects_sub_contract && "sub",
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {co.affects_sub_contract ? nameOfSub(co.sub_id) : "—"}
                </td>
                <td className={`px-3 py-2 text-xs ${CO_STATUS_TEXT[co.status]}`}>
                  {CO_STATUS_LABEL[co.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Helpers / shared ----------

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
      <div className={`text-sm font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  onExportPdf,
  pdfLabel = "Export PDF",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onExportPdf?: () => void;
  pdfLabel?: string;
}) {
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
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <div className="flex items-center gap-2">
            {onExportPdf && (
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
                title="Coming soon"
              >
                <Download className="h-3.5 w-3.5" />
                {pdfLabel}
              </button>
            )}
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
        {children}
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

function NumberInput({
  value,
  editable,
  onCommit,
}: {
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
}) {
  if (!editable) {
    return (
      <span className="text-zinc-300">
        {value === null ? "—" : value}
      </span>
    );
  }
  return (
    <input
      type="number"
      step="0.01"
      defaultValue={value ?? ""}
      placeholder="—"
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === "") onCommit(null);
        else {
          const n = Number(v);
          if (!Number.isNaN(n) && n !== value) onCommit(n);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
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
  if (!editable)
    return <span className="text-zinc-300">{fmtDate(value)}</span>;
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

// Suppress unused — kept for future expansion of CO statuses in this view.
void CO_STATUSES;
