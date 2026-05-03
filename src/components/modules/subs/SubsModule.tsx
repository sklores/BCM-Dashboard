"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  UserPlus,
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
import { ContractorDetailPage } from "./ContractorDetailPage";

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
  const [showExisting, setShowExisting] = useState(false);
  const [openSubId, setOpenSubId] = useState<string | null>(null);

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

  // Open a sub by name when Contacts dispatches `bcm-navigate` with subName.
  // Backwards-compatible bridge between the two modules — clicking
  // "Open in Subs" on a Subs-Trade or Subs-MEP company in Contacts jumps
  // straight to that sub's profile.
  useEffect(() => {
    function onNavigate(e: Event) {
      const detail = (e as CustomEvent<{ moduleKey?: string; subName?: string }>)
        .detail;
      if (detail?.moduleKey !== "subs" || !detail.subName) return;
      const target = subs.find(
        (s) => s.name.trim().toLowerCase() === detail.subName!.trim().toLowerCase(),
      );
      if (target) setOpenSubId(target.id);
    }
    window.addEventListener("bcm-navigate", onNavigate);
    return () => window.removeEventListener("bcm-navigate", onNavigate);
  }, [subs]);

  // Subs currently linked to this project (the main list).
  const projectLinkedSubs = useMemo(() => {
    const linkedIds = new Set(projectSubs.map((l) => l.sub_id));
    return subs.filter((s) => linkedIds.has(s.id));
  }, [subs, projectSubs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectLinkedSubs;
    return projectLinkedSubs.filter((s) =>
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
  }, [projectLinkedSubs, search]);

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

  async function handleAddNew() {
    try {
      const created = await createSub();
      setSubs((rows) => [...rows, created]);
      // Auto-link to the current project
      try {
        const link = await addSubToProject(projectId, created.id);
        setProjectSubs((rows) => [...rows, link]);
      } catch {
        // The directory entry exists; if linking fails it can still be added later
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contractor");
    }
  }

  async function handleRemoveFromProject(subId: string) {
    const link = projectSubs.find((l) => l.sub_id === subId);
    if (!link) return;
    if (
      !window.confirm(
        "Remove from this project? The contractor stays in the directory and can be added back via Add existing.",
      )
    )
      return;
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

  async function handleAddExisting(picked: Sub[]) {
    if (picked.length === 0) return;
    const newLinks: ProjectSub[] = [];
    for (const sub of picked) {
      try {
        const link = await addSubToProject(projectId, sub.id);
        newLinks.push(link);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add to project",
        );
      }
    }
    setProjectSubs((rows) => [...rows, ...newLinks]);
    setShowExisting(false);
  }

  async function handleBulkImportToDirectory(rows: ImportRow[]) {
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
      setError(
        skipped > 0
          ? `Imported ${inserted.length} into directory; skipped ${skipped} duplicate or unnamed row(s). They are not yet on this project — use Add existing to link them.`
          : `Imported ${inserted.length} into directory. They are not yet on this project — use Add existing to link them.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    }
  }

  async function handleDeleteFromDirectory(id: string) {
    if (
      !window.confirm(
        "Delete from the global directory? This removes them from every project. Use Remove from project for a softer option.",
      )
    )
      return;
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

  const openSub = openSubId ? subs.find((s) => s.id === openSubId) : null;
  if (openSub) {
    return (
      <ContractorDetailPage
        projectId={projectId}
        sub={openSub}
        onBack={() => setOpenSubId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Subs</h1>
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
            placeholder="Search contractors on this project…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-zinc-600">
          {filtered.length} of {projectLinkedSubs.length} on project · {subs.length} in directory
        </span>
        {editable && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add new
            </button>
            <button
              type="button"
              onClick={() => setShowExisting((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition ${
                showExisting
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add existing
            </button>
          </div>
        )}
      </div>

      {showExisting && editable && (
        <AddExistingPanel
          allSubs={subs}
          projectSubs={projectSubs}
          onPick={handleAddExisting}
          onBulkImport={handleBulkImportToDirectory}
          onClose={() => setShowExisting(false)}
        />
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Trade</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-zinc-500">
                    {projectLinkedSubs.length === 0
                      ? "No contractors on this project yet — use Add new or Add existing."
                      : "No contractors match the search."}
                  </td>
                </tr>
              )}
              {filtered.map((sub) => (
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
                  <td className="w-40 px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOpenSubId(sub.id)}
                        className="inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-blue-500 hover:text-blue-400"
                        title="Open contractor detail"
                      >
                        Open
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      {editable && (
                        <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromProject(sub.id)}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-amber-500/50 hover:text-amber-300"
                            title="Remove from this project"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFromDirectory(sub.id)}
                            className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
                            aria-label="Delete from directory"
                            title="Delete from directory (every project)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Add Existing Panel ----------

function AddExistingPanel({
  allSubs,
  projectSubs,
  onPick,
  onBulkImport,
  onClose,
}: {
  allSubs: Sub[];
  projectSubs: ProjectSub[];
  onPick: (picked: Sub[]) => Promise<void>;
  onBulkImport: (rows: ImportRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);

  const linkedIds = useMemo(
    () => new Set(projectSubs.map((l) => l.sub_id)),
    [projectSubs],
  );

  // Directory minus already-on-project
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSubs
      .filter((s) => !linkedIds.has(s.id))
      .filter((s) => {
        if (!q) return true;
        return [
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
          .includes(q);
      });
  }, [allSubs, linkedIds, search]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    const picked = candidates.filter((c) => selected.has(c.id));
    await onPick(picked);
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Add existing contractor
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Pick from the global directory. Multi-select to add several at
            once. Already-linked contractors are hidden.
          </p>
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

      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the directory…"
            autoFocus
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-zinc-600">
          {candidates.length} available
        </span>
      </div>

      <div className="max-h-72 overflow-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="w-8 px-2 py-1.5"></th>
              <th className="px-2 py-1.5 font-medium">Company</th>
              <th className="px-2 py-1.5 font-medium">Trade</th>
              <th className="px-2 py-1.5 font-medium">Contact</th>
              <th className="px-2 py-1.5 font-medium">Email</th>
              <th className="px-2 py-1.5 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-2 py-3 text-center text-zinc-500"
                >
                  {allSubs.length === linkedIds.size
                    ? "Every contractor in the directory is already on this project."
                    : "No matches in the directory. Add new, or bulk import below."}
                </td>
              </tr>
            )}
            {candidates.map((s) => (
              <tr
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/60 ${
                  selected.has(s.id) ? "bg-blue-500/5" : ""
                }`}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                  />
                </td>
                <td className="px-2 py-1.5 text-zinc-200">{s.name}</td>
                <td className="px-2 py-1.5 text-zinc-400">{s.trade ?? "—"}</td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {s.contact_name ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {s.contact_email ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {s.contact_phone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
        >
          Add {selected.size > 0 ? selected.size : ""} to project
        </button>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-xs transition ${
            showImport
              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          }`}
        >
          {showImport ? "Hide bulk import" : "Bulk import directory…"}
        </button>
      </div>

      {showImport && (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <BulkImportSection onImport={onBulkImport} />
        </div>
      )}
    </div>
  );
}

// ---------- Bulk Import (subsection of Add Existing) ----------

function BulkImportSection({
  onImport,
}: {
  onImport: (rows: ImportRow[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportRow[] | null>(null);
  const [pickedAll, setPickedAll] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const raw = await res.text();
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const j = JSON.parse(raw);
          detail = j.error || detail;
        } catch {
          if (raw) detail += ` ${raw.slice(0, 200)}`;
        }
        throw new Error(`Parse failed: ${detail}`);
      }
      if (!raw) {
        throw new Error(
          "Server returned an empty response. Try splitting the list into smaller chunks.",
        );
      }
      let j: { contractors: ImportRow[] };
      try {
        j = JSON.parse(raw);
      } catch {
        throw new Error(
          "Couldn't parse server response: " + raw.slice(0, 200),
        );
      }
      setParsed(j.contractors ?? []);
      setPickedAll(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    await onImport(parsed);
    setParsed(null);
    setText("");
    setPickedAll(true);
  }

  if (!parsed) {
    return (
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Bulk import directory
        </h4>
        <p className="mb-2 text-xs text-zinc-500">
          One-time load of your existing contractor list. Imported entries
          land in the global directory; check Add existing to link them to
          this project.
        </p>
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
          rows={5}
          placeholder="…or paste contractor data directly (CSV, tab-separated, freeform)"
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
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          Found {parsed.length} row{parsed.length === 1 ? "" : "s"}.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setParsed(null);
              setPickedAll(true);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Re-edit
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-zinc-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-2 py-1.5 font-medium">Company</th>
              <th className="px-2 py-1.5 font-medium">Trade</th>
              <th className="px-2 py-1.5 font-medium">Contact</th>
              <th className="px-2 py-1.5 font-medium">Email</th>
              <th className="px-2 py-1.5 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((r, i) => (
              <tr key={i} className="border-b border-zinc-900">
                <td className="px-2 py-1.5 text-zinc-200">
                  {r.name || (
                    <span className="text-zinc-500">(no name)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">{r.trade ?? "—"}</td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {r.contact_name ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {r.contact_email ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {r.contact_phone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!pickedAll || parsed.length === 0}
          className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
        >
          Import {parsed.length} to directory
        </button>
        <span className="text-[10px] text-zinc-600">
          Duplicates (same name + email) will be skipped automatically.
        </span>
      </div>
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
