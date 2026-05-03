"use client";

import { FilePlus } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";

// Placeholder for the Create module (#12 in the target spec) — document
// factory with two sections (Create, Saved). Will be built out in Phase H.
export function CreateModule(_: ModuleProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <FilePlus className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Create</h1>
      </div>
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        Document factory coming soon. Will host card grid by category
        (Reports, Contracts &amp; Agreements, Financial, Client Facing) and a
        Saved tab listing every generated document.
      </div>
    </div>
  );
}
