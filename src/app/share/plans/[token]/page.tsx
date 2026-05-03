// Public share page for the current Plans set on a project. Anyone with
// the URL can read; no auth required. Server-rendered against Supabase
// via the anon key — RLS is disabled in beta so the read works.

import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Drawing = {
  id: string;
  drawing_number: string | null;
  title: string | null;
  type: string | null;
  revision_number: string | null;
  revision_date: string | null;
  pdf_url: string | null;
  upload_verified_date: string | null;
  upload_verified_by: string | null;
};

type Project = {
  id: string;
  name: string | null;
  address: string | null;
};

export const dynamic = "force-dynamic";

async function loadShareData(token: string): Promise<{
  project: Project | null;
  drawings: Drawing[];
} | null> {
  const t = await supabase
    .from("plans_share_tokens")
    .select("project_id")
    .eq("token", token)
    .maybeSingle();
  if (t.error || !t.data) return null;
  const projectId = t.data.project_id as string;

  const [p, d] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, address")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("drawings")
      .select(
        "id, drawing_number, title, type, revision_number, revision_date, pdf_url, upload_verified_date, upload_verified_by",
      )
      .eq("project_id", projectId)
      .eq("status", "current")
      .order("drawing_number", { ascending: true }),
  ]);
  if (p.error) return null;
  return {
    project: (p.data as Project | null) ?? null,
    drawings: (d.data ?? []) as Drawing[],
  };
}

export default async function SharePlansPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadShareData(token);
  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 p-12 text-zinc-200">
        <h1 className="text-2xl font-semibold">Link not found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This share link is invalid or has been revoked.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 sm:p-10">
      <header className="mb-6 border-b border-zinc-800 pb-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Plans — current set
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {data.project?.name || data.project?.address || "Project"}
        </h1>
        <p className="mt-2 text-xs text-zinc-500">
          {data.drawings.length} drawing
          {data.drawings.length === 1 ? "" : "s"}. Read-only.
        </p>
      </header>

      {data.drawings.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
          No current drawings on this project yet.
        </div>
      ) : (
        <ul className="grid gap-2">
          {data.drawings.map((d) => (
            <li
              key={d.id}
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-100">
                    {d.drawing_number ?? "—"}
                  </span>{" "}
                  <span className="text-zinc-300">{d.title ?? ""}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  {d.revision_number && (
                    <span>Rev {d.revision_number}</span>
                  )}
                  {d.revision_date && (
                    <span>{d.revision_date}</span>
                  )}
                  {d.upload_verified_date && (
                    <span>
                      Uploaded {d.upload_verified_date}
                      {d.upload_verified_by ? ` by ${d.upload_verified_by}` : ""}
                    </span>
                  )}
                  {d.pdf_url && (
                    <Link
                      href={d.pdf_url}
                      target="_blank"
                      className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-300 hover:bg-blue-500/20"
                    >
                      Open PDF
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 border-t border-zinc-800 pt-4 text-[11px] text-zinc-600">
        BCM Dashboard · Drawings shown are the current revision only.
      </footer>
    </div>
  );
}
