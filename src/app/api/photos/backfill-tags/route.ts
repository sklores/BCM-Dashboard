import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Backfill missing tags / room / stage / description on photos. The
// dashboard's Uploader runs Claude vision at upload time, but the
// mobile companion app uploads photos directly to the photos table
// without going through the dashboard. This endpoint catches up any
// such untagged photos: scans photos in the given project where
// tags is empty AND room is null AND ai_description is null, runs
// Claude vision on each, and writes the results back.
//
// Capped at MAX_PHOTOS per invocation to limit burst cost. The
// Photos module re-invokes if there are still untagged photos after
// the response.

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

const MAX_PHOTOS = 25;

type AnalysisResult = {
  description: string;
  tags: string[];
  room: string;
  stage: string;
};

async function analyzeOne(
  client: Anthropic,
  url: string,
): Promise<AnalysisResult | null> {
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
  if (!textBlock || textBlock.type !== "text") return null;
  return JSON.parse(textBlock.text) as AnalysisResult;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase env not configured" },
      { status: 500 },
    );
  }

  let projectId: string;
  try {
    const body = await req.json();
    projectId = body?.project_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // "Untagged" = tags array empty AND no AI description AND no room.
  // Filtering on tags via PostgREST: array_length is hard to express
  // remotely, so we filter client-side after fetching the candidates
  // by ai_description IS NULL (the cheapest column to index on).
  const { data: candidates, error: fetchErr } = await supabase
    .from("photos")
    .select("id, project_id, storage_url, tags, ai_description, room")
    .eq("project_id", projectId)
    .is("ai_description", null)
    .order("uploaded_at", { ascending: false })
    .limit(200);
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const untagged = (candidates ?? []).filter(
    (p) =>
      (!p.tags || (p.tags as string[]).length === 0) &&
      p.ai_description == null &&
      p.room == null &&
      typeof p.storage_url === "string" &&
      p.storage_url.length > 0,
  );

  if (untagged.length === 0) {
    return NextResponse.json({ tagged: 0, remaining: 0 });
  }

  const slice = untagged.slice(0, MAX_PHOTOS);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let tagged = 0;
  const errors: Array<{ id: string; message: string }> = [];

  // Tag in parallel but capped to avoid hammering the API.
  const concurrency = 4;
  const queue = [...slice];
  async function worker() {
    while (queue.length > 0) {
      const photo = queue.shift();
      if (!photo) return;
      try {
        const analysis = await analyzeOne(
          client,
          photo.storage_url as string,
        );
        if (!analysis) continue;
        const { error: updateErr } = await supabase
          .from("photos")
          .update({
            tags: analysis.tags,
            room: analysis.room,
            stage: analysis.stage,
            ai_description: analysis.description,
          })
          .eq("id", photo.id as string);
        if (updateErr) {
          errors.push({ id: photo.id as string, message: updateErr.message });
          continue;
        }
        tagged++;
      } catch (err) {
        errors.push({
          id: photo.id as string,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, slice.length) }, () => worker()),
  );

  return NextResponse.json({
    tagged,
    remaining: Math.max(0, untagged.length - tagged),
    errors: errors.length > 0 ? errors : undefined,
  });
}
