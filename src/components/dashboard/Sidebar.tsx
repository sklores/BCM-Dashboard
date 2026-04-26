"use client";

import type { ModuleDef } from "./modules";

type Props = {
  modules: ModuleDef[];
  activeModule: string;
  onModuleChange: (key: string) => void;
};

export function Sidebar({ modules, activeModule, onModuleChange }: Props) {
  return (
    <nav className="bcm-sidebar flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-zinc-800 bg-zinc-900 p-2">
      {modules.map((m) => {
        const Icon = m.icon;
        const active = m.key === activeModule;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onModuleChange(m.key)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-blue-600/15 text-blue-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{m.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
