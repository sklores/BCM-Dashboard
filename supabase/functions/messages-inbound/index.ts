// Postmark inbound webhook on Supabase Edge Functions.
//
// Why not Vercel? Vercel serverless functions cap request bodies at
// ~4.5MB, which Postmark routinely exceeds when emails carry photo
// attachments (base64-encoded inline). Supabase Edge Functions accept
// up to ~32MB, which covers ordinary construction-photo forwards.
//
// What it does:
//   1. Matches the To/Cc recipients against projects.inbound_email
//   2. Inserts one row per matched project into `messages`
//   3. For each image attachment in the payload, uploads the binary
//      to the `photos` storage bucket, runs the existing Claude vision
//      tagging prompt against the public URL, and inserts a row into
//      `photos` — so forwarded jobsite shots appear in the Photos
//      module fully tagged, with no extra clicks.
//
// Non-image attachments are dropped silently for now (PDFs / docs
// have no destination module yet). The text/HTML email body still
// lands in `messages` regardless.
//
// Auth: optional Basic Auth via INBOUND_USER / INBOUND_PASS env vars.
// Postmark supports user:pass in the webhook URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

type PostmarkAttachment = {
  Name?: string;
  Content?: string; // base64
  ContentType?: string;
  ContentLength?: number;
  ContentID?: string;
};

