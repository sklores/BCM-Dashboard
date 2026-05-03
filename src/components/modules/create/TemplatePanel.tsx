"use client";

// TemplatePanel: per-doc-type management of the uploaded reference
// template. Slides in from the right of the Create module.
//
// Two states:
//   1. No active template — shows an upload area.
//   2. Active template — shows file name, upload date, structure preview,
//      and Replace / Remove buttons.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  analyzeTemplate,
  deactivateTemplate,
  fetchActiveTemplate,
  saveTemplate,
  uploadTemplateFile,
} from "./queries";
import type {
  CreateTemplate,
  DocTemplate,
  TemplateExtractedStructure,
} from "./types";

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function TemplatePanel({
  template,
  canManage,
  canView,
  onClose,
  onSaved,
  onRemoved,
}: {
  template: DocTemplate;
  canManage: boolean;
  canView: boolean;
  onClose: () => void;
  onSaved: (t: CreateTemplate) => void;
  onRemoved: () => void;
}) {
  const [active, setActive] = useState<CreateTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"idle" | "uploading" | "analyzing" | "removing">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    file_url: string;
    file_name: string;
    source_text: string | null;
    extracted: TemplateExtractedStructure;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const t = await fetchActiveTemplate(template.type);
        if (!cancelled) setActive(t);
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
  }, [template.type]);

  async function handlePick(file: File) {
    if (!canManage) return;
    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max 25 MB.`);
      return;
    }
    setError(null);
    setBusy("uploading");
    try {
      const { url } = await uploadTemplateFile(template.type, file);
      setBusy("analyzing");
      const result = await analyzeTemplate(url, file.name);
      setPending({
        file_url: url,
        file_name: file.name,
        source_text: result.source_text,
        extracted: result.structure,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy("idle");
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setBusy("uploading");
    try {
      const saved = await saveTemplate({
        document_type: template.type,
        file_url: pending.file_url,
        file_name: pending.file_name,
        source_text: pending.source_text,
        extracted_structure: pending.extracted,
      });
      setActive(saved);
      setPending(null);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy("idle");
    }
  }

  async function handleRemove() {
    if (!active || !canManage) return;
    if (
      !window.confirm(
        "Remove this template? Future generations of this document type will fall back to the generic format until you upload a new template.",
      )
    )
      return;
    setBusy("removing");
    try {
      await deactivateTemplate(active.id);
      setActive(null);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Template — {template.title}
            </p>
            <h2 className="truncate text-lg font-semibold text-zinc-100">
              {active
                ? active.file_name ?? "Uploaded template"
                : "No template yet"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close template panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!canView && (
          <div className="m-5 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
            Your role can't view templates.
          </div>
        )}

        {canView && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            )}
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && pending && (
              <PendingPreview
                pending={pending}
                onConfirm={handleConfirm}
                onCancel={() => setPending(null)}
                busy={busy}
                canManage={canManage}
              />
            )}

            {!loading && !pending && !active && (
              <div className="space-y-3">
                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-200">
                  <Info className="mr-1.5 inline h-3 w-3 align-text-bottom" />
                  Upload a current document for this type and Create will
                  use it as the format reference for every future
                  {` ${template.title.toLowerCase()}`}. Field names, language,
                  section order — Claude pulls all of it from your file.
                </div>
                <UploadDrop
                  onPick={handlePick}
                  busy={busy}
                  disabled={!canManage}
                />
                {!canManage && canView && (
                  <p className="text-xs text-zinc-500">
                    Read-only — your role can view but not upload.
                  </p>
                )}
              </div>
            )}

            {!loading && !pending && active && (
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="mr-1.5 inline h-3 w-3 align-text-bottom" />
                  Active template — every {template.title.toLowerCase()}{" "}
                  generated from this card uses this format.
                </div>

                <FileBadge name={active.file_name ?? ""} url={active.file_url} />
                <p className="text-[11px] text-zinc-500">
                  Uploaded {new Date(active.uploaded_at).toLocaleString()}
                </p>

                {active.extracted_structure && (
                  <ExtractedSummary
                    extracted={
                      active.extracted_structure as TemplateExtractedStructure
                    }
                  />
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
                    <UploadDrop
                      onPick={handlePick}
                      busy={busy}
                      disabled={!canManage}
                      compact
                      label="Replace template"
                    />
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={busy !== "idle"}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/15 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove template
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function UploadDrop({
  onPick,
  busy,
  disabled,
  compact,
  label,
}: {
  onPick: (f: File) => void;
  busy: "idle" | "uploading" | "analyzing" | "removing";
  disabled: boolean;
  compact?: boolean;
  label?: string;
}) {
  const isBusy = busy === "uploading" || busy === "analyzing";
  return (
    <label
      className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs transition ${
        disabled
          ? "cursor-not-allowed border-zinc-800 bg-zinc-900/30 text-zinc-600"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-300 hover:border-blue-500/50 hover:text-blue-300"
      } ${compact ? "px-3 py-1.5" : "px-4 py-8"}`}
    >
      {isBusy ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busy === "uploading" ? "Uploading…" : "Analyzing with Claude…"}
        </>
      ) : (
        <>
          <Upload className="h-3.5 w-3.5" />
          {label ?? "Drop a .pdf, .docx, or .txt — or click to browse"}
        </>
      )}
      <input
        type="file"
        accept={ACCEPT}
        disabled={disabled || isBusy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = "";
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function FileBadge({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
      <FileText className="h-3.5 w-3.5 text-blue-400" />
      <span className="flex-1 truncate text-zinc-200">{name || "—"}</span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          Download
        </a>
      )}
    </div>
  );
}

