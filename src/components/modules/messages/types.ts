export type Message = {
  id: string;
  project_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  received_at: string;
  tags: string[];
};

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
