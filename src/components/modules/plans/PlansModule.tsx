"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Map,
  MessageSquare,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { canEdit, useRole, type Role } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  DRAWING_TYPE_LABEL,
  RFI_STATUSES,
  RFI_STATUS_LABEL,
  RFI_STATUS_TEXT,
  STANDARD_DRAWING_TYPES,
  SUBMITTAL_ACTION_REQUIRED,
  SUBMITTAL_STATUSES,
  SUBMITTAL_STATUS_LABEL,
  SUBMITTAL_STATUS_TEXT,
  type Drawing,
  type DrawingPin,
  type Rfi,
  type RfiStatus,
  type Submittal,
  type SubmittalStatus,
  type UserOption,
} from "./types";
import {
  clearDrawingPdf,
  createDrawing,
  createRfi,
  createSubmittal,
  deleteDrawing,
  deleteRfi,
  deleteSubmittal,
  fetchDrawings,
  fetchPins,
  fetchRfis,
  fetchSubmittals,
  fetchUserOptions,
  nextRfiNumber,
  nextSubmittalNumber,
  postRfiToMessages,
  uploadDrawingPdf,
  postSubmittalAlert,
  supersedeDrawing,
  updateDrawing,
  updateRfi,
  updateSubmittal,
  type DrawingPatch,
  type RfiPatch,
  type SubmittalPatch,
} from "./queries";

type Section = "drawings" | "rfis" | "submittals" | "annotations";

