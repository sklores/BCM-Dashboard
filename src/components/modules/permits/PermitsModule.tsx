"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Paperclip,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createInspection,
  createPermit,
  createThirdPartyInspection,
  deleteInspection,
  deletePermit,
  deleteThirdPartyInspection,
  fetchInspections,
  fetchInspectorContacts,
  fetchPermits,
  fetchScheduleMilestones,
  fetchThirdPartyInspections,
  postAlert,
  updateInspection,
  updatePermit,
  updateThirdPartyInspection,
  uploadInspectionFile,
  uploadPermitFile,
} from "./queries";
import {
  INSPECTION_RESULTS,
  INSPECTION_RESULT_LABEL,
  INSPECTION_RESULT_STYLE,
  PERMIT_STATUSES,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_STYLE,
  PERMIT_TYPES,
  PERMIT_TYPE_LABEL,
  THIRD_PARTY_RESULTS,
  THIRD_PARTY_RESULT_LABEL,
  THIRD_PARTY_RESULT_STYLE,
  daysUntil,
  fmtDate,
  fmtUsd,
  type Inspection,
  type InspectionPatch,
  type InspectionResult,
  type InspectorContactOption,
  type Permit,
  type PermitPatch,
  type PermitStatus,
  type PermitType,
  type ScheduleMilestone,
  type ThirdPartyInspection,
  type ThirdPartyInspectionPatch,
  type ThirdPartyResult,
} from "./types";

type Section = "permits" | "inspections" | "third_party" | "co";

