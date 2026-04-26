import { supabase } from "@/lib/supabase";
import type { Plan, PlanCategory } from "./types";

const COLUMNS =
  "id, project_id, name, category, description, file_url, uploaded_at";

export async function fetchPlans(projectId: string): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export type PlanPatch = Partial<
  Pick<Plan, "name" | "category" | "description" | "file_url">
>;

export async function createPlan(
  projectId: string,
  category: PlanCategory,
): Promise<Plan> {
  const { data, error } = await supabase
    .from("plans")
    .insert({ project_id: projectId, name: "New plan", category })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function updatePlan(id: string, patch: PlanPatch): Promise<void> {
  const { error } = await supabase.from("plans").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}
