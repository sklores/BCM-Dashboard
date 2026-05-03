"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  Minimize2,
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
  EXTRACTION_CATEGORY_DOT,
  RFI_STATUSES,
  RFI_STATUS_LABEL,
  RFI_STATUS_TEXT,
  STANDARD_DRAWING_TYPES,
  SUBMITTAL_ACTION_REQUIRED,
  SUBMITTAL_STATUSES,
  SUBMITTAL_STATUS_LABEL,
  SUBMITTAL_STATUS_TEXT,
  type Drawing,
  type DrawingExtraction,
  type DrawingPin,
  type ExtractionCategory,
  type GeneralNote,
  type Rfi,
  type RfiStatus,
  type Submittal,
  type SubmittalStatus,
  type UserOption,
} from "./types";
import {
  clearDrawingPdf,
  createDrawing,
  ensurePlansShareToken,
  createRfi,
  createSubmittal,
  deleteDrawing,
  deleteRfi,
  deleteSubmittal,
  fetchDrawings,
  fetchExtractions,
  fetchPins,
  fetchRfis,
  fetchSubmittals,
  fetchUserOptions,
  nextRfiNumber,
  nextSubmittalNumber,
  postRfiToMessages,
  uploadDrawingPdf,
  postSubmittalAlert,
  createGeneralNote,
  deleteGeneralNote,
  fetchGeneralNotes,
  pushExtractionToContractors,
  pushExtractionToGeneralNotes,
  pushExtractionToMaterials,
  pushExtractionToNotes,
  pushExtractionToPermits,
  pushExtractionToSchedule,
  updateGeneralNote,
  runExtractDrawing,
  runTitleBlockRead,
  supersedeDrawing,
  updateDrawing,
  updateExtraction,
  updateRfi,
  updateSubmittal,
  type DrawingPatch,
  type RfiPatch,
  type SubmittalPatch,
} from "./queries";