export function PermitsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role) || role === "apm"; // APM full access per spec

  const [section, setSection] = useState<Section>("permits");
  const [permits, setPermits] = useState<Permit[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdPartyInspection[]>([]);
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);
  const [inspectorContacts, setInspectorContacts] = useState<
    InspectorContactOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openPermit, setOpenPermit] = useState<Permit | null>(null);
  const [openInspection, setOpenInspection] = useState<Inspection | null>(null);
  const [openTpi, setOpenTpi] = useState<ThirdPartyInspection | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [p, i, t, m, ic] = await Promise.all([
          fetchPermits(projectId),
          fetchInspections(projectId),
          fetchThirdPartyInspections(projectId),
          fetchScheduleMilestones(projectId),
          fetchInspectorContacts(projectId),
        ]);
        if (cancelled) return;
        setPermits(p);
        setInspections(i);
        setThirdParty(t);
        setMilestones(m);
        setInspectorContacts(ic);
        // Fire expiring-soon alerts on load
        await checkExpiringPermits(projectId, p);
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

  // ---- Permit CRUD ----

  async function handleAddPermit(parentId: string | null = null) {
    try {
      const created = await createPermit(projectId, {
        parent_permit_id: parentId,
      });
      setPermits((rows) => [...rows, created]);
      setOpenPermit(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add permit");
    }
  }

  async function handleUpdatePermit(id: string, patch: PermitPatch) {
    const prev = permits;
    setPermits((rows) => rows.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (openPermit?.id === id) setOpenPermit({ ...openPermit, ...patch });
    try {
      await updatePermit(id, patch);
    } catch (err) {
      setPermits(prev);
      setError(err instanceof Error ? err.message : "Failed to save permit");
    }
  }

  async function handleDeletePermit(id: string) {
    if (!window.confirm("Delete this permit and all its sub-permits and inspections?"))
      return;
    const prev = permits;
    setPermits((rows) =>
      rows.filter((p) => p.id !== id && p.parent_permit_id !== id),
    );
    setInspections((rows) => rows.filter((i) => i.permit_id !== id));
    if (openPermit?.id === id) setOpenPermit(null);
    try {
      await deletePermit(id);
    } catch (err) {
      setPermits(prev);
      setError(err instanceof Error ? err.message : "Failed to delete permit");
    }
  }

  // ---- Inspection CRUD ----

  async function handleAddInspection(permitId: string) {
    try {
      const created = await createInspection(projectId, permitId);
      setInspections((rows) => [created, ...rows]);
      setOpenInspection(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add inspection");
    }
  }

  async function handleUpdateInspection(
    id: string,
    patch: InspectionPatch,
  ) {
    const prev = inspections;
    const previous = prev.find((i) => i.id === id);
    setInspections((rows) =>
      rows.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    if (openInspection?.id === id)
      setOpenInspection({ ...openInspection, ...patch });
    try {
      await updateInspection(id, patch);
      // Failure alerts
      if (
        patch.result &&
        previous &&
        patch.result !== previous.result &&
        (patch.result === "failed" || patch.result === "reinspection")
      ) {
        const insp = { ...previous, ...patch };
        const permit = permits.find((p) => p.id === insp.permit_id);
        const permitLabel =
          permit?.permit_number || permit?.permit_type || "permit";
        const milestone = insp.schedule_milestone_id
          ? milestones.find((m) => m.id === insp.schedule_milestone_id)
          : null;
        const milestoneSuffix = milestone
          ? ` — Schedule milestone "${milestone.name}" flagged at risk`
          : "";
        const message = `Inspection ${INSPECTION_RESULT_LABEL[insp.result as InspectionResult].toLowerCase()}: ${insp.inspection_type ?? "(untyped)"} on ${permitLabel}${milestoneSuffix}`;
        await postAlert(projectId, "inspection_failed", message);
      }
    } catch (err) {
      setInspections(prev);
      setError(err instanceof Error ? err.message : "Failed to save inspection");
    }
  }

  async function handleDeleteInspection(id: string) {
    if (!window.confirm("Delete this inspection?")) return;
    const prev = inspections;
    setInspections((rows) => rows.filter((i) => i.id !== id));
    if (openInspection?.id === id) setOpenInspection(null);
    try {
      await deleteInspection(id);
    } catch (err) {
      setInspections(prev);
      setError(
        err instanceof Error ? err.message : "Failed to delete inspection",
      );
    }
  }

  // ---- Third party CRUD ----

  async function handleAddTpi() {
    try {
      const created = await createThirdPartyInspection(projectId);
      setThirdParty((rows) => [created, ...rows]);
      setOpenTpi(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add inspection");
    }
  }

  async function handleUpdateTpi(
    id: string,
    patch: ThirdPartyInspectionPatch,
  ) {
    const prev = thirdParty;
    const previous = prev.find((t) => t.id === id);
    setThirdParty((rows) =>
      rows.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    if (openTpi?.id === id) setOpenTpi({ ...openTpi, ...patch });
    try {
      await updateThirdPartyInspection(id, patch);
      if (
        patch.result === "failed" &&
        previous &&
        previous.result !== "failed"
      ) {
        const insp = { ...previous, ...patch };
        const message = `Third-party ${insp.inspection_type ?? "inspection"} failed${insp.company ? ` (${insp.company})` : ""}`;
        await postAlert(projectId, "third_party_inspection_failed", message);
      }
    } catch (err) {
      setThirdParty(prev);
      setError(err instanceof Error ? err.message : "Failed to save inspection");
    }
  }

  async function handleDeleteTpi(id: string) {
    if (!window.confirm("Delete this inspection?")) return;
    const prev = thirdParty;
    setThirdParty((rows) => rows.filter((t) => t.id !== id));
    if (openTpi?.id === id) setOpenTpi(null);
    try {
      await deleteThirdPartyInspection(id);
    } catch (err) {
      setThirdParty(prev);
      setError(
        err instanceof Error ? err.message : "Failed to delete inspection",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Permits</h1>
      </div>

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["permits", `Permits (${permits.length})`],
            ["inspections", `Inspections (${inspections.length})`],
            ["third_party", `Third Party (${thirdParty.length})`],
            ["co", "CO Tracker"],
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
          View only — your role ({role}) cannot edit permits.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && section === "permits" && (
        <PermitsSection
          permits={permits}
          inspections={inspections}
          editable={editable}
          onAddPermit={handleAddPermit}
          onOpenPermit={setOpenPermit}
          onDeletePermit={handleDeletePermit}
        />
      )}

      {!loading && !error && section === "inspections" && (
        <InspectionsSection
          permits={permits}
          inspections={inspections}
          editable={editable}
          onOpenInspection={setOpenInspection}
          onAddInspection={handleAddInspection}
        />
      )}

      {!loading && !error && section === "third_party" && (
        <ThirdPartySection
          inspections={thirdParty}
          inspectorContacts={inspectorContacts}
          editable={editable}
          onAdd={handleAddTpi}
          onOpen={setOpenTpi}
        />
      )}

      {!loading && !error && section === "co" && (
        <CoTracker permits={permits} inspections={inspections} />
      )}

      {openPermit && (
        <PermitModal
          permit={openPermit}
          permits={permits}
          inspections={inspections.filter(
            (i) => i.permit_id === openPermit.id,
          )}
          editable={editable}
          onClose={() => setOpenPermit(null)}
          onUpdate={handleUpdatePermit}
          onDelete={handleDeletePermit}
          projectId={projectId}
          onAddInspection={handleAddInspection}
          onOpenInspection={setOpenInspection}
        />
      )}

      {openInspection && (
        <InspectionModal
          inspection={openInspection}
          permits={permits}
          milestones={milestones}
          editable={editable}
          projectId={projectId}
          onClose={() => setOpenInspection(null)}
          onUpdate={handleUpdateInspection}
          onDelete={handleDeleteInspection}
        />
      )}

      {openTpi && (
        <ThirdPartyModal
          inspection={openTpi}
          inspectorContacts={inspectorContacts}
          editable={editable}
          projectId={projectId}
          onClose={() => setOpenTpi(null)}
          onUpdate={handleUpdateTpi}
          onDelete={handleDeleteTpi}
        />
      )}
    </div>
  );
}

// ---------- Permits Section ----------

function PermitsSection({
  permits,
  inspections,
  editable,
  onAddPermit,
  onOpenPermit,
  onDeletePermit,
}: {
  permits: Permit[];
  inspections: Inspection[];
  editable: boolean;
  onAddPermit: (parentId: string | null) => Promise<void>;
  onOpenPermit: (p: Permit) => void;
  onDeletePermit: (id: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<PermitStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<PermitType | "all">("all");

  const filtered = useMemo(
    () =>
      permits.filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (typeFilter !== "all" && p.permit_type !== typeFilter) return false;
        return true;
      }),
    [permits, statusFilter, typeFilter],
  );

  // Build hierarchy: masters and orphans first, sub-permits underneath
  const masters = filtered.filter((p) => !p.parent_permit_id);
  const subsByParent = new Map<string, Permit[]>();
  for (const p of filtered) {
    if (p.parent_permit_id) {
      const list = subsByParent.get(p.parent_permit_id) ?? [];
      list.push(p);
      subsByParent.set(p.parent_permit_id, list);
    }
  }

  function inspCount(permitId: string) {
    return inspections.filter((i) => i.permit_id === permitId).length;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PermitStatus | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All statuses</option>
          {PERMIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PERMIT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as PermitType | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All types</option>
          {PERMIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PERMIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {editable && (
          <button
            type="button"
            onClick={() => onAddPermit(null)}
            className="ml-auto flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add master permit
          </button>
        )}
      </div>

      {masters.length === 0 && (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No permits yet.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {masters.map((p) => (
          <div
            key={p.id}
            className="rounded-md border border-zinc-800 bg-zinc-900/40"
          >
            <PermitRow
              permit={p}
              isMaster
              inspectionCount={inspCount(p.id)}
              editable={editable}
              onOpen={onOpenPermit}
              onAddSub={() => onAddPermit(p.id)}
              onDelete={onDeletePermit}
            />
            {(subsByParent.get(p.id) ?? []).map((sub) => (
              <div
                key={sub.id}
                className="border-t border-zinc-800/60 pl-6"
              >
                <PermitRow
                  permit={sub}
                  inspectionCount={inspCount(sub.id)}
                  editable={editable}
                  onOpen={onOpenPermit}
                  onDelete={onDeletePermit}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PermitRow({
  permit,
  isMaster,
  inspectionCount,
  editable,
  onOpen,
  onAddSub,
  onDelete,
}: {
  permit: Permit;
  isMaster?: boolean;
  inspectionCount: number;
  editable: boolean;
  onOpen: (p: Permit) => void;
  onAddSub?: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const expDays = daysUntil(permit.expiration_date);
  const expiringSoon =
    permit.status === "issued" && expDays !== null && expDays >= 0 && expDays <= 30;
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onOpen(permit)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-300" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                isMaster ? "font-semibold text-zinc-100" : "text-zinc-200"
              }`}
            >
              {permit.permit_type
                ? PERMIT_TYPE_LABEL[permit.permit_type]
                : "Untyped"}
              {permit.permit_number ? ` · ${permit.permit_number}` : ""}
            </span>
            {isMaster && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-300">
                Master
              </span>
            )}
            {expiringSoon && (
              <span
                title={`Expires in ${expDays} day${expDays === 1 ? "" : "s"}`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300"
              >
                <AlertTriangle className="h-3 w-3" />
                Expiring
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
            {permit.jurisdiction && <span>{permit.jurisdiction}</span>}
            <span>
              Issued: <span className="text-zinc-400">{fmtDate(permit.issued_date)}</span>
            </span>
            <span>
              Exp: <span className="text-zinc-400">{fmtDate(permit.expiration_date)}</span>
            </span>
            <span>
              Insp:{" "}
              <span className="text-zinc-400">{inspectionCount}</span>
            </span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${PERMIT_STATUS_STYLE[permit.status]}`}
        >
          {PERMIT_STATUS_LABEL[permit.status]}
        </span>
      </button>
      {editable && onAddSub && (
        <button
          type="button"
          onClick={onAddSub}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 transition hover:border-blue-500 hover:text-blue-400"
          title="Add sub-permit"
        >
          + Sub
        </button>
      )}
      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(permit.id);
          }}
          className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
          aria-label="Delete permit"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------- Permit Modal ----------

function PermitModal({
  permit,
  permits,
  inspections,
  editable,
  projectId,
  onClose,
  onUpdate,
  onDelete,
  onAddInspection,
  onOpenInspection,
}: {
  permit: Permit;
  permits: Permit[];
  inspections: Inspection[];
  editable: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate: (id: string, patch: PermitPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddInspection: (permitId: string) => Promise<void>;
  onOpenInspection: (i: Inspection) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadPermitFile(projectId, permit.id, file);
      await onUpdate(permit.id, { pdf_url: url });
    } finally {
      setUploading(false);
    }
  }

  const parents = permits.filter(
    (p) => !p.parent_permit_id && p.id !== permit.id,
  );

  return (
    <Modal onClose={onClose} title={"Permit"} icon={ScrollText}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Permit type">
          <Select
            value={permit.permit_type ?? ""}
            editable={editable}
            options={[
              { value: "", label: "—" },
              ...PERMIT_TYPES.map((t) => ({
                value: t,
                label: PERMIT_TYPE_LABEL[t],
              })),
            ]}
            onChange={(v) =>
              onUpdate(permit.id, {
                permit_type: v === "" ? null : (v as PermitType),
              })
            }
          />
        </Field>
        <Field label="Status">
          <Select
            value={permit.status}
            editable={editable}
            options={PERMIT_STATUSES.map((s) => ({
              value: s,
              label: PERMIT_STATUS_LABEL[s],
            }))}
            onChange={(v) =>
              onUpdate(permit.id, { status: v as PermitStatus })
            }
          />
        </Field>
        <Field label="Permit number">
          <Input
            value={permit.permit_number ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(permit.id, { permit_number: v || null })
            }
          />
        </Field>
        <Field label="Jurisdiction">
          <Input
            value={permit.jurisdiction ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(permit.id, { jurisdiction: v || null })
            }
          />
        </Field>
        <Field label="Parent permit">
          <Select
            value={permit.parent_permit_id ?? ""}
            editable={editable}
            options={[
              { value: "", label: "— Master permit (no parent) —" },
              ...parents.map((p) => ({
                value: p.id,
                label:
                  (p.permit_type
                    ? PERMIT_TYPE_LABEL[p.permit_type]
                    : "Untyped") +
                  (p.permit_number ? ` · ${p.permit_number}` : ""),
              })),
            ]}
            onChange={(v) =>
              onUpdate(permit.id, {
                parent_permit_id: v === "" ? null : v,
              })
            }
          />
        </Field>
        <Field label="Fee">
          <NumberInput
            value={permit.fee}
            editable={editable}
            onCommit={(v) => onUpdate(permit.id, { fee: v })}
          />
        </Field>
        <Field label="Applied">
          <DateInput
            value={permit.applied_date}
            editable={editable}
            onCommit={(v) => onUpdate(permit.id, { applied_date: v })}
          />
        </Field>
        <Field label="Issued">
          <DateInput
            value={permit.issued_date}
            editable={editable}
            onCommit={(v) => onUpdate(permit.id, { issued_date: v })}
          />
        </Field>
        <Field label="Expiration">
          <DateInput
            value={permit.expiration_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(permit.id, { expiration_date: v })
            }
          />
        </Field>
      </div>

      <Field label="Notes" wide>
        <textarea
          defaultValue={permit.notes ?? ""}
          disabled={!editable}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (permit.notes ?? ""))
              onUpdate(permit.id, { notes: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>

      <Field label="Permit PDF" wide>
        <FileSlot
          url={permit.pdf_url}
          editable={editable}
          uploading={uploading}
          onUpload={handleUpload}
          onClear={() => onUpdate(permit.id, { pdf_url: null })}
        />
      </Field>

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-200">Inspections</h3>
          {editable && (
            <button
              type="button"
              onClick={() => onAddInspection(permit.id)}
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-3 w-3" />
              Add inspection
            </button>
          )}
        </div>
        {inspections.length === 0 ? (
          <p className="text-xs text-zinc-500">No inspections on this permit.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800/60 rounded-md border border-zinc-800">
            {inspections.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onOpenInspection(i)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-zinc-900"
                >
                  <ClipboardCheck className="h-4 w-4 text-zinc-500" />
                  <span className="flex-1 text-zinc-200">
                    {i.inspection_type ?? "Untyped"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {fmtDate(i.scheduled_date)}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] ${INSPECTION_RESULT_STYLE[i.result]}`}
                  >
                    {INSPECTION_RESULT_LABEL[i.result]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end border-t border-zinc-800 pt-3">
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(permit.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete permit
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Inspections Section ----------

function InspectionsSection({
  permits,
  inspections,
  editable,
  onOpenInspection,
  onAddInspection,
}: {
  permits: Permit[];
  inspections: Inspection[];
  editable: boolean;
  onOpenInspection: (i: Inspection) => void;
  onAddInspection: (permitId: string) => Promise<void>;
}) {
  const [resultFilter, setResultFilter] = useState<InspectionResult | "all">(
    "all",
  );
  const [permitFilter, setPermitFilter] = useState<string | "all">("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [createForPermit, setCreateForPermit] = useState<string>("");

  const filtered = useMemo(
    () =>
      inspections.filter((i) => {
        if (resultFilter !== "all" && i.result !== resultFilter) return false;
        if (permitFilter !== "all" && i.permit_id !== permitFilter) return false;
        if (from && i.scheduled_date && i.scheduled_date < from) return false;
        if (to && i.scheduled_date && i.scheduled_date > to) return false;
        return true;
      }),
    [inspections, resultFilter, permitFilter, from, to],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={permitFilter}
          onChange={(e) => setPermitFilter(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All permits</option>
          {permits.map((p) => (
            <option key={p.id} value={p.id}>
              {(p.permit_type ? PERMIT_TYPE_LABEL[p.permit_type] : "Untyped") +
                (p.permit_number ? ` · ${p.permit_number}` : "")}
            </option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) =>
            setResultFilter(e.target.value as InspectionResult | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All results</option>
          {INSPECTION_RESULTS.map((r) => (
            <option key={r} value={r}>
              {INSPECTION_RESULT_LABEL[r]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        />
        <span className="text-xs text-zinc-600">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        />
        {editable && permits.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <select
              value={createForPermit}
              onChange={(e) => setCreateForPermit(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
            >
              <option value="">Pick a permit…</option>
              {permits.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.permit_type
                    ? PERMIT_TYPE_LABEL[p.permit_type]
                    : "Untyped") +
                    (p.permit_number ? ` · ${p.permit_number}` : "")}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!createForPermit}
              onClick={() => {
                onAddInspection(createForPermit);
                setCreateForPermit("");
              }}
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              Add inspection
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No inspections matching the current filters.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Permit</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Inspector</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const permit = permits.find((p) => p.id === i.permit_id);
                return (
                  <tr
                    key={i.id}
                    onClick={() => onOpenInspection(i)}
                    className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 text-zinc-200">
                      {i.inspection_type ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {permit
                        ? (permit.permit_type
                            ? PERMIT_TYPE_LABEL[permit.permit_type]
                            : "Untyped") +
                          (permit.permit_number
                            ? ` · ${permit.permit_number}`
                            : "")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(i.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {i.inspector_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${INSPECTION_RESULT_STYLE[i.result]}`}
                      >
                        {INSPECTION_RESULT_LABEL[i.result]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Inspection Modal ----------

function InspectionModal({
  inspection,
  permits,
  milestones,
  editable,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: {
  inspection: Inspection;
  permits: Permit[];
  milestones: ScheduleMilestone[];
  editable: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate: (id: string, patch: InspectionPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadInspectionFile(
        projectId,
        inspection.id,
        file,
        "inspection",
      );
      await onUpdate(inspection.id, { correction_notice_url: url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Inspection" icon={ClipboardCheck}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inspection type" wide>
          <Input
            value={inspection.inspection_type ?? ""}
            editable={editable}
            placeholder="e.g. Framing rough, Final electrical"
            onCommit={(v) =>
              onUpdate(inspection.id, { inspection_type: v || null })
            }
          />
        </Field>
        <Field label="Parent permit">
          <Select
            value={inspection.permit_id}
            editable={false}
            options={permits.map((p) => ({
              value: p.id,
              label:
                (p.permit_type
                  ? PERMIT_TYPE_LABEL[p.permit_type]
                  : "Untyped") +
                (p.permit_number ? ` · ${p.permit_number}` : ""),
            }))}
            onChange={() => {}}
          />
        </Field>
        <Field label="Result">
          <Select
            value={inspection.result}
            editable={editable}
            options={INSPECTION_RESULTS.map((r) => ({
              value: r,
              label: INSPECTION_RESULT_LABEL[r],
            }))}
            onChange={(v) =>
              onUpdate(inspection.id, { result: v as InspectionResult })
            }
          />
        </Field>
        <Field label="Scheduled date">
          <DateInput
            value={inspection.scheduled_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(inspection.id, { scheduled_date: v })
            }
          />
        </Field>
        <Field label="Inspector name">
          <Input
            value={inspection.inspector_name ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(inspection.id, { inspector_name: v || null })
            }
          />
        </Field>
        <Field label="Linked milestone" wide>
          <Select
            value={inspection.schedule_milestone_id ?? ""}
            editable={editable}
            options={[
              { value: "", label: "— None —" },
              ...milestones.map((m) => ({
                value: m.id,
                label:
                  m.name +
                  (m.end_date ? ` · ${fmtDate(m.end_date)}` : ""),
              })),
            ]}
            onChange={(v) =>
              onUpdate(inspection.id, {
                schedule_milestone_id: v === "" ? null : v,
              })
            }
          />
        </Field>
      </div>

      <Field label="Notes" wide>
        <textarea
          defaultValue={inspection.notes ?? ""}
          disabled={!editable}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (inspection.notes ?? ""))
              onUpdate(inspection.id, { notes: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>

      <Field label="Correction notice" wide>
        <FileSlot
          url={inspection.correction_notice_url}
          editable={editable}
          uploading={uploading}
          onUpload={handleUpload}
          onClear={() =>
            onUpdate(inspection.id, { correction_notice_url: null })
          }
        />
      </Field>

      <div className="mt-4 flex justify-end border-t border-zinc-800 pt-3">
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(inspection.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete inspection
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Third Party Section ----------

function ThirdPartySection({
  inspections,
  inspectorContacts,
  editable,
  onAdd,
  onOpen,
}: {
  inspections: ThirdPartyInspection[];
  inspectorContacts: InspectorContactOption[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onOpen: (i: ThirdPartyInspection) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Hired inspection consultants — separate from municipal inspections.
        </p>
        {editable && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add inspection
          </button>
        )}
      </div>

      {inspectorContacts.length === 0 && (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
          No contacts with role "Inspector" yet — add them in the Contacts
          module to populate the inspector picker.
        </div>
      )}

      {inspections.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No third-party inspections yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Inspector</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Completed</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => {
                const c = inspectorContacts.find(
                  (x) => x.id === i.inspector_contact_id,
                );
                return (
                  <tr
                    key={i.id}
                    onClick={() => onOpen(i)}
                    className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 text-zinc-200">
                      {i.inspection_type ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {c?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {i.company ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(i.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(i.completed_date)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${THIRD_PARTY_RESULT_STYLE[i.result]}`}
                      >
                        {THIRD_PARTY_RESULT_LABEL[i.result]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThirdPartyModal({
  inspection,
  inspectorContacts,
  editable,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: {
  inspection: ThirdPartyInspection;
  inspectorContacts: InspectorContactOption[];
  editable: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: ThirdPartyInspectionPatch,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadInspectionFile(
        projectId,
        inspection.id,
        file,
        "third_party",
      );
      await onUpdate(inspection.id, { report_url: url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Third Party Inspection" icon={ShieldCheck}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inspection type" wide>
          <Input
            value={inspection.inspection_type ?? ""}
            editable={editable}
            placeholder="e.g. Structural special inspection"
            onCommit={(v) =>
              onUpdate(inspection.id, { inspection_type: v || null })
            }
          />
        </Field>
        <Field label="Inspector contact">
          <Select
            value={inspection.inspector_contact_id ?? ""}
            editable={editable}
            options={[
              { value: "", label: "— None —" },
              ...inspectorContacts.map((c) => ({
                value: c.id,
                label: c.name,
              })),
            ]}
            onChange={(v) =>
              onUpdate(inspection.id, {
                inspector_contact_id: v === "" ? null : v,
              })
            }
          />
        </Field>
        <Field label="Company">
          <Input
            value={inspection.company ?? ""}
            editable={editable}
            onCommit={(v) =>
              onUpdate(inspection.id, { company: v || null })
            }
          />
        </Field>
        <Field label="Result">
          <Select
            value={inspection.result}
            editable={editable}
            options={THIRD_PARTY_RESULTS.map((r) => ({
              value: r,
              label: THIRD_PARTY_RESULT_LABEL[r],
            }))}
            onChange={(v) =>
              onUpdate(inspection.id, { result: v as ThirdPartyResult })
            }
          />
        </Field>
        <Field label="Scheduled">
          <DateInput
            value={inspection.scheduled_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(inspection.id, { scheduled_date: v })
            }
          />
        </Field>
        <Field label="Completed">
          <DateInput
            value={inspection.completed_date}
            editable={editable}
            onCommit={(v) =>
              onUpdate(inspection.id, { completed_date: v })
            }
          />
        </Field>
      </div>

      <Field label="Notes" wide>
        <textarea
          defaultValue={inspection.notes ?? ""}
          disabled={!editable}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (inspection.notes ?? ""))
              onUpdate(inspection.id, { notes: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>

      <Field label="Report PDF" wide>
        <FileSlot
          url={inspection.report_url}
          editable={editable}
          uploading={uploading}
          onUpload={handleUpload}
          onClear={() => onUpdate(inspection.id, { report_url: null })}
        />
      </Field>

      <div className="mt-4 flex justify-end border-t border-zinc-800 pt-3">
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(inspection.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete inspection
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------- CO Tracker ----------

function CoTracker({
  permits,
  inspections,
}: {
  permits: Permit[];
  inspections: Inspection[];
}) {
  const total = inspections.length;
  const passed = inspections.filter((i) => i.result === "passed").length;
  const failed = inspections.filter((i) => i.result === "failed").length;
  const reinsp = inspections.filter((i) => i.result === "reinspection").length;
  const open = total - passed;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);

  const openList = inspections.filter((i) => i.result !== "passed");
  const failedList = inspections.filter(
    (i) => i.result === "failed" || i.result === "reinspection",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            Path to Certificate of Occupancy
          </h2>
          <span className="text-sm text-zinc-400">{pct}% complete</span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500/70 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total inspections" value={total} />
          <Stat label="Passed" value={passed} tone="emerald" />
          <Stat label="Failed" value={failed} tone="red" />
          <Stat label="Open" value={open} tone="amber" />
        </div>

        {reinsp > 0 && (
          <p className="mt-3 text-xs text-orange-300">
            {reinsp} inspection{reinsp === 1 ? "" : "s"} pending re-inspection.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Open inspections blocking CO"
          empty="All inspections passed — clear path to CO."
          rows={openList.map((i) => ({
            id: i.id,
            label: i.inspection_type ?? "Untyped inspection",
            sub:
              (permits.find((p) => p.id === i.permit_id)?.permit_number ?? "") +
              (i.scheduled_date ? ` · ${fmtDate(i.scheduled_date)}` : ""),
            status: INSPECTION_RESULT_LABEL[i.result],
            tone: INSPECTION_RESULT_STYLE[i.result],
          }))}
        />
        <ListCard
          title="Failed / re-inspection required"
          empty="No failed inspections."
          rows={failedList.map((i) => ({
            id: i.id,
            label: i.inspection_type ?? "Untyped inspection",
            sub:
              (permits.find((p) => p.id === i.permit_id)?.permit_number ?? "") +
              (i.scheduled_date ? ` · ${fmtDate(i.scheduled_date)}` : ""),
            status: INSPECTION_RESULT_LABEL[i.result],
            tone: INSPECTION_RESULT_STYLE[i.result],
          }))}
        />
      </div>

      <p className="text-xs text-zinc-600">
        Total fees on the project:{" "}
        <span className="text-zinc-400">
          {fmtUsd(
            permits.reduce((acc, p) => acc + (Number(p.fee) || 0), 0),
          )}
        </span>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "red" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-zinc-100";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function ListCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    label: string;
    sub: string;
    status: string;
    tone: string;
  }>;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-800/60">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-zinc-200">{r.label}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {r.sub}
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] ${r.tone}`}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Reusable bits ----------

function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: typeof ScrollText;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-[11px] uppercase tracking-wider text-zinc-500 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function Input({
  value,
  editable,
  placeholder,
  onCommit,
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (!editable) {
    return (
      <span className="block min-h-[1.5rem] text-zinc-200">
        {value || <span className="text-zinc-500">—</span>}
      </span>
    );
  }

  return (
    <input
      type="text"
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
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  if (!editable) {
    return (
      <span className="block text-zinc-200">{fmtUsd(value)}</span>
    );
  }

  return (
    <input
      type="number"
      step="0.01"
      min="0"
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
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function DateInput({
  value,
  editable,
  onCommit,
}: {
  value: string | null;
  editable: boolean;
  onCommit: (next: string | null) => void;
}) {
  if (!editable) {
    return <span className="block text-zinc-200">{fmtDate(value)}</span>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onCommit(e.target.value === "" ? null : e.target.value)}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function Select({
  value,
  editable,
  options,
  onChange,
}: {
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  if (!editable) {
    const match = options.find((o) => o.value === value);
    return (
      <span className="block text-zinc-200">{match?.label ?? "—"}</span>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FileSlot({
  url,
  editable,
  uploading,
  onUpload,
  onClear,
}: {
  url: string | null;
  editable: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-blue-300 hover:bg-zinc-900"
        >
          <Paperclip className="h-4 w-4" />
          View attachment
        </a>
      ) : (
        <span className="flex-1 text-sm text-zinc-500">No file uploaded.</span>
      )}
      {editable && (
        <>
          <label className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />
                {url ? "Replace" : "Upload"}
              </span>
            )}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              onClick={onClear}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              title="Remove attachment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Helpers ----------

async function checkExpiringPermits(
  projectId: string,
  permits: Permit[],
): Promise<void> {
  const issued = permits.filter(
    (p) => p.status === "issued" && p.expiration_date,
  );
  for (const p of issued) {
    const days = daysUntil(p.expiration_date);
    if (days !== null && days >= 0 && days <= 30) {
      try {
        await postAlert(
          projectId,
          "permit_expiring_soon",
          `Permit ${p.permit_number ?? "(no number)"} expires in ${days} day${days === 1 ? "" : "s"}`,
        );
      } catch {
        // ignore — alerts are best-effort
      }
    }
  }
}
