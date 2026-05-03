import { supabase } from "@/lib/supabase";
import {
  COMPANY_CATEGORIES,
  type Company,
  type CompanyCategory,
  type CompanyPatch,
  type Contact,
  type ContactPatch,
} from "./types";

const COMPANY_COLUMNS =
  "id, project_id, company_name, address, website, phone, primary_contact_id, category, sub_id, created_at";

const COMPANY_COLUMNS_LEGACY =
  "id, project_id, company_name, address, website, phone, primary_contact_id, created_at";

const CONTACT_COLUMNS =
  "id, project_id, first_name, last_name, company_id, role_type, email, phone, address, notes, created_at";

// True once we've discovered (and remembered for this session) that the
// companies.category column doesn't exist yet — i.e. the migration hasn't
// been applied. Lets the rest of the module degrade gracefully without
// re-issuing the failing select on every action.
let categoryColumnMissing = false;

function isMissingCategoryColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "42703") return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("category") && msg.includes("does not exist");
}

// ---------- Companies ----------

export async function fetchCompanies(projectId: string): Promise<Company[]> {
  if (!categoryColumnMissing) {
    const res = await supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("project_id", projectId)
      .order("company_name", { ascending: true });
    if (!res.error) return (res.data ?? []) as Company[];
    if (!isMissingCategoryColumnError(res.error)) throw res.error;
    categoryColumnMissing = true;
  }
  // Legacy path — the migration that adds companies.category hasn't been
  // applied yet. Return companies with category=null so the UI still works.
  const res2 = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS_LEGACY)
    .eq("project_id", projectId)
    .order("company_name", { ascending: true });
  if (res2.error) throw res2.error;
  return (res2.data ?? []).map((c) => ({
    ...(c as Omit<Company, "category">),
    category: null,
  }));
}

export function isCategoryColumnMissing(): boolean {
  return categoryColumnMissing;
}

// Ensure every project has at least one placeholder row in each of the seven
// category buckets. Idempotent: only inserts rows for categories that have
// zero companies. No-op when the migration adding category hasn't run yet.
export async function ensureCompanyCategories(
  projectId: string,
): Promise<Company[]> {
  const existing = await fetchCompanies(projectId);
  if (categoryColumnMissing) return existing;
  const present = new Set(
    existing.map((c) => c.category).filter(Boolean) as CompanyCategory[],
  );
  const missing = COMPANY_CATEGORIES.filter((cat) => !present.has(cat));
  if (missing.length === 0) return existing;
  const rows = missing.map((cat) => ({
    project_id: projectId,
    company_name: "",
    category: cat,
  }));
  const { data, error } = await supabase
    .from("companies")
    .insert(rows)
    .select(COMPANY_COLUMNS);
  if (error) {
    if (isMissingCategoryColumnError(error)) {
      categoryColumnMissing = true;
      return existing;
    }
    throw error;
  }
  return [...existing, ...((data ?? []) as Company[])];
}

export async function createCompany(
  projectId: string,
  name: string,
  category: CompanyCategory | null = null,
): Promise<Company> {
  const payload: Record<string, unknown> = {
    project_id: projectId,
    company_name: name,
  };
  if (!categoryColumnMissing) payload.category = category;

  // If we're creating a Subs Trade or Subs MEP company, also create a
  // matching sub row so the two modules stay in sync. The sub_id link
  // makes "Open in Subs" instant.
  let mirroredSubId: string | null = null;
  if (
    !categoryColumnMissing &&
    (category === "subs_trade" || category === "subs_mep") &&
    name.trim() !== ""
  ) {
    const subRes = await supabase
      .from("subs")
      .insert({ name: name.trim() })
      .select("id")
      .single();
    if (!subRes.error && subRes.data) {
      mirroredSubId = subRes.data.id as string;
      payload.sub_id = mirroredSubId;
      // Also link the sub to this project so it shows in the Subs list.
      await supabase
        .from("project_subs")
        .insert({ project_id: projectId, sub_id: mirroredSubId });
    }
  }

  const cols = categoryColumnMissing ? COMPANY_COLUMNS_LEGACY : COMPANY_COLUMNS;
  const { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select(cols)
    .single();
  if (error) throw error;
  const row = data as unknown as Omit<Company, "category"> & {
    category?: CompanyCategory | null;
    sub_id?: string | null;
  };
  return {
    ...row,
    category: row.category ?? null,
    sub_id: row.sub_id ?? null,
  };
}

export async function updateCompany(
  id: string,
  patch: CompanyPatch,
): Promise<void> {
  // Strip category from the patch when the column doesn't exist yet so the
  // rest of the edit (name, phone, etc.) still saves.
  const safe: Record<string, unknown> = { ...patch };
  if (categoryColumnMissing) delete safe.category;
  const { error } = await supabase.from("companies").update(safe).eq("id", id);
  if (error) {
    if (isMissingCategoryColumnError(error)) {
      categoryColumnMissing = true;
      delete safe.category;
      const retry = await supabase.from("companies").update(safe).eq("id", id);
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Contacts ----------

export async function fetchContacts(projectId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("project_id", projectId)
    .order("last_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function createContact(
  projectId: string,
  patch: ContactPatch = {},
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .insert({ project_id: projectId, first_name: "", last_name: "", ...patch })
    .select(CONTACT_COLUMNS)
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  id: string,
  patch: ContactPatch,
): Promise<void> {
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Activity feed (best effort, no other-module schema changes) ----------

export type ActivityRow = {
  kind: "message";
  id: string;
  ts: string;
  label: string;
  detail: string;
};

export async function fetchActivityForContact(
  projectId: string,
  email: string | null,
): Promise<ActivityRow[]> {
  if (!email) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, subject, received_at, body")
    .eq("project_id", projectId)
    .ilike("from_email", email)
    .order("received_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    kind: "message" as const,
    id: m.id as string,
    ts: m.received_at as string,
    label: (m.subject as string | null) ?? "(no subject)",
    detail: ((m.body as string | null) ?? "").slice(0, 160),
  }));
}
