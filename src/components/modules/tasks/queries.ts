import { supabase } from "@/lib/supabase";
import type {
  ProjectSubOption,
  ProjectTeamOption,
  Task,
  TaskStatus,
} from "./types";

const COLUMNS =
  "id, project_id, title, description, status, assigned_sub_id, assigned_user_id, start_date, due_date, created_at, completed_at, sort_order";

export async function fetchTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "status"
    | "assigned_sub_id"
    | "assigned_user_id"
    | "start_date"
    | "due_date"
    | "completed_at"
    | "sort_order"
  >
>;

export async function createTask(
  projectId: string,
  fields: { title: string },
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ project_id: projectId, title: fields.title })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  // When transitioning to/from complete, manage completed_at.
  if (patch.status !== undefined) {
    if (patch.status === "complete" && patch.completed_at === undefined) {
      patch.completed_at = new Date().toISOString();
    }
    if (patch.status !== "complete" && patch.completed_at === undefined) {
      patch.completed_at = null;
    }
  }
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
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
  const byId = new Map(
    (subs ?? []).map((s) => [s.id as string, s.name as string]),
  );
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

export const STATUS_VALUES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "complete",
  "delayed",
];
