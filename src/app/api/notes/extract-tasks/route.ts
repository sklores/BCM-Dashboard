import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Convert a free-form scratch note into one or more clean, individual
// tasks. A single sloppy note like
//   "tomorrow tell mike about rebar issue and call plumber for sink leak
//    also pick up paint at home depot"
// should come back as three tasks with imperative titles and useful
// (but optional) descriptions. The model also picks a priority and
// classifies each task by type so it slots into Work cleanly.
//
// Constraints baked into the prompt:
//   - Each task title is imperative and ≤ 80 chars.
//   - Skip pure status / observation / completed-work mentions.
//   - Never invent details that aren't in the note (no "by Friday" if
//     the note doesn't say so).
//   - If the note has nothing actionable, return a single task with
//     the original title/body so the user is never silently dropped.

const PROMPT = `You convert construction-project scratch notes into clean, individual tasks for the Work module.

Rules:
1. Identify EACH distinct action / todo / follow-up in the note. A single note often contains multiple independent tasks separated by "and", "also", "then", line breaks, or just commas.
2. For each action, write an IMPERATIVE task title starting with a verb (Call, Order, Tell, Fix, Confirm, Pick up, Schedule, Email, Verify, Buy, Send, Review, Follow up, etc.). Keep titles ≤ 80 characters.
3. If a task needs context the title can't carry, put it in description. Otherwise leave description empty.
4. Skip non-actionable content (observations like "weather was bad today", status updates like "demo is done", musings).
5. Never invent details. If the note doesn't say when something is due, don't put a due date in the title or description.
6. Pick priority: "high" for blockers / safety / time-critical items, "low" for nice-to-haves, "medium" for everything else.
7. Pick task_type: "general" for most things; "communication" if the task is to talk/email/call someone; "purchase" for buying/picking up materials; "verification" for checking/confirming something is right.
8. If the note has NO actionable content, return a single task using the note's existing title (or a short summary of the body) and the body as description.

Return JSON matching the schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          task_type: {
            type: "string",
            enum: ["general", "communication", "purchase", "verification"],
          },
        },
        required: ["title", "description", "priority", "task_type"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
} as const;

type ExtractedTask = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  task_type: "general" | "communication" | "purchase" | "verification";
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }

  let title: string | null = null;
  let body: string | null = null;
  try {
    const json = await req.json();
    title = typeof json?.title === "string" ? json.title : null;
    body = typeof json?.body === "string" ? json.body : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const combined = [title?.trim(), body?.trim()]
    .filter((s): s is string => !!s)
    .join("\n");
  if (combined.length === 0) {
    return NextResponse.json(
      { error: "title or body is required" },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMsg = [
    title ? `Note title: ${title.trim()}` : null,
    body ? `Note body:\n${body.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "text", text: userMsg },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: SCHEMA,
        },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text content in Claude response" },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(textBlock.text) as { tasks: ExtractedTask[] };
    return NextResponse.json(parsed);
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
