"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  addSubToProject,
  bulkInsertSubs,
  createSub,
  deleteSub,
  fetchProjectSubs,
  fetchSubs,
  removeSubFromProject,
  updateSub,
  type SubPatch,
} from "./queries";
import type { ProjectSub, Sub } from "./types";

type ImportRow = {
  name: string | null;
  trade: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  license_number: string | null;
  notes: string | null;
};

function dedupeKey(s: { name?: string | null; contact_email?: string | null }) {
  return `${(s.name ?? "").trim().toLowerCase()}|${(s.contact_email ?? "").trim().toLowerCase()}`;
}

export function SubsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [projectSubs, setProjectSubs] = useState<ProjectSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [allSubs, links] = await Promise.all([
          fetchSubs(),
          fetchProjectSubs(projectId),
        ]);
        if (cancelled) return;
        setSubs(allSubs);
        setProjectSubs(links);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load contractors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleUpdate(id: string, patch: SubPatch) {
    const prev = subs;
    setSubs((rows) => rows.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      await updateSub(id, patch);
    } catch (err) {
      setSubs(prev);
      setError(err instanceof Error ? err.message : "Failed to save contractor");
    }
  }

  async function handleAdd() {
    try {
      const created = await createSub();
      setSubs((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contractor");
    }
  }

  async function handleDelete(id: string) {
    const prevSubs = subs;
    const prevLinks = projectSubs;
    setSubs((rows) => rows.filter((s) => s.id !== id));
    setProjectSubs((rows) => rows.filter((l) => l.sub_id !== id));
    try {
      await deleteSub(id);
    } catch (err) {
      setSubs(prevSubs);
      setProjectSubs(prevLinks);
      setError(err instanceof Error ? err.message : "Failed to delete contractor");
    }
  }

  async function handleToggleProject(sub: Sub, on: boolean) {
    if (on) {
      const prev = projectSubs;
      try {
        const link = await addSubToProject(projectId, sub.id);
        setProjectSubs((rows) => [...rows, link]);
      } catch (err) {
        setProjectSubs(prev);
        setError(err instanceof Error ? err.message : "Failed to add to project");
      }
    } else {
      const link = projectSubs.find((l) => l.sub_id === sub.id);
      if (!link) return;
      const prev = projectSubs;
      setProjectSubs((rows) => rows.filter((l) => l.id !== link.id));
      try {
        await removeSubFromProject(link.id);
      } catch (err) {
        setProjectSubs(prev);
        setError(
          err instanceof Error ? err.message : "Failed to remove from project",
        );
      }
    }
  }

  async function handleBulkImport(rows: ImportRow[]) {
    const existingKeys = new Set(subs.map((s) => dedupeKey(s)));
    const fresh: SubPatch[] = [];
    let skipped = 0;
    for (const r of rows) {
      const key = dedupeKey(r);
      if (existingKeys.has(key) || !r.name || r.name.trim() === "") {
        skipped++;
        continue;
      }
      existingKeys.add(key);
      fresh.push({
        name: r.name.trim(),
        trade: r.trade?.trim() || null,
        contact_name: r.contact_name?.trim() || null,
        contact_email: r.contact_email?.trim() || null,
        contact_phone: r.contact_phone?.trim() || null,
        license_number: r.license_number?.trim() || null,
        notes: r.notes?.trim() || null,
      });
    }
    if (fresh.length === 0) {
      setError(
        skipped > 0
          ? `All ${skipped} row(s) skipped — duplicates or missing names.`
          : "No rows to import.",
      );
      return;
    }
    try {
      const inserted = await bulkInsertSubs(fresh);
      setSubs((prev) =>
        [...prev, ...inserted].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? ""),
        ),
      );
      setShowImport(false);
      setError(
        skipped > 0
          ? `Imported ${inserted.length} contractor(s); skipped ${skipped} duplicate or unnamed row(s).`
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) =>
      [
        s.name,
        s.trade,
        s.contact_name,
        s.contact_email,
        s.contact_phone,
        s.license_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [subs, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Contractors</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit contractors.
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contractors…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-zinc-600">
          {filtered.length} of {subs.length}
        </span>
        {editable && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition ${
                showImport
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add contractor
            </button>
          </div>
        )}
      </div>

      {showImport && editable && (
        <ImportPanel
          existingSubs={subs}
          onImport={handleBulkImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Trade</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">On project</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-zinc-500">
                    {subs.length === 0
                      ? "No contractors yet."
                      : "No contractors match the search."}
                  </td>
                </tr>
              )}
              {filtered.map((sub) => {
                const onProject = projectSubs.some(
                  (l) => l.sub_id === sub.id,
                );
                return (
                  <tr
                    key={sub.id}
                    className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <EditableText
                        value={sub.name}
                        editable={editable}
                        onCommit={(v) => handleUpdate(sub.id, { name: v })}
                        className="text-zinc-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={sub.trade ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(sub.id, { trade: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={sub.contact_name ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(sub.id, { contact_name: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={sub.contact_email ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(sub.id, {
                            contact_email: v || null,
                          })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={sub.contact_phone ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(sub.id, {
                            contact_phone: v || null,
                          })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={onProject}
                        disabled={!editable}
                        onChange={(e) =>
                          handleToggleProject(sub, e.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed [color-scheme:dark]"
                        aria-label="Toggle on this project"
                      />
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      {editable && (
                        <RowDeleteButton
                          label="Delete contractor"
                          onClick={() => handleDelete(sub.id)}
                        />
                      )}
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

// ---------- Import Panel ----------

function ImportPanel({
  existingSubs,
  onImport,
  onClose,
}: {
  existingSubs: Sub[];
  onImport: (rows: ImportRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingKeys = useMemo(
    () => new Set(existingSubs.map((s) => dedupeKey(s))),
    [existingSubs],
  );

  async function handleFile(file: File) {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setErr(
        "Export your Excel sheet as CSV first (File → Save As → CSV), then drop or paste it here.",
      );
      return;
    }
    try {
      const t = await file.text();
      setText(t);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read file.");
    }
  }

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setErr(null);
    setParsed(null);
    try {
      const res = await fetch("/api/subs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Parse failed: ${res.status}`);
      }
      const j = (await res.json()) as { contractors: ImportRow[] };
      const rows = j.contractors ?? [];
      setParsed(rows);
      // Pre-select all that aren't dupes and have a name
      setSelected(
        new Set(
          rows
            .map((r, i) =>
              r.name && !existingKeys.has(dedupeKey(r)) ? i : -1,
            )
            .filter((i) => i >= 0),
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  function toggleRow(idx: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleConfirm() {
    if (!parsed) return;
    const rows = parsed.filter((_, i) => selected.has(i));
    await onImport(rows);
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Import contractors
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Paste from Excel (any column order works) or drop a CSV. Claude
            extracts the rows; preview and confirm before saving. Duplicates
            (same name + email) are skipped.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close import"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!parsed && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 text-xs transition ${
              dragOver
                ? "border-blue-500 bg-blue-500/5 text-blue-300"
                : "border-zinc-700 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            <Upload className="h-4 w-4" />
            Drop a CSV here, or click to browse
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="…or paste contractor data directly (CSV, tab-separated, or freeform)"
            className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            >
              {parsing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Parse with Claude
            </button>
            {err && <p className="text-xs text-red-400">{err}</p>}
          </div>
        </>
      )}

      {parsed && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              Found {parsed.length} row{parsed.length === 1 ? "" : "s"}.
              Selected {selected.size} for import.
            </span>
            <button
              type="button"
              onClick={() => {
                setParsed(null);
                setSelected(new Set());
              }}
              className="ml-auto text-zinc-400 hover:text-zinc-200"
            >
              Re-edit
            </button>
          </div>
          <div className="max-h-96 overflow-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="w-8 px-2 py-1.5"></th>
                  <th className="px-2 py-1.5 font-medium">Company</th>
                  <th className="px-2 py-1.5 font-medium">Trade</th>
                  <th className="px-2 py-1.5 font-medium">Contact</th>
                  <th className="px-2 py-1.5 font-medium">Email</th>
                  <th className="px-2 py-1.5 font-medium">Phone</th>
                  <th className="px-2 py-1.5 font-medium">License</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) => {
                  const dup = existingKeys.has(dedupeKey(r));
                  const noName = !r.name || r.name.trim() === "";
                  return (
                    <tr
                      key={i}
                      className={`border-b border-zinc-900 ${
                        dup || noName ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          disabled={dup || noName}
                          onChange={() => toggleRow(i)}
                          className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-zinc-200">
                        {r.name || (
                          <span className="text-zinc-500">(no name)</span>
                        )}
                        {dup && (
                          <span className="ml-1 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 text-[9px] uppercase tracking-wider text-amber-300">
                            Dup
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400">
                        {r.trade ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400">
                        {r.contact_name ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400">
                        {r.contact_email ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400">
                        {r.contact_phone ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400">
                        {r.license_number ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
            >
              Import {selected.size} contractor{selected.size === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
            >
              Cancel
            </button>
            <span className="ml-auto text-[10px] text-zinc-600">
              Imported contractors stay in the global directory until you
              check &quot;On project&quot;.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableText({
  value,
  editable,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => Promise<void> | void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

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
      className={`w-full cursor-text rounded bg-transparent px-1 py-0.5 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}

function RowDeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`${label}?`)) onClick();
      }}
      className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
      aria-label={label}
      title={label}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
