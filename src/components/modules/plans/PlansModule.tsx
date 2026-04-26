"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Map, Plus, Trash2 } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Plan,
  type PlanCategory,
} from "./types";
import {
  createPlan,
  deletePlan,
  fetchPlans,
  updatePlan,
  type PlanPatch,
} from "./queries";

type Filter = PlanCategory | "all";

export function PlansModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchPlans(projectId);
        if (!cancelled) setPlans(rows);
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

  const counts = useMemo(() => {
    const c: Record<PlanCategory, number> = {
      stamped: 0,
      mep: 0,
      old: 0,
      takeoffs: 0,
      horizontal: 0,
    };
    for (const p of plans) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [plans]);

  const filtered =
    filter === "all" ? plans : plans.filter((p) => p.category === filter);

  async function handleAdd() {
    const cat: PlanCategory = filter === "all" ? "stamped" : filter;
    try {
      const created = await createPlan(projectId, cat);
      setPlans((rows) => [created, ...rows]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function handleUpdate(id: string, patch: PlanPatch) {
    const prev = plans;
    setPlans((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    try {
      await updatePlan(id, patch);
    } catch (err) {
      setPlans(prev);
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(plan: Plan) {
    const prev = plans;
    setPlans((rows) => rows.filter((p) => p.id !== plan.id));
    try {
      await deletePlan(plan.id);
    } catch (err) {
      setPlans(prev);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Map className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Plans</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit plans.
        </p>
      )}

      <div className="inline-flex w-fit flex-wrap rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded px-3 py-1 transition ${
            filter === "all"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          All ({plans.length})
        </button>
        {CATEGORIES.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`rounded px-3 py-1 transition ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {c.label} ({counts[c.key] ?? 0})
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Link</th>
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-zinc-500">
                      {filter === "all"
                        ? "No plans yet."
                        : `No plans in ${CATEGORY_LABEL[filter as PlanCategory]}.`}
                    </td>
                  </tr>
                )}
                {filtered.map((plan) => (
                  <tr
                    key={plan.id}
                    className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <TextInput
                        value={plan.name}
                        editable={editable}
                        onCommit={(v) =>
                          handleUpdate(plan.id, { name: v || "Untitled" })
                        }
                        className="text-zinc-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <select
                          value={plan.category}
                          onChange={(e) =>
                            handleUpdate(plan.id, {
                              category: e.target.value as PlanCategory,
                            })
                          }
                          className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key} className="bg-zinc-900">
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-zinc-300">
                          {CATEGORY_LABEL[plan.category]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <TextInput
                        value={plan.description ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(plan.id, { description: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <TextInput
                          value={plan.file_url ?? ""}
                          editable={editable}
                          placeholder="Paste OneDrive link"
                          onCommit={(v) =>
                            handleUpdate(plan.id, { file_url: v || null })
                          }
                          className="text-zinc-300"
                        />
                      ) : plan.file_url ? (
                        <a
                          href={plan.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Delete this plan?"))
                              handleDelete(plan);
                          }}
                          className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                          aria-label="Delete plan"
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
              onClick={handleAdd}
              className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-4 w-4" />
              Add plan
              {filter !== "all" && (
                <span className="text-xs text-zinc-500">
                  to {CATEGORY_LABEL[filter as PlanCategory]}
                </span>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

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
