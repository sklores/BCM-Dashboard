"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  FileUp,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createMaterialCard,
  createPhase,
  createSubtask,
  createTask,
  deleteMaterialCard,
  deletePhase,
  deleteSubtask,
  deleteTask,
  fetchMaterialCards,
  fetchMaterialCatalog,
  fetchMilestones,
  fetchPhases,
  fetchProjectSubOptions,
  fetchProjectTeamOptions,
  fetchSubtasks,
  fetchTasks,
  updateMaterialCard,
  updatePhase,
  updatePhaseSortOrder,
  updateSubtask,
  updateTask,
  type MaterialCardPatch,
  type PhasePatch,
  type SubtaskPatch,
  type TaskPatch,
} from "./queries";
import { GanttView } from "./GanttView";
import { CalendarView } from "./CalendarView";
import { DetailedGanttView } from "./DetailedGanttView";
import { MilestoneView } from "./MilestoneView";
import type {
  MaterialCatalogOption,
  ProjectSubOption,
  ProjectTeamOption,
  SchedulePhase,
  ScheduleMaterialCard,
  ScheduleSubtask,
  ScheduleTask,
  ScheduleMilestone,
  ScheduleView,
} from "./types";

const VIEWS: { key: ScheduleView; label: string }[] = [
  { key: "detailed", label: "Detailed" },
  { key: "gantt", label: "Gantt" },
  { key: "calendar", label: "Calendar" },
  { key: "milestone", label: "Milestone" },
];

