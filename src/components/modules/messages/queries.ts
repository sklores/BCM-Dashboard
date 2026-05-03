import { supabase } from "@/lib/supabase";
import type { EntryType, Message, Priority } from "./types";

const COLUMNS =
  "id, project_id, from_email, from_name, subject, body, received_at, tags, entry_type, priority, follow_up_task_id, attachment_url";

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

export async function createManualMessage(
  projectId: string,
  fields: {
    entry_type: EntryType;
    subject?: string | null;
    body?: string | null;
    from_name?: string | null;
    from_email?: string | null;
    priority?: Priority;
    attachment_url?: string | null;
  },
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      project_id: projectId,
      entry_type: fields.entry_type,
      subject: fields.subject ?? null,
      body: fields.body ?? null,
      from_name: fields.from_name ?? null,
      from_email: fields.from_email ?? null,
      priority: fields.priority ?? "normal",
      attachment_url: fields.attachment_url ?? null,
      received_at: new Date().toISOString(),
      tags: [],
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Message;
}

export async function updateMessagePriority(
  id: string,
  priority: Priority,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ priority })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadMessageAttachment(
  projectId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const newId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${projectId}/messages/${newId}.${ext}`;
  const up = await supabase.storage
    .from("photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
  if (up.error) throw up.error;
  const pub = supabase.storage.from("photos").getPublicUrl(path);
  return { path, url: pub.data.publicUrl };
}

export async function createFollowUpTaskFromMessage(
  projectId: string,
  message: Pick<Message, "id" | "subject" | "body" | "from_name">,
): Promise<string> {
  const subject = message.subject?.trim() || "Follow up";
  const description =
    [
      message.from_name ? `From: ${message.from_name}` : null,
      message.body ?? "",
    ]
      .filter(Boolean)
      .join("\n\n") || null;
  const ins = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: subject,
      description,
      status: "not_started",
      task_type: "general",
      priority: "medium",
      linked_module: "messages",
      linked_record_id: message.id,
    })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  const taskId = ins.data.id as string;
  const upd = await supabase
    .from("messages")
    .update({ follow_up_task_id: taskId })
    .eq("id", message.id);
  if (upd.error) throw upd.error;
  return taskId;
}

export async function ocrScreenshot(imageUrl: string): Promise<string> {
  const res = await fetch("/api/messages/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `OCR failed: ${res.status}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}
