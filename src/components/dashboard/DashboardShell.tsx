"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleProvider } from "@/lib/role-context";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { TopBar, type Project } from "./TopBar";
import { modules } from "./modules";

const ORDER_STORAGE_KEY = "bcm-dashboard-module-order";
const DEFAULT_ORDER = modules.map((m) => m.key);

function applyOrder(keys: string[]): typeof modules {
  // Drop unknown keys (e.g. modules that have since been removed) and append
  // any modules added after the order was saved.
  const known = new Set(DEFAULT_ORDER);
  const filtered = keys.filter((k) => known.has(k));
  const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
  const finalKeys = [...filtered, ...missing];
  return finalKeys
    .map((k) => modules.find((m) => m.key === k))
    .filter((m): m is (typeof modules)[number] => m !== undefined);
}

type Props = {
  projects: Project[];
};

export function DashboardShell({ projects }: Props) {
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? "");
  const [activeModuleKey, setActiveModuleKey] = useState(modules[0].key);
  const [moduleOrder, setModuleOrder] = useState<string[]>(DEFAULT_ORDER);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved order from localStorage on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ORDER_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        setModuleOrder(parsed as string[]);
      }
    } catch {
      // ignore corrupt localStorage value
    }
  }, []);

  const orderedModules = useMemo(() => applyOrder(moduleOrder), [moduleOrder]);

  function handleReorder(nextKeys: string[]) {
    setModuleOrder(nextKeys);
    try {
      window.localStorage.setItem(
        ORDER_STORAGE_KEY,
        JSON.stringify(nextKeys),
      );
    } catch {
      // ignore quota / private mode
    }
  }

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

  const moduleDef =
    orderedModules.find((m) => m.key === activeModuleKey) ?? orderedModules[0];
  const ActiveModule = moduleDef.Component;

  return (
    <RoleProvider role="owner">
      <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
        <TopBar
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectChange={setActiveProjectId}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar
            modules={orderedModules}
            activeModule={activeModuleKey}
            onModuleChange={setActiveModuleKey}
          />
          <main className="h-full flex-1 overflow-y-auto p-10">
            <ActiveModule
              projectId={activeProjectId}
              moduleKey={moduleDef.key}
              moduleLabel={moduleDef.label}
            />
          </main>
        </div>
        {showSettings && (
          <SettingsModal
            modules={orderedModules}
            onClose={() => setShowSettings(false)}
            onReorder={handleReorder}
          />
        )}
      </div>
    </RoleProvider>
  );
}
