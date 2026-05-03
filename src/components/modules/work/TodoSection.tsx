"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Todo = {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  device_id: string | null;
};

// Per-device pseudo-user id used to scope To Do items to "this user" until
// real auth lands in v2. Stored in localStorage so the same browser keeps
// seeing the same list across reloads. Other devices / browsers / users see
// their own list.
const DEVICE_ID_KEY = "bcm-dashboard-device-id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
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

export function TodoSection({
  projectId,
  editable,
}: {
  projectId: string;
  editable: boolean;
}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
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
        const { data, error } = await supabase
          .from("personal_todos")
          .select("id, project_id, title, done, sort_order, created_at, device_id")
          .eq("project_id", projectId)
          .eq("device_id", deviceId)
          .order("done", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!cancelled) setTodos((data ?? []) as Todo[]);
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

  async function handleAdd() {
    const title = draft.trim();
    if (!title || !deviceId) return;
    const optimistic: Todo = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      title,
      done: false,
      sort_order: 0,
      created_at: new Date().toISOString(),
      device_id: deviceId,
    };
    setTodos((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const { data, error } = await supabase
        .from("personal_todos")
        .insert({ project_id: projectId, title, device_id: deviceId })
        .select("id, project_id, title, done, sort_order, created_at, device_id")
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

  async function handleToggle(id: string, done: boolean) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try {
      await supabase.from("personal_todos").update({ done }).eq("id", id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleEdit(id: string, title: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      await supabase.from("personal_todos").update({ title }).eq("id", id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    const prev = todos;
    setTodos((rows) => rows.filter((t) => t.id !== id));
    try {
      await supabase.from("personal_todos").delete().eq("id", id);
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

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        Quick personal checklist for this project — scoped to this browser
        until full user accounts ship.
      </p>

      {editable && (
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
      )}

      {open.length === 0 && done.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
          Nothing to do yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {open.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              editable={editable}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {done.length > 0 && (
            <li className="pt-2 text-[10px] uppercase tracking-wider text-zinc-600">
              Done
            </li>
          )}
          {done.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              editable={editable}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  editable,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  editable: boolean;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onEdit: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(todo.title);
  useEffect(() => setDraft(todo.title), [todo.title]);
  return (
    <li className="group flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5">
      <input
        type="checkbox"
        checked={todo.done}
        disabled={!editable}
        onChange={(e) => onToggle(todo.id, e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <input
        type="text"
        value={draft}
        disabled={!editable}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() && draft !== todo.title) onEdit(todo.id, draft.trim());
          else if (!draft.trim()) setDraft(todo.title);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(todo.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`flex-1 bg-transparent text-sm outline-none disabled:opacity-60 ${
          todo.done ? "text-zinc-500 line-through" : "text-zinc-100"
        }`}
      />
      {editable && (
        <button
          type="button"
          onClick={() => onDelete(todo.id)}
          className="rounded p-0.5 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-800 hover:text-red-400"
          aria-label="Delete to-do"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
