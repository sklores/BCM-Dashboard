"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Loader2,
  Plus,
  Search,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ---------- Types ----------

type TodoStatus = "open" | "done" | "deferred";

const TODO_STATUSES: TodoStatus[] = ["open", "done", "deferred"];

const TODO_STATUS_LABEL: Record<TodoStatus, string> = {
  open: "Open",
  done: "Done",
  deferred: "Deferred",
};

const TODO_STATUS_STYLE: Record<TodoStatus, string> = {
  open: "border-zinc-700 bg-zinc-900 text-zinc-300",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  deferred: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

type Todo = {
  id: string;
  project_id: string;
  title: string;
  status: TodoStatus;
  done: boolean; // legacy column kept in sync for mobile compat
  sort_order: number;
  created_at: string;
  device_id: string | null;
  shared: boolean;
  raised_by: string | null;
};

type ContactOption = {
  id: string;
  name: string;
};

const SELECT_COLS =
  "id, project_id, title, status, done, sort_order, created_at, device_id, shared, raised_by";

// Per-device pseudo-user id used to scope private items. Same key the
// dashboard has used since Phase E.
const DEVICE_ID_KEY = "bcm-dashboard-device-id";

function getDeviceId(): string {
  if (typeof window === "undefined")
    return "00000000-0000-0000-0000-000000000000";
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    // ignore storage errors
  }
  return fresh;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

// ---------- Section ----------

export function TodoSection({
  projectId,
  editable,
}: {
  projectId: string;
  editable: boolean;
}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftShared, setDraftShared] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TodoStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [deviceId, setDeviceId] = useState<string>("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [todosRes, contactsRes] = await Promise.all([
          supabase
            .from("personal_todos")
            .select(SELECT_COLS)
            .eq("project_id", projectId)
            .or(`device_id.eq.${deviceId},shared.eq.true`)
            .order("status", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("contacts")
            .select("id, first_name, last_name, email")
            .eq("project_id", projectId)
            .order("last_name", { ascending: true }),
        ]);
        if (todosRes.error) throw todosRes.error;
        if (cancelled) return;
        setTodos((todosRes.data ?? []) as Todo[]);
        if (!contactsRes.error) {
          setContacts(
            (contactsRes.data ?? []).map((c) => ({
              id: c.id as string,
              name:
                `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                ((c.email as string | null) ?? "Unnamed contact"),
            })),
          );
        }
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
  }, [projectId, deviceId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [todos, statusFilter, search]);

  async function handleAdd() {
    const title = draft.trim();
    if (!title || !deviceId) return;
    const optimistic: Todo = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      title,
      status: "open",
      done: false,
      sort_order: 0,
      created_at: new Date().toISOString(),
      device_id: deviceId,
      shared: draftShared,
      raised_by: null,
    };
    setTodos((prev) => [...prev, optimistic]);
    setDraft("");
    setDraftShared(false);
    try {
      const { data, error } = await supabase
        .from("personal_todos")
        .insert({
          project_id: projectId,
          title,
          status: "open",
          done: false,
          device_id: deviceId,
          shared: optimistic.shared,
        })
        .select(SELECT_COLS)
        .single();
      if (error) throw error;
      setTodos((prev) =>
        prev.map((t) => (t.id === optimistic.id ? (data as Todo) : t)),
      );
    } catch (err) {
      setTodos((prev) => prev.filter((t) => t.id !== optimistic.id));
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function handleUpdate(
    id: string,
    patch: Partial<Pick<Todo, "title" | "status" | "raised_by" | "shared">>,
  ) {
    const prev = todos;
    // If status changes, keep the legacy `done` boolean in sync so the
    // mobile app (which still reads `done`) stays consistent.
    const next: Partial<Todo> = { ...patch };
    if (patch.status !== undefined) next.done = patch.status === "done";

    setTodos((rows) => rows.map((t) => (t.id === id ? { ...t, ...next } : t)));
    try {
      const dbPatch: Record<string, unknown> = { ...patch };
      if (patch.status !== undefined)
        dbPatch.done = patch.status === "done";
      const { error } = await supabase
        .from("personal_todos")
        .update(dbPatch)
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      setTodos(prev);
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleResolve(id: string, resolved: boolean) {
    await handleUpdate(id, { status: resolved ? "done" : "open" });
  }

  async function handleDelete(id: string) {
    const prev = todos;
    setTodos((rows) => rows.filter((t) => t.id !== id));
    try {
      const { error } = await supabase
        .from("personal_todos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      setTodos(prev);
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        Personal checklist for this project — scoped to this browser until
        full user accounts ship. Items shared from mobile (Super in the
        field) appear here too.
      </p>

      {/* Filter row — mirrors Notes → Pending Items */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TodoStatus | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All statuses</option>
          {TODO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TODO_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Add row */}
      {editable && (
        <div className="flex flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              placeholder="Add a to-do…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={draft.trim() === ""}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <label className="inline-flex select-none items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-400">
            <input
              type="checkbox"
              checked={draftShared}
              onChange={(e) => setDraftShared(e.target.checked)}
              className="h-3 w-3 accent-blue-500"
            />
            Share with project (visible to mobile + other browsers)
          </label>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {todos.length === 0
            ? "Nothing to do yet."
            : "No items match the current filters."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((t) => {
            const raisedBy = t.raised_by
              ? contacts.find((c) => c.id === t.raised_by)
              : null;
            const isMine = t.device_id === deviceId;
            const canEdit = editable && (isMine || t.shared);
            return (
              <li
                key={t.id}
                className={`flex items-start gap-3 rounded-md border bg-zinc-900/40 p-3 ${
                  t.status === "deferred"
                    ? "border-zinc-800 opacity-70"
                    : "border-zinc-800"
                }`}
              >
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleResolve(t.id, t.status !== "done")}
                  className={`mt-0.5 rounded p-1 ${
                    canEdit ? "hover:bg-zinc-800" : "opacity-60"
                  }`}
                  aria-label={t.status === "done" ? "Reopen" : "Resolve"}
                >
                  {t.status === "done" ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4 text-zinc-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    {!isMine && (
                      <Smartphone
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400"
                        aria-label="From another device (mobile or other browser)"
                      />
                    )}
                    <input
                      type="text"
                      defaultValue={t.title}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v.trim() && v !== t.title)
                          handleUpdate(t.id, { title: v.trim() });
                      }}
                      placeholder="To-do"
                      className={`w-full bg-transparent text-sm outline-none ${
                        t.status === "done"
                          ? "text-zinc-500 line-through"
                          : "text-zinc-200"
                      }`}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    <span>Added: {fmtDate(t.created_at)}</span>
                    {raisedBy && <span>By {raisedBy.name}</span>}
                    {t.shared && (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-blue-300">
                        Shared
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={t.status}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleUpdate(t.id, {
                        status: e.target.value as TodoStatus,
                      })
                    }
                    className={`rounded-full border px-2 py-0.5 text-[11px] outline-none [color-scheme:dark] ${TODO_STATUS_STYLE[t.status]}`}
                  >
                    {TODO_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TODO_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={t.raised_by ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleUpdate(t.id, {
                        raised_by:
                          e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                  >
                    <option value="">Raised by…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Delete to-do"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
