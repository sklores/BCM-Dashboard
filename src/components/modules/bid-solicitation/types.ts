export type BidRequestStatus = "open" | "awarded" | "closed";
export type BidInvitationStatus = "invited" | "received" | "declined" | "awarded";

export type BidRequest = {
  id: string;
  project_id: string;
  trade_name: string | null;
  scope_of_work: string | null;
  due_date: string | null;
  status: BidRequestStatus;
  created_at: string;
};

export type BidInvitation = {
  id: string;
  bid_request_id: string;
  sub_id: string;
  status: BidInvitationStatus;
  base_bid: number | null;
};

export type BidLineItem = {
  id: string;
  bid_request_id: string;
  sub_id: string | null;
  description: string | null;
  amount: number | null;
  sort_order: number;
};

export type SubOption = { id: string; name: string };

export const REQUEST_STATUS_LABEL: Record<BidRequestStatus, string> = {
  open: "Open",
  awarded: "Awarded",
  closed: "Closed",
};

export const INVITATION_STATUS_LABEL: Record<BidInvitationStatus, string> = {
  invited: "Invited",
  received: "Bid Received",
  declined: "Declined",
  awarded: "Awarded",
};

export const INVITATION_STATUS_TEXT: Record<BidInvitationStatus, string> = {
  invited: "text-zinc-400",
  received: "text-blue-400",
  declined: "text-zinc-500",
  awarded: "text-emerald-400",
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
