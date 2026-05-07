import { supabase } from "@/lib/supabase";
import { writeTimelineEvent } from "@/lib/timeline";
import {
  STATUS_LABEL,
  type MaterialCatalogOption,
  type ProjectSubOption,
  type ProjectTeamOption,
  type ScheduleMaterialCard,
  type SchedulePhase,
  type ScheduleStatus,
  type ScheduleTask,
  type ScheduleSubtask,
  type ScheduleMilestone,
} from "./types";

const PHASE_COLUMNS =
  "id, project_id, name, status, start_date, end_date, notes, sort_order, is_milestone, progress_pct";

const TASK_COLUMNS =
  "id, phase_id, name, status, assigned_sub_id, assigned_user_id, start_date, end_date, notes, sort_order";

const SUBTASK_COLUMNS =
  "id, task_id, name, status, start_date, end_date, notes, sort_order";

const MATERIAL_CARD_COLUMNS =
  "id, task_id, material_id, instructions, pdf_url";

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

export async function fetchSubtasks(
  taskIds: string[],
): Promise<ScheduleSubtask[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("schedule_subtasks")
    .select(SUBTASK_COLUMNS)
    .in("task_id", taskIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduleSubtask[];
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

export async function fetchMaterialCards(
  taskIds: string[],
): Promise<ScheduleMaterialCard[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("schedule_material_cards")
    .select(MATERIAL_CARD_COLUMNS)
    .in("task_id", taskIds);
  if (error) throw error;
  return (data ?? []) as ScheduleMaterialCard[];
}

export async function fetchProjectSubOptions(
  projectId: string,
): Promise<ProjectSubOption[]> {
  const { data: links, error: linksError } = await supabase
    .from("project_subs")
    .select("id, sub_id")
    .eq("project_id", projectId);
  if (linksError) throw linksError;
  if (!links || links.length === 0) return [];

  const { data: subs, error: subsError } = await supabase
    .from("subs")
    .select("id, name")
    .in(
      "id",
      links.map((l) => l.sub_id as string),
    );
  if (subsError) throw subsError;

  const byId = new Map((subs ?? []).map((s) => [s.id as string, s.name as string]));
  return links.map((l) => ({
    id: l.id as string,
    name: byId.get(l.sub_id as string) ?? "Unknown sub",
  }));
}

export async function fetchProjectTeamOptions(
  projectId: string,
): Promise<ProjectTeamOption[]> {
  const { data: links, error: linksError } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId)
    .neq("role", "sub");
  if (linksError) throw linksError;
  if (!links || links.length === 0) return [];

  const userIds = Array.from(
    new Set(links.map((l) => l.user_id as string)),
  );
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", userIds);
  if (usersError) throw usersError;

  const byId = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      (u.full_name as string | null) ||
        (u.email as string | null) ||
        "Unnamed",
    ]),
  );
  return userIds.map((uid) => ({
    user_id: uid,
    name: byId.get(uid) ?? "Unnamed",
  }));
}

