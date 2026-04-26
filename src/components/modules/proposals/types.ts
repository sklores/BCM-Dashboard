export type ProposalStatus =
  | "draft"
  | "sent"
  | "under_review"
  | "won"
  | "lost";

export type ProposalType = "simple" | "detailed";

export type Proposal = {
  id: string;
  project_id: string | null;
  estimate_id: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  client_name: string | null;
  project_name: string | null;
  project_address: string | null;
  proposal_type: ProposalType;
  cover_letter: string | null;
  scope_narrative: string | null;
  timeline_summary: string | null;
  team_section: string | null;
  why_hire_us: string | null;
  status: ProposalStatus;
  created_at: string;
};

export type CompanySettings = {
  id: string;
  company_name: string | null;
  logo_url: string | null;
  years_in_business: number | null;
  mission_statement: string | null;
  portfolio_highlights: string | null;
  standard_terms: string | null;
};

export type EstimateOption = {
  id: string;
  estimate_number: string | null;
  client_name: string | null;
  project_name: string | null;
  project_address: string | null;
  fee_type: "fixed" | "percent";
  fee_value: number;
  notes: string | null;
};

export type EstimateLineItemMin = {
  id: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  total_cost: number;
  sort_order: number;
};

export const STATUS_OPTIONS: ProposalStatus[] = [
  "draft",
  "sent",
  "under_review",
  "won",
  "lost",
];

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  under_review: "Under Review",
  won: "Won",
  lost: "Lost",
};

export const STATUS_TEXT: Record<ProposalStatus, string> = {
  draft: "text-zinc-400",
  sent: "text-blue-400",
  under_review: "text-amber-400",
  won: "text-emerald-400",
  lost: "text-red-400",
};

export const TYPE_LABEL: Record<ProposalType, string> = {
  simple: "Simple",
  detailed: "Detailed",
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

export function calcGrandTotal(
  lineItems: { total_cost: number }[],
  feeType: "fixed" | "percent",
  feeValue: number,
): { subtotal: number; fee: number; grand: number } {
  const subtotal = lineItems.reduce(
    (sum, it) => sum + (Number(it.total_cost) || 0),
    0,
  );
  const fee =
    feeType === "percent"
      ? (subtotal * (Number(feeValue) || 0)) / 100
      : Number(feeValue) || 0;
  return { subtotal, fee, grand: subtotal + fee };
}
