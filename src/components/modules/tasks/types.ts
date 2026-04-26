export type TaskType =
  | "general"
  | "punch_list"
  | "action_item"
  | "inspection_followup";

export const TASK_TYPES: TaskType[] = [
  "general",
  "punch_list",
  "action_item",
  "inspection_followup",
];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  general: "General",
  punch_list: "Punch List",
  action_item: "Action Item",
  inspection_followup: "Inspection Follow Up",
};

export const TASK_TYPE_STYLE: Record<TaskType, string> = {
  general: "bg-zinc-700/40 text-zinc-300 border-zinc-700",
  punch_list: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  action_item: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  inspection_followup: "bg-red-500/10 text-red-300 border-red-500/30",
};

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "delayed"
  | "complete";

export const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "delayed",
  "complete",
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  delayed: "Delayed",
  complete: "Complete",
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  not_started: "bg-zinc-800 text-zinc-300 border-zinc-700",
  in_progress: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  delayed: "bg-red-500/10 text-red-300 border-red-500/30",
  complete: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  medium: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  high: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  urgent: "bg-red-500/10 text-red-300 border-red-500/30",
};

export type RecurringFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export const RECURRING_FREQUENCIES: RecurringFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
];

export const RECURRING_FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  task_type: TaskType;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  recurring: boolean;
  recurring_frequency: RecurringFrequency | null;
  recurring_end_date: string | null;
  parent_task_id: string | null;
  linked_module: string | null;
  linked_record_id: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  sort_order: number;
  // Legacy single-assignee columns retained for back-compat
  assigned_sub_id: string | null;
  assigned_user_id: string | null;
};

export type TaskAssignee = {
  id: string;
  task_id: string;
  contact_id: string | null;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

export type TaskDependency = {
  id: string;
  task_id: string;
  predecessor_task_id: string;
  created_at: string;
};

export type PunchListDetails = {
  id: string;
  task_id: string;
  location: string | null;
  responsible_sub_id: string | null;
  sign_off_required: boolean;
  sign_off_date: string | null;
  sign_off_by: string | null;
  created_at: string;
};

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "status"
    | "task_type"
    | "priority"
    | "start_date"
    | "due_date"
    | "recurring"
    | "recurring_frequency"
    | "recurring_end_date"
    | "parent_task_id"
    | "linked_module"
    | "linked_record_id"
    | "completed_at"
    | "sort_order"
  >
>;

export type PunchListPatch = Partial<
  Pick<
    PunchListDetails,
    | "location"
    | "responsible_sub_id"
    | "sign_off_required"
    | "sign_off_date"
    | "sign_off_by"
  >
>;

export type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  role_type: string | null;
};

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isOverdue(t: Task): boolean {
  if (!t.due_date) return false;
  if (t.status === "complete") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(t.due_date + "T00:00:00") < today;
}

export function nextRecurringDate(
  current: string,
  freq: RecurringFrequency,
): string {
  const d = new Date(current + "T00:00:00");
  switch (freq) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}