type Section =
  | "drawings"
  | "rfis"
  | "submittals"
  | "annotations"
  | "general_notes";

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
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    forDrawingId: string | null;
  } | null>(null);
  const [extracting, setExtracting] = useState<Drawing | null>(null);
  const [generalNotes, setGeneralNotes] = useState<GeneralNote[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [d, r, s, p, u, gn] = await Promise.all([
          fetchDrawings(projectId),
          fetchRfis(projectId),
          fetchSubmittals(projectId),
          fetchPins(projectId),
          fetchUserOptions(projectId),
          fetchGeneralNotes(projectId),
        ]);
        if (cancelled) return;
        setDrawings(d);
        setRfis(r);
        setSubmittals(s);
        setPins(p);
        setUsers(u);
        setGeneralNotes(gn);
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

  async function commitVerifiedUpload(verifiedBy: string, verifiedDate: string) {
    if (!pendingUpload) return;
    const { file, forDrawingId } = pendingUpload;
    setPendingUpload(null);
    try {
      if (forDrawingId) {
        const url = await uploadDrawingPdf(projectId, forDrawingId, file);
        await updateDrawing(forDrawingId, {
          pdf_url: url,
          upload_verified_by: verifiedBy.trim() || null,
          upload_verified_date: verifiedDate || null,
        });
        setDrawings((rows) =>
          rows.map((d) =>
            d.id === forDrawingId
              ? {
                  ...d,
                  pdf_url: url,
                  upload_verified_by: verifiedBy.trim() || null,
                  upload_verified_date: verifiedDate || null,
                }
              : d,
          ),
        );
        runTitleBlockRead(forDrawingId, url)
          .then(async () => {
            const fresh = await fetchDrawings(projectId);
            setDrawings(fresh);
          })
          .catch(() => {});
        return;
      }
      const titleGuess = file.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const created = await createDrawing(projectId, {
        title: titleGuess || null,
        upload_verified_by: verifiedBy.trim() || null,
        upload_verified_date: verifiedDate || null,
      });
      const url = await uploadDrawingPdf(projectId, created.id, file);
      await updateDrawing(created.id, { pdf_url: url });
      setDrawings((rows) => [{ ...created, pdf_url: url }, ...rows]);
      runTitleBlockRead(created.id, url)
        .then(async () => {
          const fresh = await fetchDrawings(projectId);
          setDrawings(fresh);
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleShareCurrentSet() {
    try {
      const token = await ensurePlansShareToken(projectId);
      const url = `${window.location.origin}/share/plans/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setError(null);
        setShareInfo(`Copied: ${url}`);
        setTimeout(() => setShareInfo(null), 5000);
      } catch {
        setShareInfo(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <MapIcon className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Plans</h1>
        <button
          type="button"
          onClick={handleShareCurrentSet}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          title="Copy a public link to the current set"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Share current set
        </button>
      </div>
      {shareInfo && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          {shareInfo}
        </div>
      )}

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
            ["general_notes", "General Notes"],
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
            // Defer until the verify modal is confirmed.
            setPendingUpload({ file, forDrawingId: id });
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
          onExtract={(d) => setExtracting(d)}
          onUploadNew={async (file) => {
            // Defer the actual upload until the user verifies date + uploader.
            setPendingUpload({ file, forDrawingId: null });
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

      {!loading && !error && section === "general_notes" && (
        <GeneralNotesSection
          notes={generalNotes}
          drawings={drawings}
          editable={editable}
          onAdd={async () => {
            try {
              const created = await createGeneralNote(projectId, "");
              setGeneralNotes((rows) => [created, ...rows]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          }}
          onUpdate={async (id, body) => {
            setGeneralNotes((rows) =>
              rows.map((n) => (n.id === id ? { ...n, body } : n)),
            );
            try {
              await updateGeneralNote(id, body);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          }}
          onDelete={async (id) => {
            const prev = generalNotes;
            setGeneralNotes((rows) => rows.filter((n) => n.id !== id));
            try {
              await deleteGeneralNote(id);
            } catch (err) {
              setGeneralNotes(prev);
              setError(err instanceof Error ? err.message : "Failed");
            }
          }}
        />
      )}

      {extracting && (
        <ExtractionReviewPanel
          projectId={projectId}
          drawing={extracting}
          editable={editable}
          onClose={() => setExtracting(null)}
          onDrawingUpdated={(d) =>
            setDrawings((rows) =>
              rows.map((x) => (x.id === d.id ? { ...x, ...d } : x)),
            )
          }
        />
      )}

      {pendingUpload && (
        <UploadVerifyModal
          fileName={pendingUpload.file.name}
          onCancel={() => setPendingUpload(null)}
          onConfirm={commitVerifiedUpload}
        />
      )}
    </div>
  );
}

function UploadVerifyModal({
  fileName,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  onCancel: () => void;
  onConfirm: (uploadedBy: string, uploadedDate: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-100">
          Verify upload
        </h2>
        <p className="mt-1 text-xs text-zinc-500 break-all">{fileName}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              Uploader name *
            </span>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is uploading this?"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              Upload date *
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || !date}
            onClick={() => onConfirm(name, date)}
            className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
          >
            Confirm &amp; upload
          </button>
        </div>
      </div>
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
  onExtract,
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
  onExtract: (d: Drawing) => void;
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
                <td className="w-44 px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {d.title_block_read && (
                      <span
                        title="Title block auto-read by Claude Vision"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-violet-300"
                      >
                        <Sparkles className="h-3 w-3" />
                        AI
                      </span>
                    )}
                    {d.pdf_url && editable && (
                      <button
                        type="button"
                        onClick={() => onExtract(d)}
                        className="rounded-md border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
                        title={
                          d.extraction_status === "complete"
                            ? "View extractions"
                            : "Extract drawing data"
                        }
                      >
                        {d.extraction_status === "complete"
                          ? "View"
                          : d.extraction_status === "processing"
                            ? "Processing…"
                            : "Extract"}
                      </button>
                    )}
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
  const [fullscreen, setFullscreen] = useState(false);

  // Sync state when the user exits browser fullscreen via Esc / browser UI.
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fullscreen) {
        setFullscreen(false);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFsChange);
  }, [fullscreen]);

  // Exit browser fullscreen if the viewer is dismissed while in FS.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  async function toggleFullscreen() {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* request can be rejected; the in-app overlay still applies */
    }
  }

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
          <MapIcon className="h-5 w-5 text-blue-400" />
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
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
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

function ExtractionReviewPanel({
  projectId,
  drawing,
  editable,
  onClose,
  onDrawingUpdated,
}: {
  projectId: string;
  drawing: Drawing;
  editable: boolean;
  onClose: () => void;
  onDrawingUpdated: (d: Drawing) => void;
}) {
  const [items, setItems] = useState<DrawingExtraction[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExtractions(drawing.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawing.id]);

  async function handleRun() {
    if (!drawing.pdf_url) return;
    setRunning(true);
    setErr(null);
    try {
      const inserted = await runExtractDrawing(drawing.id, drawing.pdf_url);
      const all = await fetchExtractions(drawing.id);
      setItems(all);
      onDrawingUpdated({
        ...drawing,
        extraction_status: "complete",
        extraction_completed_at: new Date().toISOString(),
      });
      // suppress unused param to match React-pattern friendliness
      void inserted;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Extraction failed");
      onDrawingUpdated({ ...drawing, extraction_status: "error" });
    } finally {
      setRunning(false);
    }
  }

  async function patch(id: string, p: Parameters<typeof updateExtraction>[1]) {
    setItems((rows) =>
      rows.map((it) => (it.id === id ? { ...it, ...p } : it)),
    );
    try {
      await updateExtraction(id, p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function pushToMaterials(it: DrawingExtraction) {
    try {
      await pushExtractionToMaterials(projectId, drawing, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_materials: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }
  async function pushToNotes(it: DrawingExtraction) {
    try {
      await pushExtractionToNotes(projectId, drawing, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_notes: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }
  async function pushToSchedule(it: DrawingExtraction) {
    try {
      await pushExtractionToSchedule(projectId, drawing, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_schedule: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }
  async function pushToContractors(it: DrawingExtraction) {
    try {
      await pushExtractionToContractors(drawing, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_contractors: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }
  async function pushToPermits(it: DrawingExtraction) {
    try {
      await pushExtractionToPermits(projectId, drawing, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_permits: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }
  async function pushToGeneralNotes(it: DrawingExtraction) {
    try {
      await pushExtractionToGeneralNotes(projectId, drawing.id, it);
      setItems((rows) =>
        rows.map((x) =>
          x.id === it.id ? { ...x, pushed_to_general_notes: true } : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed");
    }
  }

  function toggle(cat: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      DrawingExtraction[]
    >();
    for (const it of items) {
      const c = it.category ?? "Other";
      const arr = map.get(c) ?? [];
      arr.push(it);
      map.set(c, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      confirmed: items.filter((i) => i.status === "confirmed").length,
      rejected: items.filter((i) => i.status === "rejected").length,
      mat: items.filter((i) => i.pushed_to_materials).length,
      sched: items.filter((i) => i.pushed_to_schedule).length,
      notes: items.filter((i) => i.pushed_to_notes).length,
    };
  }, [items]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-5 py-3">
        <MapIcon className="h-5 w-5 text-blue-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-100">
            {drawing.title || "Untitled drawing"}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            {drawing.drawing_number && <span>{drawing.drawing_number}</span>}
            {drawing.scale && <span>Scale {drawing.scale}</span>}
            {drawing.title_block_read && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 text-[10px] uppercase tracking-wider text-violet-300">
                <Sparkles className="h-3 w-3" />
                AI title block
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span>Total {summary.total}</span>
          <span className="text-emerald-400">Confirmed {summary.confirmed}</span>
          <span className="text-red-400">Rejected {summary.rejected}</span>
          <span>→ Materials {summary.mat}</span>
          <span>→ Notes {summary.notes}</span>
          <span>→ Schedule {summary.sched}</span>
        </div>
        {editable && (
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !drawing.pdf_url}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {items.length === 0
              ? "Extract drawing data"
              : running
                ? "Analyzing…"
                : "Re-extract"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* PDF */}
        <div className="min-h-0 flex-1 bg-zinc-900">
          {drawing.pdf_url ? (
            <iframe
              src={`${drawing.pdf_url}#toolbar=1&navpanes=0`}
              title={drawing.title || "Drawing"}
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No PDF uploaded yet — upload one first to enable extraction.
            </div>
          )}
        </div>

        {/* Extractions sidebar */}
        <aside className="flex w-[28rem] shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
          {running && (
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-blue-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing drawing — this may take 30 seconds…
            </div>
          )}
          {err && (
            <div className="border-b border-zinc-800 bg-red-500/5 px-4 py-2 text-xs text-red-300">
              {err}
              {drawing.pdf_url && (
                <button
                  type="button"
                  onClick={handleRun}
                  className="ml-2 underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {loading && !running && (
            <p className="px-4 py-3 text-xs text-zinc-500">Loading…</p>
          )}
          {!loading && !running && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <Sparkles className="h-6 w-6 text-blue-400" />
              <p className="text-sm text-zinc-200">
                No extractions yet for this drawing.
              </p>
              <p className="text-xs text-zinc-500">
                Click <strong>Extract drawing data</strong> above to have
                Claude read every labeled element on the sheet.
              </p>
            </div>
          )}
          {!loading && grouped.length > 0 && (
            <div className="flex flex-col">
              {grouped.map(([cat, list]) => {
                const isCollapsed = collapsed.has(cat);
                const dot =
                  EXTRACTION_CATEGORY_DOT[
                    cat as ExtractionCategory
                  ] ?? "bg-zinc-500";
                return (
                  <div
                    key={cat}
                    className="border-b border-zinc-800/60 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(cat)}
                      className="flex w-full items-center gap-2 bg-zinc-900/40 px-3 py-2 text-left"
                    >
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                        {cat}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-500">
                        {list.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="flex flex-col">
                        {list.map((it) => (
                          <ExtractionRow
                            key={it.id}
                            it={it}
                            editable={editable}
                            onPatch={patch}
                            onPushToMaterials={pushToMaterials}
                            onPushToNotes={pushToNotes}
                            onPushToSchedule={pushToSchedule}
                            onPushToContractors={pushToContractors}
                            onPushToPermits={pushToPermits}
                            onPushToGeneralNotes={pushToGeneralNotes}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ExtractionRow({
  it,
  editable,
  onPatch,
  onPushToMaterials,
  onPushToNotes,
  onPushToSchedule,
  onPushToContractors,
  onPushToPermits,
  onPushToGeneralNotes,
}: {
  it: DrawingExtraction;
  editable: boolean;
  onPatch: (id: string, p: Parameters<typeof updateExtraction>[1]) => Promise<void>;
  onPushToMaterials: (it: DrawingExtraction) => Promise<void>;
  onPushToNotes: (it: DrawingExtraction) => Promise<void>;
  onPushToSchedule: (it: DrawingExtraction) => Promise<void>;
  onPushToContractors: (it: DrawingExtraction) => Promise<void>;
  onPushToPermits: (it: DrawingExtraction) => Promise<void>;
  onPushToGeneralNotes: (it: DrawingExtraction) => Promise<void>;
}) {
  // Suppress lint warning for the legacy notes push that's no longer wired
  // through any UI affordance.
  void onPushToNotes;
  const [labelDraft, setLabelDraft] = useState(it.label ?? "");
  useEffect(() => setLabelDraft(it.label ?? ""), [it.label]);
  const c = it.confidence ?? 0;
  const conf = c >= 0.8 ? "bg-emerald-400" : c >= 0.5 ? "bg-yellow-400" : "bg-red-400";

  const dimmed = it.status === "rejected";
  return (
    <li
      className={`border-b border-zinc-800/40 px-3 py-2.5 ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${conf}`} title="Confidence" />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={labelDraft}
            disabled={!editable || it.status === "rejected"}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => {
              if (labelDraft !== (it.label ?? ""))
                onPatch(it.id, { label: labelDraft });
            }}
            className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-medium text-zinc-100 outline-none focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
          {it.description && (
            <p className="mt-0.5 line-clamp-2 px-1 text-[11px] text-zinc-400">
              {it.description}
            </p>
          )}
          {it.location_description && (
            <p className="mt-0.5 px-1 text-[10px] text-zinc-600">
              📍 {it.location_description}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {it.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => onPatch(it.id, { status: "confirmed" })}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onPatch(it.id, { status: "rejected" })}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
              >
                Reject
              </button>
            </>
          )}
          {it.status === "confirmed" && (
            <>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0 text-[10px] text-emerald-300">
                Confirmed
              </span>
              <button
                type="button"
                onClick={() => onPushToContractors(it)}
                disabled={it.pushed_to_contractors}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                {it.pushed_to_contractors ? "✓ Contractors" : "→ Contractors"}
              </button>
              <button
                type="button"
                onClick={() => onPushToMaterials(it)}
                disabled={it.pushed_to_materials}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                {it.pushed_to_materials ? "✓ Materials" : "→ Materials"}
              </button>
              <button
                type="button"
                onClick={() => onPushToPermits(it)}
                disabled={it.pushed_to_permits}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                {it.pushed_to_permits ? "✓ Permits" : "→ Permits"}
              </button>
              <button
                type="button"
                onClick={() => onPushToGeneralNotes(it)}
                disabled={it.pushed_to_general_notes}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                {it.pushed_to_general_notes ? "✓ General Notes" : "→ General Notes"}
              </button>
              <button
                type="button"
                onClick={() => onPushToSchedule(it)}
                disabled={it.pushed_to_schedule}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                {it.pushed_to_schedule ? "✓ Schedule" : "→ Schedule"}
              </button>
            </>
          )}
          {it.status === "rejected" && (
            <button
              type="button"
              onClick={() => onPatch(it.id, { status: "pending" })}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-blue-500 hover:text-blue-400"
            >
              Restore
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function GeneralNotesSection({
  notes,
  drawings,
  editable,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: GeneralNote[];
  drawings: Drawing[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onUpdate: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          A jot-list for items that don't fit on a drawing or in another module.
          Push extracted items here from the drawing review panel.
        </p>
        {editable && (
          <button
            type="button"
            onClick={() => {
              void onAdd();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" /> Add note
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <Sparkles className="h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">No general notes yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const drawing = n.drawing_id
              ? drawings.find((d) => d.id === n.drawing_id)
              : null;
            return (
              <li
                key={n.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <div className="flex items-center gap-2">
                    {drawing && (
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-400">
                        {drawing.drawing_number ?? "—"}{" "}
                        {drawing.title ? `· ${drawing.title}` : ""}
                      </span>
                    )}
                    {n.source && (
                      <span className="text-zinc-600">{n.source}</span>
                    )}
                    <span className="text-zinc-600">
                      {fmtDate(n.created_at.slice(0, 10))}
                    </span>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => {
                        void onDelete(n.id);
                      }}
                      className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <GeneralNoteBody
                  value={n.body ?? ""}
                  editable={editable}
                  onCommit={(body) => onUpdate(n.id, body)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GeneralNoteBody({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      value={draft}
      disabled={!editable}
      placeholder="Type a general note…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) void onCommit(draft);
      }}
      rows={2}
      className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
    />
  );
}
