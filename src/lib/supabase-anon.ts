import { createClient } from "@supabase/supabase-js";

// Plain anon Supabase client for server contexts that don't need an
// authenticated session — public share pages, the materials import API,
// and the root page's project list. RLS is disabled in beta so the anon
// key has full read/write; switch to a service-role or session-aware
// server client if you ever turn RLS on.
export const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
