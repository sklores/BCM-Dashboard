"use client";

import { useState } from "react";
import { RoleProvider } from "@/lib/role-context";
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
  const ActiveModule = moduleDef.Component;

  return (
    <RoleProvider role="owner">
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
            <ActiveModule
              projectId={activeProjectId}
              moduleKey={moduleDef.key}
              moduleLabel={moduleDef.label}
            />
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
