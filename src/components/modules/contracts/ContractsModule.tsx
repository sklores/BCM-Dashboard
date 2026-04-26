"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSignature,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  CONTRACT_TYPE_LABEL,
  CO_STATUS_LABEL,
  CO_STATUS_TEXT,
  PRIME_STATUS_LABEL,
  SUB_STATUS_LABEL,
  fmtUsd,
  type ChangeOrder,
  type ChangeOrderStatus,
  type ContractType,
  type PrimeContract,
  type PrimeStatus,
  type SubAgreement,
  type SubAgreementLineItem,
  type SubAgreementStatus,
  type SubOption,
} from "./types";
import {
  createChangeOrder,
  createPrime,
  createSubAgreement,
  createSubLineItem,
  deleteChangeOrder,
  deletePrime,
  deleteSubAgreement,
  deleteSubLineItem,
  fetchChangeOrders,
  fetchPrimeContracts,
  fetchProjectAddress,
  fetchProjectSubOptions,
  fetchSubAgreements,
  fetchSubLineItems,
  updateChangeOrder,
  updatePrime,
  updateSubAgreement,
  updateSubLineItem,
} from "./queries";

type Section = "prime" | "sub" | "co";

const CONTRACT_TYPES: ContractType[] = [
  "lump_sum",
  "cost_plus_fixed",
  "cost_plus_percent",
  "gmp",
  "tnm",
];

