import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Postmark inbound webhook. Postmark POSTs parsed email JSON to this
// endpoint; we match the To: address against projects.inbound_email
// and insert a row into messages.
//
// Auth: Postmark supports Basic Auth in the webhook URL. Configure the
// Postmark inbound stream URL as
//   https://USER:PASS@bcmdashboard.thejumpstreet.com/api/messages/inbound
// and set MESSAGES_INBOUND_USER / MESSAGES_INBOUND_PASS env vars to
// match. If either env var is unset we fall back to "open" and just
// log a warning — useful during local testing but DO NOT ship to prod
// without setting both.
//
// Docs: https://postmarkapp.com/developer/user-guide/inbound/parse-an-email

type PostmarkInbound = {
  From?: string;
  FromName?: string;
  To?: string;
  ToFull?: Array<{ Email?: string; Name?: string; MailboxHash?: string }>;
  Cc?: string;
  CcFull?: Array<{ Email?: string; Name?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  Date?: string;
};

function checkBasicAuth(req: Request): { ok: boolean; reason?: string } {
  const expectedUser = process.env.MESSAGES_INBOUND_USER;
  const expectedPass = process.env.MESSAGES_INBOUND_PASS;
  if (!expectedUser || !expectedPass) {
    // Open mode — fine for local dev, dangerous in prod. Logged below.
    return { ok: true, reason: "no-auth-configured" };
  }
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    return { ok: false, reason: "missing basic auth" };
  }
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return { ok: false, reason: "malformed basic auth" };
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (user !== expectedUser || pass !== expectedPass) {
    return { ok: false, reason: "bad credentials" };
  }
  return { ok: true };
}

function adminClient() {
  // Use the service-role key on the server so we can write to messages
  // regardless of RLS. RLS is disabled on the messages table today, but
  // we use service-role anyway in case it gets re-enabled.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key);
}

export async function POST(req: Request) {
  const auth = checkBasicAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: `unauthorized: ${auth.reason}` },
      { status: 401 },
    );
  }
  if (auth.reason === "no-auth-configured") {
    console.warn(
      "[messages/inbound] MESSAGES_INBOUND_USER/PASS not set — accepting unauthenticated webhook",
    );
  }

  let payload: PostmarkInbound;
  try {
    payload = (await req.json()) as PostmarkInbound;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Collect every recipient (To + Cc) — Postmark splits these for us.
  const recipients = new Set<string>();
  for (const r of payload.ToFull ?? []) {
    if (r.Email) recipients.add(r.Email.toLowerCase().trim());
  }
  for (const r of payload.CcFull ?? []) {
    if (r.Email) recipients.add(r.Email.toLowerCase().trim());
  }
  // Fallback: parse the flat To / Cc strings if Postmark didn't give
  // structured arrays (shouldn't happen for inbound, but defensive).
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
    return NextResponse.json(
      { error: "No recipients in payload" },
      { status: 400 },
    );
  }

  const supabase = adminClient();
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id, inbound_email")
    .in("inbound_email", Array.from(recipients));
  if (projErr) {
    console.error("[messages/inbound] project lookup failed", projErr);
    return NextResponse.json({ error: projErr.message }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    // Not for any of our projects — accept-and-drop so Postmark doesn't
    // retry forever.
    return NextResponse.json(
      {
        accepted: false,
        reason: "no matching project",
        recipients: Array.from(recipients),
      },
      { status: 200 },
    );
  }

  // Insert one message row per matched project. If a single email is
  // CC'd to two project addresses (rare but possible — e.g. a sub
  // working on both jobs), both projects get the message.
  //
  // Prefer TextBody so forwarded messages carry their full original
  // content. StrippedTextReply is Postmark's auto-stripped reply
  // text — useful for clean reply threads but removes the forwarded
  // payload, which is the whole point of forwarding to the project
  // address.
  const body =
    payload.TextBody || payload.HtmlBody || payload.StrippedTextReply || "";
  const receivedAt = payload.Date ? new Date(payload.Date).toISOString() : new Date().toISOString();
  const rows = projects.map((p) => ({
    project_id: p.id as string,
    from_email: payload.From ?? null,
    from_name: payload.FromName ?? null,
    subject: payload.Subject ?? null,
    body,
    received_at: receivedAt,
  }));
  const { error: insErr } = await supabase.from("messages").insert(rows);
  if (insErr) {
    console.error("[messages/inbound] insert failed", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    accepted: true,
    inserted: rows.length,
    projects: projects.map((p) => p.id),
  });
}

// Quick health-check helper. Visit the URL in a browser and you should
// see this JSON — handy for verifying the route deployed.
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/messages/inbound",
    method: "POST a Postmark Inbound webhook payload",
  });
}
