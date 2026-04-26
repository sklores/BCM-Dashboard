import { supabase } from "@/lib/supabase";
import type {
  BidInvitation,
  BidLineItem,
  BidRequest,
  SubOption,
} from "./types";

const REQ_COLUMNS =
  "id, project_id, trade_name, scope_of_work, due_date, status, created_at";
const INV_COLUMNS = "id, bid_request_id, sub_id, status, base_bid";
const LINE_COLUMNS =
  "id, bid_request_id, sub_id, description, amount, sort_order";

export async function fetchBidRequests(
  projectId: string,
): Promise<BidRequest[]> {
  const { data, error } = await supabase
    .from("bid_requests")
    .select(REQ_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BidRequest[];
}

export async function fetchInvitations(
  bidRequestId: string,
): Promise<BidInvitation[]> {
  const { data, error } = await supabase
    .from("bid_invitations")
    .select(INV_COLUMNS)
    .eq("bid_request_id", bidRequestId);
  if (error) throw error;
  return (data ?? []) as BidInvitation[];
}

export async function fetchLineItems(
  bidRequestId: string,
): Promise<BidLineItem[]> {
  const { data, error } = await supabase
    .from("bid_line_items")
    .select(LINE_COLUMNS)
    .eq("bid_request_id", bidRequestId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BidLineItem[];
}

export async function fetchProjectSubOptions(
  projectId: string,
): Promise<SubOption[]> {
  const { data: links, error: linksError } = await supabase
    .from("project_subs")
    .select("sub_id")
    .eq("project_id", projectId);
  if (linksError) throw linksError;
  if (!links || links.length === 0) return [];
  const subIds = Array.from(new Set(links.map((l) => l.sub_id as string)));
  const { data: subs, error: subsError } = await supabase
    .from("subs")
    .select("id, name")
    .in("id", subIds);
  if (subsError) throw subsError;
  return (subs ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));
}

export type BidRequestPatch = Partial<
  Pick<BidRequest, "trade_name" | "scope_of_work" | "due_date" | "status">
>;

export async function createBidRequest(
  projectId: string,
): Promise<BidRequest> {
  const { data, error } = await supabase
    .from("bid_requests")
    .insert({ project_id: projectId, trade_name: "New bid request" })
    .select(REQ_COLUMNS)
    .single();
  if (error) throw error;
  return data as BidRequest;
}

export async function updateBidRequest(
  id: string,
  patch: BidRequestPatch,
): Promise<void> {
  const { error } = await supabase
    .from("bid_requests")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBidRequest(id: string): Promise<void> {
  const { error } = await supabase.from("bid_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function inviteSub(
  bidRequestId: string,
  subId: string,
): Promise<BidInvitation> {
  const { data, error } = await supabase
    .from("bid_invitations")
    .insert({ bid_request_id: bidRequestId, sub_id: subId })
    .select(INV_COLUMNS)
    .single();
  if (error) throw error;
  return data as BidInvitation;
}

export async function removeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("bid_invitations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export type InvitationPatch = Partial<Pick<BidInvitation, "status" | "base_bid">>;

export async function updateInvitation(
  id: string,
  patch: InvitationPatch,
): Promise<void> {
  const { error } = await supabase
    .from("bid_invitations")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function createLineItem(
  bidRequestId: string,
  subId: string | null,
  sortOrder: number,
): Promise<BidLineItem> {
  const { data, error } = await supabase
    .from("bid_line_items")
    .insert({
      bid_request_id: bidRequestId,
      sub_id: subId,
      sort_order: sortOrder,
    })
    .select(LINE_COLUMNS)
    .single();
  if (error) throw error;
  return data as BidLineItem;
}

export type LineItemPatch = Partial<
  Pick<BidLineItem, "description" | "amount" | "sub_id">
>;

export async function updateLineItem(
  id: string,
  patch: LineItemPatch,
): Promise<void> {
  const { error } = await supabase
    .from("bid_line_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("bid_line_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Award flow: mark invitation/request as awarded AND create the sub agreement.
export async function awardBid({
  invitationId,
  bidRequestId,
  projectId,
  subId,
  baseBid,
  trade,
  scopeOfWork,
}: {
  invitationId: string;
  bidRequestId: string;
  projectId: string;
  subId: string;
  baseBid: number | null;
  trade: string | null;
  scopeOfWork: string | null;
}): Promise<void> {
  // 1. Update invitation
  const { error: invError } = await supabase
    .from("bid_invitations")
    .update({ status: "awarded" })
    .eq("id", invitationId);
  if (invError) throw invError;

  // 2. Mark request awarded
  const { error: reqError } = await supabase
    .from("bid_requests")
    .update({ status: "awarded" })
    .eq("id", bidRequestId);
  if (reqError) throw reqError;

  // 3. Create the subcontractor agreement
  const { error: agErr } = await supabase
    .from("subcontractor_agreements")
    .insert({
      project_id: projectId,
      sub_id: subId,
      contract_value: baseBid ?? 0,
      trade,
      scope_of_work: scopeOfWork,
      bid_request_id: bidRequestId,
      status: "draft",
    });
  if (agErr) throw agErr;
}
