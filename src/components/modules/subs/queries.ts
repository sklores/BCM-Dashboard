import { supabase } from "@/lib/supabase";
import type { ProjectSub, Sub } from "./types";

const SUB_COLUMNS =
  "id, name, trade, contact_name, contact_email, contact_phone, license_number, notes";

export async function fetchSubs(): Promise<Sub[]> {
  const { data, error } = await supabase
    .from("subs")
    .select(SUB_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Sub[];
}

export async function fetchProjectSubs(
  projectId: string,
): Promise<ProjectSub[]> {
  const { data, error } = await supabase
    .from("project_subs")
    .select("id, project_id, sub_id")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as ProjectSub[];
}

export type SubPatch = Partial<Omit<Sub, "id">>;

export async function createSub(): Promise<Sub> {
  const { data, error } = await supabase
    .from("subs")
    .insert({ name: "New sub" })
    .select(SUB_COLUMNS)
    .single();
  if (error) throw error;
  return data as Sub;
}

export async function updateSub(id: string, patch: SubPatch): Promise<void> {
  const { error } = await supabase.from("subs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSub(id: string): Promise<void> {
  const { error } = await supabase.from("subs").delete().eq("id", id);
  if (error) throw error;
}

export async function addSubToProject(
  projectId: string,
  subId: string,
): Promise<ProjectSub> {
  const { data, error } = await supabase
    .from("project_subs")
    .insert({ project_id: projectId, sub_id: subId })
    .select("id, project_id, sub_id")
    .single();
  if (error) throw error;
  return data as ProjectSub;
}

export async function removeSubFromProject(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("project_subs")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}
