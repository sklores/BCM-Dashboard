import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROMPT = `You are extracting subcontractor / contractor records from a pasted spreadsheet, CSV, or freeform list.

Return ONE row per contractor. Use null for any field you cannot determine — don't invent values. Skip header rows. Skip rows that look like blank spacers or comments.

Field mapping:
- "name": company / vendor / sub name (the business itself)
- "trade": their work (e.g. "Drywall", "Electrical", "Framing")
- "contact_name": individual person at the company
- "contact_email": email address
- "contact_phone": phone number, preserved as-is
- "license_number": license or registration number if listed
- "notes": anything else worth keeping (rate notes, address, certifications)`;

const SCHEMA = {
  type: "object",
  properties: {
    contractors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: ["string", "null"] },
          trade: { type: ["string", "null"] },
          contact_name: { type: ["string", "null"] },
          contact_email: { type: ["string", "null"] },
          contact_phone: { type: ["string", "null"] },
          license_number: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: [
          "name",
          "trade",
          "contact_name",
          "contact_email",
          "contact_phone",
          "license_number",
          "notes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["contractors"],
  additionalProperties: false,
} as const;

type Parsed = {
  contractors: Array<{
    name: string | null;
    trade: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    license_number: string | null;
    notes: string | null;
  }>;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "Provide pasted contractor data in `text`." },
      { status: 400 },
    );
  }
  if (text.length > 200_000) {
    return NextResponse.json(
      {
        error:
          "Input too large. Paste up to 200k characters; for bigger sheets, split into chunks.",
      },
      { status: 413 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // SDK requires streaming for long-running calls; collect the final
    // Message via the SDK's helper so the rest of this route is unchanged.
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 32000,
      thinking: { type: "disabled" },
      output_config: {
        format: {
          type: "json_schema",
          schema: SCHEMA,
        },
        effort: "low",
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${PROMPT}\n\nDATA:\n\n${text}`,
            },
          ],
        },
      ],
    });
    const response = await stream.finalMessage();

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "Claude returned no text block" },
        { status: 502 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error:
            "Contractor list is larger than what fits in a single pass. Split the input into ~200-row chunks and import them one at a time.",
        },
        { status: 413 },
      );
    }
    let parsed: Parsed;
    try {
      parsed = JSON.parse(block.text) as Parsed;
    } catch (e) {
      return NextResponse.json(
        {
          error:
            "Couldn't parse extraction output (likely truncated). Try splitting the list into smaller chunks. " +
            (e instanceof Error ? e.message : ""),
        },
        { status: 502 },
      );
    }
    return NextResponse.json(parsed);
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
