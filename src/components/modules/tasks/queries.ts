import { supabase } from "@/lib/supabase";
import type {
  ContactOption,
  PunchListDetails,
  PunchListPatch,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskDependency,
  TaskPatch,
} from "./types";

const TASK_COLUMNS =
  "id, project_id, title, description, status, task_type, priority, start_date, due_date, recurring, recurring_frequency, recurring_end_date, parent_task_id, linked_module, linked_record_id, created_by, created_at, completed_at, sort_order, assigned_sub_id, assigned_user_id";

// ---------- Tasks ----------

export async function fetchTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(
  projectId: string,
  patch: TaskPatch = {},
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: "New task",
      status: "not_started",
      task_type: "general",
      priority: "medium",
      ...patch,
    })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
): Promise<void> {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Assignees ----------

export async function fetchAssignees(
  taskIds: string[],
): Promise<TaskAssignee[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("task_assignees")
    .select("id, task_id, contact_id, created_at")
    .in("task_id", taskIds);
  if (error) throw error;
  return (data ?? []) as TaskAssignee[];
}

export async function addAssignee(
  taskId: string,
  contactId: string,
): Promise<TaskAssignee> {
  const { data, error } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, contact_id: contactId })
    .select("id, task_id, contact_id, created_at")
    .single();
  if (error) throw error;
  return data as TaskAssignee;
}

export async function removeAssignee(id: string): Promise<void> {
  const { error } = await supabase
    .from("task_assignees")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Attachments ----------

export async function fetchAttachments(
  taskIds: string[],
): Promise<TaskAttachment[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, task_id, file_url, file_name, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskAttachment[];
}

export async function uploadTaskAttachment(
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const path = `${taskId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from("tasks")
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from("tasks").getPublicUrl(path);
  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      file_url: urlData.publicUrl,
      file_name: file.name,
    })
    .select("id, task_id, file_url, file_name, created_at")
    .single();
  if (error) throw error;
  return data as TaskAttachment;
}

export async function deleteAttachment(id: string): Promise<void> {
  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Dependencies ----------

export async function fetchDependencies(
  taskIds: string[],
): Promise<TaskDependency[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("id, task_id, predecessor_task_id, created_at")
    .in("task_id", taskIds);
  if (error) throw error;
  return (data ?? []) as TaskDependency[];
}

export async function addDependency(
  taskId: string,
  predecessorId: string,
): Promise<TaskDependency> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, predecessor_task_id: predecessorId })
    .select("id, task_id, predecessor_task_id, created_at")
    .single();
  if (error) throw error;
  return data as TaskDependency;
}

export async function removeDependency(id: string): Promise<void> {
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Punch List Details ----------

export async function fetchPunchListDetails(
  taskIds: string[],
): Promise<PunchListDetails[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("punch_list_details")
    .select(
      "id, task_id, location, responsible_sub_id, sign_off_required, sign_off_date, sign_off_by, created_at",
    )
    .in("task_id", taskIds);
  if (error) throw error;
  return (data ?? []) as PunchListDetails[];
}

export async function upsertPunchListDetails(
  taskId: string,
  patch: PunchListPatch,
): Promise<PunchListDetails> {
  const { data: existing, error: existsErr } = await supabase
    .from("punch_list_details")
    .select("id")
    .eq("task_id", taskId)
    .maybeSingle();
  if (existsErr) throw existsErr;
  if (existing?.id) {
    const { data, error } = await supabase
      .from("punch_list_details")
      .update(patch)
      .eq("id", existing.id)
      .select(
        "id, task_id, location, responsible_sub_id, sign_off_required, sign_off_date, sign_off_by, created_at",
      )
      .single();
    if (error) throw error;
    return data as PunchListDetails;
  }
  const { data, error } = await supabase
    .from("punch_list_details")
    .insert({ task_id: taskId, ...patch })
    .select(
      "id, task_id, location, responsible_sub_id, sign_off_required, sign_off_date, sign_off_by, created_at",
    )
    .single();
  if (error) throw error;
  return data as PunchListDetails;
}

// ---------- Contacts (assignee + sub picker) ----------

export async function fetchContactOptions(
  projectId: string,
): Promise<ContactOption[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, role_type")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((c) => {
    const name = `${(c.first_name as string) ?? ""} ${(c.last_name as string) ?? ""}`.trim();
    return {
      id: c.id as string,
      name: name || ((c.email as string) ?? "Contact"),
      email: (c.email as string | null) ?? null,
      role_type: (c.role_type as string | null) ?? null,
    };
  });
}

// ---------- Alerts ----------

export async function postAlert(
  projectId: string,
  eventType: string,
  message: string,
): Promise<void> {
  const { error } = await supabase.from("alerts").insert({
    project_id: projectId,
    module_key: "tasks",
    event_type: eventType,
    message,
  });
  if (error) throw error;
}
