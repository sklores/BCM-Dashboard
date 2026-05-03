"use client";

import { Fragment, useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileUp,
  Flag,
  GripVertical,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { canEdit, useRole } from "@/lib/role-context";
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type MaterialCatalogOption,
  type ProjectSubOption,
  type ProjectTeamOption,
  type ScheduleStatus,
  type ScheduleMaterialCard,
  type SchedulePhase,
  type ScheduleSubtask,
  type ScheduleTask,
} from "./types";
import type {
  MaterialCardPatch,
  PhasePatch,
  SubtaskPatch,
  TaskPatch,
} from "./queries";

type Zoom = "weekly" | "monthly" | "full";

const ZOOMS: { key: Zoom; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "full", label: "Full Project" },
];

const STATUS_OPTIONS: ScheduleStatus[] = [
  "not_started",
  "in_progress",
  "complete",
  "delayed",
];

const TOTAL_COLS = 8;

type Handlers = {
  editable: boolean;
  subOptions: ProjectSubOption[];
  teamOptions: ProjectTeamOption[];
  materialCatalog: MaterialCatalogOption[];
  onUpdatePhase: (id: string, patch: PhasePatch) => Promise<void>;
  onUpdateTask: (id: string, patch: TaskPatch) => Promise<void>;
  onUpdateSubtask: (id: string, patch: SubtaskPatch) => Promise<void>;
  onUpdateMaterialCard: (id: string, patch: MaterialCardPatch) => Promise<void>;
  onAddTask: (phaseId: string) => Promise<void>;
  onAddSubtask: (taskId: string) => Promise<void>;
  onAddMaterialCard: (taskId: string) => Promise<void>;
  onDeletePhase: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onDeleteSubtask: (id: string) => Promise<void>;
  onDeleteMaterialCard: (id: string) => Promise<void>;
  onCreateJobFromSubtask: (
    subtaskId: string,
    phaseId: string,
    subtaskName: string,
  ) => Promise<void>;
};

