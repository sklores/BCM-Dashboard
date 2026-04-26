import { supabase } from "@/lib/supabase";
import type { Material, MaterialPhoto } from "./types";

const COLUMNS =
  "id, project_id, product_name, manufacturer, supplier, sku, price, lead_time, notes, is_finish, room, color_finish, installation_notes";

const PHOTO_COLUMNS =
  "id, material_id, storage_path, storage_url, sort_order, created_at";

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

// ---------- Material photos ----------

export async function fetchMaterialPhotos(
  materialIds: string[],
): Promise<MaterialPhoto[]> {
  if (materialIds.length === 0) return [];
  const { data, error } = await supabase
    .from("material_photos")
    .select(PHOTO_COLUMNS)
    .in("material_id", materialIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaterialPhoto[];
}

export async function uploadMaterialPhoto(
  materialId: string,
  file: File,
  sortOrder: number,
): Promise<MaterialPhoto> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const photoId = crypto.randomUUID();
  const path = `materials/${materialId}/${photoId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
  const { data, error } = await supabase
    .from("material_photos")
    .insert({
      id: photoId,
      material_id: materialId,
      storage_path: path,
      storage_url: urlData.publicUrl,
      sort_order: sortOrder,
    })
    .select(PHOTO_COLUMNS)
    .single();
  if (error) throw error;
  return data as MaterialPhoto;
}

export async function deleteMaterialPhoto(
  id: string,
  storagePath: string,
): Promise<void> {
  await supabase.storage.from("photos").remove([storagePath]);
  const { error } = await supabase
    .from("material_photos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
