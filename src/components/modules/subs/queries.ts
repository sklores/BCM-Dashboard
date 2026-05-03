import { supabase } from "@/lib/supabase";
import type { ProjectSub, Sub } from "./types";

const SUB_COLUMNS =
  "id, name, trade, contact_name, contact_email, contact_phone, license_number, notes, scope_of_work";

export async function fetchSubs(): Promise<Sub[]> {
  const { data, error } = await supabase
    .from("subs")
    .select(SUB_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Sub[];
}

export async function fetchProjectSubs(
  projectId: string,
): Promise<ProjectSub[]> {
  const { data, error } = await supabase
    .from("project_subs")
    .select("id, project_id, sub_id")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as ProjectSub[];
}

export type SubPatch = Partial<Omit<Sub, "id">>;

export async function createSub(): Promise<Sub> {
  const { data, error } = await supabase
    .from("subs")
    .insert({ name: "New sub" })
    .select(SUB_COLUMNS)
    .single();
  if (error) throw error;
  return data as Sub;
}

export async function updateSub(id: string, patch: SubPatch): Promise<void> {
  const { error } = await supabase.from("subs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSub(id: string): Promise<void> {
  const { error } = await supabase.from("subs").delete().eq("id", id);
  if (error) throw error;
}

export async function addSubToProject(
  projectId: string,
  subId: string,
): Promise<ProjectSub> {
  const { data, error } = await supabase
    .from("project_subs")
    .insert({ project_id: projectId, sub_id: subId })
    .select("id, project_id, sub_id")
    .single();
  if (error) throw error;

  // Mirror into companies (Contacts) if not already there. The category is
  // a best-guess from the sub's trade — falls back to subs_trade.
  await mirrorSubAsCompany(projectId, subId);

  return data as ProjectSub;
}

async function mirrorSubAsCompany(
  projectId: string,
  subId: string,
): Promise<void> {
  // Skip if a company for this sub on this project already exists.
  const existing = await supabase
    .from("companies")
    .select("id")
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .maybeSingle();
  if (existing.data) return;

  const sub = await supabase
    .from("subs")
    .select("name, trade, contact_phone")
    .eq("id", subId)
    .maybeSingle();
  if (sub.error || !sub.data) return;
  const trade = ((sub.data.trade as string | null) ?? "").toLowerCase();
  const isMep = /electric|plumb|hvac|mechanical|fire|sprinkler/.test(trade);
  await supabase.from("companies").insert({
    project_id: projectId,
    company_name: (sub.data.name as string) ?? "",
    category: isMep ? "subs_mep" : "subs_trade",
    sub_id: subId,
    phone: (sub.data.contact_phone as string | null) ?? null,
  });
}

export async function removeSubFromProject(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("project_subs")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}

export async function bulkInsertSubs(rows: SubPatch[]): Promise<Sub[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((r) => ({
    name: r.name ?? "Unnamed",
    trade: r.trade ?? null,
    contact_name: r.contact_name ?? null,
    contact_email: r.contact_email ?? null,
    contact_phone: r.contact_phone ?? null,
    license_number: r.license_number ?? null,
    notes: r.notes ?? null,
  }));
  const { data, error } = await supabase
    .from("subs")
    .insert(payload)
    .select(SUB_COLUMNS);
  if (error) throw error;
  return (data ?? []) as Sub[];
}
