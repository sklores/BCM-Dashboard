import { supabase } from "@/lib/supabase";
import type {
  ActionItem,
  ActionItemPatch,
  ContactOption,
  Meeting,
  MeetingAttendee,
  MeetingMinutes,
  MeetingPatch,
  PendingItem,
  PendingItemPatch,
  ScratchNote,
  ScratchNotePatch,
  TeamPadNote,
  TeamPadNotePatch,
} from "./types";

const SCRATCH_COLUMNS =
  "id, project_id, user_id, title, body, tagged_module, tagged_record_id, created_at, updated_at";
const MEETING_COLUMNS =
  "id, project_id, meeting_name, date, location, attendees, notes_body, status, created_at";
const ATTENDEE_COLUMNS = "id, meeting_id, contact_id, name";
const ACTION_COLUMNS =
  "id, meeting_id, description, assigned_to, due_date, converted_to_task, task_id, created_at";
const MINUTES_COLUMNS =
  "id, meeting_id, project_id, status, pdf_url, distributed_at, created_at";
const PENDING_COLUMNS =
  "id, project_id, description, raised_by, meeting_id, status, resolved_at, created_at";

const TEAM_PAD_COLUMNS =
  "id, project_id, title, body, last_edited_by, created_at, updated_at";

// ---------- Scratch Notes ----------

export async function fetchScratchNotes(
  projectId: string,
): Promise<ScratchNote[]> {
  const { data, error } = await supabase
    .from("scratch_notes")
    .select(SCRATCH_COLUMNS)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScratchNote[];
}

export async function createScratchNote(
  projectId: string,
  patch: ScratchNotePatch = {},
): Promise<ScratchNote> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("scratch_notes")
    .insert({
      project_id: projectId,
      title: "Untitled",
      body: "",
      created_at: now,
      updated_at: now,
      ...patch,
    })
    .select(SCRATCH_COLUMNS)
    .single();
  if (error) throw error;
  return data as ScratchNote;
}

