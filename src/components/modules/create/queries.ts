import { supabase } from "@/lib/supabase";
import type {
  CreateTemplate,
  DocCategory,
  DocStatus,
  GeneratedDocument,
  TemplateExtractedStructure,
} from "./types";

const COLUMNS =
  "id, project_id, category, doc_type, title, content, metadata, status, created_at, updated_at";

export async function fetchProjectShell(
  projectId: string,
): Promise<{ name: string | null; address: string | null }> {
  const { data, error } = await supabase
    .from("projects")
    .select("name, address")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return {
    name: (data?.name as string | null) ?? null,
    address: (data?.address as string | null) ?? null,
  };
}

export async function fetchDocuments(
  projectId: string,
): Promise<GeneratedDocument[]> {
  const { data, error } = await supabase
    .from("generated_documents")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GeneratedDocument[];
}

export async function createDocument(input: {
  project_id: string;
  category: DocCategory;
  doc_type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<GeneratedDocument> {
  const { data, error } = await supabase
    .from("generated_documents")
    .insert({
      project_id: input.project_id,
      category: input.category,
      doc_type: input.doc_type,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
      status: "draft",
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as GeneratedDocument;
}

export type DocPatch = Partial<{
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  status: DocStatus;
}>;

export async function updateDocument(
  id: string,
  patch: DocPatch,
): Promise<void> {
  const { error } = await supabase
    .from("generated_documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from("generated_documents")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Reference templates ----------

const TEMPLATE_COLUMNS =
  "id, document_type, file_url, file_name, source_text, extracted_structure, uploaded_by, uploaded_at, active";

export async function fetchActiveTemplates(): Promise<CreateTemplate[]> {
  const { data, error } = await supabase
    .from("create_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("active", true);
  if (error) throw error;
  return (data ?? []) as CreateTemplate[];
}

export async function fetchActiveTemplate(
  docType: string,
): Promise<CreateTemplate | null> {
  const { data, error } = await supabase
    .from("create_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("document_type", docType)
    .eq("active", true)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CreateTemplate | null) ?? null;
}

export async function uploadTemplateFile(
  docType: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${docType}/${id}.${ext}`;
  const up = await supabase.storage
    .from("create-templates")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  if (up.error) throw up.error;
  const pub = supabase.storage.from("create-templates").getPublicUrl(path);
  return { path, url: pub.data.publicUrl };
}

export async function analyzeTemplate(
  url: string,
  fileName: string,
): Promise<{
  structure: TemplateExtractedStructure;
  source_text: string | null;
}> {
  const res = await fetch("/api/create/analyze-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, fileName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Analyze failed: ${res.status}`);
  }
  return (await res.json()) as {
    structure: TemplateExtractedStructure;
    source_text: string | null;
  };
}

export async function saveTemplate(input: {
  document_type: string;
  file_url: string;
  file_name: string;
  source_text: string | null;
  extracted_structure: TemplateExtractedStructure;
}): Promise<CreateTemplate> {
  // Mark any prior active template for this doc_type inactive (keep
  // history) before inserting the new one.
  const deact = await supabase
    .from("create_templates")
    .update({ active: false })
    .eq("document_type", input.document_type)
    .eq("active", true);
  if (deact.error) throw deact.error;

  const { data, error } = await supabase
    .from("create_templates")
    .insert({
      document_type: input.document_type,
      file_url: input.file_url,
      file_name: input.file_name,
      source_text: input.source_text,
      extracted_structure: input.extracted_structure,
      active: true,
    })
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw error;
  return data as CreateTemplate;
}

export async function deactivateTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("create_templates")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

export async function generateWithTemplate(input: {
  doc_type: string;
  template: CreateTemplate | null;
  fields: Record<string, string>;
  project: { name: string | null; address: string | null };
}): Promise<string> {
  const res = await fetch("/api/create/generate-with-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc_type: input.doc_type,
      template: input.template
        ? {
            source_text: input.template.source_text,
            extracted_structure: input.template.extracted_structure,
          }
        : null,
      fields: input.fields,
      project: input.project,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Generate failed: ${res.status}`);
  }
  const data = (await res.json()) as { markdown: string };
  return data.markdown;
}
