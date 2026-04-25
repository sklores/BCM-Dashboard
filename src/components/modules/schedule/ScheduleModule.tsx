"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  fetchMilestones,
  fetchPhases,
  fetchTasks,
  updatePhase,
  updateTask,
  type PhasePatch,
  type TaskPatch,
} from "./queries";
import { SimpleGanttView } from "./SimpleGanttView";
import { DetailedGanttView } from "./DetailedGanttView";
import { MilestoneView } from "./MilestoneView";
import type {
  SchedulePhase,
  ScheduleTask,
  ScheduleMilestone,
  ScheduleView,
} from "./types";

const VIEWS: { key: ScheduleView; label: string }[] = [
  { key: "simple", label: "Simple Gantt" },
  { key: "detailed", label: "Detailed Gantt" },
  { key: "milestone", label: "Milestone" },
];

export function ScheduleModule({ projectId }: ModuleProps) {
  const [view, setView] = useState<ScheduleView>("simple");
  const [phases, setPhases] = useState<SchedulePhase[]>([]);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const phaseRows = await fetchPhases(projectId);
        const [taskRows, milestoneRows] = await Promise.all([
          fetchTasks(phaseRows.map((p) => p.id)),
          fetchMilestones(projectId),
        ]);
        if (cancelled) return;
        setPhases(phaseRows);
        setTasks(taskRows);
        setMilestones(milestoneRows);
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
    setPhases((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    try {
      await updatePhase(id, patch);
    } catch (err) {
      setPhases(prev);
      setError(err instanceof Error ? err.message : "Failed to save phase");
    }
  }

  async function handleUpdateTask(id: string, patch: TaskPatch) {
    const prev = tasks;
    setTasks((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    try {
      await updateTask(id, patch);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Schedule</h1>
      </div>

      <ViewSwitcher value={view} onChange={setView} />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          {view === "simple" && <SimpleGanttView phases={phases} />}
          {view === "detailed" && (
            <DetailedGanttView
              phases={phases}
              tasks={tasks}
              onUpdatePhase={handleUpdatePhase}
              onUpdateTask={handleUpdateTask}
            />
          )}
          {view === "milestone" && <MilestoneView milestones={milestones} />}
        </>
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
