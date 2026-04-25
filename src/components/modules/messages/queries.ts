import { supabase } from "@/lib/supabase";
import type { Message } from "./types";

const COLUMNS =
  "id, project_id, from_email, from_name, subject, body, received_at";

export async function fetchMessages(projectId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function fetchProjectInboundEmail(
  projectId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("inbound_email")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return (data?.inbound_email as string | null) ?? null;
}
