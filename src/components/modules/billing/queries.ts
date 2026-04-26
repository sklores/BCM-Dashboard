import { supabase } from "@/lib/supabase";
import type {
  ContractChangeOrder,
  PayApplication,
  SubOption,
  SubRequisition,
} from "./types";

const PAY_COLUMNS =
  "id, project_id, application_number, period_start, period_end, scheduled_value, work_completed_this_period, work_completed_to_date, retainage_held, previous_payments, status, created_at";

const REQ_COLUMNS =
  "id, project_id, sub_id, period_start, period_end, scheduled_value, work_completed_this_period, work_completed_to_date, retainage_held, amount_due, status, created_at";

const CO_COLUMNS =
  "id, project_id, co_number, co_date, description, amount, status, affects_client_contract, affects_sub_contract, sub_id";

// ---------- Pay Applications ----------

export async function fetchPayApplications(
  projectId: string,
): Promise<PayApplication[]> {
  const { data, error } = await supabase
    .from("pay_applications")
    .select(PAY_COLUMNS)
    .eq("project_id", projectId)
    .order("application_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PayApplication[];
}

export async function nextPayAppNumber(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("pay_applications")
    .select("application_number")
    .eq("project_id", projectId)
    .order("application_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = (data?.[0]?.application_number as number | null) ?? 0;
  return max + 1;
}

export async function createPayApp(
  projectId: string,
  applicationNumber: number,
): Promise<PayApplication> {
  const { data, error } = await supabase
    .from("pay_applications")
    .insert({
      project_id: projectId,
      application_number: applicationNumber,
      status: "draft",
    })
    .select(PAY_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayApplication;
}

export async function updatePayApp(
  id: string,
  patch: Partial<PayApplication>,
): Promise<void> {
  const { error } = await supabase
    .from("pay_applications")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePayApp(id: string): Promise<void> {
  const { error } = await supabase
    .from("pay_applications")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Sub Requisitions ----------

export async function fetchSubRequisitions(
  projectId: string,
): Promise<SubRequisition[]> {
  const { data, error } = await supabase
    .from("sub_requisitions")
    .select(REQ_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubRequisition[];
}

export async function createSubRequisition(
  projectId: string,
): Promise<SubRequisition> {
  const { data, error } = await supabase
    .from("sub_requisitions")
    .insert({ project_id: projectId, status: "pending_review" })
    .select(REQ_COLUMNS)
    .single();
  if (error) throw error;
  return data as SubRequisition;
}

export async function updateSubRequisition(
  id: string,
  patch: Partial<SubRequisition>,
): Promise<void> {
  const { error } = await supabase
    .from("sub_requisitions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubRequisition(id: string): Promise<void> {
  const { error } = await supabase
    .from("sub_requisitions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Change orders (reuses contract_change_orders) ----------

export async function fetchChangeOrders(
  projectId: string,
): Promise<ContractChangeOrder[]> {
  const { data, error } = await supabase
    .from("contract_change_orders")
    .select(CO_COLUMNS)
    .eq("project_id", projectId)
    .order("co_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContractChangeOrder[];
}

// ---------- Subs (project_subs joined with subs.name) ----------

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

// ---------- Schedule cross-ref (overbilling check) ----------

export async function checkOverbillingForSub(
  projectId: string,
  subId: string,
): Promise<{
  flagged: boolean;
  incompleteTaskNames: string[];
}> {
  // Find all project_subs entries for this sub on this project so we can match
  // schedule_tasks.assigned_sub_id (which references project_subs.id).
  const { data: links, error: linksError } = await supabase
    .from("project_subs")
    .select("id")
    .eq("project_id", projectId)
    .eq("sub_id", subId);
  if (linksError) throw linksError;
  const linkIds = (links ?? []).map((l) => l.id as string);
  if (linkIds.length === 0) return { flagged: false, incompleteTaskNames: [] };

  const { data: tasks, error: tasksError } = await supabase
    .from("schedule_tasks")
    .select("name, status")
    .in("assigned_sub_id", linkIds);
  if (tasksError) throw tasksError;

  const incomplete = (tasks ?? []).filter(
    (t) => t.status !== "complete",
  );
  return {
    flagged: incomplete.length > 0,
    incompleteTaskNames: incomplete.map((t) => (t.name as string) ?? ""),
  };
}

export async function postOverbillingAlert(
  projectId: string,
  subName: string,
  taskNames: string[],
): Promise<void> {
  const message = `Sub overbilling flag: ${subName} requisition includes work where Schedule shows ${taskNames.length} task(s) not complete (${taskNames.slice(0, 3).join(", ")}${taskNames.length > 3 ? "…" : ""})`;
  const { error } = await supabase.from("alerts").insert({
    project_id: projectId,
    module_key: "billing",
    event_type: "sub_overbilling",
    message,
  });
  if (error) throw error;
}