export function DetailedGanttView({
  phases,
  tasks,
  subtasks,
  materialCards,
  subOptions,
  teamOptions,
  materialCatalog,
  onUpdatePhase,
  onUpdateTask,
  onUpdateSubtask,
  onUpdateMaterialCard,
  onAddPhase,
  onAddTask,
  onAddSubtask,
  onAddMaterialCard,
  onDeletePhase,
  onDeleteTask,
  onDeleteSubtask,
  onDeleteMaterialCard,
  onReorderPhases,
  onCreateJobFromSubtask,
}: {
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
  subtasks: ScheduleSubtask[];
  materialCards: ScheduleMaterialCard[];
  subOptions: ProjectSubOption[];
  teamOptions: ProjectTeamOption[];
  materialCatalog: MaterialCatalogOption[];
  onUpdatePhase: (id: string, patch: PhasePatch) => Promise<void>;
  onUpdateTask: (id: string, patch: TaskPatch) => Promise<void>;
  onUpdateSubtask: (id: string, patch: SubtaskPatch) => Promise<void>;
  onUpdateMaterialCard: (id: string, patch: MaterialCardPatch) => Promise<void>;
  onAddPhase: () => Promise<void>;
  onAddTask: (phaseId: string) => Promise<void>;
  onAddSubtask: (taskId: string) => Promise<void>;
  onAddMaterialCard: (taskId: string) => Promise<void>;
  onDeletePhase: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onDeleteSubtask: (id: string) => Promise<void>;
  onDeleteMaterialCard: (id: string) => Promise<void>;
  onReorderPhases: (reordered: SchedulePhase[]) => Promise<void>;
  onCreateJobFromSubtask: (
    subtaskId: string,
    phaseId: string,
    subtaskName: string,
  ) => Promise<void>;
}) {
  const role = useRole();
  const editable = canEdit(role);
  const [zoom, setZoom] = useState<Zoom>("monthly");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    () => new Set(phases.map((p) => p.id)),
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    () =>
      new Set(
        tasks
          .filter(
            (t) =>
              subtasks.some((s) => s.task_id === t.id) ||
              materialCards.some((c) => c.task_id === t.id),
          )
          .map((t) => t.id),
      ),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function togglePhase(id: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTask(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderPhases(arrayMove(phases, oldIndex, newIndex));
  }

  const handlers: Handlers = {
    editable,
    subOptions,
    teamOptions,
    materialCatalog,
    onUpdatePhase,
    onUpdateTask,
    onUpdateSubtask,
    onUpdateMaterialCard,
    onAddTask,
    onAddSubtask,
    onAddMaterialCard,
    onDeletePhase,
    onDeleteTask,
    onDeleteSubtask,
    onDeleteMaterialCard,
    onCreateJobFromSubtask,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <ZoomControl value={zoom} onChange={setZoom} />
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
          title="Coming soon"
        >
          <FileUp className="h-3.5 w-3.5" />
          Import from MS Project PDF
        </button>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit tasks.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Sub</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Start</th>
                <th className="px-3 py-2 font-medium">End</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {phases.length === 0 && (
                <tr>
                  <td colSpan={TOTAL_COLS} className="px-3 py-4 text-zinc-500">
                    No phases yet.
                  </td>
                </tr>
              )}
              <SortableContext
                items={phases.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {phases.map((phase) => {
                  const phaseTasks = tasks.filter(
                    (t) => t.phase_id === phase.id,
                  );
                  const phaseOpen = expandedPhases.has(phase.id);
                  return (
                    <Fragment key={phase.id}>
                      <SortablePhaseRow
                        phase={phase}
                        taskCount={phaseTasks.length}
                        phaseOpen={phaseOpen}
                        onToggle={() => togglePhase(phase.id)}
                        handlers={handlers}
                      />
                      {phaseOpen &&
                        phaseTasks.map((task) => {
                          const taskSubtasks = subtasks.filter(
                            (s) => s.task_id === task.id,
                          );
                          const taskCards = materialCards.filter(
                            (c) => c.task_id === task.id,
                          );
                          const taskOpen = expandedTasks.has(task.id);
                          const childCount =
                            taskSubtasks.length + taskCards.length;
                          return (
                            <Fragment key={task.id}>
                              <TaskRow
                                task={task}
                                childCount={childCount}
                                taskOpen={taskOpen}
                                onToggle={() => toggleTask(task.id)}
                                handlers={handlers}
                              />
                              {taskOpen &&
                                taskSubtasks.map((subtask) => (
                                  <SubtaskRow
                                    key={subtask.id}
                                    subtask={subtask}
                                    phaseId={phase.id}
                                    handlers={handlers}
                                  />
                                ))}
                              {taskOpen &&
                                taskCards.map((card) => (
                                  <MaterialCardRow
                                    key={card.id}
                                    card={card}
                                    handlers={handlers}
                                  />
                                ))}
                              {taskOpen && editable && (
                                <>
                                  <AddRow
                                    pl="pl-16"
                                    label="Add subtask"
                                    onAdd={() => onAddSubtask(task.id)}
                                  />
                                  <AddRow
                                    pl="pl-16"
                                    label="Add material card"
                                    onAdd={() => onAddMaterialCard(task.id)}
                                  />
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      {phaseOpen && editable && (
                        <AddRow
                          pl="pl-10"
                          label="Add task"
                          onAdd={() => onAddTask(phase.id)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </SortableContext>
            </tbody>
          </table>
        </div>
      </DndContext>

      {editable && (
        <button
          type="button"
          onClick={() => onAddPhase()}
          className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          Add phase
        </button>
      )}
    </div>
  );
}

function SortablePhaseRow({
  phase,
  taskCount,
  phaseOpen,
  onToggle,
  handlers,
}: {
  phase: SchedulePhase;
  taskCount: number;
  phaseOpen: boolean;
  onToggle: () => void;
  handlers: Handlers;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const { editable } = handlers;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="group border-b border-zinc-800 bg-zinc-900/40"
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {editable && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
              aria-label="Drag to reorder phase"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label={phaseOpen ? "Collapse" : "Expand"}
          >
            {phaseOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <EditableText
            value={phase.name}
            editable={editable}
            onCommit={(v) => handlers.onUpdatePhase(phase.id, { name: v })}
            className="font-medium text-zinc-100"
          />
          <span className="text-xs font-normal text-zinc-500">
            ({taskCount})
          </span>
          {phase.progress_pct !== null && phase.progress_pct !== undefined && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300"
              title="Progress driven by jobs marked complete"
            >
              {phase.progress_pct}%
            </span>
          )}
          <label
            className={`ml-2 inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
              phase.is_milestone
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            } ${editable ? "" : "cursor-default opacity-70"}`}
            title="Show this phase in the Milestone view"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={phase.is_milestone}
              disabled={!editable}
              onChange={(e) =>
                handlers.onUpdatePhase(phase.id, {
                  is_milestone: e.target.checked,
                })
              }
              className="h-3 w-3 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-amber-400 focus:ring-1 focus:ring-amber-500 focus:ring-offset-0 disabled:cursor-default [color-scheme:dark]"
            />
            <Flag className="h-3 w-3" />
            Milestone
          </label>
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusCell
          value={phase.status}
          editable={editable}
          onChange={(s) => handlers.onUpdatePhase(phase.id, { status: s })}
        />
      </td>
      <td className="px-3 py-2 text-zinc-600">—</td>
      <td className="px-3 py-2 text-zinc-600">—</td>
      <td className="px-3 py-2">
        <DateCell
          value={phase.start_date}
          editable={editable}
          onCommit={(v) => handlers.onUpdatePhase(phase.id, { start_date: v })}
        />
      </td>
      <td className="px-3 py-2">
        <DateCell
          value={phase.end_date}
          editable={editable}
          onCommit={(v) => handlers.onUpdatePhase(phase.id, { end_date: v })}
        />
      </td>
      <td className="px-3 py-2">
        <EditableText
          value={phase.notes ?? ""}
          editable={editable}
          placeholder="—"
          onCommit={(v) =>
            handlers.onUpdatePhase(phase.id, { notes: v || null })
          }
          className="text-zinc-300"
        />
      </td>
      <td className="w-8 px-2 py-2 text-right">
        {editable && (
          <RowDeleteButton
            label="Delete phase and all its tasks"
            onClick={() => handlers.onDeletePhase(phase.id)}
          />
        )}
      </td>
    </tr>
  );
}

function TaskRow({
  task,
  childCount,
  taskOpen,
  onToggle,
  handlers,
}: {
  task: ScheduleTask;
  childCount: number;
  taskOpen: boolean;
  onToggle: () => void;
  handlers: Handlers;
}) {
  const { editable, subOptions, teamOptions } = handlers;
  return (
    <tr className="group border-b border-zinc-900 hover:bg-zinc-900/40">
      <td className="px-3 py-2 pl-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label={taskOpen ? "Collapse" : "Expand"}
          >
            {taskOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <EditableText
            value={task.name}
            editable={editable}
            onCommit={(v) => handlers.onUpdateTask(task.id, { name: v })}
            className="text-zinc-200"
          />
          {childCount > 0 && (
            <span className="text-xs font-normal text-zinc-500">
              ({childCount})
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusCell
          value={task.status}
          editable={editable}
          onChange={(s) => handlers.onUpdateTask(task.id, { status: s })}
        />
      </td>
      <td className="px-3 py-2">
        <PickerCell
          value={task.assigned_sub_id}
          editable={editable}
          options={subOptions.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) =>
            handlers.onUpdateTask(task.id, { assigned_sub_id: v })
          }
          emptyLabel="— Unassigned —"
          fallback="No subs on project"
        />
      </td>
      <td className="px-3 py-2">
        <PickerCell
          value={task.assigned_user_id}
          editable={editable}
          options={teamOptions.map((m) => ({ value: m.user_id, label: m.name }))}
          onChange={(v) =>
            handlers.onUpdateTask(task.id, { assigned_user_id: v })
          }
          emptyLabel="— Unassigned —"
          fallback="No team on project"
        />
      </td>
      <td className="px-3 py-2">
        <DateCell
          value={task.start_date}
          editable={editable}
          onCommit={(v) => handlers.onUpdateTask(task.id, { start_date: v })}
        />
      </td>
      <td className="px-3 py-2">
        <DateCell
          value={task.end_date}
          editable={editable}
          onCommit={(v) => handlers.onUpdateTask(task.id, { end_date: v })}
        />
      </td>
      <td className="px-3 py-2">
        <EditableText
          value={task.notes ?? ""}
          editable={editable}
          placeholder="—"
          onCommit={(v) => handlers.onUpdateTask(task.id, { notes: v || null })}
          className="text-zinc-300"
        />
      </td>
      <td className="w-8 px-2 py-2 text-right">
        {editable && (
          <RowDeleteButton
            label="Delete task and all its children"
            onClick={() => handlers.onDeleteTask(task.id)}
          />
        )}
      </td>
    </tr>
  );
}

function SubtaskRow({
  subtask,
  phaseId,
  handlers,
}: {
  subtask: ScheduleSubtask;
  phaseId: string;
  handlers: Handlers;
}) {
  const { editable } = handlers;
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobCreated, setJobCreated] = useState(false);
  async function createJob() {
    setCreatingJob(true);
    try {
      await handlers.onCreateJobFromSubtask(subtask.id, phaseId, subtask.name);
      setJobCreated(true);
      setTimeout(() => setJobCreated(false), 2500);
    } finally {
      setCreatingJob(false);
    }
  }
  return (
    <tr className="group border-b border-zinc-900/60 hover:bg-zinc-900/40">
      <td className="px-3 py-2 pl-16">
        <EditableText
          value={subtask.name}
          editable={editable}
          onCommit={(v) => handlers.onUpdateSubtask(subtask.id, { name: v })}
          className="text-zinc-300"
        />
      </td>
      <td className="px-3 py-2">
        <StatusCell
          value={subtask.status}
          editable={editable}
          onChange={(s) => handlers.onUpdateSubtask(subtask.id, { status: s })}
        />
      </td>
      <td className="px-3 py-2 text-zinc-600">—</td>
      <td className="px-3 py-2 text-zinc-600">—</td>
      <td className="px-3 py-2">
        <DateCell
          value={subtask.start_date}
          editable={editable}
          onCommit={(v) =>
            handlers.onUpdateSubtask(subtask.id, { start_date: v })
          }
        />
      </td>
      <td className="px-3 py-2">
        <DateCell
          value={subtask.end_date}
          editable={editable}
          onCommit={(v) =>
            handlers.onUpdateSubtask(subtask.id, { end_date: v })
          }
        />
      </td>
      <td className="px-3 py-2">
        <EditableText
          value={subtask.notes ?? ""}
          editable={editable}
          placeholder="—"
          onCommit={(v) =>
            handlers.onUpdateSubtask(subtask.id, { notes: v || null })
          }
          className="text-zinc-400"
        />
      </td>
      <td className="w-32 px-2 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          {editable && (
            <button
              type="button"
              onClick={createJob}
              disabled={creatingJob || jobCreated}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition opacity-0 group-hover:opacity-100 focus-within:opacity-100 disabled:opacity-100 ${
                jobCreated
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              }`}
              title="Create a Job from this subtask"
            >
              <Briefcase className="h-3 w-3" />
              {jobCreated
                ? "Job created"
                : creatingJob
                  ? "Creating…"
                  : "Create Job"}
            </button>
          )}
          {editable && (
            <RowDeleteButton
              label="Delete subtask"
              onClick={() => handlers.onDeleteSubtask(subtask.id)}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function MaterialCardRow({
  card,
  handlers,
}: {
  card: ScheduleMaterialCard;
  handlers: Handlers;
}) {
  const { editable, materialCatalog } = handlers;
  return (
    <tr className="group border-b border-zinc-900/60 bg-zinc-900/20 hover:bg-zinc-900/50">
      <td colSpan={TOTAL_COLS - 1} className="px-3 py-2 pl-16">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-2 py-0.5 text-blue-400">
            <Package className="h-3 w-3" />
            Material
          </span>
          <PickerCell
            value={card.material_id}
            editable={editable}
            options={materialCatalog.map((m) => ({
              value: m.id,
              label: m.product_name,
            }))}
            onChange={(v) =>
              handlers.onUpdateMaterialCard(card.id, { material_id: v })
            }
            emptyLabel="— Pick material —"
            fallback="No materials in catalog"
            wide
          />
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">Instructions:</span>
          <span className="min-w-[12rem] flex-1">
            <EditableText
              value={card.instructions ?? ""}
              editable={editable}
              placeholder="—"
              onCommit={(v) =>
                handlers.onUpdateMaterialCard(card.id, {
                  instructions: v || null,
                })
              }
              className="text-zinc-300"
            />
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">PDF URL:</span>
          <span className="min-w-[10rem] flex-1">
            <EditableText
              value={card.pdf_url ?? ""}
              editable={editable}
              placeholder="—"
              onCommit={(v) =>
                handlers.onUpdateMaterialCard(card.id, { pdf_url: v || null })
              }
              className="text-zinc-300"
            />
          </span>
        </div>
      </td>
      <td className="w-8 px-2 py-2 text-right">
        {editable && (
          <RowDeleteButton
            label="Delete material card"
            onClick={() => handlers.onDeleteMaterialCard(card.id)}
          />
        )}
      </td>
    </tr>
  );
}

function AddRow({
  pl,
  label,
  onAdd,
}: {
  pl: string;
  label: string;
  onAdd: () => void;
}) {
  return (
    <tr className="border-b border-zinc-900/60">
      <td colSpan={TOTAL_COLS} className={`px-3 py-1 ${pl}`}>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          {label}
        </button>
      </td>
    </tr>
  );
}

function PickerCell({
  value,
  editable,
  options,
  onChange,
  emptyLabel,
  fallback,
  wide = false,
}: {
  value: string | null;
  editable: boolean;
  options: { value: string; label: string }[];
  onChange: (next: string | null) => void;
  emptyLabel: string;
  fallback: string;
  wide?: boolean;
}) {
  const widthClass = wide ? "min-w-[10rem]" : "max-w-[10rem]";
  if (!editable) {
    const match = options.find((o) => o.value === value);
    return (
      <span className={`${widthClass} truncate text-zinc-300`}>
        {match?.label ?? <span className="text-zinc-600">—</span>}
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
      className={`${widthClass} cursor-pointer truncate rounded bg-transparent px-1 py-0.5 text-zinc-300 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500`}
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

function DateCell({
  value,
  editable,
  onCommit,
}: {
  value: string | null;
  editable: boolean;
  onCommit: (next: string | null) => Promise<void> | void;
}) {
  if (!editable) {
    return <span className="text-zinc-400">{formatDate(value)}</span>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => {
        const next = e.target.value || null;
        if (next !== value) onCommit(next);
      }}
      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-zinc-400 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:text-zinc-200 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function StatusCell({
  value,
  editable,
  onChange,
}: {
  value: ScheduleStatus;
  editable: boolean;
  onChange: (next: ScheduleStatus) => Promise<void> | void;
}) {
  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
        <span className={`text-xs ${STATUS_TEXT[value]}`}>
          {STATUS_LABEL[value]}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ScheduleStatus)}
        className={`cursor-pointer appearance-none rounded bg-transparent px-1 py-0.5 pr-1 text-xs outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${STATUS_TEXT[value]}`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </span>
  );
}

function ZoomControl({
  value,
  onChange,
}: {
  value: Zoom;
  onChange: (z: Zoom) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
      {ZOOMS.map((z) => {
        const active = z.key === value;
        return (
          <button
            key={z.key}
            type="button"
            onClick={() => onChange(z.key)}
            className={`rounded px-3 py-1 transition ${
              active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {z.label}
          </button>
        );
      })}
    </div>
  );
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
