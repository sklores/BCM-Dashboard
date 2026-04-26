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
  "id, project_id, company_name, address, website, phone, primary_contact_id, category, created_at";

const CONTACT_COLUMNS =
  "id, project_id, first_name, last_name, company_id, role_type, email, phone, address, notes, created_at";

// ---------- Companies ----------

export async function fetchCompanies(projectId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("project_id", projectId)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Company[];
}

// Ensure every project has at least one placeholder row in each of the seven
// category buckets. Idempotent: only inserts rows for categories that have
// zero companies.
export async function ensureCompanyCategories(
  projectId: string,
): Promise<Company[]> {
  const existing = await fetchCompanies(projectId);
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
  if (error) throw error;
  return [...existing, ...((data ?? []) as Company[])];
}

export async function createCompany(
  projectId: string,
  name: string,
  category: CompanyCategory | null = null,
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert({ project_id: projectId, company_name: name, category })
    .select(COMPANY_COLUMNS)
    .single();
  if (error) throw error;
  return data as Company;
}

export async function updateCompany(
  id: string,
  patch: CompanyPatch,
): Promise<void> {
  const { error } = await supabase.from("companies").update(patch).eq("id", id);
  if (error) throw error;
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
