export type PrimeStatus = "draft" | "executed" | "complete";
export type SubAgreementStatus = "draft" | "sent" | "signed" | "fully_executed";
export type ChangeOrderStatus = "pending" | "approved" | "rejected" | "in_dispute";

export type ContractType =
  | "lump_sum"
  | "cost_plus_fixed"
  | "cost_plus_percent"
  | "gmp"
  | "tnm";

export type PrimeContract = {
  id: string;
  project_id: string;
  contract_number: string | null;
  client_name: string | null;
  contract_type: ContractType | null;
  original_contract_value: number | null;
  retainage_percentage: number | null;
  start_date: string | null;
  substantial_completion_date: string | null;
  final_completion_date: string | null;
  scope_of_work: string | null;
  inclusions: string | null;
  exclusions: string | null;
  pdf_url: string | null;
  status: PrimeStatus;
};

export type SubAgreement = {
  id: string;
  project_id: string;
  sub_id: string | null;
  contract_number: string | null;
  trade: string | null;
  scope_of_work: string | null;
  contract_value: number | null;
  retainage_percentage: number | null;
  start_date: string | null;
  completion_date: string | null;
  pdf_url: string | null;
  status: SubAgreementStatus;
  bid_request_id: string | null;
};

export type SubAgreementLineItem = {
  id: string;
  agreement_id: string;
  description: string | null;
  value: number | null;
  sort_order: number;
};

export type ChangeOrder = {
  id: string;
  project_id: string;
  co_number: number | null;
  co_date: string | null;
  description: string | null;
  amount: number | null;
  status: ChangeOrderStatus;
  affects_client_contract: boolean;
  affects_sub_contract: boolean;
  sub_id: string | null;
};

export type SubOption = { id: string; name: string };

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  lump_sum: "Lump Sum",
  cost_plus_fixed: "Cost Plus Fixed Fee",
  cost_plus_percent: "Cost Plus Percentage",
  gmp: "GMP",
  tnm: "T&M",
};

export const PRIME_STATUS_LABEL: Record<PrimeStatus, string> = {
  draft: "Draft",
  executed: "Executed",
  complete: "Complete",
};

export const SUB_STATUS_LABEL: Record<SubAgreementStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  fully_executed: "Fully Executed",
};

export const CO_STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_dispute: "In Dispute",
};

export const CO_STATUS_TEXT: Record<ChangeOrderStatus, string> = {
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
