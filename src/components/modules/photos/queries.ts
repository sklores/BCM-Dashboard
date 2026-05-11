import { supabase } from "@/lib/supabase";
import { writeTimelineEvent } from "@/lib/timeline";
import type { Photo } from "./types";

const COLUMNS =
  "id, project_id, kind, storage_path, storage_url, taken_at, tags, room, stage, ai_description, notes, uploaded_at, annotated_from_id";

export async function fetchPhotos(projectId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("photos")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Photo[];
}

export async function uploadPhotoBlob(
  projectId: string,
  file: File,
  photoId: string,
): Promise<{ path: string; url: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${projectId}/${photoId}.${ext}`;
  const { error } = await supabase.storage
    .from("photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
  if (error) throw error;
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function insertPhoto(row: {
  id: string;
  project_id: string;
  storage_path: string;
  storage_url: string;
  taken_at: string | null;
  tags: string[];
  room: string | null;
  stage: string | null;
  ai_description: string | null;
  annotated_from_id?: string | null;
}): Promise<Photo> {
  const { data, error } = await supabase
    .from("photos")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  // Don't write a timeline event for derived/annotated photos — those
  // are the result of someone marking up an existing photo, not a new
  // upload.
  if (!row.annotated_from_id) {
    const photo = data as Photo;
    const summary =
      photo.ai_description ||
      (photo.tags && photo.tags.length > 0
        ? `Tagged: ${photo.tags.slice(0, 3).join(", ")}`
        : "");
    writeTimelineEvent({
      projectId: row.project_id,
      moduleKey: "photos",
      eventType: "photo_uploaded",
      title: summary
        ? `Photo uploaded — ${summary}`
        : "Photo uploaded",
      details: {
        room: photo.room,
        stage: photo.stage,
        tags: photo.tags,
        storage_url: photo.storage_url,
      },
      refTable: "photos",
      refId: photo.id,
    });
  }
  return data as Photo;
}

export type PhotoPatch = Partial<
  Pick<Photo, "tags" | "notes" | "room" | "stage" | "taken_at">
>;

export async function updatePhoto(id: string, patch: PhotoPatch): Promise<void> {
  const { error } = await supabase.from("photos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from("photos").remove([storagePath]);
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}
