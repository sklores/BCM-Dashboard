export type PayAppStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "paid"
  | "disputed";

export type ReqStatus =
  | "pending_review"
  | "approved"
  | "disputed"
  | "paid";

export type CoStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_dispute";

export type PayApplication = {
  id: string;
  project_id: string;
  application_number: number | null;
  period_start: string | null;
  period_end: string | null;
  scheduled_value: number | null;
  work_completed_this_period: number | null;
  work_completed_to_date: number | null;
  retainage_held: number | null;
  previous_payments: number | null;
  status: PayAppStatus;
  created_at: string;
};

export type SubRequisition = {
  id: string;
  project_id: string;
  sub_id: string | null;
  period_start: string | null;
  period_end: string | null;
  scheduled_value: number | null;
  work_completed_this_period: number | null;
  work_completed_to_date: number | null;
  retainage_held: number | null;
  amount_due: number | null;
  status: ReqStatus;
  created_at: string;
};

export type ContractChangeOrder = {
  id: string;
  project_id: string;
  co_number: number | null;
  co_date: string | null;
  description: string | null;
  amount: number | null;
  status: CoStatus;
  affects_client_contract: boolean;
  affects_sub_contract: boolean;
  sub_id: string | null;
};

export type SubOption = { id: string; name: string };

export const PAY_APP_STATUSES: PayAppStatus[] = [
  "draft",
  "submitted",
  "approved",
  "paid",
  "disputed",
];

export const PAY_APP_STATUS_LABEL: Record<PayAppStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  paid: "Paid",
  disputed: "Disputed",
};

export const PAY_APP_STATUS_TEXT: Record<PayAppStatus, string> = {
  draft: "text-zinc-400",
  submitted: "text-blue-400",
  approved: "text-amber-400",
  paid: "text-emerald-400",
  disputed: "text-red-400",
};

export const REQ_STATUSES: ReqStatus[] = [
  "pending_review",
  "approved",
  "disputed",
  "paid",
];

export const REQ_STATUS_LABEL: Record<ReqStatus, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  disputed: "Disputed",
  paid: "Paid",
};

export const REQ_STATUS_TEXT: Record<ReqStatus, string> = {
  pending_review: "text-zinc-400",
  approved: "text-amber-400",
  disputed: "text-red-400",
  paid: "text-emerald-400",
};

export const CO_STATUSES: CoStatus[] = [
  "pending",
  "approved",
  "rejected",
  "in_dispute",
];

export const CO_STATUS_LABEL: Record<CoStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_dispute: "In Dispute",
};

export const CO_STATUS_TEXT: Record<CoStatus, string> = {
  pending: "text-zinc-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
  in_dispute: "text-amber-400",
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

// Pay app: amount due = WCTD − retainage − previous payments
export function payAppAmountDue(p: PayApplication): number {
  const wctd = Number(p.work_completed_to_date) || 0;
  const ret = Number(p.retainage_held) || 0;
  const prev = Number(p.previous_payments) || 0;
  return wctd - ret - prev;
}