export async function fetchMaterialCatalog(
  projectId: string,
): Promise<MaterialCatalogOption[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, product_name, status, expected_delivery_date")
    .eq("project_id", projectId)
    .order("product_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaterialCatalogOption[];
}

export type PhasePatch = Partial<
  Pick<
    SchedulePhase,
    "name" | "status" | "start_date" | "end_date" | "notes" | "is_milestone"
  >
>;

export type TaskPatch = Partial<
  Pick<
    ScheduleTask,
    | "name"
    | "status"
    | "start_date"
    | "end_date"
    | "notes"
    | "assigned_sub_id"
    | "assigned_user_id"
  >
>;

export type SubtaskPatch = Partial<
  Pick<ScheduleSubtask, "name" | "status" | "start_date" | "end_date" | "notes">
>;

export type MaterialCardPatch = Partial<
  Pick<ScheduleMaterialCard, "material_id" | "instructions" | "pdf_url">
>;

type PhasePriorSnapshot = {
  project_id: string;
  name: string;
  status: ScheduleStatus;
};
type TaskPriorSnapshot = {
  phase_id: string;
  name: string;
  status: ScheduleStatus;
};

export async function updatePhase(id: string, patch: PhasePatch): Promise<void> {
  // If the patch includes a status change, capture the prior value so
  // we can write a Timeline event with the from→to transition.
  let prior: PhasePriorSnapshot | null = null;
  if (patch.status !== undefined) {
    const { data } = await supabase
      .from("schedule_phases")
      .select("project_id, name, status")
      .eq("id", id)
      .single();
    if (data) prior = data as unknown as PhasePriorSnapshot;
  }
  const { error } = await supabase
    .from("schedule_phases")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  if (
    prior &&
    patch.status !== undefined &&
    patch.status !== null &&
    patch.status !== prior.status
  ) {
    writeTimelineEvent({
      projectId: prior.project_id,
      moduleKey: "schedule",
      eventType: "phase_status_changed",
      title: `Phase "${prior.name}" → ${STATUS_LABEL[patch.status]}`,
      details: {
        from: prior.status,
        to: patch.status,
        from_label: STATUS_LABEL[prior.status],
        to_label: STATUS_LABEL[patch.status],
      },
      refTable: "schedule_phases",
      refId: id,
    });
  }
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  let prior: TaskPriorSnapshot | null = null;
  let projectId: string | null = null;
  if (patch.status !== undefined) {
    const { data } = await supabase
      .from("schedule_tasks")
      .select("phase_id, name, status")
      .eq("id", id)
      .single();
    if (data) {
      prior = data as unknown as TaskPriorSnapshot;
      const { data: phase } = await supabase
        .from("schedule_phases")
        .select("project_id")
        .eq("id", prior.phase_id)
        .single();
      projectId =
        (phase as { project_id: string } | null)?.project_id ?? null;
    }
  }
  const { error } = await supabase
    .from("schedule_tasks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  if (
    prior &&
    projectId &&
    patch.status !== undefined &&
    patch.status !== null &&
    patch.status !== prior.status
  ) {
    writeTimelineEvent({
      projectId,
      moduleKey: "schedule",
      eventType: "task_status_changed",
      title: `Task "${prior.name}" → ${STATUS_LABEL[patch.status]}`,
      details: {
        from: prior.status,
        to: patch.status,
        from_label: STATUS_LABEL[prior.status],
        to_label: STATUS_LABEL[patch.status],
      },
      refTable: "schedule_tasks",
      refId: id,
    });
  }
}

export async function updateSubtask(
  id: string,
  patch: SubtaskPatch,
): Promise<void> {
  const { error } = await supabase
    .from("schedule_subtasks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function updateMaterialCard(
  id: string,
  patch: MaterialCardPatch,
): Promise<void> {
  const { error } = await supabase
    .from("schedule_material_cards")
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
    .insert({ project_id: projectId, name: "New phase", sort_order: sortOrder })
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
    .insert({ phase_id: phaseId, name: "New task", sort_order: sortOrder })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data as ScheduleTask;
}

export async function createSubtask(
  taskId: string,
  sortOrder: number,
): Promise<ScheduleSubtask> {
  const { data, error } = await supabase
    .from("schedule_subtasks")
    .insert({ task_id: taskId, name: "New subtask", sort_order: sortOrder })
    .select(SUBTASK_COLUMNS)
    .single();
  if (error) throw error;
  return data as ScheduleSubtask;
}

export async function createMaterialCard(
  taskId: string,
): Promise<ScheduleMaterialCard> {
  const { data, error } = await supabase
    .from("schedule_material_cards")
    .insert({ task_id: taskId })
    .select(MATERIAL_CARD_COLUMNS)
    .single();
  if (error) throw error;
  return data as ScheduleMaterialCard;
}

export async function updatePhaseSortOrder(
  id: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from("schedule_phases")
    .update({ sort_order: sortOrder })
    .eq("id", id);
  if (error) throw error;
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

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_subtasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMaterialCard(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_material_cards")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
