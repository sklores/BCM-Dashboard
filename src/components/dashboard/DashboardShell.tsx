"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar, type Project } from "./TopBar";
import { modules } from "./modules";

const sampleProjects: Project[] = [
  {
    id: "1",
    name: "BCM Construction",
    address: "123 Example Ave, Brooklyn, NY 11201",
  },
  {
    id: "2",
    name: "Downtown Loft Renovation",
    address: "456 Main St, New York, NY 10013",
  },
];

export function DashboardShell() {
  const [activeProjectId, setActiveProjectId] = useState(sampleProjects[0].id);
  const [activeModuleKey, setActiveModuleKey] = useState(modules[0].key);

  const moduleDef = modules.find((m) => m.key === activeModuleKey) ?? modules[0];
  const ModuleIcon = moduleDef.icon;

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <TopBar
        projects={sampleProjects}
        activeProjectId={activeProjectId}
        onProjectChange={setActiveProjectId}
      />
      <div className="flex min-h-0 flex-1">
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
        <Sidebar
          activeModule={activeModuleKey}
          onModuleChange={setActiveModuleKey}
        />
      </div>
    </div>
  );
}
