import { supabase } from "@/lib/supabase";
import type {
  CompanySettings,
  EstimateLineItemMin,
  EstimateOption,
  Proposal,
} from "./types";

const PROPOSAL_COLUMNS =
  "id, project_id, estimate_id, proposal_number, proposal_date, client_name, project_name, project_address, proposal_type, cover_letter, scope_narrative, timeline_summary, team_section, why_hire_us, status, created_at";

const SETTINGS_COLUMNS =
  "id, company_name, logo_url, years_in_business, mission_statement, portfolio_highlights, standard_terms";

const ESTIMATE_OPTION_COLUMNS =
  "id, estimate_number, client_name, project_name, project_address, fee_type, fee_value, notes";

const LINE_COLUMNS =
  "id, description, quantity, unit, unit_cost, total_cost, sort_order";

export async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Proposal[];
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from("company_settings")
    .select(SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CompanySettings | null) ?? null;
}

export async function updateCompanySettings(
  id: string,
  patch: Partial<CompanySettings>,
): Promise<void> {
  const { error } = await supabase
    .from("company_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchEstimateOptions(): Promise<EstimateOption[]> {
  const { data, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_OPTION_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EstimateOption[];
}

export async function fetchEstimateLineItems(
  estimateId: string,
): Promise<EstimateLineItemMin[]> {
  const { data, error } = await supabase
    .from("estimate_line_items")
    .select(LINE_COLUMNS)
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EstimateLineItemMin[];
}

export type ProposalPatch = Partial<Omit<Proposal, "id" | "created_at">>;

export async function createProposal(): Promise<Proposal> {
  const { data, error } = await supabase
    .from("proposals")
    .insert({ proposal_type: "detailed", status: "draft" })
    .select(PROPOSAL_COLUMNS)
    .single();
  if (error) throw error;
  return data as Proposal;
}

export async function updateProposal(
  id: string,
  patch: ProposalPatch,
): Promise<void> {
  const { error } = await supabase.from("proposals").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) throw error;
}
