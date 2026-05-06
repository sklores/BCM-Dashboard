import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { supabaseAnon } from "@/lib/supabase-anon";

export default async function Home() {
  const { data, error } = await supabaseAnon
    .from("projects")
    .select("id, name, address")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-red-400">
        Error loading projects: {error.message}
      </div>
    );
  }

  return <DashboardShell projects={data ?? []} />;
}
