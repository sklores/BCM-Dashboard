"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  addUserToProject,
  createUser,
  deleteUser,
  fetchProjectMembers,
  fetchUsers,
  removeUserFromProject,
  updateMemberRole,
  updateUser,
  type UserPatch,
} from "./queries";
import {
  PROJECT_ROLE_LABEL,
  PROJECT_ROLE_OPTIONS,
  type ProjectMember,
  type ProjectRole,
  type User,
} from "./types";

const DEFAULT_PROJECT_ROLE: ProjectRole = "pm";

export function TeamModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [allUsers, projectMembers] = await Promise.all([
          fetchUsers(),
          fetchProjectMembers(projectId),
        ]);
        if (cancelled) return;
        setUsers(allUsers);
        setMembers(projectMembers);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function memberFor(userId: string): ProjectMember | undefined {
    return members.find((m) => m.user_id === userId);
  }

  async function handleUpdate(id: string, patch: UserPatch) {
    const prev = users;
    setUsers((rows) => rows.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    try {
      await updateUser(id, patch);
    } catch (err) {
      setUsers(prev);
      setError(err instanceof Error ? err.message : "Failed to save user");
    }
  }

  async function handleAdd() {
    try {
      const created = await createUser();
      setUsers((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    }
  }

  async function handleDelete(id: string) {
    const prevUsers = users;
    const prevMembers = members;
    setUsers((rows) => rows.filter((u) => u.id !== id));
    setMembers((rows) => rows.filter((m) => m.user_id !== id));
    try {
      await deleteUser(id);
    } catch (err) {
      setUsers(prevUsers);
      setMembers(prevMembers);
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function handleToggleProject(user: User, on: boolean) {
    if (on) {
      const prev = members;
      try {
        const link = await addUserToProject(
          projectId,
          user.id,
          DEFAULT_PROJECT_ROLE,
        );
        setMembers((rows) => [...rows, link]);
      } catch (err) {
        setMembers(prev);
        setError(err instanceof Error ? err.message : "Failed to add to project");
      }
    } else {
      const link = memberFor(user.id);
      if (!link) return;
      const prev = members;
      setMembers((rows) => rows.filter((m) => m.id !== link.id));
      try {
        await removeUserFromProject(link.id);
      } catch (err) {
        setMembers(prev);
        setError(
          err instanceof Error ? err.message : "Failed to remove from project",
        );
      }
    }
  }

  async function handleRoleChange(linkId: string, nextRole: ProjectRole) {
    const prev = members;
    setMembers((rows) =>
      rows.map((m) => (m.id === linkId ? { ...m, role: nextRole } : m)),
    );
    try {
      await updateMemberRole(linkId, nextRole);
    } catch (err) {
      setMembers(prev);
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Team</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit team members.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <p className="text-sm text-zinc-400">
            All team members across projects. Toggle a row to add or remove the
            person from this project.
          </p>
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">On project</th>
                  <th className="px-3 py-2 font-medium">Project role</th>
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-zinc-500">
                      No team members yet.
                    </td>
                  </tr>
                )}
                {users.map((user) => {
                  const member = memberFor(user.id);
                  const onProject = !!member;
                  return (
                    <tr
                      key={user.id}
                      className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2">
                        <EditableText
                          value={user.full_name ?? ""}
                          editable={editable}
                          placeholder="Unnamed"
                          onCommit={(v) =>
                            handleUpdate(user.id, { full_name: v || null })
                          }
                          className="text-zinc-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableText
                          value={user.email ?? ""}
                          editable={editable}
                          placeholder="—"
                          onCommit={(v) =>
                            handleUpdate(user.id, { email: v })
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
                            handleToggleProject(user, e.target.checked)
                          }
                          className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed [color-scheme:dark]"
                          aria-label="Toggle on this project"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {member ? (
                          <RoleSelect
                            value={
                              (PROJECT_ROLE_OPTIONS as string[]).includes(
                                member.role ?? "",
                              )
                                ? (member.role as ProjectRole)
                                : DEFAULT_PROJECT_ROLE
                            }
                            editable={editable}
                            onChange={(r) => handleRoleChange(member.id, r)}
                          />
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="w-8 px-2 py-2 text-right">
                        {editable && (
                          <RowDeleteButton
                            label="Delete user"
                            onClick={() => handleDelete(user.id)}
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
              Add team member
            </button>
          )}
        </>
      )}
    </div>
  );
}

function RoleSelect({
  value,
  editable,
  onChange,
}: {
  value: ProjectRole;
  editable: boolean;
  onChange: (next: ProjectRole) => void;
}) {
  if (!editable) {
    return <span className="text-zinc-300">{PROJECT_ROLE_LABEL[value]}</span>;
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProjectRole)}
      className="cursor-pointer appearance-none rounded bg-transparent px-1 py-0.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
    >
      {PROJECT_ROLE_OPTIONS.map((r) => (
        <option key={r} value={r} className="bg-zinc-900 text-zinc-100">
          {PROJECT_ROLE_LABEL[r]}
        </option>
      ))}
    </select>
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
