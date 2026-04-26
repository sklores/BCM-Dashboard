import { supabase } from "@/lib/supabase";
import type { Estimate, EstimateLineItem } from "./types";

const ESTIMATE_COLUMNS =
  "id, client_name, project_name, project_address, estimate_date, estimate_number, fee_type, fee_value, notes, status, created_at";

const LINE_COLUMNS =
  "id, estimate_id, description, quantity, unit, unit_cost, total_cost, sort_order";

export async function fetchEstimates(): Promise<Estimate[]> {
  const { data, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Estimate[];
}

export async function fetchLineItems(
  estimateId: string,
): Promise<EstimateLineItem[]> {
  const { data, error } = await supabase
    .from("estimate_line_items")
    .select(LINE_COLUMNS)
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EstimateLineItem[];
}

export type EstimatePatch = Partial<
  Pick<
    Estimate,
    | "client_name"
    | "project_name"
    | "project_address"
    | "estimate_date"
    | "estimate_number"
    | "fee_type"
    | "fee_value"
    | "notes"
    | "status"
  >
>;

export async function createEstimate(): Promise<Estimate> {
  const { data, error } = await supabase
    .from("estimates")
    .insert({ project_name: "New estimate" })
    .select(ESTIMATE_COLUMNS)
    .single();
  if (error) throw error;
  return data as Estimate;
}

export async function updateEstimate(
  id: string,
  patch: EstimatePatch,
): Promise<void> {
  const { error } = await supabase.from("estimates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteEstimate(id: string): Promise<void> {
  const { error } = await supabase.from("estimates").delete().eq("id", id);
  if (error) throw error;
}

export type LineItemPatch = Partial<
  Pick<EstimateLineItem, "description" | "quantity" | "unit" | "unit_cost" | "sort_order">
>;

export async function createLineItem(
  estimateId: string,
  sortOrder: number,
): Promise<EstimateLineItem> {
  const { data, error } = await supabase
    .from("estimate_line_items")
    .insert({ estimate_id: estimateId, sort_order: sortOrder })
    .select(LINE_COLUMNS)
    .single();
  if (error) throw error;
  return data as EstimateLineItem;
}

export async function updateLineItem(
  id: string,
  patch: LineItemPatch,
): Promise<void> {
  const { error } = await supabase
    .from("estimate_line_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
