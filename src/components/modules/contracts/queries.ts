import { supabase } from "@/lib/supabase";
import type {
  ChangeOrder,
  PrimeContract,
  SubAgreement,
  SubAgreementLineItem,
  SubOption,
} from "./types";

const PRIME_COLUMNS =
  "id, project_id, contract_number, client_name, contract_type, original_contract_value, retainage_percentage, start_date, substantial_completion_date, final_completion_date, scope_of_work, inclusions, exclusions, pdf_url, status";

const SUB_COLUMNS =
  "id, project_id, sub_id, contract_number, trade, scope_of_work, contract_value, retainage_percentage, start_date, completion_date, pdf_url, status, bid_request_id";

const SUB_LINE_COLUMNS =
  "id, agreement_id, description, value, sort_order";

const CO_COLUMNS =
  "id, project_id, co_number, co_date, description, amount, status, affects_client_contract, affects_sub_contract, sub_id";

export async function fetchPrimeContracts(
  projectId: string,
): Promise<PrimeContract[]> {
  const { data, error } = await supabase
    .from("prime_contracts")
    .select(PRIME_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PrimeContract[];
}

export async function fetchSubAgreements(
  projectId: string,
): Promise<SubAgreement[]> {
  const { data, error } = await supabase
    .from("subcontractor_agreements")
    .select(SUB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubAgreement[];
}

export async function fetchSubLineItems(
  agreementId: string,
): Promise<SubAgreementLineItem[]> {
  const { data, error } = await supabase
    .from("sub_agreement_line_items")
    .select(SUB_LINE_COLUMNS)
    .eq("agreement_id", agreementId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubAgreementLineItem[];
}

export async function fetchChangeOrders(
  projectId: string,
): Promise<ChangeOrder[]> {
  const { data, error } = await supabase
    .from("contract_change_orders")
    .select(CO_COLUMNS)
    .eq("project_id", projectId)
    .order("co_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChangeOrder[];
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

export async function fetchProjectAddress(
  projectId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("address")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return (data?.address as string | null) ?? null;
}

// Generic CRUD wrappers — keep one per table.
export async function createPrime(
  projectId: string,
): Promise<PrimeContract> {
  const { data, error } = await supabase
    .from("prime_contracts")
    .insert({ project_id: projectId })
    .select(PRIME_COLUMNS)
    .single();
  if (error) throw error;
  return data as PrimeContract;
}

export async function updatePrime(
  id: string,
  patch: Partial<PrimeContract>,
): Promise<void> {
  const { error } = await supabase
    .from("prime_contracts")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePrime(id: string): Promise<void> {
  const { error } = await supabase
    .from("prime_contracts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createSubAgreement(
  projectId: string,
): Promise<SubAgreement> {
  const { data, error } = await supabase
    .from("subcontractor_agreements")
    .insert({ project_id: projectId })
    .select(SUB_COLUMNS)
    .single();
  if (error) throw error;
  return data as SubAgreement;
}

export async function updateSubAgreement(
  id: string,
  patch: Partial<SubAgreement>,
): Promise<void> {
  const { error } = await supabase
    .from("subcontractor_agreements")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubAgreement(id: string): Promise<void> {
  const { error } = await supabase
    .from("subcontractor_agreements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createSubLineItem(
  agreementId: string,
  sortOrder: number,
): Promise<SubAgreementLineItem> {
  const { data, error } = await supabase
    .from("sub_agreement_line_items")
    .insert({ agreement_id: agreementId, sort_order: sortOrder })
    .select(SUB_LINE_COLUMNS)
    .single();
  if (error) throw error;
  return data as SubAgreementLineItem;
}

export async function updateSubLineItem(
  id: string,
  patch: Partial<SubAgreementLineItem>,
): Promise<void> {
  const { error } = await supabase
    .from("sub_agreement_line_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubLineItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("sub_agreement_line_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createChangeOrder(
  projectId: string,
  coNumber: number,
): Promise<ChangeOrder> {
  const { data, error } = await supabase
    .from("contract_change_orders")
    .insert({ project_id: projectId, co_number: coNumber })
    .select(CO_COLUMNS)
    .single();
  if (error) throw error;
  return data as ChangeOrder;
}

export async function updateChangeOrder(
  id: string,
  patch: Partial<ChangeOrder>,
): Promise<void> {
  const { error } = await supabase
    .from("contract_change_orders")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteChangeOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from("contract_change_orders")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// V2 NOTE: DocuSign API integration for sub-agreement send + signature tracking.
// V2 NOTE: Outlook API for automatic sending of executed contracts.
// V2 NOTE: Approved change orders should write revised contract value to a
// future Billing module.
