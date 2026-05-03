export type ScheduleStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "delayed";

export type SchedulePhase = {
  id: string;
  project_id: string;
  name: string;
  status: ScheduleStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  sort_order: number;
  is_milestone: boolean;
  progress_pct: number | null;
};

export type ScheduleTask = {
  id: string;
  phase_id: string;
  name: string;
  status: ScheduleStatus;
  assigned_sub_id: string | null;
  assigned_user_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  sort_order: number;
};

export type ScheduleSubtask = {
  id: string;
  task_id: string;
  name: string;
  status: ScheduleStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  sort_order: number;
};

export type ScheduleMaterialCard = {
  id: string;
  task_id: string;
  material_id: string | null;
  instructions: string | null;
  pdf_url: string | null;
};

export type ProjectSubOption = {
  id: string;
  name: string;
};

export type ProjectTeamOption = {
  user_id: string;
  name: string;
};

export type MaterialCatalogOption = {
  id: string;
  product_name: string;
  status: string | null;
  expected_delivery_date: string | null;
};

export type ScheduleMilestone = {
  id: string;
  project_id: string;
  name: string;
  date: string | null;
  status: ScheduleStatus;
  sort_order: number;
};

export type ScheduleView = "gantt" | "detailed" | "calendar" | "milestone";

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  delayed: "Delayed",
};

// Tailwind colors keyed off status. Used by both Simple and Detailed views.
export const STATUS_BAR: Record<ScheduleStatus, string> = {
  not_started: "bg-zinc-600",
  in_progress: "bg-blue-500",
  complete: "bg-emerald-500",
  delayed: "bg-red-500",
};

export const STATUS_DOT: Record<ScheduleStatus, string> = {
  not_started: "bg-zinc-500",
  in_progress: "bg-blue-400",
  complete: "bg-emerald-400",
  delayed: "bg-red-400",
};

export const STATUS_TEXT: Record<ScheduleStatus, string> = {
  not_started: "text-zinc-400",
  in_progress: "text-blue-400",
  complete: "text-emerald-400",
  delayed: "text-red-400",
};
