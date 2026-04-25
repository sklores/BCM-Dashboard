// Supabase Edge Function: receives Postmark inbound webhook payloads and
// writes each email to the messages table for the matching project.
//
// Deploy with the Supabase CLI:
//
//   supabase functions deploy postmark-inbound --no-verify-jwt
//
// Then point the Postmark inbound webhook URL at:
//
//   https://<project-ref>.supabase.co/functions/v1/postmark-inbound
//
// Required env vars on the function (set via `supabase secrets set ...`):
//
//   SUPABASE_URL                - your project URL
//   SUPABASE_SERVICE_ROLE_KEY   - service role key (bypasses RLS)
//
// Optional:
//
//   POSTMARK_INBOUND_TOKEN  - if set, the webhook must include header
//                             X-Postmark-Inbound-Token matching this value.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PostmarkInbound = {
  From?: string;
  FromName?: string;
  FromFull?: { Email?: string; Name?: string };
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  ToFull?: Array<{ Email?: string }>;
  To?: string;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const requiredToken = Deno.env.get("POSTMARK_INBOUND_TOKEN");
  if (requiredToken) {
    const supplied = req.headers.get("x-postmark-inbound-token");
    if (supplied !== requiredToken) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: PostmarkInbound;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Recipient email is the project's inbound address. Postmark may put
  // multiple recipients in ToFull; take the first that matches our domain.
  const recipients = (payload.ToFull ?? [])
    .map((t) => (t.Email ?? "").toLowerCase())
    .filter(Boolean);
  const recipientEmail =
    recipients.find((r) => r.endsWith("@bcmdashboard.com")) ??
    recipients[0] ??
    (payload.To ?? "").toLowerCase().split(",")[0]?.trim();

  if (!recipientEmail) {
    return new Response("Missing recipient", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("inbound_email", recipientEmail)
    .limit(1)
    .maybeSingle();

  if (projectError) {
    console.error("project lookup failed", projectError);
    return new Response("DB error", { status: 500 });
  }
  if (!project) {
    return new Response("Project not found for " + recipientEmail, {
      status: 404,
    });
  }

  const fromEmail =
    payload.FromFull?.Email?.toLowerCase() ??
    payload.From?.toLowerCase() ??
    null;
  const fromName = payload.FromFull?.Name ?? payload.FromName ?? null;

  const { error: insertError } = await supabase.from("messages").insert({
    project_id: (project as any).id,
    from_email: fromEmail,
    from_name: fromName,
    subject: payload.Subject ?? null,
    body: payload.TextBody ?? payload.HtmlBody ?? null,
    received_at: payload.Date
      ? new Date(payload.Date).toISOString()
      : new Date().toISOString(),
  });

  if (insertError) {
    console.error("insert failed", insertError);
    return new Response("DB error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
