import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    const viaNote =
      result.via === "wayback"
        ? " (via Wayback Machine snapshot)"
        : result.via === "jina"
          ? " (via Jina Reader)"
          : result.via === "googlebot"
            ? " (fetched as Googlebot)"
            : "";
    userContent.push({
      type: "text",
      text: `${PROMPT_BASE}\n\nThe HTML/text below is the product page at ${body.url}${viaNote}. Extract the product details.\n\nHTML:\n\n${html}`,
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
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

type ToolName = "direct" | "googlebot" | "jina" | "wayback";

const DEFAULT_ORDER: ToolName[] = ["direct", "googlebot", "jina", "wayback"];

const TOOL_LABEL: Record<ToolName, string> = {
  direct: "Direct browser fetch",
  googlebot: "Googlebot UA fetch",
  jina: "Jina Reader",
  wayback: "Wayback Machine",
};

type ToolResult =
  | { ok: true; html: string }
  | { ok: false; reason: string };

async function tryDirect(url: string, ua: string): Promise<ToolResult> {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const html = await r.text();
    return { ok: true, html };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function tryJina(url: string): Promise<ToolResult> {
  // Jina Reader strips a page to clean LLM-friendly text.
  // No auth required for low volume.
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/plain" },
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const text = await r.text();
    if (!text || text.length < 50) return { ok: false, reason: "empty body" };
    return { ok: true, html: text };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function tryWayback(url: string): Promise<ToolResult> {
  try {
    const lookup = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": BROWSER_UA } },
    );
    if (!lookup.ok) return { ok: false, reason: `availability HTTP ${lookup.status}` };
    const j = (await lookup.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const snap = j.archived_snapshots?.closest;
    if (!snap?.available || !snap.url)
      return { ok: false, reason: "no snapshot available" };
    const snapRes = await fetch(snap.url, {
      headers: { "User-Agent": BROWSER_UA },
      redirect: "follow",
    });
    if (!snapRes.ok)
      return { ok: false, reason: `snapshot HTTP ${snapRes.status}` };
    const html = await snapRes.text();
    return { ok: true, html };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function runTool(tool: ToolName, url: string): Promise<ToolResult> {
  switch (tool) {
    case "direct":
      return tryDirect(url, BROWSER_UA);
    case "googlebot":
      return tryDirect(url, GOOGLEBOT_UA);
    case "jina":
      return tryJina(url);
    case "wayback":
      return tryWayback(url);
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function preferredFirstTool(domain: string): Promise<ToolName | null> {
  if (!domain) return null;
  const { data } = await supabase
    .from("url_import_attempts")
    .select("tool")
    .eq("domain", domain)
    .eq("succeeded", true)
    .order("created_at", { ascending: false })
    .limit(1);
  const tool = data?.[0]?.tool as ToolName | undefined;
  return tool && DEFAULT_ORDER.includes(tool) ? tool : null;
}

async function logAttempt(
  domain: string,
  tool: ToolName,
  succeeded: boolean,
): Promise<void> {
  if (!domain) return;
  try {
    await supabase
      .from("url_import_attempts")
      .insert({ domain, tool, succeeded });
  } catch {
    /* logging is best-effort */
  }
}

async function fetchProductPage(
  url: string,
): Promise<
  | { ok: true; html: string; via: ToolName }
  | { ok: false; error: string }
> {
  const domain = getDomain(url);
  // Try the most-recently-successful tool for this domain first.
  const preferred = await preferredFirstTool(domain);
  const order: ToolName[] = preferred
    ? [preferred, ...DEFAULT_ORDER.filter((t) => t !== preferred)]
    : DEFAULT_ORDER;

  const log: Array<{ tool: ToolName; reason: string }> = [];
  for (const tool of order) {
    const r = await runTool(tool, url);
    await logAttempt(domain, tool, r.ok);
    if (r.ok) {
      return { ok: true, html: r.html, via: tool };
    }
    log.push({ tool, reason: r.reason });
  }

  const breakdown = log
    .map((l) => `${TOOL_LABEL[l.tool]} (${l.reason})`)
    .join("; ");
  return {
    ok: false,
    error: `Tried every available fetcher and none worked. ${breakdown}. Try uploading the spec sheet PDF instead.`,
  };
}
