"use client";

import { ChevronDown, MapPin, Settings } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export type Project = {
  id: string;
  name: string;
  address: string;
};

type Props = {
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (id: string) => void;
  onOpenSettings?: () => void;
};

export function TopBar({
  projects,
  activeProjectId,
  onProjectChange,
  onOpenSettings,
}: Props) {
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-6">
      {logoFailed ? (
        <div className="text-sm font-bold tracking-widest text-zinc-300">
          BCM
        </div>
      ) : (
        <Image
          src="/bcm-logo.png"
          alt="Bruno Clay Construction & Management"
          width={180}
          height={40}
          priority
          onError={() => setLogoFailed(true)}
          className="h-9 w-auto object-contain"
        />
      )}
      <div className="mx-6 h-6 w-px bg-zinc-800" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 rounded-md px-3 py-1.5 transition hover:bg-zinc-800/60"
        >
          <MapPin className="h-4 w-4 text-zinc-500" />
          <div className="text-left">
            <div className="text-xs text-zinc-500">{active.name}</div>
            <div className="text-sm font-medium text-zinc-100">
              {active.address}
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-full z-20 mt-1 w-96 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
              {projects.map((p) => {
                const isActive = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onProjectChange(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-zinc-800 ${
                      isActive ? "bg-zinc-800/50" : ""
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500">{p.name}</div>
                      <div className="truncate text-sm text-zinc-100">
                        {p.address}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}
