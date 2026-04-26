"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ListChecks,
  Mail,
  Plus,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  STATUS_BORDER,
  STATUS_COLUMNS,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type ProjectSubOption,
  type ProjectTeamOption,
  type Task,
  type TaskStatus,
} from "./types";
import {
  STATUS_VALUES,
  createTask,
  deleteTask,
  fetchProjectSubOptions,
  fetchProjectTeamOptions,
  fetchTasks,
  updateTask,
  type TaskPatch,
} from "./queries";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type TimeTracking = {
  openLabel: string | null;
  dueLabel: string | null;
  overdue: boolean;
  dueSoon: boolean;
};

function trackTime(task: Task): TimeTracking {
  const today = new Date();
  let openLabel: string | null = null;
  let dueLabel: string | null = null;
  let overdue = false;
  let dueSoon = false;

  const startBasis = task.start_date
    ? new Date(task.start_date + "T00:00:00")
    : new Date(task.created_at);
  if (startBasis) {
    const days = Math.max(0, daysBetween(startBasis, today));
    openLabel = `Open ${days}d`;
  }

  if (task.due_date) {
    const due = new Date(task.due_date + "T00:00:00");
    const days = daysBetween(today, due);
    if (task.status === "complete") {
      dueLabel = null;
    } else if (days < 0) {
      dueLabel = `Overdue ${Math.abs(days)}d`;
      overdue = true;
    } else if (days === 0) {
      dueLabel = "Due today";
      dueSoon = true;
    } else {
      dueLabel = `Due in ${days}d`;
      if (days <= 2) dueSoon = true;
    }
  }

  return { openLabel, dueLabel, overdue, dueSoon };
}

function nameForSub(
  id: string | null,
  options: ProjectSubOption[],
): string | null {
  if (!id) return null;
  return options.find((o) => o.id === id)?.name ?? "Unknown sub";
}

function nameForUser(
  id: string | null,
  options: ProjectTeamOption[],
): string | null {
  if (!id) return null;
  return options.find((o) => o.user_id === id)?.name ?? "Unnamed";
}

