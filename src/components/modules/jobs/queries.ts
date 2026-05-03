import { supabase } from "@/lib/supabase";
import type {
  Job,
  JobDrawing,
  JobDrawingOption,
  JobExtractionOption,
  JobMaterial,
  JobMaterialOption,
  JobPhaseOption,
  JobStatus,
  JobSubOption,
} from "./types";

const JOB_COLUMNS =
  "id, project_id, sub_id, title, scope, status, start_date, end_date, notes, parent_phase_id, parent_subtask_id, location, created_at";

export async function fetchJobs(projectId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Job[];
}

export async function fetchJobMaterials(
  jobIds: string[],
): Promise<JobMaterial[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from("job_materials")
    .select("id, job_id, material_id")
    .in("job_id", jobIds);
  if (error) throw error;
  return (data ?? []) as JobMaterial[];
}

export async function fetchJobDrawings(
  jobIds: string[],
): Promise<JobDrawing[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from("job_drawings")
    .select("id, job_id, drawing_id, extraction_id")
    .in("job_id", jobIds);
  if (error) throw error;
  return (data ?? []) as JobDrawing[];
}

export async function createJob(projectId: string): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({ project_id: projectId, title: "New job" })
    .select(JOB_COLUMNS)
    .single();
  if (error) throw error;
  return data as Job;
}

export type JobPatch = Partial<{
  sub_id: string | null;
  title: string | null;
  scope: string | null;
  status: JobStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  parent_phase_id: string | null;
  parent_subtask_id: string | null;
  location: string | null;
}>;

export async function updateJob(id: string, patch: JobPatch): Promise<void> {
  const { error } = await supabase.from("jobs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function setJobMaterials(
  jobId: string,
  materialIds: string[],
): Promise<JobMaterial[]> {
  const del = await supabase
    .from("job_materials")
    .delete()
    .eq("job_id", jobId);
  if (del.error) throw del.error;
  if (materialIds.length === 0) return [];
  const rows = materialIds.map((mid) => ({ job_id: jobId, material_id: mid }));
  const ins = await supabase
    .from("job_materials")
    .insert(rows)
    .select("id, job_id, material_id");
  if (ins.error) throw ins.error;
  return (ins.data ?? []) as JobMaterial[];
}

export async function setJobDrawings(
  jobId: string,
  drawings: { drawing_id: string | null; extraction_id: string | null }[],
): Promise<JobDrawing[]> {
  const del = await supabase
    .from("job_drawings")
    .delete()
    .eq("job_id", jobId);
  if (del.error) throw del.error;
  if (drawings.length === 0) return [];
  const rows = drawings.map((d) => ({
    job_id: jobId,
    drawing_id: d.drawing_id,
    extraction_id: d.extraction_id,
  }));
  const ins = await supabase
    .from("job_drawings")
    .insert(rows)
    .select("id, job_id, drawing_id, extraction_id");
  if (ins.error) throw ins.error;
  return (ins.data ?? []) as JobDrawing[];
}

// ---------- Pickers ----------

export async function fetchJobSubOptions(
  projectId: string,
): Promise<JobSubOption[]> {
  const linkRes = await supabase
    .from("project_subs")
    .select("sub_id")
    .eq("project_id", projectId);
  if (linkRes.error) throw linkRes.error;
  const ids = (linkRes.data ?? []).map((l) => l.sub_id as string);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("subs")
    .select("id, name, trade")
    .in("id", ids)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobSubOption[];
}

export async function fetchJobMaterialOptions(
  projectId: string,
): Promise<JobMaterialOption[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, product_name, manufacturer")
    .eq("project_id", projectId)
    .order("product_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobMaterialOption[];
}

export async function fetchJobDrawingOptions(
  projectId: string,
): Promise<JobDrawingOption[]> {
  const { data, error } = await supabase
    .from("drawings")
    .select("id, drawing_number, title")
    .eq("project_id", projectId)
    .order("drawing_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobDrawingOption[];
}

export async function fetchJobExtractionOptions(
  projectId: string,
): Promise<JobExtractionOption[]> {
  // Pull confirmed extractions across all drawings on this project.
  const dr = await supabase
    .from("drawings")
    .select("id")
    .eq("project_id", projectId);
  if (dr.error) throw dr.error;
  const drawingIds = (dr.data ?? []).map((d) => d.id as string);
  if (drawingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("drawing_extractions")
    .select("id, drawing_id, label, category, status")
    .in("drawing_id", drawingIds)
    .eq("status", "confirmed")
    .order("label", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    drawing_id: e.drawing_id as string,
    label: (e.label as string | null) ?? null,
    category: (e.category as string | null) ?? null,
  }));
}

export async function fetchJobPhaseOptions(
  projectId: string,
): Promise<JobPhaseOption[]> {
  const { data, error } = await supabase
    .from("schedule_phases")
    .select("id, name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobPhaseOption[];
}
