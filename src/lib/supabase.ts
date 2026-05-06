"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side Supabase client. Uses cookies for the auth session so the
// Next.js middleware can read it server-side and gate routes. Existing
// modules continue to do `import { supabase } from "@/lib/supabase"` —
// the API surface is identical (.from / .storage / .auth / etc.).
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
