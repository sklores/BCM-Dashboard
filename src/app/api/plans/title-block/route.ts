import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROMPT = `You are reading the TITLE BLOCK of a construction drawing. The title block is the rectangular cartouche, almost always in the lower-right corner of the sheet. Read it carefully. If a value isn't clearly visible, return null — do not guess.

Return ONLY the JSON shape requested.`;

const SCHEMA = {
  type: "object",
  properties: {
    drawing_number: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    revision_number: { type: ["string", "null"] },
    revision_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
    scale: { type: ["string", "null"] },
    project_name: { type: ["string", "null"] },
    sheet_size: { type: ["string", "null"], description: "e.g. ARCH D, 24x36" },
    readable: {
      type: "boolean",
      description: "false if the title block could not be located or read",
    },
  },
  required: [
    "drawing_number",
    "title",
    "revision_number",
    "revision_date",
    "scale",
    "project_name",
    "sheet_size",
    "readable",
  ],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Fetch the PDF server-side and pass as a base64 document block.
  let bytes: ArrayBuffer;
  try {
    const r = await fetch(body.url);
    if (!r.ok)
      return NextResponse.json(
        { error: `Couldn't fetch PDF: ${r.status}` },
        { status: 502 },
      );
    bytes = await r.arrayBuffer();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF fetch failed" },
      { status: 502 },
    );
  }

  const base64 = Buffer.from(bytes).toString("base64");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      thinking: { type: "disabled" },
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const response = await stream.finalMessage();
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "No text from Claude" },
        { status: 502 },
      );
    }
    return NextResponse.json(JSON.parse(block.text));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claude failed" },
      { status: 502 },
    );
  }
}