type PostmarkInbound = {
  From?: string;
  FromName?: string;
  To?: string;
  ToFull?: Array<{ Email?: string; Name?: string }>;
  Cc?: string;
  CcFull?: Array<{ Email?: string; Name?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Date?: string;
  Attachments?: PostmarkAttachment[];
};

type PhotoAnalysis = {
  description?: string;
  tags?: string[];
  room?: string | null;
  stage?: string | null;
};

const CLAUDE_VISION_PROMPT = `You are analyzing a construction project photo. Identify what's visible and tag it for searchability.

Return JSON matching the schema with:
- description: 1-2 sentence description of what's in the photo
- tags: 3-8 lowercase tags. Include a mix of room/area (kitchen, bath, exterior), work type (framing, plumbing, drywall, paint, tile, electrical, hvac), stage (before, in_progress, completed), and notable items (cabinets, fixtures, appliances, materials, tools)
- room: primary area shown — one of: kitchen, bath, bedroom, living, dining, exterior, basement, attic, garage, hallway, other
- stage: work stage shown — one of: demolition, framing, mep, drywall, finishes, punch, completed, other`;

const CLAUDE_VISION_SCHEMA = {
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

function checkBasicAuth(req: Request): { ok: boolean; reason?: string } {
  const expectedUser = Deno.env.get("MESSAGES_INBOUND_USER");
  const expectedPass = Deno.env.get("MESSAGES_INBOUND_PASS");
  if (!expectedUser || !expectedPass) {
    // Open mode — fine during initial rollout. Add the env vars to
    // lock down before public exposure.
    return { ok: true, reason: "no-auth-configured" };
  }
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    return { ok: false, reason: "missing basic auth" };
  }
  const decoded = atob(header.slice(6).trim());
  const idx = decoded.indexOf(":");
  if (idx < 0) return { ok: false, reason: "malformed basic auth" };
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (user !== expectedUser || pass !== expectedPass) {
    return { ok: false, reason: "bad credentials" };
  }
  return { ok: true };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extForContentType(ct: string): string {
  const m = ct.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("heic")) return "heic";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

function isImage(ct: string | undefined): boolean {
  if (!ct) return false;
  return ct.toLowerCase().startsWith("image/");
}

function isPdf(ct: string | undefined, name?: string): boolean {
  if (ct && ct.toLowerCase().includes("pdf")) return true;
  if (name && name.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

async function analyzeWithClaudeOnce(
  apiKey: string,
  imageUrl: string,
): Promise<PhotoAnalysis | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: CLAUDE_VISION_PROMPT },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: CLAUDE_VISION_SCHEMA,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `vision ${res.status}: ${await res.text().catch(() => "<no body>")}`,
    );
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((b) => b.type === "text" && b.text);
  if (!block?.text) throw new Error("vision returned no text block");
  return JSON.parse(block.text) as PhotoAnalysis;
}

async function analyzeWithClaude(
  imageUrl: string,
): Promise<PhotoAnalysis | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.warn("[messages-inbound] ANTHROPIC_API_KEY not set — skipping vision");
    return null;
  }
  // One attempt, then one retry after a short backoff. Vision calls
  // can fail transiently when Postmark delivers a batch of photos
  // back-to-back (rate limit blip, network jitter). One retry catches
  // those without doubling latency on the happy path.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await analyzeWithClaudeOnce(apiKey, imageUrl);
    } catch (err) {
      console.warn(
        `[messages-inbound] vision attempt ${attempt} failed`,
        err instanceof Error ? err.message : err,
      );
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({
      ok: true,
      route: "messages-inbound",
      method: "POST a Postmark inbound webhook payload",
    });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  const auth = checkBasicAuth(req);
  if (!auth.ok) {
    return Response.json(
      { error: `unauthorized: ${auth.reason}` },
      { status: 401 },
    );
  }
  if (auth.reason === "no-auth-configured") {
    console.warn(
      "[messages-inbound] no Basic Auth configured — accepting unauthenticated webhook",
    );
  }

  let payload: PostmarkInbound;
  try {
    payload = (await req.json()) as PostmarkInbound;
  } catch (err) {
    console.warn("[messages-inbound] invalid JSON", err);
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // Collect every recipient (To + Cc).
  const recipients = new Set<string>();
  for (const r of payload.ToFull ?? []) {
    if (r.Email) recipients.add(r.Email.toLowerCase().trim());
  }
  for (const r of payload.CcFull ?? []) {
    if (r.Email) recipients.add(r.Email.toLowerCase().trim());
  }
  if (recipients.size === 0) {
    for (const flat of [payload.To, payload.Cc]) {
      if (!flat) continue;
      for (const piece of flat.split(",")) {
        const m = piece.match(/<([^>]+)>/) ?? piece.match(/([^\s,<>]+@[^\s,<>]+)/);
        if (m) recipients.add(m[1].toLowerCase().trim());
      }
    }
  }
  if (recipients.size === 0) {
    return Response.json({ error: "no recipients" }, { status: 400 });
  }

  // Service-role client — RLS is off on messages/photos, but use the
  // service role so this still works if RLS gets enabled later.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id, inbound_email")
    .in("inbound_email", Array.from(recipients));
  if (projErr) {
    console.error("[messages-inbound] project lookup failed", projErr);
    return Response.json({ error: projErr.message }, { status: 500 });
  }
  if (!projects || projects.length === 0) {
    return Response.json(
      { accepted: false, reason: "no matching project", recipients: [...recipients] },
      { status: 200 },
    );
  }

  // Prefer TextBody so forwarded messages keep their full content.
  const body =
    payload.TextBody || payload.HtmlBody || payload.StrippedTextReply || "";
  const receivedAt = payload.Date
    ? new Date(payload.Date).toISOString()
    : new Date().toISOString();

  // 1. Insert the message row(s).
  const messageRows = projects.map((p) => ({
    project_id: p.id as string,
    from_email: payload.From ?? null,
    from_name: payload.FromName ?? null,
    subject: payload.Subject ?? null,
    body,
    received_at: receivedAt,
  }));
  const { error: msgErr } = await supabase.from("messages").insert(messageRows);
  if (msgErr) {
    console.error("[messages-inbound] message insert failed", msgErr);
    return Response.json({ error: msgErr.message }, { status: 500 });
  }

  // 2. Process attachments → photos module.
  //    Images: upload + Claude vision tagging + kind='photo'
  //    PDFs:   upload as-is + kind='pdf' (no vision call)
  //    Other:  dropped silently (no destination module yet)
  const attachmentSummaries: Array<{
    project_id: string;
    photo_id: string;
    kind: "photo" | "pdf";
    name: string;
    tagged: boolean;
  }> = [];
  const attachments = payload.Attachments ?? [];
  for (const att of attachments) {
    if (!att.Content) continue;
    const image = isImage(att.ContentType);
    const pdf = !image && isPdf(att.ContentType, att.Name);
    if (!image && !pdf) continue;
    const kind: "photo" | "pdf" = image ? "photo" : "pdf";
    const ext = image
      ? extForContentType(att.ContentType!)
      : "pdf";
    const contentType =
      att.ContentType ?? (image ? "image/jpeg" : "application/pdf");

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(att.Content);
    } catch (err) {
      console.warn("[messages-inbound] attachment decode failed", att.Name, err);
      continue;
    }

    // One upload per matched project so each project sees the
    // attachment independently. (Typical case = 1 project.)
    for (const project of projects) {
      const photoId = crypto.randomUUID();
      const path = `${project.id}/${photoId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, bytes, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });
      if (upErr) {
        console.error("[messages-inbound] storage upload failed", upErr);
        continue;
      }
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // Vision tagging only for images. PDFs go in untagged for now —
      // text extraction could come later via pdf.js in a follow-up.
      const analysis = image ? await analyzeWithClaude(publicUrl) : null;

      // ai_description for PDFs: fall back to the original filename so
      // the card has something readable rather than just "PDF".
      const aiDescription = analysis?.description ?? (pdf ? att.Name ?? null : null);

      const { error: photoErr } = await supabase.from("photos").insert({
        id: photoId,
        project_id: project.id as string,
        kind,
        storage_path: path,
        storage_url: publicUrl,
        taken_at: receivedAt,
        tags: analysis?.tags ?? (pdf ? ["pdf"] : []),
        room: analysis?.room ?? null,
        stage: analysis?.stage ?? null,
        ai_description: aiDescription,
      });
      if (photoErr) {
        console.error("[messages-inbound] photo insert failed", photoErr);
        continue;
      }
      attachmentSummaries.push({
        project_id: project.id as string,
        photo_id: photoId,
        kind,
        name: att.Name ?? `${kind}.${ext}`,
        tagged: !!analysis,
      });
    }
  }

  return Response.json({
    accepted: true,
    messages_inserted: messageRows.length,
    attachments_inserted: attachmentSummaries.length,
    photos_inserted: attachmentSummaries.filter((a) => a.kind === "photo").length,
    pdfs_inserted: attachmentSummaries.filter((a) => a.kind === "pdf").length,
    attachments: attachmentSummaries,
  });
});
