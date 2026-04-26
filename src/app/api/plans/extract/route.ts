import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 600;

const PROMPT = `Analyze this construction drawing and extract every labeled element you can identify.

For each element return:
- category: one of Architectural, Structural, Mechanical, Electrical, Plumbing, Civil, Specification, Dimension, Other.
- label: the exact label / tag / number from the drawing (e.g. "DR-101", "M-22", "2x6 STUD WALL", "SLAB ON GRADE").
- description: a short plain-English description of what the element is.
- location_description: where on the sheet it appears (e.g. "north wall, room 102", "lower-right detail", "upper grid B-3"). Use null if unclear.
- confidence: a number 0–1 reflecting how confident you are this is a real labeled element on the drawing (not a guess).

Return ONLY the JSON shape requested. Skip the title block, sheet borders, and the drafting legend itself; focus on actual labeled elements within the drawing area.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "Architectural",
              "Structural",
              "Mechanical",
              "Electrical",
              "Plumbing",
              "Civil",
              "Specification",
              "Dimension",
              "Other",
            ],
          },
          label: { type: "string" },
          description: { type: ["string", "null"] },
          location_description: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: [
          "category",
          "label",
          "description",
          "location_description",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
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
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
        effort: "medium",
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
