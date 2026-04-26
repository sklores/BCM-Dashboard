"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Layout,
  ListChecks,
  Loader2,
  Paperclip,
  Plus,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  addAssignee,
  addDependency,
  createTask,
  deleteAttachment,
  deleteTask,
  fetchAssignees,
  fetchAttachments,
  fetchContactOptions,
  fetchDependencies,
  fetchPunchListDetails,
  fetchTasks,
  postAlert,
  removeAssignee,
  removeDependency,
  updateTask,
  uploadTaskAttachment,
  upsertPunchListDetails,
} from "./queries";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_STYLE,
  TASK_TYPES,
  TASK_TYPE_LABEL,
  TASK_TYPE_STYLE,
  fmtDate,
  isOverdue,
  nextRecurringDate,
  type ContactOption,
  type Priority,
  type PunchListDetails,
  type PunchListPatch,
  type RecurringFrequency,
  type Task,
  type TaskAssignee,
  type TaskAttachment,
  type TaskDependency,
  type TaskPatch,
  type TaskStatus,
  type TaskType,
} from "./types";

type View = "list" | "board" | "calendar";

export function TasksModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role) || role === "apm";

  const [view, setView] = useState<View>("list");
  const [punchMode, setPunchMode] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [punchDetails, setPunchDetails] = useState<PunchListDetails[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => new Date());

  useEffect(() => {
    if (role === "super") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [t, c] = await Promise.all([
          fetchTasks(projectId),
          fetchContactOptions(projectId),
        ]);
        if (cancelled) return;
        setTasks(t);
        setContacts(c);
        const ids = t.map((row) => row.id);
        const [a, att, dep, pd] = await Promise.all([
          fetchAssignees(ids),
          fetchAttachments(ids),
          fetchDependencies(ids),
          fetchPunchListDetails(ids),
        ]);
        if (cancelled) return;
        setAssignees(a);
        setAttachments(att);
        setDependencies(dep);
        setPunchDetails(pd);
        // Fire alerts on load (best effort)
        scanForAtRiskTasks(projectId, t, dep);
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
  }, [projectId, role]);

  // ---- Filtered list ----

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (punchMode && t.task_type !== "punch_list") return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
      return true;
    });
  }, [tasks, punchMode, statusFilter, typeFilter]);

  // ---- Task CRUD ----

  async function handleAddTask(extra: TaskPatch = {}) {
    try {
      const created = await createTask(projectId, {
        task_type: punchMode ? "punch_list" : "general",
        ...extra,
      });
      setTasks((rows) => [created, ...rows]);
      setOpenTask(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function handleUpdateTask(id: string, patch: TaskPatch) {
    const prev = tasks;
    const previous = prev.find((t) => t.id === id);
    setTasks((rows) =>
      rows.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    if (openTask?.id === id) setOpenTask({ ...openTask, ...patch });
    try {
      await updateTask(id, patch);
      // Recurring auto-generation when marked complete
      if (
        patch.status === "complete" &&
        previous &&
        previous.status !== "complete" &&
        previous.recurring &&
        previous.recurring_frequency &&
        previous.due_date
      ) {
        const nextDue = nextRecurringDate(
          previous.due_date,
          previous.recurring_frequency,
        );
        if (
          !previous.recurring_end_date ||
          nextDue <= previous.recurring_end_date
        ) {
          const nextStart = previous.start_date
            ? nextRecurringDate(
                previous.start_date,
                previous.recurring_frequency,
              )
            : null;
          const created = await createTask(projectId, {
            title: previous.title,
            description: previous.description ?? undefined,
            task_type: previous.task_type,
            priority: previous.priority,
            due_date: nextDue,
            start_date: nextStart ?? undefined,
            recurring: true,
            recurring_frequency: previous.recurring_frequency,
            recurring_end_date: previous.recurring_end_date ?? undefined,
            parent_task_id: previous.parent_task_id ?? previous.id,
            linked_module: previous.linked_module ?? undefined,
            linked_record_id: previous.linked_record_id ?? undefined,
          });
          setTasks((rows) => [created, ...rows]);
        }
      }
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  }

  async function handleDeleteTask(id: string) {
    if (!window.confirm("Delete this task?")) return;
    const prev = tasks;
    setTasks((rows) => rows.filter((t) => t.id !== id));
    if (openTask?.id === id) setOpenTask(null);
    try {
      await deleteTask(id);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  // ---- Assignees ----

  async function handleAddAssignee(taskId: string, contactId: string) {
    try {
      const a = await addAssignee(taskId, contactId);
      setAssignees((rows) => [...rows, a]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add assignee");
    }
  }
  async function handleRemoveAssignee(id: string) {
    const prev = assignees;
    setAssignees((rows) => rows.filter((a) => a.id !== id));
    try {
      await removeAssignee(id);
    } catch (err) {
      setAssignees(prev);
      setError(err instanceof Error ? err.message : "Failed to remove assignee");
    }
  }

  // ---- Attachments ----

  async function handleUploadAttachment(taskId: string, file: File) {
    try {
      const a = await uploadTaskAttachment(taskId, file);
      setAttachments((rows) => [...rows, a]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }
  async function handleDeleteAttachment(id: string) {
    const prev = attachments;
    setAttachments((rows) => rows.filter((a) => a.id !== id));
    try {
      await deleteAttachment(id);
    } catch (err) {
      setAttachments(prev);
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ---- Dependencies ----

  async function handleAddDependency(taskId: string, predecessorId: string) {
    try {
      const d = await addDependency(taskId, predecessorId);
      setDependencies((rows) => [...rows, d]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dependency");
    }
  }
  async function handleRemoveDependency(id: string) {
    const prev = dependencies;
    setDependencies((rows) => rows.filter((d) => d.id !== id));
    try {
      await removeDependency(id);
    } catch (err) {
      setDependencies(prev);
      setError(
        err instanceof Error ? err.message : "Failed to remove dependency",
      );
    }
  }

  // ---- Punch List Details ----

  async function handleUpdatePunch(taskId: string, patch: PunchListPatch) {
    try {
      const updated = await upsertPunchListDetails(taskId, patch);
      setPunchDetails((rows) => {
        const idx = rows.findIndex((r) => r.task_id === taskId);
        if (idx === -1) return [...rows, updated];
        const copy = [...rows];
        copy[idx] = updated;
        return copy;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details");
    }
  }

  if (role === "super") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ListChecks className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">Tasks</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Tasks are mobile-only for the Super role.
        </p>
      </div>
    );
  }

  // Punch list summary
  const punchTasks = tasks.filter((t) => t.task_type === "punch_list");
  const punchTotal = punchTasks.length;
  const punchDone = punchTasks.filter((t) => t.status === "complete").length;
  const punchRemaining = punchTotal - punchDone;
  const punchPct = punchTotal === 0 ? 0 : Math.round((punchDone / punchTotal) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <ListChecks className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">
          {punchMode ? "Punch List" : "Tasks"}
        </h1>
        <button
          type="button"
          onClick={() => setPunchMode((v) => !v)}
          className={`ml-auto flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition ${
            punchMode
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          }`}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {punchMode ? "Exit Punch List" : "Punch List Mode"}
        </button>
      </div>

      {punchMode && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Total" value={punchTotal} />
          <SummaryStat label="Completed" value={punchDone} tone="emerald" />
          <SummaryStat label="Remaining" value={punchRemaining} tone="amber" />
          <SummaryStat label="% Complete" value={`${punchPct}%`} tone="blue" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(
            [
              ["list", "List", ListChecks],
              ["board", "Board", Layout],
              ["calendar", "Calendar", CalendarDays],
            ] as const
          ).map(([key, label, Icon]) => {
            const active = key === view;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TaskStatus | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {!punchMode && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TaskType | "all")}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          >
            <option value="all">All types</option>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => handleAddTask()}
            className="ml-auto flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </button>
        )}
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit tasks.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && view === "list" && (
        <ListView
          tasks={filtered}
          assignees={assignees}
          contacts={contacts}
          dependencies={dependencies}
          allTasks={tasks}
          punchMode={punchMode}
          punchDetails={punchDetails}
          onOpen={setOpenTask}
        />
      )}

      {!loading && !error && view === "board" && (
        <BoardView
          tasks={filtered}
          editable={editable}
          onUpdateStatus={(id, status) =>
            handleUpdateTask(id, {
              status,
              completed_at: status === "complete" ? new Date().toISOString() : null,
            })
          }
          onOpen={setOpenTask}
        />
      )}

      {!loading && !error && view === "calendar" && (
        <CalendarView
          tasks={filtered}
          cursor={calendarCursor}
          setCursor={setCalendarCursor}
          onOpen={setOpenTask}
        />
      )}

      {openTask && (
        <TaskDetail
          task={openTask}
          allTasks={tasks}
          assignees={assignees.filter((a) => a.task_id === openTask.id)}
          attachments={attachments.filter((a) => a.task_id === openTask.id)}
          dependencies={dependencies.filter((d) => d.task_id === openTask.id)}
          punchDetails={punchDetails.find((p) => p.task_id === openTask.id) ?? null}
          contacts={contacts}
          editable={editable}
          onClose={() => setOpenTask(null)}
          onUpdate={(patch) => handleUpdateTask(openTask.id, patch)}
          onDelete={() => handleDeleteTask(openTask.id)}
          onAddAssignee={(cid) => handleAddAssignee(openTask.id, cid)}
          onRemoveAssignee={handleRemoveAssignee}
          onUploadAttachment={(file) =>
            handleUploadAttachment(openTask.id, file)
          }
          onDeleteAttachment={handleDeleteAttachment}
          onAddDependency={(pid) => handleAddDependency(openTask.id, pid)}
          onRemoveDependency={handleRemoveDependency}
          onUpdatePunch={(patch) => handleUpdatePunch(openTask.id, patch)}
        />
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "emerald" | "amber" | "blue";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "blue"
          ? "text-blue-300"
          : "text-zinc-100";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}

// ---------- List View ----------

function ListView({
  tasks,
  assignees,
  contacts,
  dependencies,
  allTasks,
  punchMode,
  punchDetails,
  onOpen,
}: {
  tasks: Task[];
  assignees: TaskAssignee[];
  contacts: ContactOption[];
  dependencies: TaskDependency[];
  allTasks: Task[];
  punchMode: boolean;
  punchDetails: PunchListDetails[];
  onOpen: (t: Task) => void;
}) {
  const [punchGroupBy, setPunchGroupBy] = useState<"sub" | "location">("sub");

  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
        No tasks match the current filters.
      </div>
    );
  }

  function rowFor(t: Task) {
    const ass = assignees
      .filter((a) => a.task_id === t.id)
      .map((a) => contacts.find((c) => c.id === a.contact_id)?.name ?? "?")
      .filter(Boolean);
    const overdue = isOverdue(t);
    const atRisk = dependencies
      .filter((d) => d.task_id === t.id)
      .some((d) => {
        const pred = allTasks.find((x) => x.id === d.predecessor_task_id);
        if (!pred || pred.status === "complete") return false;
        if (!t.due_date || !pred.due_date) return false;
        return pred.due_date >= t.due_date;
      });
    const punch = punchDetails.find((p) => p.task_id === t.id);
    const subName = punch?.responsible_sub_id
      ? contacts.find((c) => c.id === punch.responsible_sub_id)?.name ?? null
      : null;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onOpen(t)}
        className="flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
      >
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${TASK_STATUS_STYLE[t.status]}`}
        >
          {TASK_STATUS_LABEL[t.status]}
        </span>
        <span
          className={`hidden shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider sm:inline-flex ${PRIORITY_STYLE[t.priority]}`}
        >
          {PRIORITY_LABEL[t.priority]}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm ${
              t.status === "complete"
                ? "text-zinc-500 line-through"
                : "text-zinc-100"
            }`}
          >
            {t.title}
            {t.recurring && (
              <RotateCw className="ml-1 inline h-3 w-3 text-zinc-500" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
            {t.due_date && <span>Due {fmtDate(t.due_date)}</span>}
            {ass.length > 0 && <span>{ass.join(", ")}</span>}
            {punch?.location && <span>📍 {punch.location}</span>}
            {subName && <span>{subName}</span>}
          </div>
        </div>
        {overdue && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </span>
        )}
        {atRisk && (
          <span
            title="A predecessor is not complete and may slip your due date"
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
          >
            <AlertTriangle className="h-3 w-3" />
            At risk
          </span>
        )}
      </button>
    );
  }

  if (punchMode) {
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
      const punch = punchDetails.find((p) => p.task_id === t.id);
      const key =
        punchGroupBy === "sub"
          ? (punch?.responsible_sub_id
              ? contacts.find((c) => c.id === punch.responsible_sub_id)?.name ??
                "(unassigned)"
              : "(unassigned)")
          : punch?.location || "(no location)";
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    const ordered = Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return (
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(["sub", "location"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setPunchGroupBy(g)}
              className={`rounded px-3 py-1 text-xs transition ${
                punchGroupBy === g
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              By {g === "sub" ? "Sub" : "Location"}
            </button>
          ))}
        </div>
        {ordered.map(([key, items]) => (
          <div
            key={key}
            className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">{key}</h3>
              <span className="text-xs text-zinc-500">
                {items.filter((t) => t.status === "complete").length} of{" "}
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">{items.map(rowFor)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="flex flex-col gap-1.5">{tasks.map(rowFor)}</div>;
}

// ---------- Board View ----------

function BoardView({
  tasks,
  editable,
  onUpdateStatus,
  onOpen,
}: {
  tasks: Task[];
  editable: boolean;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onOpen: (t: Task) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {TASK_STATUSES.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-2"
          >
            <div className="flex items-center justify-between px-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${TASK_STATUS_STYLE[status]}`}
              >
                {TASK_STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-zinc-500">{items.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 && (
                <div className="rounded border border-dashed border-zinc-800 p-2 text-center text-[11px] text-zinc-600">
                  Empty
                </div>
              )}
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpen(t)}
                  className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-left transition hover:border-zinc-700 hover:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs ${
                        t.status === "complete"
                          ? "text-zinc-500 line-through"
                          : "text-zinc-100"
                      }`}
                    >
                      {t.title}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wider ${PRIORITY_STYLE[t.priority]}`}
                    >
                      {PRIORITY_LABEL[t.priority][0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    {t.due_date && <span>{fmtDate(t.due_date)}</span>}
                    {isOverdue(t) && (
                      <span className="text-red-400">Overdue</span>
                    )}
                  </div>
                  {editable && (
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(t.id, e.target.value as TaskStatus);
                      }}
                      className="mt-1 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-blue-500 [color-scheme:dark]"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Calendar View ----------

function CalendarView({
  tasks,
  cursor,
  setCursor,
  onOpen,
}: {
  tasks: Task[];
  cursor: Date;
  setCursor: (d: Date) => void;
  onOpen: (t: Task) => void;
}) {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  function toISO(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const today = new Date();
  const todayISO = toISO(today);

  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const arr = byDate.get(t.due_date) ?? [];
    arr.push(t);
    byDate.set(t.due_date, arr);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCursor(new Date())}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-2 text-sm font-medium text-zinc-300">
          {cursor.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40">
        <div className="grid grid-cols-7 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-1.5 text-center font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6">
          {days.map((d) => {
            const iso = toISO(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = iso === todayISO;
            const dayTasks = byDate.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={`min-h-24 border-b border-r border-zinc-800 p-1.5 ${
                  inMonth ? "bg-transparent" : "bg-zinc-900/20"
                }`}
              >
                <div
                  className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                      : inMonth
                        ? "text-zinc-300"
                        : "text-zinc-600"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpen(t)}
                      className={`truncate rounded px-1 py-0.5 text-left text-[10px] ${TASK_STATUS_STYLE[t.status]}`}
                    >
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-zinc-500">
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Task Detail (slide-out) ----------

function TaskDetail({
  task,
  allTasks,
  assignees,
  attachments,
  dependencies,
  punchDetails,
  contacts,
  editable,
  onClose,
  onUpdate,
  onDelete,
  onAddAssignee,
  onRemoveAssignee,
  onUploadAttachment,
  onDeleteAttachment,
  onAddDependency,
  onRemoveDependency,
  onUpdatePunch,
}: {
  task: Task;
  allTasks: Task[];
  assignees: TaskAssignee[];
  attachments: TaskAttachment[];
  dependencies: TaskDependency[];
  punchDetails: PunchListDetails | null;
  contacts: ContactOption[];
  editable: boolean;
  onClose: () => void;
  onUpdate: (patch: TaskPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddAssignee: (contactId: string) => Promise<void>;
  onRemoveAssignee: (id: string) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (id: string) => Promise<void>;
  onAddDependency: (predecessorId: string) => Promise<void>;
  onRemoveDependency: (id: string) => Promise<void>;
  onUpdatePunch: (patch: PunchListPatch) => Promise<void>;
}) {
  const [assigneePicker, setAssigneePicker] = useState("");
  const [depPicker, setDepPicker] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const usedAssigneeIds = new Set(
    assignees.map((a) => a.contact_id).filter(Boolean) as string[],
  );
  const otherTasks = allTasks.filter((t) => t.id !== task.id);
  const usedDepIds = new Set(dependencies.map((d) => d.predecessor_task_id));

  const subContacts = contacts.filter((c) => c.role_type === "subcontractor");

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <input
                type="text"
                defaultValue={task.title}
                disabled={!editable}
                onBlur={(e) => {
                  const v = e.target.value.trim() || "Untitled";
                  if (v !== task.title) onUpdate({ title: v });
                }}
                className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-zinc-100 outline-none focus:border-zinc-800 focus:bg-zinc-900 disabled:opacity-60"
              />
              <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                <span>Created {fmtDate(task.created_at.slice(0, 10))}</span>
                {task.parent_task_id && (
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] uppercase tracking-wider text-violet-300">
                    Recurring instance
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Status / Type / Priority */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <select
                value={task.status}
                disabled={!editable}
                onChange={(e) => {
                  const status = e.target.value as TaskStatus;
                  onUpdate({
                    status,
                    completed_at:
                      status === "complete" ? new Date().toISOString() : null,
                  });
                }}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={task.task_type}
                disabled={!editable}
                onChange={(e) =>
                  onUpdate({ task_type: e.target.value as TaskType })
                }
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={task.priority}
                disabled={!editable}
                onChange={(e) =>
                  onUpdate({ priority: e.target.value as Priority })
                }
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <input
                type="date"
                value={task.start_date ?? ""}
                disabled={!editable}
                onChange={(e) =>
                  onUpdate({
                    start_date: e.target.value === "" ? null : e.target.value,
                  })
                }
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={task.due_date ?? ""}
                disabled={!editable}
                onChange={(e) =>
                  onUpdate({
                    due_date: e.target.value === "" ? null : e.target.value,
                  })
                }
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
              />
            </Field>
          </div>

          {/* Description */}
          <Field label="Description / notes" wide>
            <textarea
              defaultValue={task.description ?? ""}
              disabled={!editable}
              rows={3}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (task.description ?? ""))
                  onUpdate({ description: v || null });
              }}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </Field>

          {/* Assignees */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Assignees
            </h3>
            <div className="mb-2 flex flex-wrap gap-2">
              {assignees.length === 0 && (
                <span className="text-xs text-zinc-500">No assignees yet.</span>
              )}
              {assignees.map((a) => {
                const c = contacts.find((x) => x.id === a.contact_id);
                return (
                  <span
                    key={a.id}
                    className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-200"
                  >
                    {c?.name ?? "Unknown"}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => onRemoveAssignee(a.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            {editable && (
              <div className="flex items-center gap-2">
                <select
                  value={assigneePicker}
                  onChange={(e) => setAssigneePicker(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                >
                  <option value="">Add from contacts…</option>
                  {contacts
                    .filter((c) => !usedAssigneeIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!assigneePicker}
                  onClick={async () => {
                    await onAddAssignee(assigneePicker);
                    setAssigneePicker("");
                  }}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Recurring */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Recurring
            </h3>
            <label className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={task.recurring}
                disabled={!editable}
                onChange={(e) =>
                  onUpdate({
                    recurring: e.target.checked,
                    recurring_frequency: e.target.checked
                      ? task.recurring_frequency ?? "weekly"
                      : null,
                  })
                }
                className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 [color-scheme:dark]"
              />
              Recurring task
            </label>
            {task.recurring && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Frequency">
                  <select
                    value={task.recurring_frequency ?? "weekly"}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdate({
                        recurring_frequency: e.target.value as RecurringFrequency,
                      })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                  >
                    {RECURRING_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {RECURRING_FREQUENCY_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="End date (optional)">
                  <input
                    type="date"
                    value={task.recurring_end_date ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdate({
                        recurring_end_date:
                          e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Soft dependencies */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Predecessors
            </h3>
            <div className="mb-2 flex flex-col gap-1">
              {dependencies.length === 0 && (
                <span className="text-xs text-zinc-500">
                  No predecessors. Add one to flag this task at risk if its
                  predecessor slips.
                </span>
              )}
              {dependencies.map((d) => {
                const pred = allTasks.find(
                  (t) => t.id === d.predecessor_task_id,
                );
                if (!pred) return null;
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs"
                  >
                    <span className="flex-1 text-zinc-200">{pred.title}</span>
                    <span
                      className={`rounded-full border px-1.5 py-0 text-[10px] ${TASK_STATUS_STYLE[pred.status]}`}
                    >
                      {TASK_STATUS_LABEL[pred.status]}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => onRemoveDependency(d.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {editable && (
              <div className="flex items-center gap-2">
                <select
                  value={depPicker}
                  onChange={(e) => setDepPicker(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                >
                  <option value="">Pick a predecessor task…</option>
                  {otherTasks
                    .filter((t) => !usedDepIds.has(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!depPicker}
                  onClick={async () => {
                    await onAddDependency(depPicker);
                    setDepPicker("");
                  }}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Punch list details */}
          {task.task_type === "punch_list" && (
            <div className="border-t border-zinc-800 pt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Punch list details
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Location" wide>
                  <input
                    type="text"
                    defaultValue={punchDetails?.location ?? ""}
                    disabled={!editable}
                    placeholder="e.g. Lobby ceiling, Unit 402 bath"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (punchDetails?.location ?? ""))
                        onUpdatePunch({ location: v || null });
                    }}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </Field>
                <Field label="Responsible sub">
                  <select
                    value={punchDetails?.responsible_sub_id ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdatePunch({
                        responsible_sub_id:
                          e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                  >
                    <option value="">— None —</option>
                    {(subContacts.length > 0 ? subContacts : contacts).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sign-off required">
                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={!!punchDetails?.sign_off_required}
                      disabled={!editable}
                      onChange={(e) =>
                        onUpdatePunch({ sign_off_required: e.target.checked })
                      }
                      className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 [color-scheme:dark]"
                    />
                    Yes
                  </label>
                </Field>
                <Field label="Sign-off date">
                  <input
                    type="date"
                    value={punchDetails?.sign_off_date ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdatePunch({
                        sign_off_date:
                          e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                  />
                </Field>
                <Field label="Sign-off by" wide>
                  <select
                    value={punchDetails?.sign_off_by ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdatePunch({
                        sign_off_by: e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                  >
                    <option value="">— None —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Attachments
            </h3>
            <div className="mb-2 flex flex-col gap-1">
              {attachments.length === 0 && (
                <span className="text-xs text-zinc-500">No files yet.</span>
              )}
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3 text-zinc-500" />
                  <a
                    href={a.file_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate text-blue-300 hover:underline"
                  >
                    {a.file_name ?? "file"}
                  </a>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(a.id)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <label
                className={`flex w-fit cursor-pointer items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs transition hover:border-blue-500 hover:text-blue-400 ${
                  uploading ? "opacity-60" : "text-zinc-300"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Add file
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploading(true);
                    try {
                      await onUploadAttachment(f);
                    } finally {
                      setUploading(false);
                      if (fileRef.current) fileRef.current.value = "";
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Linked module record (read-only display + free edit) */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Linked record
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Module">
                <input
                  type="text"
                  defaultValue={task.linked_module ?? ""}
                  disabled={!editable}
                  placeholder="e.g. permits, rfis"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (task.linked_module ?? ""))
                      onUpdate({ linked_module: v || null });
                  }}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </Field>
              <Field label="Record ID">
                <input
                  type="text"
                  defaultValue={task.linked_record_id ?? ""}
                  disabled={!editable}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (task.linked_record_id ?? ""))
                      onUpdate({ linked_record_id: v || null });
                  }}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </Field>
            </div>
            {task.task_type === "action_item" && task.linked_module === "meetings" && (
              <p className="mt-2 text-[11px] text-zinc-600">
                Originated from a Notes meeting action item.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-3">
            {task.recurring && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                <RotateCw className="h-3 w-3" />
                Auto-creates next instance on complete
              </span>
            )}
            {editable && (
              <button
                type="button"
                onClick={async () => {
                  await onDelete();
                  onClose();
                }}
                className="ml-auto rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
              >
                Delete task
              </button>
            )}
          </div>
        </div>
      </div>
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
        wide ? "sm:col-span-2" : ""
      }`}
    >
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

// ---------- Background alert checks ----------

async function scanForAtRiskTasks(
  projectId: string,
  tasks: Task[],
  deps: TaskDependency[],
): Promise<void> {
  // task_at_risk: a task with a predecessor that's not complete and whose
  // predecessor due_date is on or after the dependent's due_date.
  for (const dep of deps) {
    const t = tasks.find((x) => x.id === dep.task_id);
    const pred = tasks.find((x) => x.id === dep.predecessor_task_id);
    if (!t || !pred) continue;
    if (pred.status === "complete") continue;
    if (!t.due_date || !pred.due_date) continue;
    if (pred.due_date >= t.due_date) {
      try {
        await postAlert(
          projectId,
          "task_at_risk",
          `Task "${t.title}" at risk — predecessor "${pred.title}" not yet complete (due ${pred.due_date})`,
        );
      } catch {
        /* ignore */
      }
    }
  }
  // task_overdue: tasks past due_date and not complete/cancelled
  for (const t of tasks) {
    if (!isOverdue(t)) continue;
    try {
      await postAlert(
        projectId,
        "task_overdue",
        `Task "${t.title}" overdue (was due ${t.due_date})`,
      );
    } catch {
      /* ignore */
    }
  }
}

