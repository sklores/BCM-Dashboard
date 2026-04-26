import { supabase } from "@/lib/supabase";
import type { Material } from "./types";

const COLUMNS =
  "id, project_id, product_name, manufacturer, supplier, sku, price, lead_time, notes";

export async function fetchMaterials(projectId: string): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("product_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Material[];
}

export type MaterialPatch = Partial<Omit<Material, "id" | "project_id">>;

export async function createMaterial(
  projectId: string,
  fields: Partial<MaterialPatch> = {},
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .insert({
      project_id: projectId,
      product_name: "New material",
      ...fields,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Material;
}

export async function updateMaterial(
  id: string,
  patch: MaterialPatch,
): Promise<void> {
  const { error } = await supabase.from("materials").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw error;
}
