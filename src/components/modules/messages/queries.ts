import { supabase } from "@/lib/supabase";
import type { Message } from "./types";

const COLUMNS =
  "id, project_id, from_email, from_name, subject, body, received_at, tags";

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

export async function updateMessageTags(
  id: string,
  tags: string[],
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ tags })
    .eq("id", id);
  if (error) throw error;
}

export async function aiTagMessage(messageId: string): Promise<string[]> {
  const res = await fetch("/api/messages/tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Tagging failed: ${res.status}`);
  }
  const data = (await res.json()) as { tags: string[] };
  return data.tags;
}
