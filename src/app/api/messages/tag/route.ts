import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Tags are the project module keys an email could be about. Keep this list
// in sync with src/components/dashboard/modules.ts when adding modules.
const TAG_OPTIONS = [
  "budget",
  "client",
  "materials",
  "schedule",
  "subs",
  "team",
  "tasks",
  "photos",
  "plans",
  "permits",
  "notes",
  "calendar",
  "estimating",
  "contracts",
  "reports",
] as const;

const PROMPT = `You are tagging construction project emails by topic.

Available tags (return only tags from this list):
${TAG_OPTIONS.join(", ")}

Pick every tag that's clearly relevant to the email — multiple tags allowed. If nothing applies, return an empty array. Don't invent tags. Don't include speculative ones.`;

const SCHEMA = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: { type: "string", enum: TAG_OPTIONS },
    },
  },
  required: ["tags"],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: "Supabase env vars are not set" },
      { status: 500 },
    );
  }

  let messageId: string;
  try {
    const body = await req.json();
    messageId = body?.messageId;
    if (typeof messageId !== "string" || !messageId) {
      throw new Error();
    }
  } catch {
    return NextResponse.json(
      { error: "Provide messageId as a string" },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data: message, error: fetchErr } = await supabase
    .from("messages")
    .select("id, subject, body")
    .eq("id", messageId)
    .single();
  if (fetchErr) {
    return NextResponse.json(
      { error: `Failed to load message: ${fetchErr.message}` },
      { status: 500 },
    );
  }

  const subject = (message.subject as string | null) ?? "";
  const body = (message.body as string | null) ?? "";
  // Trim long bodies — first ~6KB is plenty for tagging.
  const trimmedBody = body.slice(0, 6000);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\n---\nSubject: ${subject}\n\nBody:\n${trimmedBody}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text content in Claude response" },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(textBlock.text) as { tags: string[] };

    // Persist tags
    const { error: updateErr } = await supabase
      .from("messages")
      .update({ tags: parsed.tags })
      .eq("id", messageId);
    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to save tags: ${updateErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ tags: parsed.tags });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error ${err.status}: ${err.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
