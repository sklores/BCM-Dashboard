import { supabase } from "@/lib/supabase";

export type EstimateJob = {
  id: string;
  project_id: string;
  name: string | null;
  assigned_sub_id: string | null;
  regular_hours: number | null;
  regular_rate: number | null;
  off_hour_hours: number | null;
  off_hour_rate: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type EstimateJobMaterial = {
  id: string;
  job_id: string;
  material_id: string | null;
  item_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  sort_order: number;
  created_at: string;
};

export type EstimateJobPatch = Partial<
  Pick<
    EstimateJob,
    | "name"
    | "assigned_sub_id"
    | "regular_hours"
    | "regular_rate"
    | "off_hour_hours"
    | "off_hour_rate"
    | "notes"
    | "sort_order"
  >
>;

export type EstimateJobMaterialPatch = Partial<
  Pick<
    EstimateJobMaterial,
    "material_id" | "item_name" | "quantity" | "unit_price" | "sort_order"
  >
>;

export type SubOption = {
  id: string;
  name: string;
  trade: string | null;
};

export type CatalogMaterial = {
  id: string;
  product_name: string;
  manufacturer: string | null;
  supplier: string | null;
  price: number | null;
};

const JOB_COLUMNS =
  "id, project_id, name, assigned_sub_id, regular_hours, regular_rate, off_hour_hours, off_hour_rate, notes, sort_order, created_at";

const MAT_COLUMNS =
  "id, job_id, material_id, item_name, quantity, unit_price, sort_order, created_at";

// ---------- Jobs ----------

export async function fetchJobs(projectId: string): Promise<EstimateJob[]> {
  const { data, error } = await supabase
    .from("estimate_jobs")
    .select(JOB_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EstimateJob[];
}

export async function createJob(
  projectId: string,
  sortOrder: number,
): Promise<EstimateJob> {
  const { data, error } = await supabase
    .from("estimate_jobs")
    .insert({
      project_id: projectId,
      name: "New job",
      sort_order: sortOrder,
    })
    .select(JOB_COLUMNS)
    .single();
  if (error) throw error;
  return data as EstimateJob;
}

export async function updateJob(
  id: string,
  patch: EstimateJobPatch,
): Promise<void> {
  const { error } = await supabase
    .from("estimate_jobs")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("estimate_jobs").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Materials ----------

export async function fetchMaterialsForJobs(
  jobIds: string[],
): Promise<EstimateJobMaterial[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from("estimate_job_materials")
    .select(MAT_COLUMNS)
    .in("job_id", jobIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EstimateJobMaterial[];
}

export async function createJobMaterial(
  jobId: string,
  patch: EstimateJobMaterialPatch = {},
): Promise<EstimateJobMaterial> {
  const { data, error } = await supabase
    .from("estimate_job_materials")
    .insert({
      job_id: jobId,
      item_name: "",
      quantity: 0,
      unit_price: 0,
      sort_order: 0,
      ...patch,
    })
    .select(MAT_COLUMNS)
    .single();
  if (error) throw error;
  return data as EstimateJobMaterial;
}

export async function updateJobMaterial(
  id: string,
  patch: EstimateJobMaterialPatch,
): Promise<void> {
  const { error } = await supabase
    .from("estimate_job_materials")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteJobMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from("estimate_job_materials")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Pickers ----------

export async function fetchProjectSubsForPicker(
  projectId: string,
): Promise<SubOption[]> {
  const { data: links, error: linksError } = await supabase
    .from("project_subs")
    .select("sub_id")
    .eq("project_id", projectId);
  if (linksError) throw linksError;
  if (!links || links.length === 0) return [];
  const subIds = Array.from(new Set(links.map((l) => l.sub_id as string)));
  const { data: subs, error: subsError } = await supabase
    .from("subs")
    .select("id, name, trade")
    .in("id", subIds)
    .order("name", { ascending: true });
  if (subsError) throw subsError;
  return (subs ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Unnamed",
    trade: (s.trade as string | null) ?? null,
  }));
}

export async function fetchMaterialsCatalog(
  projectId: string,
): Promise<CatalogMaterial[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, product_name, manufacturer, supplier, price")
    .eq("project_id", projectId)
    .order("product_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id as string,
    product_name: (m.product_name as string) ?? "",
    manufacturer: (m.manufacturer as string | null) ?? null,
    supplier: (m.supplier as string | null) ?? null,
    price: (m.price as number | null) ?? null,
  }));
}

// ---------- Computations ----------

export function jobLaborCost(job: EstimateJob): number {
  const reg = (Number(job.regular_hours) || 0) * (Number(job.regular_rate) || 0);
  const ot =
    (Number(job.off_hour_hours) || 0) * (Number(job.off_hour_rate) || 0);
  return reg + ot;
}

export function jobMaterialsCost(materials: EstimateJobMaterial[]): number {
  return materials.reduce(
    (sum, m) =>
      sum + (Number(m.quantity) || 0) * (Number(m.unit_price) || 0),
    0,
  );
}