function ExtractedSummary({
  extracted,
}: {
  extracted: TemplateExtractedStructure;
}) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          What Claude extracted
        </p>
        <p className="mt-1 text-zinc-300">{extracted.summary}</p>
      </div>
      {extracted.structure.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Structure
          </p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5 text-zinc-300">
            {extracted.structure.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {extracted.smart_fields.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Smart fields ({extracted.smart_fields.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-zinc-300">
            {extracted.smart_fields.map((f, i) => (
              <li key={i}>
                <span className="font-mono text-zinc-400">{f.key}</span>
                {" — "}
                <span>{f.label}</span>
                {f.example && (
                  <span className="text-zinc-500"> · e.g. {f.example}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {extracted.boilerplate.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Boilerplate clauses ({extracted.boilerplate.length})
          </p>
          <ul className="mt-1 space-y-1 text-zinc-300">
            {extracted.boilerplate.slice(0, 4).map((b, i) => (
              <li key={i}>
                <p className="font-medium text-zinc-200">{b.heading}</p>
                <p className="line-clamp-3 text-zinc-500">{b.body}</p>
              </li>
            ))}
            {extracted.boilerplate.length > 4 && (
              <li className="text-zinc-500">
                +{extracted.boilerplate.length - 4} more
              </li>
            )}
          </ul>
        </div>
      )}
      {extracted.tone && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Tone
          </p>
          <p className="mt-1 text-zinc-300">{extracted.tone}</p>
        </div>
      )}
      {extracted.formatting_notes && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Formatting notes
          </p>
          <p className="mt-1 text-zinc-300">{extracted.formatting_notes}</p>
        </div>
      )}
    </div>
  );
}

function PendingPreview({
  pending,
  onConfirm,
  onCancel,
  busy,
  canManage,
}: {
  pending: {
    file_url: string;
    file_name: string;
    source_text: string | null;
    extracted: TemplateExtractedStructure;
  };
  onConfirm: () => void;
  onCancel: () => void;
  busy: "idle" | "uploading" | "analyzing" | "removing";
  canManage: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-200">
        <Info className="mr-1.5 inline h-3 w-3 align-text-bottom" />
        Review what Claude extracted, then confirm to save as the active
        template.
      </div>
      <FileBadge name={pending.file_name} url={pending.file_url} />
      <ExtractedSummary extracted={pending.extracted} />
      <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy !== "idle"}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canManage || busy !== "idle"}
          className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
        >
          {busy === "uploading" && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirm &amp; save as template
        </button>
      </div>
    </div>
  );
}
