"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  addSubToProject,
  createSub,
  deleteSub,
  fetchProjectSubs,
  fetchSubs,
  removeSubFromProject,
  updateSub,
  type SubPatch,
} from "./queries";
import type { ProjectSub, Sub } from "./types";

export function SubsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [projectSubs, setProjectSubs] = useState<ProjectSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
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
                {subs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-zinc-500">
                      No contractors yet.
                    </td>
                  </tr>
                )}
                {subs.map((sub) => {
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

          {editable && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-4 w-4" />
              Add contractor
            </button>
          )}
        </>
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