export function TasksModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subOptions, setSubOptions] = useState<ProjectSubOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<ProjectTeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [taskRows, subs, team] = await Promise.all([
          fetchTasks(projectId),
          fetchProjectSubOptions(projectId),
          fetchProjectTeamOptions(projectId),
        ]);
        if (cancelled) return;
        setTasks(taskRows);
        setSubOptions(subs);
        setTeamOptions(team);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = {
      not_started: 0,
      in_progress: 0,
      complete: 0,
      delayed: 0,
    };
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status !== "complete" && trackTime(t).overdue).length,
    [tasks],
  );

  const visibleColumns = STATUS_COLUMNS.filter(
    (c) => showComplete || c.key !== "complete",
  );

  async function handleAdd() {
    try {
      const created = await createTask(projectId, { title: "New task" });
      setTasks((rows) => [created, ...rows]);
      setSelected(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function handleUpdate(id: string, patch: TaskPatch) {
    const prev = tasks;
    setTasks((rows) =>
      rows.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    if (selected && selected.id === id) {
      setSelected({ ...selected, ...patch });
    }
    try {
      await updateTask(id, patch);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  }

  async function handleDelete(task: Task) {
    const prev = tasks;
    setTasks((rows) => rows.filter((t) => t.id !== task.id));
    if (selected?.id === task.id) setSelected(null);
    try {
      await deleteTask(task.id);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Tasks</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit tasks.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {STATUS_VALUES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
              <span className="text-zinc-400">
                {STATUS_LABEL[s]} ({counts[s] ?? 0})
              </span>
            </span>
          ))}
          {overdueCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowComplete((v) => !v)}
            className={`rounded-md border px-3 py-1 text-xs transition ${
              showComplete
                ? "border-blue-500/40 bg-blue-600/10 text-blue-400"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {showComplete ? "Hide completed" : "Show completed"}
          </button>
          {editable && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div
          className={`grid gap-4 ${
            showComplete ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"
          }`}
        >
          {visibleColumns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <KanbanColumn
                key={col.key}
                status={col.key}
                label={col.label}
                count={colTasks.length}
                tasks={colTasks}
                subOptions={subOptions}
                teamOptions={teamOptions}
                onSelect={setSelected}
              />
            );
          })}
        </div>
      )}

      {selected && (
        <TaskModal
          task={selected}
          editable={editable}
          subOptions={subOptions}
          teamOptions={teamOptions}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  count,
  tasks,
  subOptions,
  teamOptions,
  onSelect,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  tasks: Task[];
  subOptions: ProjectSubOption[];
  teamOptions: ProjectTeamOption[];
  onSelect: (task: Task) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 text-xs uppercase tracking-wider text-zinc-500">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className={STATUS_TEXT[status]}>{label}</span>
        <span className="text-zinc-600">({count})</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 p-3 text-center text-xs text-zinc-600">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              subOptions={subOptions}
              teamOptions={teamOptions}
              onClick={() => onSelect(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  subOptions,
  teamOptions,
  onClick,
}: {
  task: Task;
  subOptions: ProjectSubOption[];
  teamOptions: ProjectTeamOption[];
  onClick: () => void;
}) {
  const time = trackTime(task);
  const subName = nameForSub(task.assigned_sub_id, subOptions);
  const userName = nameForUser(task.assigned_user_id, teamOptions);
  const dueColor = time.overdue
    ? "text-red-400"
    : time.dueSoon
      ? "text-amber-400"
      : "text-zinc-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-md border bg-zinc-900/60 p-3 text-left transition hover:bg-zinc-900 ${STATUS_BORDER[task.status]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-zinc-100">{task.title}</span>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-zinc-400">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {time.openLabel && (
          <span className="text-zinc-500">{time.openLabel}</span>
        )}
        {time.dueLabel && (
          <span className={`font-medium ${dueColor}`}>{time.dueLabel}</span>
        )}
      </div>

      {(subName || userName) && (
        <div className="flex flex-wrap gap-1.5">
          {subName && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
              Sub: {subName}
            </span>
          )}
          {userName && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
              {userName}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function TaskModal({
  task,
  editable,
  subOptions,
  teamOptions,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task;
  editable: boolean;
  subOptions: ProjectSubOption[];
  teamOptions: ProjectTeamOption[];
  onClose: () => void;
  onUpdate: (id: string, patch: TaskPatch) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const time = trackTime(task);

  async function commitTitle() {
    const next = title.trim();
    if (next && next !== task.title) await onUpdate(task.id, { title: next });
    else if (!next) setTitle(task.title);
  }

  async function commitDescription() {
    const next = description;
    const current = task.description ?? "";
    if (next !== current) await onUpdate(task.id, { description: next || null });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            disabled={!editable}
            className="flex-1 bg-transparent text-xl font-semibold text-zinc-100 outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {time.openLabel && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              {time.openLabel}
            </span>
          )}
          {time.dueLabel && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                time.overdue
                  ? "bg-red-500/10 text-red-400"
                  : time.dueSoon
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {time.dueLabel}
            </span>
          )}
          <span className="text-zinc-500">
            Created {fmtDate(task.created_at.slice(0, 10))}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Status">
            <StatusSelect
              value={task.status}
              editable={editable}
              onChange={(s) => onUpdate(task.id, { status: s })}
            />
          </Field>
          <Field label="Sub">
            <SimpleSelect
              value={task.assigned_sub_id}
              editable={editable}
              options={subOptions.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(v) => onUpdate(task.id, { assigned_sub_id: v })}
              emptyLabel="— Unassigned —"
              fallback="No subs on project"
            />
          </Field>
          <Field label="Team member">
            <SimpleSelect
              value={task.assigned_user_id}
              editable={editable}
              options={teamOptions.map((m) => ({
                value: m.user_id,
                label: m.name,
              }))}
              onChange={(v) => onUpdate(task.id, { assigned_user_id: v })}
              emptyLabel="— Unassigned —"
              fallback="No team on project"
            />
          </Field>
          <Field label="Start date">
            <DateInput
              value={task.start_date}
              editable={editable}
              onChange={(v) => onUpdate(task.id, { start_date: v })}
            />
          </Field>
          <Field label="Due date">
            <DateInput
              value={task.due_date}
              editable={editable}
              onChange={(v) => onUpdate(task.id, { due_date: v })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            disabled={!editable}
            rows={4}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
            title="Coming soon"
          >
            <Mail className="h-3.5 w-3.5" />
            Send status update request
          </button>
          {editable && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("Delete this task?")) {
                  await onDelete(task);
                }
              }}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-500/40 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
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
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function StatusSelect({
  value,
  editable,
  onChange,
}: {
  value: TaskStatus;
  editable: boolean;
  onChange: (next: TaskStatus) => void;
}) {
  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
        <span className={STATUS_TEXT[value]}>{STATUS_LABEL[value]}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
        className={`cursor-pointer appearance-none rounded bg-transparent px-1 py-0.5 text-sm outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${STATUS_TEXT[value]}`}
      >
        {STATUS_VALUES.map((s) => (
          <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </span>
  );
}

function SimpleSelect({
  value,
  editable,
  options,
  onChange,
  emptyLabel,
  fallback,
}: {
  value: string | null;
  editable: boolean;
  options: { value: string; label: string }[];
  onChange: (next: string | null) => void;
  emptyLabel: string;
  fallback: string;
}) {
  if (!editable) {
    const match = options.find((o) => o.value === value);
    return (
      <span className="text-zinc-300">
        {match?.label ?? <span className="text-zinc-500">—</span>}
      </span>
    );
  }
  if (options.length === 0) {
    return <span className="text-xs italic text-zinc-600">{fallback}</span>;
  }
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500"
    >
      <option value="" className="bg-zinc-900 text-zinc-400">
        {emptyLabel}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function DateInput({
  value,
  editable,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  onChange: (next: string | null) => void;
}) {
  if (!editable) {
    return <span className="text-zinc-300">{fmtDate(value)}</span>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded bg-transparent px-1 py-0.5 text-sm text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:text-zinc-200 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

// Suppress unused import warning — Calendar/UserIcon kept for future use.
void Calendar;
void UserIcon;
