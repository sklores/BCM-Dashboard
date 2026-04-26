export type DetailedStatus = "looking" | "found" | "purchased" | "onsite";

export const DETAILED_STATUSES: DetailedStatus[] = [
  "looking",
  "found",
  "purchased",
  "onsite",
];

export const DETAILED_STATUS_LABEL: Record<DetailedStatus, string> = {
  looking: "Looking",
  found: "Found",
  purchased: "Purchased",
  onsite: "On site",
};

export const DETAILED_STATUS_STYLE: Record<DetailedStatus, string> = {
  looking: "bg-zinc-800 text-zinc-300 border-zinc-700",
  found: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  purchased: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  onsite: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export type Material = {
  id: string;
  project_id: string;
  product_name: string;
  manufacturer: string | null;
  supplier: string | null;
  sku: string | null;
  price: number | null;
  lead_time: string | null;
  notes: string | null;
  is_finish: boolean;
  room: string | null;
  color_finish: string | null;
  installation_notes: string | null;
  status: DetailedStatus;
  dimensions: string | null;
  qty: number | null;
  source_url: string | null;
};

export type MaterialPhoto = {
  id: string;
  material_id: string;
  storage_path: string;
  storage_url: string | null;
  sort_order: number;
  created_at: string;
};
