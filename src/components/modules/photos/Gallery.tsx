"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Pencil, Trash2, X } from "lucide-react";
import type { GroupMode, Photo } from "./types";

function formatDate(s: string | null): string {
  if (!s) return "Unknown date";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonth(s: string | null): string {
  if (!s) return "Undated";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateKey(p: Photo): string {
  return p.taken_at ? p.taken_at.slice(0, 7) : "0000-00";
}

export function Gallery({
  photos,
  group,
  editable,
  onSelect,
}: {
  photos: Photo[];
  group: GroupMode;
  editable: boolean;
  onSelect: (photo: Photo) => void;
}) {
  void editable;

  const groups = useMemo(() => {
    if (group === "none") {
      return [{ key: "all", label: "All photos", photos }];
    }
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      let key: string;
      if (group === "date") key = dateKey(p);
      else if (group === "room") key = p.room ?? "unspecified";
      else key = p.stage ?? "unspecified";
      const bucket = map.get(key) ?? [];
      bucket.push(p);
      map.set(key, bucket);
    }
    const entries = Array.from(map.entries());
    if (group === "date") entries.sort((a, b) => b[0].localeCompare(a[0]));
    else entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([key, list]) => ({
      key,
      label:
        group === "date"
          ? formatMonth(list[0].taken_at)
          : key.replace(/_/g, " "),
      photos: list,
    }));
  }, [photos, group]);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No photos yet. Drop some above to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2">
          {group !== "none" && (
            <h3 className="flex items-baseline gap-2 text-xs uppercase tracking-wider text-zinc-500">
              <span className="text-zinc-300">{g.label}</span>
              <span>({g.photos.length})</span>
            </h3>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {g.photos.map((photo) => (
              <Thumb key={photo.id} photo={photo} onClick={() => onSelect(photo)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Thumb({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  // PDFs open in an in-dashboard modal (PdfModal). Caller decides
  // which modal to show based on photo.kind. Photos open PhotoModal.
  if (photo.kind === "pdf") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 p-3 text-center transition hover:border-zinc-600"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-300">
          <FileText className="h-6 w-6" />
        </div>
        <div className="line-clamp-2 text-[11px] text-zinc-300">
          {photo.ai_description ?? photo.notes ?? "PDF"}
        </div>
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300">
          PDF
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600"
    >
      {photo.storage_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.storage_url}
          alt={photo.ai_description ?? ""}
          className="h-full w-full object-cover transition group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
          No preview
        </div>
      )}
      {photo.tags.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="flex flex-wrap gap-1">
            {photo.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200"
              >
                {t}
              </span>
            ))}
            {photo.tags.length > 3 && (
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
                +{photo.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

export function PhotoModal({
  photo,
  editable,
  onClose,
  onUpdate,
  onDelete,
  onAnnotate,
}: {
  photo: Photo;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: { tags?: string[]; notes?: string | null }) => Promise<void>;
  onDelete: (photo: Photo) => Promise<void>;
  onAnnotate?: (photo: Photo) => void;
}) {
  const [tagInput, setTagInput] = useState(photo.tags.join(", "));
  const [notes, setNotes] = useState(photo.notes ?? "");

  async function commitTags() {
    const next = tagInput
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const same =
      next.length === photo.tags.length &&
      next.every((t, i) => t === photo.tags[i]);
    if (!same) await onUpdate(photo.id, { tags: next });
  }

  async function commitNotes() {
    const next = notes.trim();
    const current = photo.notes ?? "";
    if (next !== current) await onUpdate(photo.id, { notes: next || null });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 items-center justify-center bg-black">
          {photo.storage_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.storage_url}
              alt={photo.ai_description ?? ""}
              className="max-h-[80vh] max-w-full object-contain"
            />
          )}
        </div>
        <div className="flex w-full flex-col gap-3 md:w-80">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-zinc-500">
              {photo.taken_at ? `Taken ${formatDate(photo.taken_at)}` : "No date"}
              <br />
              Uploaded {formatDate(photo.uploaded_at)}
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

          {photo.ai_description && (
            <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
              {photo.ai_description}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
            {photo.room && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
                {photo.room}
              </span>
            )}
            {photo.stage && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
                {photo.stage}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Tags (comma separated)
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={commitTags}
              disabled={!editable}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              disabled={!editable}
              rows={3}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </label>

          {photo.annotated_from_id && (
            <p className="text-[11px] text-violet-300">
              Annotated copy of an earlier photo.
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2">
            {editable && onAnnotate && (
              <button
                type="button"
                onClick={() => onAnnotate(photo)}
                className="flex items-center justify-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-300 transition hover:bg-blue-500/20"
              >
                <Pencil className="h-3.5 w-3.5" />
                Annotate
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Delete this photo?")) {
                    await onDelete(photo);
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-red-500/40 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// PdfModal — in-dashboard PDF viewer. Renders the PDF via an iframe
// pointing at the storage URL, which lets the browser's built-in PDF
// renderer handle the actual pages but keeps the experience inside the
// app shell. Includes a header with the filename + open-in-new-tab
// and download links (since some browsers' PDF chrome hides these
// when embedded), plus a Delete action for PMs.
export function PdfModal({
  photo,
  editable,
  onClose,
  onDelete,
}: {
  photo: Photo;
  editable: boolean;
  onClose: () => void;
  onDelete: (photo: Photo) => Promise<void>;
}) {
  const url = photo.storage_url ?? "";
  const filename = photo.ai_description?.trim() || "Document.pdf";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-300">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-100">
              {filename}
            </div>
            <div className="text-[11px] text-zinc-500">
              {photo.taken_at
                ? `Received ${formatDate(photo.taken_at)}`
                : `Uploaded ${formatDate(photo.uploaded_at)}`}
            </div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
          <a
            href={url}
            download
            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          {editable && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("Delete this PDF?")) {
                  await onDelete(photo);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-red-500/40 hover:text-red-400"
              title="Delete PDF"
            >
              <Trash2 className="h-3.5 w-3.5" />
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
        </header>
        <div className="flex-1 bg-zinc-900">
          {url ? (
            <iframe
              src={url}
              title={filename}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No file URL available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
