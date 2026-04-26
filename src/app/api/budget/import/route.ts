import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROMPT = `You are reverse-engineering a CSI MasterFormat construction budget from a pasted CSV / spreadsheet export.

The sheet groups line items under division header rows. A division header row matches the pattern "NN.NN.NN: Division Name" (e.g. "01.51.00: Temporary Conditions"). Treat that row as a division header — capture the csi_code (e.g. "01.51.00") and the name (e.g. "Temporary Conditions"). Do NOT include the header row as a line item.

Below each header are line items until the next header. Map columns by content, not by position:
- description: the item / scope name
- quantity: numeric qty
- unit_measure: short unit (ls, ea, hr, sf, lf, etc.)
- material_allowance: a budget placeholder for materials not yet selected
- material_unit_price: price per unit of material
- hours: labor hours
- hourly_rate: dollars per hour
- contractor_cost: subcontractor cost (when not broken into hours)
- notes: free-form text the user added inline

Rules:
- Skip blank rows
- Skip pure formula / total rows (rows that only have a single number in a "subtotal" or "total" column with no description)
- Allow negative numbers (used for value-engineering / deductions)
- Use null for any field you cannot determine — don't invent values
- Currency strings like "$1,200.50" should be parsed as 1200.50
- Preserve negatives

Return ONLY the JSON shape requested.`;

const CLAR_PROMPT = `Extract project clarifications, allowances, and exclusions from a pasted text. The text is structured as numbered items, sometimes with letter sub-items (a, b, c).

For each item, identify:
- section: one of "clarifications", "allowances", "exclusions" — based on which header it falls under in the source
- seq: the visible sequence label, e.g. "1", "2", "a", "b" (preserve as-is including any trailing punctuation removed)
- parent_seq: if this is a sub-item (a, b, c) under a numbered parent (1, 2, 3), put the parent's number here; otherwise null
- body: the full text of the item

Skip section headers themselves. Skip blank lines. Return ONLY the JSON shape requested.`;

const BUDGET_SCHEMA = {
  type: "object",
  properties: {
    divisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          csi_code: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: ["string", "null"] },
                quantity: { type: ["number", "null"] },
                unit_measure: { type: ["string", "null"] },
                material_allowance: { type: ["number", "null"] },
                material_unit_price: { type: ["number", "null"] },
                hours: { type: ["number", "null"] },
                hourly_rate: { type: ["number", "null"] },
                contractor_cost: { type: ["number", "null"] },
                notes: { type: ["string", "null"] },
              },
              required: [
                "description",
                "quantity",
                "unit_measure",
                "material_allowance",
                "material_unit_price",
                "hours",
                "hourly_rate",
                "contractor_cost",
                "notes",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["csi_code", "name", "lines"],
        additionalProperties: false,
      },
    },
  },
  required: ["divisions"],
  additionalProperties: false,
} as const;

const CLAR_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["clarifications", "allowances", "exclusions"],
          },
          seq: { type: ["string", "null"] },
          parent_seq: { type: ["string", "null"] },
          body: { type: "string" },
        },
        required: ["section", "seq", "parent_seq", "body"],
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
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }

  let body: { kind?: "budget" | "clarifications"; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const kind = body.kind ?? "budget";
  if (!text) {
    return NextResponse.json(
      { error: "Provide pasted CSV/text in `text`." },
      { status: 400 },
    );
  }
  if (text.length > 400_000) {
    return NextResponse.json(
      { error: "Input too large. Split into smaller chunks." },
      { status: 413 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = kind === "clarifications" ? CLAR_PROMPT : PROMPT;
  const schema = kind === "clarifications" ? CLAR_SCHEMA : BUDGET_SCHEMA;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema },
        effort: "low",
      },
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `${prompt}\n\nDATA:\n\n${text}` }],
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "Claude returned no text block" },
        { status: 502 },
      );
    }
    return NextResponse.json(JSON.parse(block.text));
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Claude extraction failed",
      },
      { status: 502 },
    );
  }
}
