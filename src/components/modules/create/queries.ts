import { supabase } from "@/lib/supabase";
import type { DocCategory, DocStatus, GeneratedDocument } from "./types";

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