export function ScheduleModule({ projectId }: ModuleProps) {
  const [view, setView] = useState<ScheduleView>("detailed");
  const [phases, setPhases] = useState<SchedulePhase[]>([]);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [subtasks, setSubtasks] = useState<ScheduleSubtask[]>([]);
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);
  const [materialCards, setMaterialCards] = useState<ScheduleMaterialCard[]>([]);
  const [subOptions, setSubOptions] = useState<ProjectSubOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<ProjectTeamOption[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Sync state when the user exits browser fullscreen via Esc / chrome.
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fullscreen) setFullscreen(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fullscreen]);

  // Exit browser fullscreen if the module unmounts (route change) while
  // still in FS so we don't leave the OS chrome hidden behind us.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  async function toggleFullscreen() {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) {
        if (!document.fullscreenElement)
          await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Browser may reject the request; in-app overlay still applies.
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const phaseRows = await fetchPhases(projectId);
        const taskRows = await fetchTasks(phaseRows.map((p) => p.id));
        const [
          subtaskRows,
          milestoneRows,
          materialCardRows,
          subs,
          team,
          catalog,
        ] = await Promise.all([
          fetchSubtasks(taskRows.map((t) => t.id)),
          fetchMilestones(projectId),
          fetchMaterialCards(taskRows.map((t) => t.id)),
          fetchProjectSubOptions(projectId),
          fetchProjectTeamOptions(projectId),
          fetchMaterialCatalog(projectId),
        ]);
        if (cancelled) return;
        setPhases(phaseRows);
        setTasks(taskRows);
        setSubtasks(subtaskRows);
        setMilestones(milestoneRows);
        setMaterialCards(materialCardRows);
        setSubOptions(subs);
        setTeamOptions(team);
        setMaterialCatalog(catalog);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load schedule");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleUpdatePhase(id: string, patch: PhasePatch) {
    const prev = phases;
    setPhases((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await updatePhase(id, patch);
    } catch (err) {
      setPhases(prev);
      setError(err instanceof Error ? err.message : "Failed to save phase");
    }
  }

  async function handleUpdateTask(id: string, patch: TaskPatch) {
    const prev = tasks;
    setTasks((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await updateTask(id, patch);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  }

  async function handleUpdateSubtask(id: string, patch: SubtaskPatch) {
    const prev = subtasks;
    setSubtasks((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    try {
      await updateSubtask(id, patch);
    } catch (err) {
      setSubtasks(prev);
      setError(err instanceof Error ? err.message : "Failed to save subtask");
    }
  }

  async function handleUpdateMaterialCard(id: string, patch: MaterialCardPatch) {
    const prev = materialCards;
    setMaterialCards((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    try {
      await updateMaterialCard(id, patch);
    } catch (err) {
      setMaterialCards(prev);
      setError(
        err instanceof Error ? err.message : "Failed to save material card",
      );
    }
  }

  async function handleAddPhase() {
    const sortOrder =
      phases.length === 0 ? 0 : Math.max(...phases.map((p) => p.sort_order)) + 1;
    try {
      const created = await createPhase(projectId, sortOrder);
      setPhases((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add phase");
    }
  }

  async function handleAddTask(phaseId: string) {
    const phaseTasks = tasks.filter((t) => t.phase_id === phaseId);
    const sortOrder =
      phaseTasks.length === 0
        ? 0
        : Math.max(...phaseTasks.map((t) => t.sort_order)) + 1;
    try {
      const created = await createTask(phaseId, sortOrder);
      setTasks((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function handleAddSubtask(taskId: string) {
    const taskSubtasks = subtasks.filter((s) => s.task_id === taskId);
    const sortOrder =
      taskSubtasks.length === 0
        ? 0
        : Math.max(...taskSubtasks.map((s) => s.sort_order)) + 1;
    try {
      const created = await createSubtask(taskId, sortOrder);
      setSubtasks((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subtask");
    }
  }

  async function handleAddMaterialCard(taskId: string) {
    try {
      const created = await createMaterialCard(taskId);
      setMaterialCards((rows) => [...rows, created]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add material card",
      );
    }
  }

  async function handleDeletePhase(id: string) {
    const prevPhases = phases;
    const prevTasks = tasks;
    const prevSubtasks = subtasks;
    const prevCards = materialCards;
    const taskIdsToRemove = tasks
      .filter((t) => t.phase_id === id)
      .map((t) => t.id);
    setPhases((rows) => rows.filter((r) => r.id !== id));
    setTasks((rows) => rows.filter((r) => r.phase_id !== id));
    setSubtasks((rows) =>
      rows.filter((r) => !taskIdsToRemove.includes(r.task_id)),
    );
    setMaterialCards((rows) =>
      rows.filter((r) => !taskIdsToRemove.includes(r.task_id)),
    );
    try {
      await deletePhase(id);
    } catch (err) {
      setPhases(prevPhases);
      setTasks(prevTasks);
      setSubtasks(prevSubtasks);
      setMaterialCards(prevCards);
      setError(err instanceof Error ? err.message : "Failed to delete phase");
    }
  }

  async function handleDeleteTask(id: string) {
    const prevTasks = tasks;
    const prevSubtasks = subtasks;
    const prevCards = materialCards;
    setTasks((rows) => rows.filter((r) => r.id !== id));
    setSubtasks((rows) => rows.filter((r) => r.task_id !== id));
    setMaterialCards((rows) => rows.filter((r) => r.task_id !== id));
    try {
      await deleteTask(id);
    } catch (err) {
      setTasks(prevTasks);
      setSubtasks(prevSubtasks);
      setMaterialCards(prevCards);
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function handleDeleteSubtask(id: string) {
    const prev = subtasks;
    setSubtasks((rows) => rows.filter((r) => r.id !== id));
    try {
      await deleteSubtask(id);
    } catch (err) {
      setSubtasks(prev);
      setError(err instanceof Error ? err.message : "Failed to delete subtask");
    }
  }

  async function handleDeleteMaterialCard(id: string) {
    const prev = materialCards;
    setMaterialCards((rows) => rows.filter((r) => r.id !== id));
    try {
      await deleteMaterialCard(id);
    } catch (err) {
      setMaterialCards(prev);
      setError(
        err instanceof Error ? err.message : "Failed to delete material card",
      );
    }
  }

  async function handleReorderPhases(reordered: SchedulePhase[]) {
    const prev = phases;
    const renumbered = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPhases(renumbered);

    const changed = renumbered.filter((p, i) => prev[i]?.id !== p.id);
    try {
      await Promise.all(
        changed.map((p) => updatePhaseSortOrder(p.id, p.sort_order)),
      );
    } catch (err) {
      setPhases(prev);
      setError(err instanceof Error ? err.message : "Failed to reorder phases");
    }
  }

  async function handleCreateJobFromSubtask(
    subtaskId: string,
    phaseId: string,
    subtaskName: string,
  ) {
    try {
      const { error } = await supabase.from("jobs").insert({
        project_id: projectId,
        title: subtaskName || "Untitled job",
        parent_subtask_id: subtaskId,
        parent_phase_id: phaseId,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  }

  // Zoom only applies to dense table-style views (Detailed + Gantt +
  // Calendar). Milestone is already a sparse summary.
  const zoomable = view === "detailed" || view === "gantt" || view === "calendar";

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-40 flex flex-col gap-3 overflow-y-auto bg-zinc-950 p-10"
          : "flex flex-col gap-3"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Schedule</h1>
        <div className="ml-auto flex items-center gap-2">
          {zoomable && (
            <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.75, z - 0.1))}
                disabled={zoom <= 0.75}
                className="rounded p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-1 text-[11px] text-zinc-300 hover:text-zinc-100"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                disabled={zoom >= 2}
                className="rounded p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
          {view === "detailed" && (
            <button
              type="button"
              disabled
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
              title="Coming soon"
            >
              <FileUp className="h-3.5 w-3.5" />
              Import from MS Project PDF
            </button>
          )}
        </div>
      </div>

      <ViewSwitcher value={view} onChange={setView} />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div className={zoomable ? "overflow-x-auto" : ""}>
          <div
            style={
              zoomable
                ? {
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                    width: `${100 / zoom}%`,
                  }
                : undefined
            }
            className="flex flex-col gap-3"
          >
          {view === "gantt" && (
            <GanttView phases={phases} tasks={tasks} subtasks={subtasks} />
          )}
          {view === "calendar" && (
            <CalendarView phases={phases} tasks={tasks} />
          )}
          {view === "detailed" && (
            <DetailedGanttView
              phases={phases}
              tasks={tasks}
              subtasks={subtasks}
              materialCards={materialCards}
              subOptions={subOptions}
              teamOptions={teamOptions}
              materialCatalog={materialCatalog}
              onUpdatePhase={handleUpdatePhase}
              onUpdateTask={handleUpdateTask}
              onUpdateSubtask={handleUpdateSubtask}
              onUpdateMaterialCard={handleUpdateMaterialCard}
              onAddPhase={handleAddPhase}
              onAddTask={handleAddTask}
              onAddSubtask={handleAddSubtask}
              onAddMaterialCard={handleAddMaterialCard}
              onDeletePhase={handleDeletePhase}
              onDeleteTask={handleDeleteTask}
              onDeleteSubtask={handleDeleteSubtask}
              onDeleteMaterialCard={handleDeleteMaterialCard}
              onReorderPhases={handleReorderPhases}
              onCreateJobFromSubtask={handleCreateJobFromSubtask}
            />
          )}
          {view === "milestone" && <MilestoneView phases={phases} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewSwitcher({
  value,
  onChange,
}: {
  value: ScheduleView;
  onChange: (v: ScheduleView) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
      {VIEWS.map((v) => {
        const active = v.key === value;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onChange(v.key)}
            className={`rounded px-4 py-1.5 text-sm transition ${
              active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
