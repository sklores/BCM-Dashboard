"use client";

import type { ModuleProps } from "@/components/dashboard/modules";

export function PlaceholderModule({ moduleLabel }: ModuleProps) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold text-zinc-100">{moduleLabel}</h1>
      <p className="text-sm text-zinc-500">
        Module placeholder. Plugin not yet implemented.
      </p>
    </div>
  );
}
