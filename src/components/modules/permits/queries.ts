import { supabase } from "@/lib/supabase";
import type {
  Inspection,
  InspectionPatch,
  InspectorContactOption,
  Permit,
  PermitPatch,
  ScheduleMilestone,
  ThirdPartyInspection,
  ThirdPartyInspectionPatch,
} from "./types";

const PERMIT_COLUMNS =
  "id, project_id, parent_permit_id, permit_type, jurisdiction, permit_number, applied_date, issued_date, expiration_date, fee, status, pdf_url, notes, created_at";

const INSPECTION_COLUMNS =
  "id, project_id, permit_id, inspection_type, scheduled_date, inspector_name, result, notes, correction_notice_url, schedule_milestone_id, created_at";

const TPI_COLUMNS =
  "id, project_id, inspection_type, inspector_contact_id, company, scheduled_date, completed_date, result, report_url, notes, created_at";

// ---------- Permits ----------

export async function fetchPermits(projectId: string): Promise<Permit[]> {
  const { data, error } = await supabase
    .from("permits")
    .select(PERMIT_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Permit[];
}

export async function createPermit(
  projectId: string,
  patch: PermitPatch = {},
): Promise<Permit> {
  const { data, error } = await supabase
    .from("permits")
    .insert({
      project_id: projectId,
      status: "not_applied",
      ...patch,
    })
    .select(PERMIT_COLUMNS)
    .single();
  if (error) throw error;
  return data as Permit;
}

export async function updatePermit(
  id: string,
  patch: PermitPatch,
): Promise<void> {
  const { error } = await supabase.from("permits").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePermit(id: string): Promise<void> {
  const { error } = await supabase.from("permits").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Inspections ----------

export async function fetchInspections(
  projectId: string,
): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from("inspections")
    .select(INSPECTION_COLUMNS)
    .eq("project_id", projectId)
    .order("scheduled_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Inspection[];
}

export async function createInspection(
  projectId: string,
  permitId: string,
  patch: InspectionPatch = {},
): Promise<Inspection> {
  const { data, error } = await supabase
    .from("inspections")
    .insert({
      project_id: projectId,
      permit_id: permitId,
      result: "scheduled",
      ...patch,
    })
    .select(INSPECTION_COLUMNS)
    .single();
  if (error) throw error;
  return data as Inspection;
}

export async function updateInspection(
  id: string,
  patch: InspectionPatch,
): Promise<void> {
  const { error } = await supabase
    .from("inspections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInspection(id: string): Promise<void> {
  const { error } = await supabase.from("inspections").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Third Party Inspections ----------

export async function fetchThirdPartyInspections(
  projectId: string,
): Promise<ThirdPartyInspection[]> {
  const { data, error } = await supabase
    .from("third_party_inspections")
    .select(TPI_COLUMNS)
    .eq("project_id", projectId)
    .order("scheduled_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ThirdPartyInspection[];
}

export async function createThirdPartyInspection(
  projectId: string,
  patch: ThirdPartyInspectionPatch = {},
): Promise<ThirdPartyInspection> {
  const { data, error } = await supabase
    .from("third_party_inspections")
    .insert({
      project_id: projectId,
      result: "pending",
      ...patch,
    })
    .select(TPI_COLUMNS)
    .single();
  if (error) throw error;
  return data as ThirdPartyInspection;
}

export async function updateThirdPartyInspection(
  id: string,
  patch: ThirdPartyInspectionPatch,
): Promise<void> {
  const { error } = await supabase
    .from("third_party_inspections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteThirdPartyInspection(id: string): Promise<void> {
  const { error } = await supabase
    .from("third_party_inspections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Cross-module reads ----------

export async function fetchScheduleMilestones(
  projectId: string,
): Promise<ScheduleMilestone[]> {
  const { data, error } = await supabase
    .from("schedule_phases")
    .select("id, name, end_date")
    .eq("project_id", projectId)
    .eq("is_milestone", true)
    .order("end_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "",
    end_date: (row.end_date as string | null) ?? null,
  }));
}

export async function fetchInspectorContacts(
  projectId: string,
): Promise<InspectorContactOption[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, role_type")
    .eq("project_id", projectId)
    .eq("role_type", "inspector");
  if (error) throw error;
  return (data ?? []).map((c) => {
    const name = `${(c.first_name as string) ?? ""} ${(c.last_name as string) ?? ""}`.trim();
    return {
      id: c.id as string,
      name: name || ((c.email as string) ?? "Inspector"),
      email: (c.email as string | null) ?? null,
    };
  });
}

// ---------- Alerts ----------

export async function postAlert(
  projectId: string,
  eventType: string,
  message: string,
): Promise<void> {
  const { error } = await supabase.from("alerts").insert({
    project_id: projectId,
    module_key: "permits",
    event_type: eventType,
    message,
  });
  if (error) throw error;
}

// ---------- File upload ----------

export async function uploadPermitFile(
  projectId: string,
  permitId: string,
  file: File,
): Promise<string> {
  const path = `${projectId}/${permitId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from("permits")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("permits").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInspectionFile(
  projectId: string,
  inspectionId: string,
  file: File,
  prefix: "inspection" | "third_party",
): Promise<string> {
  const path = `${projectId}/${prefix}/${inspectionId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from("permits")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("permits").getPublicUrl(path);
  return data.publicUrl;
}
