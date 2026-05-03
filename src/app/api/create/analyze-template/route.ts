import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pull plain text out of an uploaded template file. .pdf is sent
// straight to Claude as a document block, .docx is unzipped via mammoth,
// .txt is passed through. Returns null for the source_text only when
// the input is a PDF (Claude reads it natively).
async function extractText(
  bytes: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string | null; usePdfBlock: boolean }> {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return { text: null, usePdfBlock: true };
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const buf = Buffer.from(bytes);
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value, usePdfBlock: false };
  }
  if (mimeType.startsWith("text/") || lower.endsWith(".txt")) {
    const dec = new TextDecoder("utf-8");
    return { text: dec.decode(bytes), usePdfBlock: false };
  }
  // Fallback: try utf-8 — better than nothing.
  const dec = new TextDecoder("utf-8");
  return { text: dec.decode(bytes), usePdfBlock: false };
}

const PROMPT = `You are analyzing a construction-industry document a contractor uses as a template for a recurring document type. Identify its structure, the smart-fields where project-specific data goes, the boilerplate, the formatting patterns, and the tone, so the same kind of document can be regenerated for a future project with the contractor's exact format and language preserved.

Return JSON matching the schema with:
- doc_type_guess: a short snake_case identifier of what kind of document this is (e.g. "subcontractor_agreement", "lien_waiver", "client_contract", "sow", "rfp", "client_proposal", "change_order", "pay_application", "invoice", "daily_report").
- summary: 1-2 sentences describing the document.
- structure: ordered array of section titles in the document.
- smart_fields: array of fields the contractor fills in per project (each with key (snake_case), label (human readable), example (the literal value seen in this template), kind: "text"|"date"|"number"|"longtext").
- boilerplate: array of standard clauses or paragraphs that should reappear verbatim in every generation, each with a short heading and the body.
- tone: 1-2 sentences describing the language style (formal, plain, etc.).
- formatting_notes: 1-2 sentences on layout patterns (signature blocks, headings, table usage, etc.).`;

const SCHEMA = {
  type: "object",
  properties: {
    doc_type_guess: { type: "string" },
    summary: { type: "string" },
    structure: { type: "array", items: { type: "string" } },
    smart_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          example: { type: "string" },
          kind: { type: "string", enum: ["text", "date", "number", "longtext"] },
        },
        required: ["key", "label", "example", "kind"],
        additionalProperties: false,
      },
    },
    boilerplate: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
        },
        required: ["heading", "body"],
        additionalProperties: false,
      },
    },
    tone: { type: "string" },
    formatting_notes: { type: "string" },
  },
  required: [
    "doc_type_guess",
    "summary",
    "structure",
    "smart_fields",
    "boilerplate",
    "tone",
    "formatting_notes",
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
  let body: { url?: string; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let bytes: ArrayBuffer;
  let mimeType = "application/octet-stream";
  try {
    const r = await fetch(body.url);
    if (!r.ok)
      return NextResponse.json(
        { error: `Couldn't fetch template: ${r.status}` },
        { status: 502 },
      );
    bytes = await r.arrayBuffer();
    mimeType = r.headers.get("content-type") ?? mimeType;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 },
    );
  }

  const { text, usePdfBlock } = await extractText(
    bytes,
    mimeType,
    body.fileName ?? "",
  );

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const userContent: Anthropic.Messages.ContentBlockParam[] = usePdfBlock
      ? [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: Buffer.from(bytes).toString("base64"),
            },
          },
          { type: "text", text: PROMPT },
        ]
      : [
          {
            type: "text",
            text: `${PROMPT}\n\n--- DOCUMENT BEGINS ---\n${(text ?? "").slice(0, 80000)}\n--- DOCUMENT ENDS ---`,
          },
        ];

    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
        effort: "medium",
      },
      messages: [{ role: "user", content: userContent }],
    });
    const response = await stream.finalMessage();
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "No text from Claude" },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(block.text);
    return NextResponse.json({
      structure: parsed,
      source_text: text,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claude failed" },
      { status: 502 },
    );
  }
}
