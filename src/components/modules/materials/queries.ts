import { supabase } from "@/lib/supabase";
import { isMaterialDelayed, type Material, type MaterialPhoto } from "./types";

const COLUMNS =
  "id, project_id, product_name, manufacturer, supplier, sku, price, lead_time, notes, is_finish, room, color_finish, installation_notes, status, dimensions, qty, source_url, expected_delivery_date, delivery_delay_alerted_at";

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

// Walk the project's materials, find any that became delayed since the
// last sweep, and write one row per newly-delayed material to the alerts
// activity feed. Returns the updated material list so the caller can
// reflect the new alerted_at timestamps in state.
export async function syncDeliveryDelayAlerts(
  projectId: string,
  materials: Material[],
): Promise<Material[]> {
  const newlyDelayed = materials.filter(
    (m) => isMaterialDelayed(m) && !m.delivery_delay_alerted_at,
  );
  if (newlyDelayed.length === 0) return materials;

  const now = new Date().toISOString();
  const alerts = newlyDelayed.map((m) => ({
    project_id: projectId,
    module_key: "materials",
    event_type: "delivery_delay",
    level: "warn",
    message: `${m.product_name}${m.supplier ? ` from ${m.supplier}` : ""} expected ${m.expected_delivery_date}, still ${m.status}`,
  }));
  const ins = await supabase.from("alerts").insert(alerts);
  if (ins.error) {
    // Don't throw — UI can still show materials. Log via console.
    if (typeof console !== "undefined")
      console.warn("alerts insert failed", ins.error);
    return materials;
  }
  // Stamp the timestamps so we don't re-alert next load.
  const ids = newlyDelayed.map((m) => m.id);
  const stamp = await supabase
    .from("materials")
    .update({ delivery_delay_alerted_at: now })
    .in("id", ids);
  if (stamp.error && typeof console !== "undefined")
    console.warn("delivery_delay_alerted_at stamp failed", stamp.error);
  return materials.map((m) =>
    ids.includes(m.id) ? { ...m, delivery_delay_alerted_at: now } : m,
  );
}
