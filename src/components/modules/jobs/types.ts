export type JobStatus =
  | "not_started"
  | "in_progress"
  | "delayed"
  | "complete";

export const JOB_STATUSES: JobStatus[] = [
  "not_started",
  "in_progress",
  "delayed",
  "complete",
];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  delayed: "Delayed",
  complete: "Complete",
};

export const JOB_STATUS_STYLE: Record<JobStatus, string> = {
  not_started: "bg-zinc-800 text-zinc-300 border-zinc-700",
  in_progress: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  delayed: "bg-red-500/10 text-red-300 border-red-500/30",
  complete: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export type Job = {
  id: string;
  project_id: string;
  sub_id: string | null;
  title: string | null;
  scope: string | null;
  status: JobStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  parent_phase_id: string | null;
  parent_subtask_id: string | null;
  location: string | null;
  created_at: string;
};

export type JobPhaseOption = {
  id: string;
  name: string;
  sort_order: number;
};

export type JobMaterial = {
  id: string;
  job_id: string;
  material_id: string;
};

export type JobDrawing = {
  id: string;
  job_id: string;
  drawing_id: string | null;
  extraction_id: string | null;
};

export type JobMaterialOption = {
  id: string;
  product_name: string;
  manufacturer: string | null;
};

export type JobDrawingOption = {
  id: string;
  drawing_number: string | null;
  title: string | null;
};

export type JobExtractionOption = {
  id: string;
  drawing_id: string;
  label: string | null;
  category: string | null;
};

export type JobSubOption = {
  id: string;
  name: string;
  trade: string | null;
};
