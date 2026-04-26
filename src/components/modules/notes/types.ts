export type MeetingStatus = "draft" | "published";

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export const MEETING_STATUS_STYLE: Record<MeetingStatus, string> = {
  draft: "bg-zinc-800 text-zinc-300 border-zinc-700",
  published: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export type MinutesStatus = "draft" | "approved";

export const MINUTES_STATUS_LABEL: Record<MinutesStatus, string> = {
  draft: "Draft",
  approved: "Approved",
};

export const MINUTES_STATUS_STYLE: Record<MinutesStatus, string> = {
  draft: "bg-zinc-800 text-zinc-300 border-zinc-700",
  approved: "bg-blue-500/10 text-blue-300 border-blue-500/30",
};

export type PendingStatus = "open" | "resolved" | "deferred";

export const PENDING_STATUSES: PendingStatus[] = [
  "open",
  "resolved",
  "deferred",
];

export const PENDING_STATUS_LABEL: Record<PendingStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  deferred: "Deferred",
};

export const PENDING_STATUS_STYLE: Record<PendingStatus, string> = {
  open: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  deferred: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
};

export type TeamPadNote = {
  id: string;
  project_id: string;
  title: string | null;
  body: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamPadNotePatch = Partial<
  Pick<TeamPadNote, "title" | "body" | "last_edited_by">
>;

export type ScratchNote = {
  id: string;
  project_id: string;
  user_id: string | null;
  title: string | null;
  body: string | null;
  tagged_module: string | null;
  tagged_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Meeting = {
  id: string;
  project_id: string;
  meeting_name: string | null;
  date: string | null;
  location: string | null;
  attendees: unknown; // jsonb fallback (we use meeting_attendees join table)
  notes_body: string | null;
  status: MeetingStatus;
  created_at: string;
};

export type MeetingAttendee = {
  id: string;
  meeting_id: string;
  contact_id: string | null;
  name: string | null;
};

export type ActionItem = {
  id: string;
  meeting_id: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  converted_to_task: boolean;
  task_id: string | null;
  created_at: string;
};

export type MeetingMinutes = {
  id: string;
  meeting_id: string;
  project_id: string;
  status: MinutesStatus;
  pdf_url: string | null;
  distributed_at: string | null;
  created_at: string;
};

export type PendingItem = {
  id: string;
  project_id: string;
  description: string | null;
  raised_by: string | null;
  meeting_id: string | null;
  status: PendingStatus;
  resolved_at: string | null;
  created_at: string;
};

export type ScratchNotePatch = Partial<
  Pick<
    ScratchNote,
    "title" | "body" | "tagged_module" | "tagged_record_id" | "user_id"
  >
> & { updated_at?: string };

export type MeetingPatch = Partial<
  Pick<
    Meeting,
    "meeting_name" | "date" | "location" | "notes_body" | "status"
  >
>;

export type ActionItemPatch = Partial<
  Pick<
    ActionItem,
    "description" | "assigned_to" | "due_date" | "converted_to_task" | "task_id"
  >
>;

export type PendingItemPatch = Partial<
  Pick<
    PendingItem,
    "description" | "raised_by" | "meeting_id" | "status" | "resolved_at"
  >
>;

export type ContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export const TAGGABLE_MODULES = [
  "permits",
  "inspections",
  "subs",
  "materials",
  "schedule",
  "plans",
  "tasks",
  "billing",
  "estimating",
  "messages",
  "photos",
  "contacts",
] as const;

export type TaggableModule = (typeof TAGGABLE_MODULES)[number];

export const TAGGABLE_MODULE_LABEL: Record<TaggableModule, string> = {
  permits: "Permits",
  inspections: "Inspections",
  subs: "Subs",
  materials: "Materials",
  schedule: "Schedule",
  plans: "Plans",
  tasks: "Tasks",
  billing: "Billing",
  estimating: "Estimating",
  messages: "Messages",
  photos: "Photos",
  contacts: "Contacts",
};

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}
