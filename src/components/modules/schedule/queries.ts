import { supabase } from "@/lib/supabase";
import type { SchedulePhase, ScheduleTask, ScheduleMilestone } from "./types";

export async function fetchPhases(projectId: string): Promise<SchedulePhase[]> {
  const { data, error } = await supabase
    .from("schedule_phases")
    .select("id, project_id, name, status, start_date, end_date, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchedulePhase[];
}

export async function fetchTasks(phaseIds: string[]): Promise<ScheduleTask[]> {
  if (phaseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("schedule_tasks")
    .select(
      "id, phase_id, name, status, assigned_sub_id, assigned_user_id, start_date, end_date, notes, sort_order",
    )
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
