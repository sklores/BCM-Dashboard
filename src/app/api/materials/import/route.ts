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
    const result = await fetchProductPage(body.url!);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    let html = result.html;
    // Cap to keep prompt size reasonable. Truncate from the middle if huge.
    const MAX = 180_000;
    if (html.length > MAX) {
      html =
        html.slice(0, MAX / 2) +
        "\n\n[…truncated…]\n\n" +
        html.slice(html.length - MAX / 2);
    }

    userContent.push({
      type: "text",
      text: `${PROMPT_BASE}\n\nThe HTML below is the product page at ${body.url}${
        result.via === "wayback" ? " (via Wayback Machine snapshot)" : ""
      }. Extract the product details.\n\nHTML:\n\n${html}`,
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

    const response = await client.messages.create(baseParams);

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

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function directFetch(url: string): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

async function fetchProductPage(
  url: string,
): Promise<
  | { ok: true; html: string; via: "direct" | "wayback" }
  | { ok: false; error: string }
> {
  // 1. Try a direct fetch with a browser User-Agent.
  let directStatus: number | null = null;
  let directError: string | null = null;
  try {
    const r = await directFetch(url);
    if (r.ok) {
      const html = await r.text();
      return { ok: true, html, via: "direct" };
    }
    directStatus = r.status;
  } catch (err) {
    directError = err instanceof Error ? err.message : String(err);
  }

  // 2. Fall back to the Wayback Machine's most recent snapshot.
  try {
    const lookup = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": BROWSER_UA } },
    );
    if (lookup.ok) {
      const j = (await lookup.json()) as {
        archived_snapshots?: { closest?: { available?: boolean; url?: string } };
      };
      const snap = j.archived_snapshots?.closest;
      if (snap?.available && snap.url) {
        const snapRes = await fetch(snap.url, {
          headers: { "User-Agent": BROWSER_UA },
          redirect: "follow",
        });
        if (snapRes.ok) {
          const html = await snapRes.text();
          return { ok: true, html, via: "wayback" };
        }
      }
    }
  } catch {
    /* fall through to error */
  }

  const directLine = directStatus
    ? `Direct fetch returned ${directStatus}.`
    : directError
      ? `Direct fetch errored: ${directError}.`
      : "Direct fetch failed.";
  return {
    ok: false,
    error: `${directLine} No Wayback Machine snapshot available either. Try uploading the spec sheet PDF instead.`,
  };
}
