import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const PROMPT = `You are analyzing a construction project photo. Identify what's visible and tag it for searchability.

Return JSON matching the schema with:
- description: 1-2 sentence description of what's in the photo
- tags: 3-8 lowercase tags. Include a mix of room/area (kitchen, bath, exterior), work type (framing, plumbing, drywall, paint, tile, electrical, hvac), stage (before, in_progress, completed), and notable items (cabinets, fixtures, appliances, materials, tools)
- room: primary area shown — one of: kitchen, bath, bedroom, living, dining, exterior, basement, attic, garage, hallway, other
- stage: work stage shown — one of: demolition, framing, mep, drywall, finishes, punch, completed, other`;

const SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    room: {
      type: "string",
      enum: [
        "kitchen",
        "bath",
        "bedroom",
        "living",
        "dining",
        "exterior",
        "basement",
        "attic",
        "garage",
        "hallway",
        "other",
      ],
    },
    stage: {
      type: "string",
      enum: [
        "demolition",
        "framing",
        "mep",
        "drywall",
        "finishes",
        "punch",
        "completed",
        "other",
      ],
    },
  },
  required: ["description", "tags", "room", "stage"],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }

  let url: string;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url } },
            { type: "text", text: PROMPT },
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
    const parsed = JSON.parse(textBlock.text);
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
