import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const PROMPT_BASE = `You are extracting construction material details for a project catalog. Identify the product and return ONLY the JSON shape requested. Use null for any field you cannot determine. Don't invent values. For "price", return a plain number in USD without currency symbols.`;

const SCHEMA = {
  type: "object",
  properties: {
    product_name: { type: ["string", "null"] },
    manufacturer: { type: ["string", "null"] },
    supplier: { type: ["string", "null"] },
    sku: { type: ["string", "null"] },
    price: { type: ["number", "null"] },
    lead_time: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
  },
  required: [
    "product_name",
    "manufacturer",
    "supplier",
    "sku",
    "price",
    "lead_time",
    "notes",
  ],
  additionalProperties: false,
} as const;

type Parsed = {
  product_name: string | null;
  manufacturer: string | null;
  supplier: string | null;
  sku: string | null;
  price: number | null;
  lead_time: string | null;
  notes: string | null;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment" },
      { status: 500 },
    );
  }

  let body: {
    url?: string;
    fileBase64?: string;
    mimeType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build the request differently depending on the source.
  // - URL → use Claude's server-side web_fetch tool. Anthropic fetches the
  //   page from their infrastructure, dodging most bot blocks.
  // - File → send a document/image content block directly.
  const isUrl = !!body.url;

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (isUrl) {
    userContent.push({
      type: "text",
      text: `${PROMPT_BASE}\n\nFetch this product page using the code execution tool (urllib or requests) and extract the details. URL: ${body.url}`,
    });
  } else if (body.fileBase64 && body.mimeType) {
    if (body.mimeType === "application/pdf") {
      userContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: body.fileBase64,
        },
      });
    } else if (body.mimeType.startsWith("image/")) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: body.mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: body.fileBase64,
        },
      });
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${body.mimeType}` },
        { status: 400 },
      );
    }
    userContent.push({ type: "text", text: PROMPT_BASE });
  } else {
    return NextResponse.json(
      { error: "Provide a url or a fileBase64+mimeType" },
      { status: 400 },
    );
  }

  try {
    const baseParams = {
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" as const },
      messages: [{ role: "user" as const, content: userContent }],
      output_config: {
        format: {
          type: "json_schema" as const,
          schema: SCHEMA,
        },
      },
    };

    let response;
    if (isUrl) {
      // web_fetch_20260209 is only invokable from inside the
      // code_execution_20260120 sandbox. Claude writes Python that uses
      // urllib/requests to fetch the page, then produces the JSON answer.
      response = await client.messages.create({
        ...baseParams,
        tools: [
          { type: "code_execution_20260120", name: "code_execution" },
          { type: "web_fetch_20260209", name: "web_fetch" },
        ],
      });
    } else {
      response = await client.messages.create(baseParams);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        {
          error:
            "Claude returned no text block — the URL may have been blocked or unfetchable. Try uploading a spec sheet PDF instead.",
        },
        { status: 502 },
      );
    }
    let parsed: Parsed;
    try {
      parsed = JSON.parse(textBlock.text) as Parsed;
    } catch {
      return NextResponse.json(
        { error: "Claude response wasn't valid JSON: " + textBlock.text.slice(0, 200) },
        { status: 502 },
      );
    }

    // If everything came back null, surface that as an error rather than
    // silently creating a blank material.
    const hasAnyValue = Object.values(parsed).some(
      (v) => v !== null && v !== undefined && v !== "",
    );
    if (!hasAnyValue) {
      return NextResponse.json(
        {
          error: isUrl
            ? "Couldn't extract product details from that URL. The site may block automated fetching, or the page lacks structured product info. Try uploading the spec sheet PDF instead."
            : "Couldn't extract product details from that file.",
        },
        { status: 502 },
      );
    }

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
