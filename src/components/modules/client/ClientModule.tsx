"use client";

import { Building2 } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { ProposalsModule } from "@/components/modules/proposals/ProposalsModule";

export function ClientModule(props: ModuleProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Client</h1>
      </div>

      <div className="text-xs uppercase tracking-wider text-zinc-500">
        Proposals
      </div>
      <ProposalsModule {...props} hideHeader />
    </div>
  );
}
