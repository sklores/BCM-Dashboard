"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { fmtUsd } from "./types";
import {
  createJob,
  createJobMaterial,
  deleteJob,
  deleteJobMaterial,
  fetchJobs,
  fetchMaterialsCatalog,
  fetchMaterialsForJobs,
  fetchProjectSubsForPicker,
  jobLaborCost,
  jobMaterialsCost,
  updateJob,
  updateJobMaterial,
  type CatalogMaterial,
  type EstimateJob,
  type EstimateJobMaterial,
  type EstimateJobMaterialPatch,
  type EstimateJobPatch,
  type SubOption,
} from "./labor-materials";

export function LaborMaterialsSection({
  projectId,
  editable,
}: {
  projectId: string;
  editable: boolean;
}) {
  const [jobs, setJobs] = useState<EstimateJob[]>([]);
  const [materials, setMaterials] = useState<EstimateJobMaterial[]>([]);
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [j, s, c] = await Promise.all([
          fetchJobs(projectId),
          fetchProjectSubsForPicker(projectId),
          fetchMaterialsCatalog(projectId),
        ]);
        if (cancelled) return;
        setJobs(j);
        setSubs(s);
        setCatalog(c);
        setExpanded(new Set(j.map((row) => row.id)));
        const mats = await fetchMaterialsForJobs(j.map((row) => row.id));
        if (cancelled) return;
        setMaterials(mats);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load labor & materials",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(() => {
    let labor = 0;
    let mat = 0;
    for (const job of jobs) {
      labor += jobLaborCost(job);
      mat += jobMaterialsCost(materials.filter((m) => m.job_id === job.id));
    }
    return { labor, mat, grand: labor + mat };
  }, [jobs, materials]);

  async function handleAddJob() {
    try {
      const sortOrder = jobs.length;
      const created = await createJob(projectId, sortOrder);
      setJobs((rows) => [...rows, created]);
      setExpanded((s) => new Set(s).add(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job");
    }
  }

  async function handleUpdateJob(id: string, patch: EstimateJobPatch) {
    const prev = jobs;
    setJobs((rows) => rows.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    try {
      await updateJob(id, patch);
    } catch (err) {
      setJobs(prev);
      setError(err instanceof Error ? err.message : "Failed to save job");
    }
  }

  async function handleDeleteJob(id: string) {
    if (!window.confirm("Delete this job and all its materials?")) return;
    const prev = jobs;
    setJobs((rows) => rows.filter((j) => j.id !== id));
    setMaterials((rows) => rows.filter((m) => m.job_id !== id));
    try {
      await deleteJob(id);
    } catch (err) {
      setJobs(prev);
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  }

  async function handleAddMaterial(
    jobId: string,
    patch: EstimateJobMaterialPatch = {},
  ) {
    try {
      const sortOrder = materials.filter((m) => m.job_id === jobId).length;
      const created = await createJobMaterial(jobId, {
        sort_order: sortOrder,
        ...patch,
      });
      setMaterials((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add material");
    }
  }

  async function handleUpdateMaterial(
    id: string,
    patch: EstimateJobMaterialPatch,
  ) {
    const prev = materials;
    setMaterials((rows) =>
      rows.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    try {
      await updateJobMaterial(id, patch);
    } catch (err) {
      setMaterials(prev);
      setError(err instanceof Error ? err.message : "Failed to save material");
    }
  }

  async function handleDeleteMaterial(id: string) {
    const prev = materials;
    setMaterials((rows) => rows.filter((m) => m.id !== id));
    try {
      await deleteJobMaterial(id);
    } catch (err) {
      setMaterials(prev);
      setError(err instanceof Error ? err.message : "Failed to delete material");
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-zinc-500">
          One row per job. Add labor (regular + off-hour) and materials inline;
          totals roll up at the bottom.
        </p>
        {editable && (
          <button
            type="button"
            onClick={handleAddJob}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add job
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No jobs yet — click Add job to start.
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => {
            const jobMats = materials.filter((m) => m.job_id === job.id);
            const isOpen = expanded.has(job.id);
            const labor = jobLaborCost(job);
            const mat = jobMaterialsCost(jobMats);
            return (
              <JobCard
                key={job.id}
                job={job}
                materials={jobMats}
                subs={subs}
                catalog={catalog}
                editable={editable}
                isOpen={isOpen}
                onToggle={() => toggleExpanded(job.id)}
                onUpdateJob={(patch) => handleUpdateJob(job.id, patch)}
                onDeleteJob={() => handleDeleteJob(job.id)}
                onAddMaterial={(patch) => handleAddMaterial(job.id, patch)}
                onUpdateMaterial={handleUpdateMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                labor={labor}
                materialsCost={mat}
              />
            );
          })}
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Labor" value={fmtUsd(totals.labor)} tone="blue" />
            <Stat label="Materials" value={fmtUsd(totals.mat)} tone="amber" />
            <Stat
              label="Project Total"
              value={fmtUsd(totals.grand)}
              tone="emerald"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  materials,
  subs,
  catalog,
  editable,
  isOpen,
  onToggle,
  onUpdateJob,
  onDeleteJob,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  labor,
  materialsCost,
}: {
  job: EstimateJob;
  materials: EstimateJobMaterial[];
  subs: SubOption[];
  catalog: CatalogMaterial[];
  editable: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateJob: (patch: EstimateJobPatch) => Promise<void>;
  onDeleteJob: () => Promise<void>;
  onAddMaterial: (patch?: EstimateJobMaterialPatch) => Promise<void>;
  onUpdateMaterial: (
    id: string,
    patch: EstimateJobMaterialPatch,
  ) => Promise<void>;
  onDeleteMaterial: (id: string) => Promise<void>;
  labor: number;
  materialsCost: number;
}) {
  const total = labor + materialsCost;
  const sub = subs.find((s) => s.id === job.assigned_sub_id);

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <input
          type="text"
          defaultValue={job.name ?? ""}
          disabled={!editable}
          placeholder="Job name (e.g. Framing)"
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (job.name ?? "")) onUpdateJob({ name: v || null });
          }}
          className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-800 focus:bg-zinc-950 disabled:opacity-60"
        />
        <span className="hidden text-xs text-zinc-500 sm:inline">
          {sub
            ? `${sub.name}${sub.trade ? ` · ${sub.trade}` : ""}`
            : "(no sub)"}
        </span>
        <div className="hidden gap-3 text-xs sm:flex">
          <span className="text-zinc-400">
            Labor <span className="text-zinc-200">{fmtUsd(labor)}</span>
          </span>
          <span className="text-zinc-400">
            Mat <span className="text-zinc-200">{fmtUsd(materialsCost)}</span>
          </span>
          <span className="font-semibold text-emerald-300">
            {fmtUsd(total)}
          </span>
        </div>
        {editable && (
          <button
            type="button"
            onClick={onDeleteJob}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            aria-label="Delete job"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-zinc-800 px-3 py-3">
          {/* Sub picker + labor fields */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Subcontractor">
              <select
                value={job.assigned_sub_id ?? ""}
                disabled={!editable}
                onChange={(e) =>
                  onUpdateJob({
                    assigned_sub_id:
                      e.target.value === "" ? null : e.target.value,
                  })
                }
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              >
                <option value="">— Unassigned —</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.trade ? ` · ${s.trade}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="Regular hours">
              <NumInput
                value={job.regular_hours}
                editable={editable}
                onCommit={(v) => onUpdateJob({ regular_hours: v })}
              />
            </Field>
            <Field label="Regular rate">
              <NumInput
                value={job.regular_rate}
                editable={editable}
                onCommit={(v) => onUpdateJob({ regular_rate: v })}
                prefix="$"
              />
            </Field>
            <Field label="Off-hour hours">
              <NumInput
                value={job.off_hour_hours}
                editable={editable}
                onCommit={(v) => onUpdateJob({ off_hour_hours: v })}
              />
            </Field>
            <Field label="Off-hour rate">
              <NumInput
                value={job.off_hour_rate}
                editable={editable}
                onCommit={(v) => onUpdateJob({ off_hour_rate: v })}
                prefix="$"
              />
            </Field>
          </div>

          <Field label="Notes" wide>
            <textarea
              defaultValue={job.notes ?? ""}
              disabled={!editable}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (job.notes ?? ""))
                  onUpdateJob({ notes: v || null });
              }}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </Field>

          {/* Materials table */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Materials
              </h4>
            </div>
            <div className="overflow-x-auto rounded-md border border-zinc-800">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="w-20 px-3 py-2 font-medium">Qty</th>
                    <th className="w-28 px-3 py-2 font-medium">Unit price</th>
                    <th className="w-28 px-3 py-2 font-medium">Total</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-center text-xs text-zinc-500"
                      >
                        No materials yet.
                      </td>
                    </tr>
                  )}
                  {materials.map((m) => {
                    const lineTotal =
                      (Number(m.quantity) || 0) * (Number(m.unit_price) || 0);
                    return (
                      <tr
                        key={m.id}
                        className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            defaultValue={m.item_name ?? ""}
                            disabled={!editable}
                            placeholder="Item (e.g. 2x4 stud)"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== (m.item_name ?? ""))
                                onUpdateMaterial(m.id, { item_name: v });
                            }}
                            className="w-full rounded bg-transparent px-1 py-0.5 text-zinc-200 outline-none placeholder:text-zinc-600 focus:bg-zinc-800/60 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                          />
                          {m.material_id && (
                            <span className="ml-1 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 text-[10px] uppercase tracking-wider text-blue-300">
                              Catalog
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <NumInput
                            value={m.quantity}
                            editable={editable}
                            onCommit={(v) =>
                              onUpdateMaterial(m.id, { quantity: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <NumInput
                            value={m.unit_price}
                            editable={editable}
                            onCommit={(v) =>
                              onUpdateMaterial(m.id, { unit_price: v })
                            }
                            prefix="$"
                          />
                        </td>
                        <td className="px-3 py-2 text-zinc-200">
                          {fmtUsd(lineTotal)}
                        </td>
                        <td className="w-8 px-2 py-2 text-right">
                          {editable && (
                            <button
                              type="button"
                              onClick={() => onDeleteMaterial(m.id)}
                              className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                              aria-label="Delete material"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editable && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddMaterial()}
                  className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
                >
                  <Plus className="h-3 w-3" />
                  Add row
                </button>
                <CatalogPicker
                  catalog={catalog}
                  onPick={(c) =>
                    onAddMaterial({
                      material_id: c.id,
                      item_name: c.product_name,
                      unit_price: c.price,
                      quantity: 1,
                    })
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogPicker({
  catalog,
  onPick,
}: {
  catalog: CatalogMaterial[];
  onPick: (c: CatalogMaterial) => void;
}) {
  const [value, setValue] = useState("");
  if (catalog.length === 0) {
    return (
      <span className="text-[11px] text-zinc-600">
        Materials catalog is empty — add items in the Materials module.
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
      >
        <option value="">Pull from Materials catalog…</option>
        {catalog.map((c) => (
          <option key={c.id} value={c.id}>
            {c.product_name}
            {c.price !== null ? ` · $${c.price}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          const picked = catalog.find((c) => c.id === value);
          if (picked) onPick(picked);
          setValue("");
        }}
        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
      >
        Add
      </button>
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
        wide ? "mt-3 sm:col-span-full" : ""
      }`}
    >
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function NumInput({
  value,
  editable,
  onCommit,
  prefix,
}: {
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
  prefix?: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  if (!editable) {
    return (
      <span className="block text-zinc-200">
        {prefix && value !== null && value !== 0 ? prefix : ""}
        {value === null ? <span className="text-zinc-500">—</span> : value}
      </span>
    );
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
          {prefix}
        </span>
      )}
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
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setDraft(value === null ? "" : String(value));
            e.currentTarget.blur();
          }
        }}
        className={`w-full rounded-md border border-zinc-800 bg-zinc-900 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          prefix ? "pl-5 pr-2" : "px-2"
        }`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "emerald"
          ? "text-emerald-300"
          : "text-zinc-100";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}
