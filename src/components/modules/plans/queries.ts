import { supabase } from "@/lib/supabase";
import type {
  Drawing,
  DrawingPin,
  Rfi,
  Submittal,
  SubmittalStatus,
  UserOption,
} from "./types";

const DRAWING_COLUMNS =
  "id, project_id, drawing_number, title, type, revision_number, revision_date, uploaded_by, pdf_url, status, superseded_by, created_at";

const PIN_COLUMNS =
  "id, drawing_id, x_position, y_position, pin_number, note, rfi_id, created_by, created_at";

const RFI_COLUMNS =
  "id, project_id, rfi_number, drawing_id, location_description, question, response, status, assigned_to, drawing_pin_id, created_at, responded_at";

const SUBMITTAL_COLUMNS =
  "id, project_id, submittal_number, description, spec_section, submitted_by, submitted_to, date_submitted, date_returned, status, revision_number, notes, pdf_url, created_at";

// ---------- Drawings ----------

export async function fetchDrawings(projectId: string): Promise<Drawing[]> {
  const { data, error } = await supabase
    .from("drawings")
    .select(DRAWING_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Drawing[];
}

export type DrawingPatch = Partial<
  Pick<
    Drawing,
    | "drawing_number"
    | "title"
    | "type"
    | "revision_number"
    | "revision_date"
    | "pdf_url"
    | "uploaded_by"
    | "status"
    | "superseded_by"
  >
>;

export async function createDrawing(
  projectId: string,
  fields: DrawingPatch,
): Promise<Drawing> {
  const { data, error } = await supabase
    .from("drawings")
    .insert({
      project_id: projectId,
      title: "New drawing",
      type: "architectural",
      ...fields,
    })
    .select(DRAWING_COLUMNS)
    .single();
  if (error) throw error;
  return data as Drawing;
}

export async function updateDrawing(
  id: string,
  patch: DrawingPatch,
): Promise<void> {
  const { error } = await supabase.from("drawings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDrawing(id: string): Promise<void> {
  const { error } = await supabase.from("drawings").delete().eq("id", id);
  if (error) throw error;
}

// Upload a drawing PDF. Returns the public URL stored on the drawing row.
export async function uploadDrawingPdf(
  projectId: string,
  drawingId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${projectId}/${drawingId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("plans")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/pdf",
    });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("plans").getPublicUrl(path);
  const { error: updErr } = await supabase
    .from("drawings")
    .update({ pdf_url: data.publicUrl })
    .eq("id", drawingId);
  if (updErr) throw updErr;
  return data.publicUrl;
}

// Clear a drawing's pdf_url. (Doesn't remove the file from storage to keep
// older revisions retrievable; the drawing row holds the canonical URL.)
export async function clearDrawingPdf(drawingId: string): Promise<void> {
  const { error } = await supabase
    .from("drawings")
    .update({ pdf_url: null })
    .eq("id", drawingId);
  if (error) throw error;
}

// Mark `oldId` as superseded by `newId` and bump it to status='superseded'.
export async function supersedeDrawing(
  oldId: string,
  newId: string,
): Promise<void> {
  const { error } = await supabase
    .from("drawings")
    .update({ status: "superseded", superseded_by: newId })
    .eq("id", oldId);
  if (error) throw error;
}

// ---------- Drawing pins ----------

export async function fetchPins(projectId: string): Promise<DrawingPin[]> {
  // Pins live under drawings; pull pins whose drawing belongs to this project.
  const { data: drawings, error: dErr } = await supabase
    .from("drawings")
    .select("id")
    .eq("project_id", projectId);
  if (dErr) throw dErr;
  const drawingIds = (drawings ?? []).map((d) => d.id as string);
  if (drawingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("drawing_pins")
    .select(PIN_COLUMNS)
    .in("drawing_id", drawingIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DrawingPin[];
}

// ---------- RFIs ----------

export async function fetchRfis(projectId: string): Promise<Rfi[]> {
  const { data, error } = await supabase
    .from("rfis")
    .select(RFI_COLUMNS)
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Rfi[];
}

export async function nextRfiNumber(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("rfis")
    .select("rfi_number")
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = (data?.[0]?.rfi_number as number | null) ?? 0;
  return max + 1;
}

export type RfiPatch = Partial<
  Pick<
    Rfi,
    | "drawing_id"
    | "location_description"
    | "question"
    | "response"
    | "status"
    | "assigned_to"
    | "responded_at"
  >
>;

export async function createRfi(
  projectId: string,
  rfiNumber: number,
  fields: RfiPatch,
): Promise<Rfi> {
  const { data, error } = await supabase
    .from("rfis")
    .insert({
      project_id: projectId,
      rfi_number: rfiNumber,
      status: "open",
      ...fields,
    })
    .select(RFI_COLUMNS)
    .single();
  if (error) throw error;
  return data as Rfi;
}

export async function updateRfi(id: string, patch: RfiPatch): Promise<void> {
  // Auto-stamp responded_at when transitioning to responded.
  if (patch.status === "responded" && patch.responded_at === undefined) {
    patch.responded_at = new Date().toISOString();
  }
  const { error } = await supabase.from("rfis").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteRfi(id: string): Promise<void> {
  const { error } = await supabase.from("rfis").delete().eq("id", id);
  if (error) throw error;
}

// Cross-module: write a thread to the messages table when an RFI is created.
export async function postRfiToMessages(
  projectId: string,
  rfiNumber: number,
  question: string,
): Promise<void> {
  const subjectQuestion =
    question.length > 80 ? question.slice(0, 77) + "…" : question;
  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    from_email: "rfi@bcmdashboard.local",
    from_name: "RFI System",
    subject: `RFI #${rfiNumber}: ${subjectQuestion}`,
    body: question,
  });
  if (error) throw error;
}

// ---------- Submittals ----------

export async function fetchSubmittals(
  projectId: string,
): Promise<Submittal[]> {
  const { data, error } = await supabase
    .from("submittals")
    .select(SUBMITTAL_COLUMNS)
    .eq("project_id", projectId)
    .order("submittal_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Submittal[];
}

export async function nextSubmittalNumber(
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("submittals")
    .select("submittal_number")
    .eq("project_id", projectId)
    .order("submittal_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = (data?.[0]?.submittal_number as number | null) ?? 0;
  return max + 1;
}

export type SubmittalPatch = Partial<
  Pick<
    Submittal,
    | "description"
    | "spec_section"
    | "submitted_by"
    | "submitted_to"
    | "date_submitted"
    | "date_returned"
    | "status"
    | "revision_number"
    | "notes"
    | "pdf_url"
  >
>;

export async function createSubmittal(
  projectId: string,
  submittalNumber: number,
): Promise<Submittal> {
  const { data, error } = await supabase
    .from("submittals")
    .insert({
      project_id: projectId,
      submittal_number: submittalNumber,
      status: "pending",
    })
    .select(SUBMITTAL_COLUMNS)
    .single();
  if (error) throw error;
  return data as Submittal;
}

export async function updateSubmittal(
  id: string,
  patch: SubmittalPatch,
): Promise<void> {
  const { error } = await supabase.from("submittals").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSubmittal(id: string): Promise<void> {
  const { error } = await supabase.from("submittals").delete().eq("id", id);
  if (error) throw error;
}

// Cross-module: write to alerts when a submittal needs action.
export async function postSubmittalAlert(
  projectId: string,
  submittal: Submittal,
  newStatus: SubmittalStatus,
): Promise<void> {
  const message =
    newStatus === "rejected"
      ? `Submittal #${submittal.submittal_number} rejected: ${submittal.description ?? ""}`
      : `Submittal #${submittal.submittal_number} requires resubmittal: ${submittal.description ?? ""}`;
  const { error } = await supabase.from("alerts").insert({
    project_id: projectId,
    module_key: "plans",
    event_type: "submittal_action_required",
    message,
  });
  if (error) throw error;
}

// ---------- Users ----------

export async function fetchUserOptions(): Promise<UserOption[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .order("full_name", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name:
      (u.full_name as string | null) ||
      (u.email as string | null) ||
      "Unnamed",
  }));
}

