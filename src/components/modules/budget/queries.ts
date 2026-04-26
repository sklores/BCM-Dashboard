import { supabase } from "@/lib/supabase";
import type {
  BudgetClarification,
  BudgetClarificationPatch,
  BudgetDivision,
  BudgetDivisionPatch,
  BudgetLineItem,
  BudgetLineItemPatch,
  ClarSection,
} from "./types";

const DIV_COLUMNS =
  "id, project_id, csi_code, name, sort_order, created_at";
const LINE_COLUMNS =
  "id, project_id, division_id, description, quantity, unit_measure, material_allowance, material_unit_price, hours, hourly_rate, contractor_cost, notes, status, sent_to_owner_at, sort_order, created_at";
const CLAR_COLUMNS =
  "id, project_id, section, seq, parent_seq, body, sort_order, created_at";

// ---------- Divisions ----------

export async function fetchDivisions(
  projectId: string,
): Promise<BudgetDivision[]> {
  const { data, error } = await supabase
    .from("budget_divisions")
    .select(DIV_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("csi_code", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetDivision[];
}

export async function createDivision(
  projectId: string,
  patch: BudgetDivisionPatch & { sort_order: number },
): Promise<BudgetDivision> {
  const { data, error } = await supabase
    .from("budget_divisions")
    .insert({
      project_id: projectId,
      name: "New division",
      ...patch,
    })
    .select(DIV_COLUMNS)
    .single();
  if (error) throw error;
  return data as BudgetDivision;
}

export async function updateDivision(
  id: string,
  patch: BudgetDivisionPatch,
): Promise<void> {
  const { error } = await supabase
    .from("budget_divisions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDivision(id: string): Promise<void> {
  const { error } = await supabase
    .from("budget_divisions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Line Items ----------

export async function fetchLineItems(
  projectId: string,
): Promise<BudgetLineItem[]> {
  const { data, error } = await supabase
    .from("budget_line_items")
    .select(LINE_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetLineItem[];
}

export async function createLineItem(
  projectId: string,
  divisionId: string,
  patch: BudgetLineItemPatch & { sort_order?: number } = {},
): Promise<BudgetLineItem> {
  const { data, error } = await supabase
    .from("budget_line_items")
    .insert({
      project_id: projectId,
      division_id: divisionId,
      description: "",
      sort_order: 0,
      ...patch,
    })
    .select(LINE_COLUMNS)
    .single();
  if (error) throw error;
  return data as BudgetLineItem;
}

export async function updateLineItem(
  id: string,
  patch: BudgetLineItemPatch,
): Promise<void> {
  const { error } = await supabase
    .from("budget_line_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("budget_line_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Clarifications ----------

export async function fetchClarifications(
  projectId: string,
): Promise<BudgetClarification[]> {
  const { data, error } = await supabase
    .from("budget_clarifications")
    .select(CLAR_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetClarification[];
}

export async function createClarification(
  projectId: string,
  section: ClarSection,
  patch: BudgetClarificationPatch & { sort_order: number } = {
    sort_order: 0,
  },
): Promise<BudgetClarification> {
  const { data, error } = await supabase
    .from("budget_clarifications")
    .insert({
      project_id: projectId,
      section,
      body: "",
      ...patch,
    })
    .select(CLAR_COLUMNS)
    .single();
  if (error) throw error;
  return data as BudgetClarification;
}

export async function updateClarification(
  id: string,
  patch: BudgetClarificationPatch,
): Promise<void> {
  const { error } = await supabase
    .from("budget_clarifications")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteClarification(id: string): Promise<void> {
  const { error } = await supabase
    .from("budget_clarifications")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Bulk Insert (Import) ----------

export async function bulkInsertBudget(
  projectId: string,
  divisions: Array<{
    csi_code: string | null;
    name: string | null;
    lines: BudgetLineItemPatch[];
  }>,
): Promise<{ insertedDivisions: number; insertedLines: number }> {
  let baseSort = 0;
  let insertedDivisions = 0;
  let insertedLines = 0;
  for (const d of divisions) {
    const div = await createDivision(projectId, {
      csi_code: d.csi_code,
      name: d.name,
      sort_order: baseSort++,
    });
    insertedDivisions++;
    if (d.lines.length === 0) continue;
    const linePayload = d.lines.map((l, i) => ({
      project_id: projectId,
      division_id: div.id,
      description: l.description ?? "",
      quantity: l.quantity ?? null,
      unit_measure: l.unit_measure ?? null,
      material_allowance: l.material_allowance ?? null,
      material_unit_price: l.material_unit_price ?? null,
      hours: l.hours ?? null,
      hourly_rate: l.hourly_rate ?? null,
      contractor_cost: l.contractor_cost ?? null,
      notes: l.notes ?? null,
      sort_order: i,
    }));
    const { data, error } = await supabase
      .from("budget_line_items")
      .insert(linePayload)
      .select("id");
    if (error) throw error;
    insertedLines += (data ?? []).length;
  }
  return { insertedDivisions, insertedLines };
}

export async function bulkInsertClarifications(
  projectId: string,
  rows: Array<{
    section: ClarSection;
    seq: string | null;
    parent_seq: string | null;
    body: string;
    sort_order: number;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => ({
    project_id: projectId,
    section: r.section,
    seq: r.seq,
    parent_seq: r.parent_seq,
    body: r.body,
    sort_order: r.sort_order,
  }));
  const { data, error } = await supabase
    .from("budget_clarifications")
    .insert(payload)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
