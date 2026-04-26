"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Gavel, Plus, Trash2, X } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  INVITATION_STATUS_LABEL,
  INVITATION_STATUS_TEXT,
  REQUEST_STATUS_LABEL,
  fmtUsd,
  type BidInvitation,
  type BidInvitationStatus,
  type BidLineItem,
  type BidRequest,
  type BidRequestStatus,
  type SubOption,
} from "./types";
import {
  awardBid,
  createBidRequest,
  createLineItem,
  deleteBidRequest,
  deleteLineItem,
  fetchBidRequests,
  fetchInvitations,
  fetchLineItems,
  fetchProjectSubOptions,
  inviteSub,
  removeInvitation,
  updateBidRequest,
  updateInvitation,
  updateLineItem,
  type BidRequestPatch,
} from "./queries";

const REQUEST_STATUSES: BidRequestStatus[] = ["open", "awarded", "closed"];
const INVITATION_STATUSES: BidInvitationStatus[] = [
  "invited",
  "received",
  "declined",
  "awarded",
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BidSolicitationModule({
  projectId,
  hideHeader = false,
}: ModuleProps & { hideHeader?: boolean }) {
  const role = useRole();
  const editable = canEdit(role);
  const [requests, setRequests] = useState<BidRequest[]>([]);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BidRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [rows, subs] = await Promise.all([
          fetchBidRequests(projectId),
          fetchProjectSubOptions(projectId),
        ]);
        if (cancelled) return;
        setRequests(rows);
        setSubOptions(subs);
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

  async function handleAdd() {
    try {
      const created = await createBidRequest(projectId);
      setRequests((rows) => [created, ...rows]);
      setSelected(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function handleUpdate(id: string, patch: BidRequestPatch) {
    const prev = requests;
    setRequests((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    if (selected?.id === id) setSelected({ ...selected, ...patch });
    try {
      await updateBidRequest(id, patch);
    } catch (err) {
      setRequests(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(req: BidRequest) {
    const prev = requests;
    setRequests((rows) => rows.filter((r) => r.id !== req.id));
    if (selected?.id === req.id) setSelected(null);
    try {
      await deleteBidRequest(req.id);
    } catch (err) {
      setRequests(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <Gavel className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">Bid Solicitation</h1>
        </div>
      )}

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit bid requests.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Trade</th>
                  <th className="px-3 py-2 font-medium">Due date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-zinc-500">
                      No bid requests yet.
                    </td>
                  </tr>
                )}
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-3 py-2 text-zinc-100">
                      {r.trade_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(r.due_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {REQUEST_STATUS_LABEL[r.status]}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {fmtDate(r.created_at.slice(0, 10))}
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      {editable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this bid request?"))
                              handleDelete(r);
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
              onClick={handleAdd}
              className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-4 w-4" />
              New bid request
            </button>
          )}
        </>
      )}

      {selected && (
        <BidRequestModal
          request={selected}
          subOptions={subOptions}
          editable={editable}
          projectId={projectId}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

function BidRequestModal({
  request,
  subOptions,
  editable,
  projectId,
  onClose,
  onUpdate,
}: {
  request: BidRequest;
  subOptions: SubOption[];
  editable: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate: (id: string, patch: BidRequestPatch) => Promise<void>;
}) {
  const [invitations, setInvitations] = useState<BidInvitation[]>([]);
  const [lineItems, setLineItems] = useState<BidLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"detail" | "level">("detail");
  const [addSubId, setAddSubId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [invs, items] = await Promise.all([
          fetchInvitations(request.id),
          fetchLineItems(request.id),
        ]);
        if (!cancelled) {
          setInvitations(invs);
          setLineItems(items);
        }
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
  }, [request.id]);

  function nameOf(subId: string): string {
    return subOptions.find((s) => s.id === subId)?.name ?? "Unknown sub";
  }

  const availableSubs = subOptions.filter(
    (s) => !invitations.some((i) => i.sub_id === s.id),
  );

  async function handleInviteAdd() {
    if (!addSubId) return;
    try {
      const inv = await inviteSub(request.id, addSubId);
      setInvitations((rows) => [...rows, inv]);
      setAddSubId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    }
  }

  async function handleInviteRemove(id: string) {
    const prev = invitations;
    setInvitations((rows) => rows.filter((i) => i.id !== id));
    try {
      await removeInvitation(id);
    } catch (err) {
      setInvitations(prev);
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  async function handleInvitationUpdate(
    id: string,
    patch: { status?: BidInvitationStatus; base_bid?: number | null },
  ) {
    const prev = invitations;
    setInvitations((rows) =>
      rows.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    try {
      await updateInvitation(id, patch);
    } catch (err) {
      setInvitations(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleAward(inv: BidInvitation) {
    if (
      !window.confirm(
        `Award this bid to ${nameOf(inv.sub_id)}? A subcontractor agreement will be created in Contracts.`,
      )
    )
      return;
    try {
      await awardBid({
        invitationId: inv.id,
        bidRequestId: request.id,
        projectId,
        subId: inv.sub_id,
        baseBid: inv.base_bid,
        trade: request.trade_name,
        scopeOfWork: request.scope_of_work,
      });
      // Update local state
      setInvitations((rows) =>
        rows.map((i) =>
          i.id === inv.id ? { ...i, status: "awarded" } : i,
        ),
      );
      onUpdate(request.id, { status: "awarded" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to award");
    }
  }

  async function handleAddLineItem(subId: string) {
    const subItems = lineItems.filter((l) => l.sub_id === subId);
    const sortOrder = subItems.length;
    try {
      const created = await createLineItem(request.id, subId, sortOrder);
      setLineItems((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add line");
    }
  }

  async function handleUpdateLine(
    id: string,
    patch: { description?: string | null; amount?: number | null },
  ) {
    const prev = lineItems;
    setLineItems((rows) =>
      rows.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
    try {
      await updateLineItem(id, patch);
    } catch (err) {
      setLineItems(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDeleteLine(id: string) {
    const prev = lineItems;
    setLineItems((rows) => rows.filter((l) => l.id !== id));
    try {
      await deleteLineItem(id);
    } catch (err) {
      setLineItems(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
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
            {request.trade_name || "Bid request"}
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

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Trade name">
            <TextInput
              value={request.trade_name ?? ""}
              editable={editable}
              onCommit={(v) =>
                onUpdate(request.id, { trade_name: v || null })
              }
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={request.due_date ?? ""}
              disabled={!editable}
              onChange={(e) =>
                onUpdate(request.id, { due_date: e.target.value || null })
              }
              className="rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
            />
          </Field>
          <Field label="Status">
            <select
              value={request.status}
              disabled={!editable}
              onChange={(e) =>
                onUpdate(request.id, {
                  status: e.target.value as BidRequestStatus,
                })
              }
              className="cursor-pointer rounded bg-transparent px-1 py-1 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
            >
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-zinc-900">
                  {REQUEST_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Scope of work">
          <textarea
            defaultValue={request.scope_of_work ?? ""}
            disabled={!editable}
            onBlur={(e) => {
              const next = e.target.value;
              if ((request.scope_of_work ?? "") !== next) {
                onUpdate(request.id, { scope_of_work: next || null });
              }
            }}
            rows={3}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">
            Invited subs
          </h3>
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            {(["detail", "level"] as const).map((v) => {
              const active = v === view;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded px-3 py-1 capitalize transition ${
                    active
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v === "detail" ? "Detail" : "Level Sheet"}
                </button>
              );
            })}
          </div>
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">Error: {error}</p>}

        {!loading && !error && view === "detail" && (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border border-zinc-800">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2 font-medium">Sub</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Base bid</th>
                    <th className="px-3 py-2"></th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-zinc-500">
                        No subs invited yet.
                      </td>
                    </tr>
                  )}
                  {invitations.map((inv) => (
                    <tr
                      key={inv.id}
                      className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 text-zinc-100">
                        {nameOf(inv.sub_id)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={inv.status}
                          disabled={!editable}
                          onChange={(e) =>
                            handleInvitationUpdate(inv.id, {
                              status: e.target.value as BidInvitationStatus,
                            })
                          }
                          className={`cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${INVITATION_STATUS_TEXT[inv.status]}`}
                        >
                          {INVITATION_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                              {INVITATION_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <NumberInput
                          value={inv.base_bid}
                          editable={editable}
                          onCommit={(v) =>
                            handleInvitationUpdate(inv.id, { base_bid: v })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editable && inv.status !== "awarded" && (
                          <button
                            type="button"
                            onClick={() => handleAward(inv)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-600/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-600/20"
                          >
                            <Award className="h-3.5 w-3.5" />
                            Award
                          </button>
                        )}
                      </td>
                      <td className="w-8 px-2 py-2 text-right">
                        {editable && (
                          <button
                            type="button"
                            onClick={() => handleInviteRemove(inv.id)}
                            className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                            aria-label="Remove"
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

            {editable && availableSubs.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={addSubId}
                  onChange={(e) => setAddSubId(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Pick a sub to invite —</option>
                  {availableSubs.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-900">
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleInviteAdd}
                  disabled={!addSubId}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Invite
                </button>
              </div>
            )}
            {editable && availableSubs.length === 0 && subOptions.length > 0 && (
              <p className="text-xs text-zinc-500">All project subs invited.</p>
            )}
            {subOptions.length === 0 && (
              <p className="text-xs italic text-zinc-500">
                No subs added to this project yet — open the Subs module to add some.
              </p>
            )}

            {/* Per-sub line items */}
            {invitations.length > 0 && (
              <div className="mt-4 flex flex-col gap-4">
                <h4 className="text-xs uppercase tracking-wider text-zinc-500">
                  Line items
                </h4>
                {invitations.map((inv) => {
                  const subItems = lineItems.filter(
                    (l) => l.sub_id === inv.sub_id,
                  );
                  const total = subItems.reduce(
                    (sum, l) => sum + (Number(l.amount) || 0),
                    0,
                  );
                  return (
                    <div
                      key={inv.id}
                      className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-100">
                          {nameOf(inv.sub_id)}
                        </span>
                        <span className="text-zinc-400">
                          Total: {fmtUsd(total)}
                        </span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {subItems.length === 0 && (
                            <tr>
                              <td className="py-1 text-xs text-zinc-500">
                                No line items.
                              </td>
                            </tr>
                          )}
                          {subItems.map((item) => (
                            <tr key={item.id} className="group">
                              <td className="py-0.5 pr-2">
                                <TextInput
                                  value={item.description ?? ""}
                                  editable={editable}
                                  onCommit={(v) =>
                                    handleUpdateLine(item.id, {
                                      description: v || null,
                                    })
                                  }
                                />
                              </td>
                              <td className="w-32 py-0.5 px-2">
                                <NumberInput
                                  value={item.amount}
                                  editable={editable}
                                  onCommit={(v) =>
                                    handleUpdateLine(item.id, { amount: v })
                                  }
                                />
                              </td>
                              <td className="w-8 py-0.5 text-right">
                                {editable && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLine(item.id)}
                                    className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                                    aria-label="Delete line"
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
                          onClick={() => handleAddLineItem(inv.sub_id)}
                          className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-400"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add line item
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !error && view === "level" && (
          <LevelSheet
            invitations={invitations}
            lineItems={lineItems}
            subOptions={subOptions}
          />
        )}
      </div>
    </div>
  );
}

function LevelSheet({
  invitations,
  lineItems,
  subOptions,
}: {
  invitations: BidInvitation[];
  lineItems: BidLineItem[];
  subOptions: SubOption[];
}) {
  const subColumns = useMemo(
    () =>
      invitations.map((inv) => ({
        id: inv.sub_id,
        name: subOptions.find((s) => s.id === inv.sub_id)?.name ?? "Unknown",
      })),
    [invitations, subOptions],
  );

  // Build rows from the union of all descriptions across subs.
  const rows = useMemo(() => {
    const descs = Array.from(
      new Set(
        lineItems
          .map((l) => (l.description ?? "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    return descs.map((desc) => {
      const display =
        lineItems.find(
          (l) => (l.description ?? "").trim().toLowerCase() === desc,
        )?.description ?? desc;
      const amounts = subColumns.map((sub) => {
        const li = lineItems.find(
          (l) =>
            (l.description ?? "").trim().toLowerCase() === desc &&
            l.sub_id === sub.id,
        );
        return li?.amount ?? null;
      });
      return { description: display, amounts };
    });
  }, [lineItems, subColumns]);

  const totals = subColumns.map((sub) =>
    lineItems
      .filter((l) => l.sub_id === sub.id)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
  );

  if (subColumns.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Invite subs to see the level sheet.</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Add line items in Detail view — descriptions are matched across subs to
        build this sheet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Line item</th>
            {subColumns.map((sub) => (
              <th key={sub.id} className="px-3 py-2 text-right font-medium">
                {sub.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const present = row.amounts.filter(
              (a): a is number => a !== null,
            );
            const min = present.length > 0 ? Math.min(...present) : null;
            const max = present.length > 0 ? Math.max(...present) : null;
            return (
              <tr key={idx} className="border-b border-zinc-900">
                <td className="px-3 py-2 text-zinc-200">{row.description}</td>
                {row.amounts.map((amt, i) => {
                  let cls = "text-zinc-300";
                  if (amt === null) cls = "text-red-400";
                  else if (min !== null && amt === min && present.length > 1)
                    cls = "bg-emerald-600/10 text-emerald-300";
                  else if (max !== null && amt === max && present.length > 1)
                    cls = "bg-red-600/10 text-red-300";
                  return (
                    <td key={i} className={`px-3 py-2 text-right ${cls}`}>
                      {amt === null ? "missing" : fmtUsd(amt)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="bg-zinc-900/60 font-medium">
            <td className="px-3 py-2 text-zinc-300">Total</td>
            {totals.map((t, i) => (
              <td key={i} className="px-3 py-2 text-right text-zinc-100">
                {fmtUsd(t)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
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
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
}) {
  if (!editable) {
    return (
      <span className="text-zinc-300">
        {value === null ? "—" : fmtUsd(value)}
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
      className="w-full rounded bg-transparent px-1 py-1 text-right text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}
