export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "delayed";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigned_sub_id: string | null;
  assigned_user_id: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  sort_order: number;
};

export const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "delayed", label: "Delayed" },
  { key: "complete", label: "Complete" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  delayed: "Delayed",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  not_started: "bg-zinc-500",
  in_progress: "bg-blue-400",
  complete: "bg-emerald-400",
  delayed: "bg-red-400",
};

export const STATUS_BORDER: Record<TaskStatus, string> = {
  not_started: "border-zinc-700",
  in_progress: "border-blue-500/40",
  complete: "border-emerald-500/40",
  delayed: "border-red-500/40",
};

export const STATUS_TEXT: Record<TaskStatus, string> = {
  not_started: "text-zinc-400",
  in_progress: "text-blue-400",
  complete: "text-emerald-400",
  delayed: "text-red-400",
};

export type ProjectSubOption = { id: string; name: string };
export type ProjectTeamOption = { user_id: string; name: string };