export async function updateScratchNote(
  id: string,
  patch: ScratchNotePatch,
): Promise<void> {
  const { error } = await supabase
    .from("scratch_notes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteScratchNote(id: string): Promise<void> {
  const { error } = await supabase.from("scratch_notes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Meetings ----------

export async function fetchMeetings(projectId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("project_id", projectId)
    .order("date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Meeting[];
}

export async function createMeeting(
  projectId: string,
  patch: MeetingPatch = {},
): Promise<Meeting> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      project_id: projectId,
      meeting_name: "New meeting",
      date: today,
      status: "draft",
      ...patch,
    })
    .select(MEETING_COLUMNS)
    .single();
  if (error) throw error;
  return data as Meeting;
}

export async function updateMeeting(
  id: string,
  patch: MeetingPatch,
): Promise<void> {
  const { error } = await supabase.from("meetings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Meeting Attendees ----------

export async function fetchAttendees(
  meetingIds: string[],
): Promise<MeetingAttendee[]> {
  if (meetingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("meeting_attendees")
    .select(ATTENDEE_COLUMNS)
    .in("meeting_id", meetingIds);
  if (error) throw error;
  return (data ?? []) as MeetingAttendee[];
}

export async function addAttendee(
  meetingId: string,
  contactId: string | null,
  name: string | null,
): Promise<MeetingAttendee> {
  const { data, error } = await supabase
    .from("meeting_attendees")
    .insert({ meeting_id: meetingId, contact_id: contactId, name })
    .select(ATTENDEE_COLUMNS)
    .single();
  if (error) throw error;
  return data as MeetingAttendee;
}

export async function removeAttendee(id: string): Promise<void> {
  const { error } = await supabase
    .from("meeting_attendees")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Action Items ----------

export async function fetchActionItems(
  meetingIds: string[],
): Promise<ActionItem[]> {
  if (meetingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("action_items")
    .select(ACTION_COLUMNS)
    .in("meeting_id", meetingIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActionItem[];
}

export async function createActionItem(
  meetingId: string,
  patch: ActionItemPatch = {},
): Promise<ActionItem> {
  const { data, error } = await supabase
    .from("action_items")
    .insert({
      meeting_id: meetingId,
      description: "",
      converted_to_task: false,
      ...patch,
    })
    .select(ACTION_COLUMNS)
    .single();
  if (error) throw error;
  return data as ActionItem;
}

export async function updateActionItem(
  id: string,
  patch: ActionItemPatch,
): Promise<void> {
  const { error } = await supabase
    .from("action_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteActionItem(id: string): Promise<void> {
  const { error } = await supabase.from("action_items").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Convert to Task ----------

export async function convertActionItemToTask(
  projectId: string,
  item: ActionItem,
  assigneeName: string | null,
): Promise<string> {
  const description = [
    item.description ?? "",
    assigneeName ? `\n\nAssignee: ${assigneeName}` : "",
  ]
    .join("")
    .trim();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: (item.description ?? "Action item").slice(0, 120),
      description: description || null,
      status: "todo",
      due_date: item.due_date,
    })
    .select("id")
    .single();
  if (error) throw error;
  const taskId = data.id as string;
  await updateActionItem(item.id, {
    converted_to_task: true,
    task_id: taskId,
  });
  return taskId;
}

// ---------- Meeting Minutes ----------

export async function fetchMinutes(
  projectId: string,
): Promise<MeetingMinutes[]> {
  const { data, error } = await supabase
    .from("meeting_minutes")
    .select(MINUTES_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MeetingMinutes[];
}

export async function ensureMinutesForMeeting(
  meetingId: string,
  projectId: string,
): Promise<MeetingMinutes> {
  const { data: existing, error: existingErr } = await supabase
    .from("meeting_minutes")
    .select(MINUTES_COLUMNS)
    .eq("meeting_id", meetingId)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) return existing[0] as MeetingMinutes;
  const { data, error } = await supabase
    .from("meeting_minutes")
    .insert({
      meeting_id: meetingId,
      project_id: projectId,
      status: "draft",
    })
    .select(MINUTES_COLUMNS)
    .single();
  if (error) throw error;
  return data as MeetingMinutes;
}

// ---------- Pending Items ----------

export async function fetchPendingItems(
  projectId: string,
): Promise<PendingItem[]> {
  const { data, error } = await supabase
    .from("pending_items")
    .select(PENDING_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingItem[];
}

export async function createPendingItem(
  projectId: string,
  patch: PendingItemPatch = {},
): Promise<PendingItem> {
  const { data, error } = await supabase
    .from("pending_items")
    .insert({
      project_id: projectId,
      description: "",
      status: "open",
      ...patch,
    })
    .select(PENDING_COLUMNS)
    .single();
  if (error) throw error;
  return data as PendingItem;
}

export async function updatePendingItem(
  id: string,
  patch: PendingItemPatch,
): Promise<void> {
  const { error } = await supabase
    .from("pending_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePendingItem(id: string): Promise<void> {
  const { error } = await supabase.from("pending_items").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Team Pad ----------

export async function fetchTeamPadNotes(
  projectId: string,
): Promise<TeamPadNote[]> {
  const { data, error } = await supabase
    .from("team_pad_notes")
    .select(TEAM_PAD_COLUMNS)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeamPadNote[];
}

export async function createTeamPadNote(
  projectId: string,
): Promise<TeamPadNote> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("team_pad_notes")
    .insert({
      project_id: projectId,
      title: "Untitled pad",
      body: "",
      created_at: now,
      updated_at: now,
    })
    .select(TEAM_PAD_COLUMNS)
    .single();
  if (error) throw error;
  return data as TeamPadNote;
}

export async function updateTeamPadNote(
  id: string,
  patch: TeamPadNotePatch,
): Promise<void> {
  const { error } = await supabase
    .from("team_pad_notes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTeamPadNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("team_pad_notes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Contacts (for picker) ----------

export async function fetchContactOptions(
  projectId: string,
): Promise<ContactOption[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((c) => {
    const name = `${(c.first_name as string) ?? ""} ${(c.last_name as string) ?? ""}`.trim();
    return {
      id: c.id as string,
      name: name || ((c.email as string) ?? "Contact"),
      email: (c.email as string | null) ?? null,
    };
  });
}
