"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Allow the literal "user" shortcut to map to the default test
    // account so the credentials Steven shared in chat work as-is.
    const normalized =
      email.trim().toLowerCase() === "user"
        ? "user@bcm.local"
        : email.trim();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/15 text-blue-400">
            <LogIn className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">
              BCM Dashboard
            </h1>
            <p className="text-xs text-zinc-500">Sign in to continue.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              Company email
            </span>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brunoclay.com"
              autoFocus
              required
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5" />
            )}
            Sign in
          </button>
        </form>

        <p className="mt-4 text-[11px] text-zinc-600">
          Default test login: <code className="text-zinc-400">user</code> /{" "}
          <code className="text-zinc-400">password</code>
        </p>
      </div>
    </div>
  );
}
