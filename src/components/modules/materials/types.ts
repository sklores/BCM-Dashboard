export type DetailedStatus =
  | "specified"
  | "ordered"
  | "delivered"
  | "installed";

export const DETAILED_STATUSES: DetailedStatus[] = [
  "specified",
  "ordered",
  "delivered",
  "installed",
];

export const DETAILED_STATUS_LABEL: Record<DetailedStatus, string> = {
  specified: "Specified",
  ordered: "Ordered",
  delivered: "Delivered",
  installed: "Installed",
};

export const DETAILED_STATUS_STYLE: Record<DetailedStatus, string> = {
  specified: "bg-zinc-800 text-zinc-300 border-zinc-700",
  ordered: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  delivered: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  installed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
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
  expected_delivery_date: string | null;
  delivery_delay_alerted_at: string | null;
};

export function isMaterialDelayed(m: {
  status: DetailedStatus;
  expected_delivery_date: string | null;
}): boolean {
  if (!m.expected_delivery_date) return false;
  if (m.status === "delivered" || m.status === "installed") return false;
  return m.expected_delivery_date < new Date().toISOString().slice(0, 10);
}

export type MaterialPhoto = {
  id: string;
  material_id: string;
  storage_path: string;
  storage_url: string | null;
  sort_order: number;
  created_at: string;
};
