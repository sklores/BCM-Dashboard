import { supabase } from "@/lib/supabase";
import type { ProjectMember, ProjectRole, User } from "./types";

const USER_COLUMNS = "id, email, role, full_name";
const MEMBER_COLUMNS = "id, project_id, user_id, role";

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .order("full_name", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function fetchProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select(MEMBER_COLUMNS)
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as ProjectMember[];
}

export type UserPatch = Partial<Pick<User, "email" | "role" | "full_name">>;

export async function createUser(): Promise<User> {
  // Email has unique+not-null. Generate a placeholder so the row inserts.
  const placeholderEmail = `new-${Date.now()}@placeholder.local`;
  const { data, error } = await supabase
    .from("users")
    .insert({ email: placeholderEmail, full_name: "New team member" })
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return data as User;
}

export async function updateUser(id: string, patch: UserPatch): Promise<void> {
  const { error } = await supabase.from("users").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function addUserToProject(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<ProjectMember> {
  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role })
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return data as ProjectMember;
}

export async function removeUserFromProject(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}

export async function updateMemberRole(
  linkId: string,
  role: ProjectRole,
): Promise<void> {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("id", linkId);
  if (error) throw error;
}