const PRIME_STATUSES: PrimeStatus[] = ["draft", "executed", "complete"];
const SUB_STATUSES: SubAgreementStatus[] = [
  "draft",
  "sent",
  "signed",
  "fully_executed",
];
const CO_STATUSES: ChangeOrderStatus[] = [
  "pending",
  "approved",
  "rejected",
  "in_dispute",
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContractsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [section, setSection] = useState<Section>("prime");
  const [primes, setPrimes] = useState<PrimeContract[]>([]);
  const [subs, setSubs] = useState<SubAgreement[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [projectAddress, setProjectAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPrime, setOpenPrime] = useState<PrimeContract | null>(null);
  const [openSub, setOpenSub] = useState<SubAgreement | null>(null);
  const [openCO, setOpenCO] = useState<ChangeOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [p, s, co, opts, addr] = await Promise.all([
          fetchPrimeContracts(projectId),
          fetchSubAgreements(projectId),
          fetchChangeOrders(projectId),
          fetchProjectSubOptions(projectId),
          fetchProjectAddress(projectId),
        ]);
        if (cancelled) return;
        setPrimes(p);
        setSubs(s);
        setChangeOrders(co);
        setSubOptions(opts);
        setProjectAddress(addr);
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

  // When the BidSolicitation module created a sub agreement during this
  // session, it won't appear here unless we refetch — give a manual refresh.
  async function reloadSubs() {
    try {
      const s = await fetchSubAgreements(projectId);
      setSubs(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  }

  function nameOfSub(subId: string | null): string {
    if (!subId) return "—";
    return subOptions.find((s) => s.id === subId)?.name ?? "Unknown sub";
  }

  const approvedCoTotal = useMemo(
    () =>
      changeOrders
        .filter((co) => co.status === "approved")
        .reduce((sum, co) => sum + (Number(co.amount) || 0), 0),
    [changeOrders],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <FileSignature className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Contracts</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit contracts.
        </p>
      )}

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["prime", "Prime Contracts"],
            ["sub", "Subcontractor Agreements"],
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

      {!loading && !error && section === "prime" && (
        <PrimeSection
          rows={primes}
          editable={editable}
          onAdd={async () => {
            try {
              const created = await createPrime(projectId);
              setPrimes((rows) => [created, ...rows]);
              setOpenPrime(created);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onSelect={setOpenPrime}
          onDelete={async (id) => {
            const prev = primes;
            setPrimes((rows) => rows.filter((p) => p.id !== id));
            try {
              await deletePrime(id);
            } catch (err) {
              setPrimes(prev);
              setError(err instanceof Error ? err.message : "Failed to delete");
            }
          }}
        />
      )}

      {!loading && !error && section === "sub" && (
        <SubSection
          rows={subs}
          subOptions={subOptions}
          editable={editable}
          onRefresh={reloadSubs}
          onAdd={async () => {
            try {
              const created = await createSubAgreement(projectId);
              setSubs((rows) => [created, ...rows]);
              setOpenSub(created);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onSelect={setOpenSub}
          onDelete={async (id) => {
            const prev = subs;
            setSubs((rows) => rows.filter((s) => s.id !== id));
            try {
              await deleteSubAgreement(id);
            } catch (err) {
              setSubs(prev);
              setError(err instanceof Error ? err.message : "Failed to delete");
            }
          }}
          nameOfSub={nameOfSub}
        />
      )}

      {!loading && !error && section === "co" && (
        <COSection
          rows={changeOrders}
          subOptions={subOptions}
          editable={editable}
          approvedTotal={approvedCoTotal}
          onAdd={async () => {
            const nextNumber =
              (changeOrders.reduce(
                (m, co) => Math.max(m, co.co_number ?? 0),
                0,
              ) ?? 0) + 1;
            try {
              const created = await createChangeOrder(projectId, nextNumber);
              setChangeOrders((rows) => [...rows, created]);
              setOpenCO(created);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onSelect={setOpenCO}
          onDelete={async (id) => {
            const prev = changeOrders;
            setChangeOrders((rows) => rows.filter((co) => co.id !== id));
            try {
              await deleteChangeOrder(id);
            } catch (err) {
              setChangeOrders(prev);
              setError(err instanceof Error ? err.message : "Failed to delete");
            }
          }}
          nameOfSub={nameOfSub}
        />
      )}

      {openPrime && (
        <PrimeModal
          contract={openPrime}
          editable={editable}
          projectAddress={projectAddress}
          onClose={() => setOpenPrime(null)}
          onUpdate={async (id, patch) => {
            const prev = primes;
            setPrimes((rows) =>
              rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            );
            if (openPrime?.id === id) setOpenPrime({ ...openPrime, ...patch });
            try {
              await updatePrime(id, patch);
            } catch (err) {
              setPrimes(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
        />
      )}

      {openSub && (
        <SubModal
          agreement={openSub}
          subOptions={subOptions}
          editable={editable}
          onClose={() => setOpenSub(null)}
          onUpdate={async (id, patch) => {
            const prev = subs;
            setSubs((rows) =>
              rows.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            );
            if (openSub?.id === id) setOpenSub({ ...openSub, ...patch });
            try {
              await updateSubAgreement(id, patch);
            } catch (err) {
              setSubs(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
        />
      )}

      {openCO && (
        <COModal
          changeOrder={openCO}
          subOptions={subOptions}
          editable={editable}
          onClose={() => setOpenCO(null)}
          onUpdate={async (id, patch) => {
            const prev = changeOrders;
            setChangeOrders((rows) =>
              rows.map((co) => (co.id === id ? { ...co, ...patch } : co)),
            );
            if (openCO?.id === id) setOpenCO({ ...openCO, ...patch });
            try {
              await updateChangeOrder(id, patch);
            } catch (err) {
              setChangeOrders(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
        />
      )}
    </div>
  );
}

// ---------- Prime Contracts ----------

function PrimeSection({
  rows,
  editable,
  onAdd,
  onSelect,
  onDelete,
}: {
  rows: PrimeContract[];
  editable: boolean;
  onAdd: () => void;
  onSelect: (p: PrimeContract) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-zinc-500">
                  No prime contracts yet.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr
                key={p.id}
                className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                onClick={() => onSelect(p)}
              >
                <td className="px-3 py-2 text-zinc-200">
                  {p.contract_number ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-100">{p.client_name ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {p.contract_type ? CONTRACT_TYPE_LABEL[p.contract_type] : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-200">
                  {fmtUsd(p.original_contract_value)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {PRIME_STATUS_LABEL[p.status]}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this prime contract?"))
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
          New prime contract
        </button>
      )}
    </div>
  );
}

function PrimeModal({
  contract,
  editable,
  projectAddress,
  onClose,
  onUpdate,
}: {
  contract: PrimeContract;
  editable: boolean;
  projectAddress: string | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<PrimeContract>) => Promise<void>;
}) {
  return (
    <ModalShell
      title={`Prime Contract — ${contract.contract_number || "Untitled"}`}
      onClose={onClose}
      onExportPdf={() => {}}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Contract number">
          <TextInput
            value={contract.contract_number ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(contract.id, { contract_number: v || null })
            }
          />
        </Field>
        <Field label="Status">
          <select
            value={contract.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(contract.id, { status: e.target.value as PrimeStatus })
            }
            className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
          >
            {PRIME_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">
                {PRIME_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client name">
          <TextInput
            value={contract.client_name ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(contract.id, { client_name: v || null })}
          />
        </Field>
        <Field label="Project address (read-only)">
          <span className="text-zinc-300">{projectAddress ?? "—"}</span>
        </Field>
        <Field label="Contract type">
          <select
            value={contract.contract_type ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(contract.id, {
                contract_type: (e.target.value || null) as ContractType | null,
              })
            }
            className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
          >
            <option value="" className="bg-zinc-900">— Select —</option>
            {CONTRACT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-zinc-900">
                {CONTRACT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Original contract value">
          <NumberInput
            value={contract.original_contract_value}
            editable={editable}
            onCommit={(v) =>
              onUpdate(contract.id, { original_contract_value: v })
            }
          />
        </Field>
        <Field label="Retainage %">
          <NumberInput
            value={contract.retainage_percentage}
            editable={editable}
            onCommit={(v) =>
              onUpdate(contract.id, { retainage_percentage: v })
            }
          />
        </Field>
        <Field label="Start date">
          <DateInput
            value={contract.start_date}
            editable={editable}
            onChange={(v) => onUpdate(contract.id, { start_date: v })}
          />
        </Field>
        <Field label="Substantial completion">
          <DateInput
            value={contract.substantial_completion_date}
            editable={editable}
            onChange={(v) =>
              onUpdate(contract.id, { substantial_completion_date: v })
            }
          />
        </Field>
        <Field label="Final completion">
          <DateInput
            value={contract.final_completion_date}
            editable={editable}
            onChange={(v) =>
              onUpdate(contract.id, { final_completion_date: v })
            }
          />
        </Field>
      </div>

      <Field label="Scope of work">
        <Textarea
          value={contract.scope_of_work ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(contract.id, { scope_of_work: v || null })}
        />
      </Field>
      <Field label="Inclusions">
        <Textarea
          value={contract.inclusions ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(contract.id, { inclusions: v || null })}
        />
      </Field>
      <Field label="Exclusions">
        <Textarea
          value={contract.exclusions ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(contract.id, { exclusions: v || null })}
        />
      </Field>
      <Field label="PDF attachment URL (paste OneDrive link)">
        <TextInput
          value={contract.pdf_url ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(contract.id, { pdf_url: v || null })}
        />
      </Field>
    </ModalShell>
  );
}

// ---------- Subcontractor Agreements ----------

function SubSection({
  rows,
  subOptions,
  editable,
  onAdd,
  onSelect,
  onDelete,
  onRefresh,
  nameOfSub,
}: {
  rows: SubAgreement[];
  subOptions: SubOption[];
  editable: boolean;
  onAdd: () => void;
  onSelect: (s: SubAgreement) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  nameOfSub: (id: string | null) => string;
}) {
  void subOptions;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-zinc-500 hover:text-zinc-200"
        >
          Refresh — pull in agreements created from Bid Solicitation awards
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">Sub</th>
              <th className="px-3 py-2 font-medium">Trade</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-zinc-500">
                  No subcontractor agreements yet.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr
                key={s.id}
                className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                onClick={() => onSelect(s)}
              >
                <td className="px-3 py-2 text-zinc-200">
                  {s.contract_number ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-100">
                  {nameOfSub(s.sub_id)}
                </td>
                <td className="px-3 py-2 text-zinc-300">{s.trade ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-200">
                  {fmtUsd(s.contract_value)}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {SUB_STATUS_LABEL[s.status]}
                  {s.bid_request_id && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400">
                      from bid
                    </span>
                  )}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this agreement?"))
                          onDelete(s.id);
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
          New subcontractor agreement
        </button>
      )}
    </div>
  );
}

function SubModal({
  agreement,
  subOptions,
  editable,
  onClose,
  onUpdate,
}: {
  agreement: SubAgreement;
  subOptions: SubOption[];
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<SubAgreement>) => Promise<void>;
}) {
  const [items, setItems] = useState<SubAgreementLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchSubLineItems(agreement.id);
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agreement.id]);

  async function addLine() {
    try {
      const created = await createSubLineItem(agreement.id, items.length);
      setItems((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function updateLine(
    id: string,
    patch: Partial<SubAgreementLineItem>,
  ) {
    const prev = items;
    setItems((rows) =>
      rows.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    try {
      await updateSubLineItem(id, patch);
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function deleteLine(id: string) {
    const prev = items;
    setItems((rows) => rows.filter((it) => it.id !== id));
    try {
      await deleteSubLineItem(id);
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <ModalShell
      title={`Subcontractor Agreement — ${agreement.contract_number || "Untitled"}`}
      onClose={onClose}
      onExportPdf={() => {}}
    >
      {/* V2 NOTE: DocuSign send + signature tracking integration. */}
      {/* V2 NOTE: Outlook automatic sending of executed agreements. */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Contract number">
          <TextInput
            value={agreement.contract_number ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(agreement.id, { contract_number: v || null })
            }
          />
        </Field>
        <Field label="Status">
          <select
            value={agreement.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(agreement.id, {
                status: e.target.value as SubAgreementStatus,
              })
            }
            className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
          >
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">
                {SUB_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub">
          <select
            value={agreement.sub_id ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(agreement.id, { sub_id: e.target.value || null })
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
        <Field label="Trade">
          <TextInput
            value={agreement.trade ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(agreement.id, { trade: v || null })}
          />
        </Field>
        <Field label="Contract value">
          <NumberInput
            value={agreement.contract_value}
            editable={editable}
            onCommit={(v) => onUpdate(agreement.id, { contract_value: v })}
          />
        </Field>
        <Field label="Retainage %">
          <NumberInput
            value={agreement.retainage_percentage}
            editable={editable}
            onCommit={(v) =>
              onUpdate(agreement.id, { retainage_percentage: v })
            }
          />
        </Field>
        <Field label="Start date">
          <DateInput
            value={agreement.start_date}
            editable={editable}
            onChange={(v) => onUpdate(agreement.id, { start_date: v })}
          />
        </Field>
        <Field label="Completion date">
          <DateInput
            value={agreement.completion_date}
            editable={editable}
            onChange={(v) => onUpdate(agreement.id, { completion_date: v })}
          />
        </Field>
      </div>

      <Field label="Scope of work">
        <Textarea
          value={agreement.scope_of_work ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(agreement.id, { scope_of_work: v || null })}
        />
      </Field>

      <Field label="PDF attachment URL">
        <TextInput
          value={agreement.pdf_url ?? ""}
          editable={editable}
          onCommit={(v) => onUpdate(agreement.id, { pdf_url: v || null })}
        />
      </Field>

      <div className="text-xs uppercase tracking-wider text-zinc-500">
        Schedule of values
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-2 py-1.5 font-medium">Description</th>
            <th className="w-32 px-2 py-1.5 text-right font-medium">Value</th>
            <th className="w-8 px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="px-2 py-2 text-zinc-500">
                No line items yet.
              </td>
            </tr>
          )}
          {items.map((it) => (
            <tr key={it.id} className="group border-b border-zinc-900">
              <td className="px-2 py-1">
                <TextInput
                  value={it.description ?? ""}
                  editable={editable}
                  onCommit={(v) => updateLine(it.id, { description: v || null })}
                />
              </td>
              <td className="px-2 py-1">
                <NumberInput
                  value={it.value}
                  editable={editable}
                  onCommit={(v) => updateLine(it.id, { value: v })}
                />
              </td>
              <td className="px-2 py-1 text-right">
                {editable && (
                  <button
                    type="button"
                    onClick={() => deleteLine(it.id)}
                    className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button
          type="button"
          onClick={addLine}
          className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Add line item
        </button>
      )}
    </ModalShell>
  );
}

// ---------- Change Orders ----------

function COSection({
  rows,
  subOptions,
  editable,
  approvedTotal,
  onAdd,
  onSelect,
  onDelete,
  nameOfSub,
}: {
  rows: ChangeOrder[];
  subOptions: SubOption[];
  editable: boolean;
  approvedTotal: number;
  onAdd: () => void;
  onSelect: (co: ChangeOrder) => void;
  onDelete: (id: string) => void;
  nameOfSub: (id: string | null) => string;
}) {
  void subOptions;
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
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-zinc-500">
                  No change orders yet.
                </td>
              </tr>
            )}
            {rows.map((co) => (
              <tr
                key={co.id}
                className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                onClick={() => onSelect(co)}
              >
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
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this change order?"))
                          onDelete(co.id);
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
          New change order
        </button>
      )}
    </div>
  );
}

function COModal({
  changeOrder,
  subOptions,
  editable,
  onClose,
  onUpdate,
}: {
  changeOrder: ChangeOrder;
  subOptions: SubOption[];
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ChangeOrder>) => Promise<void>;
}) {
  return (
    <ModalShell
      title={`Change Order #${changeOrder.co_number ?? "—"}`}
      onClose={onClose}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="CO number">
          <NumberInput
            value={changeOrder.co_number}
            editable={editable}
            onCommit={(v) =>
              onUpdate(changeOrder.id, { co_number: v ?? null })
            }
          />
        </Field>
        <Field label="Date">
          <DateInput
            value={changeOrder.co_date}
            editable={editable}
            onChange={(v) => onUpdate(changeOrder.id, { co_date: v })}
          />
        </Field>
        <Field label="Amount">
          <NumberInput
            value={changeOrder.amount}
            editable={editable}
            onCommit={(v) => onUpdate(changeOrder.id, { amount: v })}
          />
        </Field>
        <Field label="Status">
          <select
            value={changeOrder.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(changeOrder.id, {
                status: e.target.value as ChangeOrderStatus,
              })
            }
            className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
          >
            {CO_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">
                {CO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Affects client contract">
          <input
            type="checkbox"
            checked={changeOrder.affects_client_contract}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(changeOrder.id, {
                affects_client_contract: e.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          />
        </Field>
        <Field label="Affects sub contract">
          <input
            type="checkbox"
            checked={changeOrder.affects_sub_contract}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(changeOrder.id, {
                affects_sub_contract: e.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          />
        </Field>
        {changeOrder.affects_sub_contract && (
          <Field label="Sub affected">
            <select
              value={changeOrder.sub_id ?? ""}
              disabled={!editable}
              onChange={(e) =>
                onUpdate(changeOrder.id, { sub_id: e.target.value || null })
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
        )}
      </div>
      <Field label="Description">
        <Textarea
          value={changeOrder.description ?? ""}
          editable={editable}
          onCommit={(v) =>
            onUpdate(changeOrder.id, { description: v || null })
          }
        />
      </Field>
      {/* V2 NOTE: When approved, write revised contract value to Billing module. */}
    </ModalShell>
  );
}

// ---------- Shared inputs / shell ----------

function ModalShell({
  title,
  children,
  onClose,
  onExportPdf,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onExportPdf?: () => void;
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
                Export PDF
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
