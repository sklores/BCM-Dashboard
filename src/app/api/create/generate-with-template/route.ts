import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Generates a finished document by handing Claude:
//   1. The full text of the user's previously-uploaded template (from
//      create_templates.source_text — already extracted from .docx/.txt
//      or echoed from a .pdf during analyze).
//   2. The structured analysis Claude produced earlier.
//   3. The user's filled fields + project context.
// Output is markdown that mirrors the template's structure, language,
// and tone with project-specific values dropped in.

type Body = {
  doc_type: string;
  template?: {
    source_text: string | null;
    extracted_structure: Record<string, unknown> | null;
  } | null;
  fields: Record<string, string>;
  project: { name: string | null; address: string | null };
};

const PROMPT_HEADER = `You are regenerating a construction-industry document for the contractor's project. The contractor has previously uploaded a reference template you must follow EXACTLY in structure, section order, language style, tone, boilerplate clauses, and formatting. Substitute project-specific values where appropriate; keep boilerplate verbatim.

Output only Markdown. Do NOT wrap the output in code fences. Use # / ## headers, **bold**, lists, and tables where the template uses them. Keep signature blocks intact (with blank lines for signatures).`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 },
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.doc_type) {
    return NextResponse.json({ error: "Missing doc_type" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = [
    PROMPT_HEADER,
    "",
    `Document type: ${body.doc_type}`,
    "",
    "Project context:",
    `- Project name: ${body.project.name ?? "(unknown)"}`,
    `- Project address: ${body.project.address ?? "(unknown)"}`,
    "",
    "User-filled fields (key = value):",
    ...Object.entries(body.fields).map(([k, v]) => `- ${k}: ${v}`),
    "",
    body.template?.extracted_structure
      ? `Extracted template structure (JSON):\n${JSON.stringify(body.template.extracted_structure, null, 2)}`
      : "(no extracted structure available — generate from doc type)",
    "",
    body.template?.source_text
      ? `--- ORIGINAL TEMPLATE CONTENT BEGINS ---\n${body.template.source_text.slice(0, 60000)}\n--- ORIGINAL TEMPLATE CONTENT ENDS ---`
      : "(no original text — base output on the doc type and fields)",
  ].join("\n");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: userPrompt }],
    });
    const response = await stream.finalMessage();
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "No text from Claude" },
        { status: 502 },
      );
    }
    return NextResponse.json({ markdown: block.text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claude failed" },
      { status: 502 },
    );
  }
}
