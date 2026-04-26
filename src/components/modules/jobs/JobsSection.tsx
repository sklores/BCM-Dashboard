"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createJob,
  deleteJob,
  fetchJobDrawingOptions,
  fetchJobDrawings,
  fetchJobExtractionOptions,
  fetchJobMaterialOptions,
  fetchJobMaterials,
  fetchJobSubOptions,
  fetchJobs,
  setJobDrawings,
  setJobMaterials,
  updateJob,
  type JobPatch,
} from "./queries";
import {
  JOB_STATUSES,
  JOB_STATUS_LABEL,
  JOB_STATUS_STYLE,
  type Job,
  type JobDrawing,
  type JobDrawingOption,
  type JobExtractionOption,
  type JobMaterial,
  type JobMaterialOption,
  type JobStatus,
  type JobSubOption,
} from "./types";

export function JobsSection({
  projectId,
  editable,
}: {
  projectId: string;
  editable: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [materials, setMaterials] = useState<JobMaterial[]>([]);
  const [drawings, setDrawings] = useState<JobDrawing[]>([]);
  const [subOptions, setSubOptions] = useState<JobSubOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<JobMaterialOption[]>(
    [],
  );
  const [drawingOptions, setDrawingOptions] = useState<JobDrawingOption[]>([]);
  const [extractionOptions, setExtractionOptions] = useState<
    JobExtractionOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [j, subs, mats, dwgs, exts] = await Promise.all([
          fetchJobs(projectId),
          fetchJobSubOptions(projectId),
          fetchJobMaterialOptions(projectId),
          fetchJobDrawingOptions(projectId),
          fetchJobExtractionOptions(projectId),
        ]);
        const ids = j.map((x) => x.id);
        const [jm, jd] = await Promise.all([
          fetchJobMaterials(ids),
          fetchJobDrawings(ids),
        ]);
        if (cancelled) return;
        setJobs(j);
        setMaterials(jm);
        setDrawings(jd);
        setSubOptions(subs);
        setMaterialOptions(mats);
        setDrawingOptions(dwgs);
        setExtractionOptions(exts);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load jobs";
          if (
            msg.toLowerCase().includes("relation") &&
            msg.toLowerCase().includes("does not exist")
          ) {
            setError(
              "Jobs schema isn't set up yet. Apply the migration supabase/migrations/20260426000002_jobs.sql in Supabase, then reload.",
            );
          } else {
            setError(msg);
          }
        }
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
      const created = await createJob(projectId);
      setJobs((rows) => [created, ...rows]);
      setExpanded((s) => new Set([...s, created.id]));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add job";
      if (
        msg.toLowerCase().includes("relation") &&
        msg.toLowerCase().includes("does not exist")
      ) {
        setError(
          "Jobs schema isn't set up yet. Apply supabase/migrations/20260426000002_jobs.sql in Supabase, then reload.",
        );
      } else {
        setError(msg);
      }
    }
  }

  async function handlePatch(id: string, patch: JobPatch) {
    const prev = jobs;
    setJobs((rows) => rows.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    try {
      await updateJob(id, patch);
    } catch (err) {
      setJobs(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this job? This cannot be undone.")) return;
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== id));
    setMaterials((rows) => rows.filter((m) => m.job_id !== id));
    setDrawings((rows) => rows.filter((d) => d.job_id !== id));
    try {
      await deleteJob(id);
    } catch (err) {
      setJobs(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleSetMaterials(jobId: string, ids: string[]) {
    try {
      const fresh = await setJobMaterials(jobId, ids);
      setMaterials((rows) => [
        ...rows.filter((m) => m.job_id !== jobId),
        ...fresh,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save materials");
    }
  }

  async function handleSetDrawings(
    jobId: string,
    items: { drawing_id: string | null; extraction_id: string | null }[],
  ) {
    try {
      const fresh = await setJobDrawings(jobId, items);
      setDrawings((rows) => [
        ...rows.filter((d) => d.job_id !== jobId),
        ...fresh,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drawings");
    }
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading jobs…
      </div>
    );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          A Job is a scope of work assigned to a subcontractor, with the
          materials and drawings they need pulled together in one place.
        </p>
        {editable && (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" /> New job
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No jobs yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => {
            const sub = j.sub_id
              ? subOptions.find((s) => s.id === j.sub_id)
              : null;
            const jobMatIds = materials
              .filter((m) => m.job_id === j.id)
              .map((m) => m.material_id);
            const jobDwgs = drawings.filter((d) => d.job_id === j.id);
            const isOpen = expanded.has(j.id);
            return (
              <li
                key={j.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/60"
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(j.id)) n.delete(j.id);
                        else n.add(j.id);
                        return n;
                      })
                    }
                    className="mt-0.5 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={j.title ?? ""}
                        disabled={!editable}
                        placeholder="Job title"
                        onChange={(e) =>
                          setJobs((rows) =>
                            rows.map((x) =>
                              x.id === j.id ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (j.title ?? ""))
                            handlePatch(j.id, { title: v || null });
                        }}
                        className="flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-medium text-zinc-100 outline-none focus:bg-zinc-950 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                      />
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          JOB_STATUS_STYLE[j.status]
                        }`}
                      >
                        {JOB_STATUS_LABEL[j.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {sub
                        ? `${sub.name}${sub.trade ? ` · ${sub.trade}` : ""}`
                        : "No contractor assigned"}
                      {jobMatIds.length > 0 &&
                        ` · ${jobMatIds.length} material${jobMatIds.length === 1 ? "" : "s"}`}
                      {jobDwgs.length > 0 &&
                        ` · ${jobDwgs.length} drawing${jobDwgs.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => handleDelete(j.id)}
                      className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Delete job"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-zinc-800 p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <Field label="Contractor">
                        <select
                          value={j.sub_id ?? ""}
                          disabled={!editable}
                          onChange={(e) =>
                            handlePatch(j.id, {
                              sub_id: e.target.value || null,
                            })
                          }
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        >
                          <option value="">— Select —</option>
                          {subOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.trade ? ` · ${s.trade}` : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select
                          value={j.status}
                          disabled={!editable}
                          onChange={(e) =>
                            handlePatch(j.id, {
                              status: e.target.value as JobStatus,
                            })
                          }
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        >
                          {JOB_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {JOB_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Start">
                        <input
                          type="date"
                          value={j.start_date ?? ""}
                          disabled={!editable}
                          onChange={(e) =>
                            handlePatch(j.id, {
                              start_date: e.target.value || null,
                            })
                          }
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        />
                      </Field>
                      <Field label="End">
                        <input
                          type="date"
                          value={j.end_date ?? ""}
                          disabled={!editable}
                          onChange={(e) =>
                            handlePatch(j.id, {
                              end_date: e.target.value || null,
                            })
                          }
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        />
                      </Field>
                    </div>

                    <Field label="Scope of work">
                      <textarea
                        value={j.scope ?? ""}
                        disabled={!editable}
                        rows={3}
                        onChange={(e) =>
                          setJobs((rows) =>
                            rows.map((x) =>
                              x.id === j.id ? { ...x, scope: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (j.scope ?? ""))
                            handlePatch(j.id, { scope: v || null });
                        }}
                        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </Field>

                    <Field label={`Materials (${jobMatIds.length})`}>
                      <MaterialPicker
                        options={materialOptions}
                        selected={jobMatIds}
                        editable={editable}
                        onChange={(ids) => handleSetMaterials(j.id, ids)}
                      />
                    </Field>

                    <Field
                      label={`Drawings & extractions (${jobDwgs.length})`}
                    >
                      <DrawingPicker
                        drawingOptions={drawingOptions}
                        extractionOptions={extractionOptions}
                        selected={jobDwgs}
                        editable={editable}
                        onChange={(items) => handleSetDrawings(j.id, items)}
                      />
                    </Field>

                    <Field label="Notes">
                      <textarea
                        value={j.notes ?? ""}
                        disabled={!editable}
                        rows={2}
                        onChange={(e) =>
                          setJobs((rows) =>
                            rows.map((x) =>
                              x.id === j.id ? { ...x, notes: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (j.notes ?? ""))
                            handlePatch(j.id, { notes: v || null });
                        }}
                        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function MaterialPicker({
  options,
  selected,
  editable,
  onChange,
}: {
  options: JobMaterialOption[];
  selected: string[];
  editable: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) =>
      !q
        ? true
        : `${o.product_name} ${o.manufacturer ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search materials…"
        className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
      />
      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-1 py-1 text-xs text-zinc-600">
            No matching materials.
          </li>
        )}
        {filtered.map((m) => {
          const checked = selectedSet.has(m.id);
          return (
            <li key={m.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${
                  checked ? "bg-blue-500/10 text-blue-200" : "text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!editable}
                  onChange={() => toggle(m.id)}
                  className="h-3 w-3"
                />
                <span className="truncate">
                  {m.product_name}
                  {m.manufacturer ? (
                    <span className="text-zinc-500"> · {m.manufacturer}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DrawingPicker({
  drawingOptions,
  extractionOptions,
  selected,
  editable,
  onChange,
}: {
  drawingOptions: JobDrawingOption[];
  extractionOptions: JobExtractionOption[];
  selected: JobDrawing[];
  editable: boolean;
  onChange: (
    items: { drawing_id: string | null; extraction_id: string | null }[],
  ) => void;
}) {
  const drawingKey = (id: string) => `d:${id}`;
  const extractionKey = (id: string) => `e:${id}`;
  const selectedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of selected) {
      if (s.extraction_id) set.add(extractionKey(s.extraction_id));
      else if (s.drawing_id) set.add(drawingKey(s.drawing_id));
    }
    return set;
  }, [selected]);

  function commit(nextSelected: Set<string>) {
    const items: { drawing_id: string | null; extraction_id: string | null }[] =
      [];
    for (const k of nextSelected) {
      if (k.startsWith("d:"))
        items.push({ drawing_id: k.slice(2), extraction_id: null });
      else if (k.startsWith("e:")) {
        const exId = k.slice(2);
        const ex = extractionOptions.find((e) => e.id === exId);
        items.push({
          drawing_id: ex?.drawing_id ?? null,
          extraction_id: exId,
        });
      }
    }
    onChange(items);
  }

  function toggle(key: string) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next);
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Drawings
        </p>
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {drawingOptions.length === 0 && (
            <li className="px-1 py-1 text-xs text-zinc-600">No drawings.</li>
          )}
          {drawingOptions.map((d) => {
            const k = drawingKey(d.id);
            const checked = selectedKeys.has(k);
            return (
              <li key={d.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${
                    checked
                      ? "bg-blue-500/10 text-blue-200"
                      : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!editable}
                    onChange={() => toggle(k)}
                    className="h-3 w-3"
                  />
                  <span className="truncate">
                    {d.drawing_number ?? "—"}
                    {d.title ? ` · ${d.title}` : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Confirmed extractions
        </p>
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {extractionOptions.length === 0 && (
            <li className="px-1 py-1 text-xs text-zinc-600">
              No confirmed extractions.
            </li>
          )}
          {extractionOptions.map((e) => {
            const k = extractionKey(e.id);
            const checked = selectedKeys.has(k);
            return (
              <li key={e.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${
                    checked
                      ? "bg-blue-500/10 text-blue-200"
                      : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!editable}
                    onChange={() => toggle(k)}
                    className="h-3 w-3"
                  />
                  <span className="truncate">
                    {e.label ?? "—"}
                    {e.category ? (
                      <span className="text-zinc-500"> · {e.category}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
