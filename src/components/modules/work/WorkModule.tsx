"use client";

import { useState } from "react";
import { Briefcase, ListChecks } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import { TasksModule } from "@/components/modules/tasks/TasksModule";
import { JobsSection } from "@/components/modules/jobs/JobsSection";

type Tab = "jobs" | "tasks";

export function WorkModule(props: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [tab, setTab] = useState<Tab>("jobs");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800">
        <TabButton
          active={tab === "jobs"}
          onClick={() => setTab("jobs")}
          icon={<Briefcase className="h-3.5 w-3.5" />}
          label="Jobs"
          hint="Subcontractor work"
        />
        <TabButton
          active={tab === "tasks"}
          onClick={() => setTab("tasks")}
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label="Tasks"
          hint="Internal team"
        />
      </div>

      {tab === "jobs" && (
        <JobsSection projectId={props.projectId} editable={editable} />
      )}
      {tab === "tasks" && <TasksModule {...props} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs ${
        active
          ? "border-blue-500 text-blue-300"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
      title={hint}
    >
      {icon}
      {label}
    </button>
  );
}