function canCreateRfi(role: Role): boolean {
  return role === "owner" || role === "pm" || role === "apm";
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PlansModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [section, setSection] = useState<Section>("drawings");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [pins, setPins] = useState<DrawingPin[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [d, r, s, p, u] = await Promise.all([
          fetchDrawings(projectId),
          fetchRfis(projectId),
          fetchSubmittals(projectId),
          fetchPins(projectId),
          fetchUserOptions(),
        ]);
        if (cancelled) return;
        setDrawings(d);
        setRfis(r);
        setSubmittals(s);
        setPins(p);
        setUsers(u);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Map className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Plans</h1>
      </div>

      {!editable && role === "apm" && (
        <p className="text-xs text-zinc-500">
          View-only — APM role can create RFIs but cannot edit drawings or
          submittals.
        </p>
      )}
      {!editable && role !== "apm" && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit Plans.
        </p>
      )}

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["drawings", "Drawings"],
            ["rfis", "RFIs"],
            ["submittals", "Submittals"],
            ["annotations", "Annotations"],
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

      {!loading && !error && section === "drawings" && (
        <DrawingsSection
          projectId={projectId}
          drawings={drawings}
          users={users}
          editable={editable}
          onUpdate={async (id, patch) => {
            const prev = drawings;
            setDrawings((rows) =>
              rows.map((d) => (d.id === id ? { ...d, ...patch } : d)),
            );
            try {
              await updateDrawing(id, patch);
            } catch (err) {
              setDrawings(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
          onAdd={async () => {
            try {
              const created = await createDrawing(projectId, {});
              setDrawings((rows) => [created, ...rows]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onUploadPdf={async (id, file) => {
            try {
              const url = await uploadDrawingPdf(projectId, id, file);
              setDrawings((rows) =>
                rows.map((d) => (d.id === id ? { ...d, pdf_url: url } : d)),
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            }
          }}
          onClearPdf={async (id) => {
            try {
              await clearDrawingPdf(id);
              setDrawings((rows) =>
                rows.map((d) => (d.id === id ? { ...d, pdf_url: null } : d)),
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          }}
          onUploadNew={async (file) => {
            try {
              const titleGuess = file.name
                .replace(/\.pdf$/i, "")
                .replace(/[_-]+/g, " ")
                .trim();
              const created = await createDrawing(projectId, {
                title: titleGuess || null,
              });
              const url = await uploadDrawingPdf(projectId, created.id, file);
              setDrawings((rows) => [
                { ...created, pdf_url: url },
                ...rows,
              ]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            }
          }}
          onAddRevision={async (existing) => {
            try {
              const created = await createDrawing(projectId, {
                drawing_number: existing.drawing_number,
                title: existing.title,
                type: existing.type,
                revision_number: bumpRev(existing.revision_number),
                revision_date: new Date().toISOString().slice(0, 10),
              });
              await supersedeDrawing(existing.id, created.id);
              setDrawings((rows) =>
                [
                  created,
                  ...rows.map((d) =>
                    d.id === existing.id
                      ? {
                          ...d,
                          status: "superseded" as const,
                          superseded_by: created.id,
                        }
                      : d,
                  ),
                ],
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to add revision",
              );
            }
          }}
          onDelete={async (id) => {
            const prev = drawings;
            setDrawings((rows) => rows.filter((d) => d.id !== id));
            try {
              await deleteDrawing(id);
            } catch (err) {
              setDrawings(prev);
              setError(
                err instanceof Error ? err.message : "Failed to delete",
              );
            }
          }}
        />
      )}

      {!loading && !error && section === "rfis" && (
        <RfisSection
          projectId={projectId}
          rfis={rfis}
          drawings={drawings}
          users={users}
          editable={editable}
          allowCreate={canCreateRfi(role)}
          onAdd={async () => {
            try {
              const number = await nextRfiNumber(projectId);
              const created = await createRfi(projectId, number, {});
              await postRfiToMessages(projectId, number, "");
              setRfis((rows) => [...rows, created]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onUpdate={async (id, patch) => {
            const prev = rfis;
            setRfis((rows) =>
              rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
            );
            try {
              await updateRfi(id, patch);
            } catch (err) {
              setRfis(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
          onDelete={async (id) => {
            const prev = rfis;
            setRfis((rows) => rows.filter((r) => r.id !== id));
            try {
              await deleteRfi(id);
            } catch (err) {
              setRfis(prev);
              setError(
                err instanceof Error ? err.message : "Failed to delete",
              );
            }
          }}
        />
      )}

      {!loading && !error && section === "submittals" && (
        <SubmittalsSection
          projectId={projectId}
          submittals={submittals}
          users={users}
          editable={editable}
          onAdd={async () => {
            try {
              const number = await nextSubmittalNumber(projectId);
              const created = await createSubmittal(projectId, number);
              setSubmittals((rows) => [...rows, created]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add");
            }
          }}
          onUpdate={async (id, patch) => {
            const prev = submittals;
            const before = prev.find((s) => s.id === id);
            setSubmittals((rows) =>
              rows.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            );
            try {
              await updateSubmittal(id, patch);
              // If status transitioned into rejected/resubmit_required, write alert.
              if (
                before &&
                patch.status &&
                patch.status !== before.status &&
                SUBMITTAL_ACTION_REQUIRED.includes(patch.status)
              ) {
                await postSubmittalAlert(
                  projectId,
                  { ...before, ...patch },
                  patch.status,
                );
              }
            } catch (err) {
              setSubmittals(prev);
              setError(err instanceof Error ? err.message : "Failed to save");
            }
          }}
          onDelete={async (id) => {
            const prev = submittals;
            setSubmittals((rows) => rows.filter((s) => s.id !== id));
            try {
              await deleteSubmittal(id);
            } catch (err) {
              setSubmittals(prev);
              setError(
                err instanceof Error ? err.message : "Failed to delete",
              );
            }
          }}
        />
      )}

      {!loading && !error && section === "annotations" && (
        <AnnotationsSection pins={pins} drawings={drawings} users={users} />
      )}
    </div>
  );
}

function bumpRev(current: string | null): string {
  // "0" → "1", "A" → "B", null → "1"
  if (!current) return "1";
  const trimmed = current.trim();
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) return String(asNum + 1);
  if (/^[A-Za-z]$/.test(trimmed)) {
    return String.fromCharCode(trimmed.charCodeAt(0) + 1);
  }
  return `${trimmed} (rev)`;
}

// ---------- Drawings section ----------

function DrawingsSection({
  projectId,
  drawings,
  users,
  editable,
  onAdd,
  onUpdate,
  onAddRevision,
  onDelete,
  onUploadPdf,
  onClearPdf,
  onUploadNew,
}: {
  projectId: string;
  drawings: Drawing[];
  users: UserOption[];
  editable: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: DrawingPatch) => Promise<void>;
  onAddRevision: (d: Drawing) => Promise<void>;
  onDelete: (id: string) => void;
  onUploadPdf: (id: string, file: File) => Promise<void>;
  onClearPdf: (id: string) => Promise<void>;
  onUploadNew: (file: File) => Promise<void>;
}) {
  void projectId;
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "current" | "superseded">(
    "current",
  );
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Drawing | null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);

  // Esc closes the inline PDF viewer
  useEffect(() => {
    if (!viewing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewing(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewing]);

  async function handleFiles(files: File[]) {
    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) return;
    setUploading(true);
    try {
      for (const f of pdfs) await onUploadNew(f);
    } finally {
      setUploading(false);
    }
  }

  const allTypes = useMemo(() => {
    const set = new Set<string>(STANDARD_DRAWING_TYPES);
    for (const d of drawings) if (d.type) set.add(d.type);
    return Array.from(set);
  }, [drawings]);

  const filtered = useMemo(() => {
    return drawings.filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [drawings, typeFilter, statusFilter]);

  function nameForUser(id: string | null): string {
    if (!id) return "—";
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  function historyFor(d: Drawing): Drawing[] {
    if (!d.drawing_number) return [d];
    return drawings
      .filter((x) => x.drawing_number === d.drawing_number)
      .sort((a, b) => (b.revision_date ?? "").localeCompare(a.revision_date ?? ""));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Type:</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="all">All types</option>
          {allTypes.map((t) => (
            <option key={t} value={t} className="bg-zinc-900">
              {DRAWING_TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </select>
        <span className="ml-3 text-zinc-500">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "current" | "superseded")
          }
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="current">Current only</option>
          <option value="superseded">Superseded</option>
          <option value="all">All</option>
        </select>
      </div>

      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => newFileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed py-5 text-sm transition ${
            dragOver
              ? "border-blue-500 bg-blue-500/5 text-blue-300"
              : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
          <span>
            Drop PDF plans here, or click to browse — multiple files at
            once create one drawing each
          </span>
          <input
            ref={newFileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(Array.from(e.target.files ?? []));
              if (newFileRef.current) newFileRef.current.value = "";
            }}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Rev</th>
              <th className="px-3 py-2 font-medium">Rev date</th>
              <th className="px-3 py-2 font-medium">Uploaded by</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">PDF</th>
              <th className="w-32 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-zinc-500">
                  No drawings match these filters.
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="group border-b border-zinc-900 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2">
                  <TextInput
                    value={d.drawing_number ?? ""}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(d.id, { drawing_number: v || null })
                    }
                    className="text-zinc-100"
                  />
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={d.title ?? ""}
                    editable={editable}
                    onCommit={(v) => onUpdate(d.id, { title: v || null })}
                    className="text-zinc-200"
                  />
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <select
                      value={d.type ?? ""}
                      onChange={(e) =>
                        onUpdate(d.id, { type: e.target.value || null })
                      }
                      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="bg-zinc-900">—</option>
                      {STANDARD_DRAWING_TYPES.map((t) => (
                        <option key={t} value={t} className="bg-zinc-900">
                          {DRAWING_TYPE_LABEL[t]}
                        </option>
                      ))}
                      {d.type &&
                        !STANDARD_DRAWING_TYPES.includes(
                          d.type as (typeof STANDARD_DRAWING_TYPES)[number],
                        ) && (
                          <option value={d.type} className="bg-zinc-900">
                            {DRAWING_TYPE_LABEL[d.type] ?? d.type}
                          </option>
                        )}
                    </select>
                  ) : (
                    <span className="text-zinc-300">
                      {d.type ? DRAWING_TYPE_LABEL[d.type] ?? d.type : "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={d.revision_number ?? ""}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(d.id, { revision_number: v || null })
                    }
                    className="text-zinc-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <DateInput
                    value={d.revision_date}
                    editable={editable}
                    onChange={(v) => onUpdate(d.id, { revision_date: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <UserSelect
                      value={d.uploaded_by}
                      users={users}
                      onChange={(v) => onUpdate(d.id, { uploaded_by: v })}
                    />
                  ) : (
                    <span className="text-zinc-300">
                      {nameForUser(d.uploaded_by)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      d.status === "current"
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    }
                  >
                    {d.status === "current" ? "Current" : "Superseded"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <PdfCell
                    drawingId={d.id}
                    pdfUrl={d.pdf_url}
                    editable={editable}
                    onUpload={onUploadPdf}
                    onClear={onClearPdf}
                    onView={() => setViewing(d)}
                  />
                </td>
                <td className="w-32 px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setShowHistoryFor(d.id)}
                      className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                      title="Revision history"
                      aria-label="Revision history"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    {editable && d.status === "current" && (
                      <button
                        type="button"
                        onClick={() => onAddRevision(d)}
                        className="rounded-md border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
                      >
                        + Rev
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Delete this drawing entry?"))
                            onDelete(d.id);
                        }}
                        className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
          Add drawing
        </button>
      )}

      <p className="text-xs italic text-zinc-500">
        Open a row to view the PDF inline. Pin tool and Ask AI are next.
      </p>

      {viewing && (
        <PdfViewer drawing={viewing} onClose={() => setViewing(null)} />
      )}

      {showHistoryFor && (
        <RevisionHistoryModal
          drawing={drawings.find((d) => d.id === showHistoryFor)!}
          history={historyFor(drawings.find((d) => d.id === showHistoryFor)!)}
          onClose={() => setShowHistoryFor(null)}
        />
      )}
    </div>
  );
}

function RevisionHistoryModal({
  drawing,
  history,
  onClose,
}: {
  drawing: Drawing;
  history: Drawing[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Revision history — {drawing.drawing_number || "(no number)"}
            </h2>
            <p className="text-xs text-zinc-500">{drawing.title ?? ""}</p>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-2 py-1.5 font-medium">Rev</th>
              <th className="px-2 py-1.5 font-medium">Date</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {history.map((d) => (
              <tr key={d.id} className="border-b border-zinc-900">
                <td className="px-2 py-1.5 text-zinc-200">
                  {d.revision_number ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {fmtDate(d.revision_date)}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      d.status === "current"
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    }
                  >
                    {d.status === "current" ? "Current" : "Superseded"}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {d.pdf_url ? (
                    <a
                      href={d.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- RFIs section ----------

function RfisSection({
  projectId,
  rfis,
  drawings,
  users,
  editable,
  allowCreate,
  onAdd,
  onUpdate,
  onDelete,
}: {
  projectId: string;
  rfis: Rfi[];
  drawings: Drawing[];
  users: UserOption[];
  editable: boolean;
  allowCreate: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: RfiPatch) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  void projectId;
  const [statusFilter, setStatusFilter] = useState<"all" | RfiStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      rfis.filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (assigneeFilter === "all" || r.assigned_to === assigneeFilter),
      ),
    [rfis, statusFilter, assigneeFilter],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | RfiStatus)
          }
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="all">All</option>
          {RFI_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {RFI_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="ml-3 text-zinc-500">Assignee:</span>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="all">All</option>
          {users.map((u) => (
            <option key={u.id} value={u.id} className="bg-zinc-900">
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="w-12 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Drawing</th>
              <th className="px-3 py-2 font-medium">Question</th>
              <th className="px-3 py-2 font-medium">Response</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-zinc-500">
                  No RFIs match these filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="group border-b border-zinc-900 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2 text-zinc-300">
                  {r.rfi_number ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <select
                      value={r.drawing_id ?? ""}
                      onChange={(e) =>
                        onUpdate(r.id, { drawing_id: e.target.value || null })
                      }
                      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="bg-zinc-900">—</option>
                      {drawings
                        .filter((d) => d.status === "current")
                        .map((d) => (
                          <option key={d.id} value={d.id} className="bg-zinc-900">
                            {d.drawing_number ?? "(no #)"} · {d.title ?? ""}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-zinc-300">
                      {drawings.find((d) => d.id === r.drawing_id)
                        ?.drawing_number ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={r.question ?? ""}
                    editable={editable}
                    onCommit={(v) => onUpdate(r.id, { question: v || null })}
                    className="text-zinc-200"
                  />
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={r.response ?? ""}
                    editable={editable}
                    placeholder="—"
                    onCommit={(v) => onUpdate(r.id, { response: v || null })}
                    className="text-zinc-300"
                  />
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <UserSelect
                      value={r.assigned_to}
                      users={users}
                      onChange={(v) => onUpdate(r.id, { assigned_to: v })}
                    />
                  ) : (
                    <span className="text-zinc-300">
                      {users.find((u) => u.id === r.assigned_to)?.name ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <select
                      value={r.status}
                      onChange={(e) =>
                        onUpdate(r.id, { status: e.target.value as RfiStatus })
                      }
                      className={`cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${RFI_STATUS_TEXT[r.status]}`}
                    >
                      {RFI_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                          {RFI_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={RFI_STATUS_TEXT[r.status]}>
                      {RFI_STATUS_LABEL[r.status]}
                    </span>
                  )}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this RFI?")) onDelete(r.id);
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

      {allowCreate && (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          New RFI
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <MessageSquare className="h-3 w-3" />
            Auto-posts to Messages
          </span>
        </button>
      )}
    </div>
  );
}

// ---------- Submittals section ----------

function SubmittalsSection({
  projectId,
  submittals,
  users,
  editable,
  onAdd,
  onUpdate,
  onDelete,
}: {
  projectId: string;
  submittals: Submittal[];
  users: UserOption[];
  editable: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: SubmittalPatch) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  void projectId;
  const [statusFilter, setStatusFilter] = useState<"all" | SubmittalStatus>(
    "all",
  );
  const [specFilter, setSpecFilter] = useState<string>("");

  const specs = useMemo(() => {
    const set = new Set<string>();
    for (const s of submittals) if (s.spec_section) set.add(s.spec_section);
    return Array.from(set).sort();
  }, [submittals]);

  const filtered = useMemo(
    () =>
      submittals.filter(
        (s) =>
          (statusFilter === "all" || s.status === statusFilter) &&
          (specFilter === "" || s.spec_section === specFilter),
      ),
    [submittals, statusFilter, specFilter],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | SubmittalStatus)
          }
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="all">All</option>
          {SUBMITTAL_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {SUBMITTAL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="ml-3 text-zinc-500">Spec section:</span>
        <select
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200"
        >
          <option value="">All</option>
          {specs.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="w-12 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-24 px-3 py-2 font-medium">Spec</th>
              <th className="px-3 py-2 font-medium">Submitted by</th>
              <th className="px-3 py-2 font-medium">Submitted to</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
              <th className="px-3 py-2 font-medium">Returned</th>
              <th className="w-12 px-3 py-2 font-medium">Rev</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">PDF</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-zinc-500">
                  No submittals match these filters.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="group border-b border-zinc-900 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2 text-zinc-300">
                  {s.submittal_number ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={s.description ?? ""}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(s.id, { description: v || null })
                    }
                    className="text-zinc-200"
                  />
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={s.spec_section ?? ""}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(s.id, { spec_section: v || null })
                    }
                    className="text-zinc-300"
                  />
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <UserSelect
                      value={s.submitted_by}
                      users={users}
                      onChange={(v) => onUpdate(s.id, { submitted_by: v })}
                    />
                  ) : (
                    <span className="text-zinc-300">
                      {users.find((u) => u.id === s.submitted_by)?.name ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TextInput
                    value={s.submitted_to ?? ""}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(s.id, { submitted_to: v || null })
                    }
                    className="text-zinc-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <DateInput
                    value={s.date_submitted}
                    editable={editable}
                    onChange={(v) => onUpdate(s.id, { date_submitted: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <DateInput
                    value={s.date_returned}
                    editable={editable}
                    onChange={(v) => onUpdate(s.id, { date_returned: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <NumberInput
                    value={s.revision_number}
                    editable={editable}
                    onCommit={(v) =>
                      onUpdate(s.id, { revision_number: v ?? 0 })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <select
                      value={s.status}
                      onChange={(e) =>
                        onUpdate(s.id, {
                          status: e.target.value as SubmittalStatus,
                        })
                      }
                      className={`cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${SUBMITTAL_STATUS_TEXT[s.status]}`}
                    >
                      {SUBMITTAL_STATUSES.map((st) => (
                        <option key={st} value={st} className="bg-zinc-900 text-zinc-100">
                          {SUBMITTAL_STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={SUBMITTAL_STATUS_TEXT[s.status]}>
                      {SUBMITTAL_STATUS_LABEL[s.status]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <TextInput
                      value={s.pdf_url ?? ""}
                      editable={editable}
                      placeholder="Paste link"
                      onCommit={(v) => onUpdate(s.id, { pdf_url: v || null })}
                      className="text-zinc-300"
                    />
                  ) : s.pdf_url ? (
                    <a
                      href={s.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="w-8 px-2 py-2 text-right">
                  {editable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this submittal?"))
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
          New submittal
        </button>
      )}
    </div>
  );
}

// ---------- Annotations section ----------

function AnnotationsSection({
  pins,
  drawings,
  users,
}: {
  pins: DrawingPin[];
  drawings: Drawing[];
  users: UserOption[];
}) {
  if (pins.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <Sparkles className="h-6 w-6 text-zinc-600" />
        <p className="text-sm text-zinc-400">
          No annotations yet. Drop pins from inside the drawing viewer (coming
          next iteration) to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Drawing</th>
            <th className="w-16 px-3 py-2 font-medium">Pin #</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th className="px-3 py-2 font-medium">Created by</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">RFI</th>
          </tr>
        </thead>
        <tbody>
          {pins.map((p) => {
            const drawing = drawings.find((d) => d.id === p.drawing_id);
            const user = users.find((u) => u.id === p.created_by);
            return (
              <tr key={p.id} className="border-b border-zinc-900">
                <td className="px-3 py-2 text-zinc-200">
                  {drawing
                    ? `${drawing.drawing_number ?? ""} ${drawing.title ?? ""}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">{p.pin_number ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-200">{p.note ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-300">{user?.name ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {fmtDate(p.created_at.slice(0, 10))}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {p.rfi_id ? "Linked" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Inputs ----------

function TextInput({
  value,
  editable,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => void;
  className?: string;
}) {
  if (!editable) {
    return (
      <span className={className}>
        {value ||
          (placeholder ? (
            <span className="text-zinc-500">{placeholder}</span>
          ) : null)}
      </span>
    );
  }
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`w-full cursor-text rounded bg-transparent px-1 py-0.5 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${className}`}
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
  if (!editable) return <span className="text-zinc-300">{value}</span>;
  return (
    <input
      type="number"
      defaultValue={value}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === "") onCommit(0);
        else {
          const n = Number(v);
          if (!Number.isNaN(n) && n !== value) onCommit(n);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full rounded bg-transparent px-1 py-0.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
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
    return <span className="text-zinc-400">{fmtDate(value)}</span>;
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function UserSelect({
  value,
  users,
  onChange,
}: {
  value: string | null;
  users: UserOption[];
  onChange: (next: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
    >
      <option value="" className="bg-zinc-900">—</option>
      {users.map((u) => (
        <option key={u.id} value={u.id} className="bg-zinc-900">
          {u.name}
        </option>
      ))}
    </select>
  );
}


function PdfCell({
  drawingId,
  pdfUrl,
  editable,
  onUpload,
  onClear,
  onView,
}: {
  drawingId: string;
  pdfUrl: string | null;
  editable: boolean;
  onUpload: (id: string, file: File) => Promise<void>;
  onClear: (id: string) => Promise<void>;
  onView: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick() {
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      await onUpload(drawingId, file);
    } finally {
      setBusy(false);
    }
  }

  if (!pdfUrl) {
    return editable ? (
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Upload className="h-3 w-3" />
        )}
        Upload PDF
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </button>
    ) : (
      <span className="text-zinc-500">—</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
        title="View inline"
      >
        Open
      </button>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title="Open in new tab"
        aria-label="Open in new tab"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
      {editable && (
        <>
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            title="Replace PDF"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Replace"}
          </button>
          <button
            type="button"
            onClick={() => onClear(drawingId)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            title="Remove PDF"
            aria-label="Remove PDF"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}

function PdfViewer({
  drawing,
  onClose,
}: {
  drawing: Drawing;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-5 py-3">
          <Map className="h-5 w-5 text-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-100">
              {drawing.title || "Untitled drawing"}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              {drawing.drawing_number && (
                <span>{drawing.drawing_number}</span>
              )}
              {drawing.type && (
                <span>{DRAWING_TYPE_LABEL[drawing.type] ?? drawing.type}</span>
              )}
              {drawing.revision_number && (
                <span>Rev {drawing.revision_number}</span>
              )}
            </div>
          </div>
          {drawing.pdf_url && (
            <a
              href={drawing.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              New tab
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close viewer"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-zinc-900">
          {drawing.pdf_url ? (
            <iframe
              src={`${drawing.pdf_url}#toolbar=1&navpanes=0`}
              title={drawing.title || "Drawing"}
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No PDF uploaded for this drawing yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
