"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar, type Project } from "./TopBar";
import { modules } from "./modules";

type Props = {
  projects: Project[];
};

export function DashboardShell({ projects }: Props) {
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? "");
  const [activeModuleKey, setActiveModuleKey] = useState(modules[0].key);

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="text-center">
          <p className="text-lg">No projects yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Insert a row into the <code className="text-zinc-300">projects</code>{" "}
            table to get started.
          </p>
        </div>
      </div>
    );
  }

  const moduleDef = modules.find((m) => m.key === activeModuleKey) ?? modules[0];
  const ModuleIcon = moduleDef.icon;

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <TopBar
        projects={projects}
        activeProjectId={activeProjectId}
        onProjectChange={setActiveProjectId}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activeModule={activeModuleKey}
          onModuleChange={setActiveModuleKey}
        />
        <main className="flex-1 overflow-auto p-10">
          <div className="flex items-center gap-3">
            <ModuleIcon className="h-6 w-6 text-blue-400" />
            <h1 className="text-2xl font-semibold text-zinc-100">
              {moduleDef.label}
            </h1>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Module placeholder. Plugin not yet implemented.
          </p>
        </main>
      </div>
    </div>
  );
}
