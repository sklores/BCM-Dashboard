export type EntryType =
  | "email"
  | "call"
  | "field_note"
  | "text_screenshot";

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  email: "Email",
  call: "Call",
  field_note: "Field note",
  text_screenshot: "Text screenshot",
};

export type Priority = "normal" | "high" | "urgent";

export const PRIORITY_LABEL: Record<Priority, string> = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  normal: "border-zinc-800 bg-zinc-900 text-zinc-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  urgent: "border-red-500/40 bg-red-500/10 text-red-300",
};

export type Message = {
  id: string;
  project_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  received_at: string;
  tags: string[];
  entry_type: EntryType;
  priority: Priority;
  follow_up_task_id: string | null;
  attachment_url: string | null;
  contact_id: string | null;
  duration_minutes: number | null;
};

export type ContactOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

// Strip common reply/forward prefixes off a subject so emails with the
// same root subject collapse into a thread. Returns a stable key.
export function normalizeSubject(s: string | null | undefined): string {
  let out = (s ?? "").trim();
  // Repeatedly strip leading "Re:" / "Fwd:" / "Fw:" (case-insensitive,
  // optional spaces) until the prefix stops matching.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let i = 0;
  while (i < 8) {
    const m = /^(re|fwd|fw)\s*:\s*/i.exec(out);
    if (!m) break;
    out = out.slice(m[0].length).trim();
    i++;
  }
  return out.toLowerCase().replace(/\s+/g, " ");
}

// Keep in sync with src/app/api/messages/tag/route.ts
export const TAG_OPTIONS = [
  "budget",
  "client",
  "materials",
  "schedule",
  "subs",
  "team",
  "tasks",
  "photos",
  "plans",
  "permits",
  "notes",
  "calendar",
  "estimating",
  "contracts",
  "reports",
] as const;

export type MessageTag = (typeof TAG_OPTIONS)[number];
