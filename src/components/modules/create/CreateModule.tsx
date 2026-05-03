"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileDown,
  FilePlus,
  FileText,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  fetchProjectShell,
  updateDocument,
} from "./queries";
import {
  DOC_CATEGORY_LABEL,
  DOC_STATUS_LABEL,
  DOC_STATUS_STYLE,
  DOC_TEMPLATES,
  DOC_TEMPLATES_BY_TYPE,
  type DocCategory,
  type DocStatus,
  type DocTemplate,
  type GeneratedDocument,
} from "./types";

type Tab = "create" | "saved";

const CATEGORY_ORDER: DocCategory[] = [
  "reports",
  "contracts",
  "financial",
  "client_facing",
];

export function CreateModule({ projectId }: ModuleProps) {
  const [tab, setTab] = useState<Tab>("create");
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [project, setProject] = useState<{
    name: string | null;
    address: string | null;
  }>({ name: null, address: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [composeFor, setComposeFor] = useState<DocTemplate | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [p, d] = await Promise.all([
          fetchProjectShell(projectId),
          fetchDocuments(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setDocs(d);
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

  const grouped = useMemo(() => {
    const map: Record<DocCategory, DocTemplate[]> = {
      reports: [],
      contracts: [],
      financial: [],
      client_facing: [],
    };
    for (const t of DOC_TEMPLATES) map[t.category].push(t);
    return map;
  }, []);

  async function handleCreate(
    template: DocTemplate,
    fields: Record<string, string>,
  ) {
    const content = template.render(fields, project);
    const titlePieces = [
      template.title,
      fields.report_date ||
        fields.invoice_date ||
        fields.co_date ||
        fields.period_end ||
        fields.week_ending ||
        fields.as_of ||
        "",
    ].filter(Boolean);
    const title = titlePieces.join(" — ");
    try {
      const created = await createDocument({
        project_id: projectId,
        category: template.category,
        doc_type: template.type,
        title,
        content,
        metadata: { fields },
      });
      setDocs((prev) => [created, ...prev]);
      setComposeFor(null);
      setOpenDocId(created.id);
      setTab("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleUpdate(id: string, content: string, status: DocStatus) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, content, status, updated_at: new Date().toISOString() } : d,
      ),
    );
    try {
      await updateDocument(id, { content, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    const prev = docs;
    setDocs((rows) => rows.filter((d) => d.id !== id));
    if (openDocId === id) setOpenDocId(null);
    try {
      await deleteDocument(id);
    } catch (err) {
      setDocs(prev);
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const openDoc = openDocId ? docs.find((d) => d.id === openDocId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <FilePlus className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Create</h1>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800">
        <TabBtn
          active={tab === "create"}
          onClick={() => setTab("create")}
          label="Create"
        />
        <TabBtn
          active={tab === "saved"}
          onClick={() => setTab("saved")}
          label={`Saved${docs.length > 0 ? ` (${docs.length})` : ""}`}
        />
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && tab === "create" && (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => (
            <section key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {DOC_CATEGORY_LABEL[cat]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[cat].map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setComposeFor(t)}
                    className="flex flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 text-left transition hover:border-blue-500/50 hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-medium text-zinc-100">
                        {t.title}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500">{t.description}</p>
                    <span className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
                      {t.fields.length} field
                      {t.fields.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && tab === "saved" && (
        <SavedTab
          docs={docs}
          onOpen={setOpenDocId}
          onDelete={handleDelete}
        />
      )}

      {composeFor && (
        <ComposeModal
          template={composeFor}
          project={project}
          onCancel={() => setComposeFor(null)}
          onCreate={handleCreate}
        />
      )}

      {openDoc && (
        <DocViewer
          doc={openDoc}
          onClose={() => setOpenDocId(null)}
          onUpdate={(content, status) =>
            handleUpdate(openDoc.id, content, status)
          }
          onDelete={() => handleDelete(openDoc.id)}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
        active
          ? "border-blue-500 text-blue-300"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function SavedTab({
  docs,
  onOpen,
  onDelete,
}: {
  docs: GeneratedDocument[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        No documents generated yet. Switch to Create to spin one up.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium">Updated</th>
            <th className="w-32 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const typeLabel =
              DOC_TEMPLATES_BY_TYPE[d.doc_type]?.title ?? d.doc_type;
            return (
              <tr key={d.id} className="border-b border-zinc-900">
                <td className="px-3 py-2 text-zinc-200">{d.title}</td>
                <td className="px-3 py-2 text-zinc-300">{typeLabel}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {DOC_CATEGORY_LABEL[d.category]}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${DOC_STATUS_STYLE[d.status]}`}
                  >
                    {DOC_STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {new Date(d.updated_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpen(d.id)}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-blue-500 hover:text-blue-400"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComposeModal({
  template,
  project,
  onCancel,
  onCreate,
}: {
  template: DocTemplate;
  project: { name: string | null; address: string | null };
  onCancel: () => void;
  onCreate: (template: DocTemplate, fields: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    // Pre-fill date fields with today.
    const today = new Date().toISOString().slice(0, 10);
    for (const f of template.fields) {
      if (f.kind === "date") initial[f.key] = today;
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  function setField(k: string, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  const missing = template.fields.filter(
    (f) => f.required && !(fields[f.key] ?? "").trim(),
  );
  const canSubmit = missing.length === 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate(template, fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-10"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {template.title}
            </h2>
            <p className="text-xs text-zinc-500">{template.description}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
              {DOC_CATEGORY_LABEL[template.category]} · Project:{" "}
              {project.name ?? project.address ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {template.fields.map((f) => (
            <label key={f.key} className="block text-xs">
              <span className="mb-1 block uppercase tracking-wider text-zinc-500">
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.kind === "longtext" ? (
                <textarea
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <input
                  type={
                    f.kind === "date"
                      ? "date"
                      : f.kind === "number"
                        ? "number"
                        : "text"
                  }
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              )}
              {f.hint && (
                <span className="mt-0.5 block text-[10px] text-zinc-600">
                  {f.hint}
                </span>
              )}
            </label>
          ))}
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
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Generate &amp; save
          </button>
        </div>
      </div>
    </div>
  );
}

function DocViewer({
  doc,
  onClose,
  onUpdate,
  onDelete,
}: {
  doc: GeneratedDocument;
  onClose: () => void;
  onUpdate: (content: string, status: DocStatus) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.content ?? "");
  useEffect(() => setDraft(doc.content ?? ""), [doc.content]);

  function save() {
    onUpdate(draft, doc.status);
    setEditing(false);
  }

  const template = DOC_TEMPLATES_BY_TYPE[doc.doc_type];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 print:bg-white print:p-0">
      <div className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl print:border-0 print:bg-white print:p-8 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">
              {doc.title}
            </h2>
            <p className="text-xs text-zinc-500">
              {template?.title ?? doc.doc_type} ·{" "}
              {DOC_CATEGORY_LABEL[doc.category]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={doc.status}
              onChange={(e) =>
                onUpdate(draft, e.target.value as DocStatus)
              }
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none [color-scheme:dark]"
            >
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
              <option value="sent">Sent</option>
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export PDF
            </button>
            {editing ? (
              <button
                type="button"
                onClick={save}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-xs text-blue-300 hover:bg-blue-500/25"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={28}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <div className="markdown-doc whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/40 p-5 text-sm leading-relaxed text-zinc-100 print:border-0 print:bg-white print:p-0 print:text-black">
            {doc.content}
          </div>
        )}
      </div>
    </div>
  );
}
