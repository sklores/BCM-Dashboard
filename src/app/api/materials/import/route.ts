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

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Many product sites filter out blank user agents; pretend to be a desktop browser.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    // Don't hold a route open forever on slow sites.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`URL fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  // Trim to a reasonable size — most product pages have what we need in the head + first body section.
  return html.slice(0, 200_000);
}

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

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (body.url) {
    let html: string;
    try {
      html = await fetchHtml(body.url);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch the URL",
        },
        { status: 400 },
      );
    }
    userContent.push({
      type: "text",
      text: `${PROMPT_BASE}\n\nProduct page URL: ${body.url}\n\nPage HTML (truncated):\n\n${html}`,
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
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
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
    const parsed = JSON.parse(textBlock.text) as Parsed;
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
