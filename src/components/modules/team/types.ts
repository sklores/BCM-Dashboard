export type ProjectRole = "owner" | "pm" | "apm" | "super";

export const PROJECT_ROLE_OPTIONS: ProjectRole[] = ["owner", "pm", "apm", "super"];

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  owner: "Owner",
  pm: "PM",
  apm: "APM",
  super: "Super",
};

export type User = {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: string | null;
};
