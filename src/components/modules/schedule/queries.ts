import { supabase } from "@/lib/supabase";
import type { SchedulePhase, ScheduleTask, ScheduleMilestone } from "./types";

const PHASE_COLUMNS =
  "id, project_id, name, status, start_date, end_date, notes, sort_order";

const TASK_COLUMNS =
  "id, phase_id, name, status, assigned_sub_id, assigned_user_id, start_date, end_date, notes, sort_order";

export async function fetchPhases(projectId: string): Promise<SchedulePhase[]> {
  const { data, error } = await supabase
    .from("schedule_phases")
    .select(PHASE_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchedulePhase[];
}

export async function fetchTasks(phaseIds: string[]): Promise<ScheduleTask[]> {
  if (phaseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("schedule_tasks")
    .select(TASK_COLUMNS)
    .in("phase_id", phaseIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduleTask[];
}

export async function fetchMilestones(
  projectId: string,
): Promise<ScheduleMilestone[]> {
  const { data, error } = await supabase
    .from("schedule_milestones")
    .select("id, project_id, name, date, status, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduleMilestone[];
}

export type PhasePatch = Partial<
  Pick<SchedulePhase, "name" | "status" | "start_date" | "end_date" | "notes">
>;

export type TaskPatch = Partial<
  Pick<
    ScheduleTask,
    "name" | "status" | "start_date" | "end_date" | "notes"
  >
>;

export async function updatePhase(id: string, patch: PhasePatch): Promise<void> {
  const { error } = await supabase
    .from("schedule_phases")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const { error } = await supabase
    .from("schedule_tasks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function createPhase(
  projectId: string,
  sortOrder: number,
): Promise<SchedulePhase> {
  const { data, error } = await supabase
    .from("schedule_phases")
    .insert({
      project_id: projectId,
      name: "New phase",
      sort_order: sortOrder,
    })
    .select(PHASE_COLUMNS)
    .single();
  if (error) throw error;
  return data as SchedulePhase;
}

export async function createTask(
  phaseId: string,
  sortOrder: number,
): Promise<ScheduleTask> {
  const { data, error } = await supabase
    .from("schedule_tasks")
    .insert({
      phase_id: phaseId,
      name: "New task",
      sort_order: sortOrder,
    })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data as ScheduleTask;
}

export async function deletePhase(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_phases")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
