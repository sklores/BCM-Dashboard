export type Photo = {
  id: string;
  project_id: string;
  storage_path: string;
  storage_url: string | null;
  taken_at: string | null;
  tags: string[];
  room: string | null;
  stage: string | null;
  ai_description: string | null;
  notes: string | null;
  uploaded_at: string;
  annotated_from_id: string | null;
};

export type PhotoAnalysis = {
  description: string;
  tags: string[];
  room: string;
  stage: string;
};

export type GroupMode = "date" | "room" | "stage" | "none";
