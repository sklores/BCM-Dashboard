export type PlanCategory =
  | "stamped"
  | "mep"
  | "old"
  | "takeoffs"
  | "horizontal";

export type Plan = {
  id: string;
  project_id: string;
  name: string;
  category: PlanCategory;
  description: string | null;
  file_url: string | null;
  uploaded_at: string;
};

export const CATEGORIES: { key: PlanCategory; label: string }[] = [
  { key: "stamped", label: "Stamped" },
  { key: "mep", label: "MEP" },
  { key: "old", label: "Old" },
  { key: "takeoffs", label: "Takeoffs" },
  { key: "horizontal", label: "Horizontal" },
];

export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  stamped: "Stamped",
  mep: "MEP",
  old: "Old",
  takeoffs: "Takeoffs",
  horizontal: "Horizontal",
};
