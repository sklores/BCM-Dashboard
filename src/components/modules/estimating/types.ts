export type EstimateStatus = "draft" | "sent" | "accepted" | "rejected" | "archived";
export type FeeType = "fixed" | "percent";

export type Estimate = {
  id: string;
  client_name: string | null;
  project_name: string | null;
  project_address: string | null;
  estimate_date: string | null;
  estimate_number: string | null;
  fee_type: FeeType;
  fee_value: number;
  notes: string | null;
  status: EstimateStatus;
  created_at: string;
};

export type EstimateLineItem = {
  id: string;
  estimate_id: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  total_cost: number;
  sort_order: number;
};

export const STATUS_LABEL: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  archived: "Archived",
};

export const STATUS_TEXT: Record<EstimateStatus, string> = {
  draft: "text-zinc-400",
  sent: "text-blue-400",
  accepted: "text-emerald-400",
  rejected: "text-red-400",
  archived: "text-zinc-500",
};

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
