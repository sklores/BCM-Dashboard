"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FileUp } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type SchedulePhase,
  type ScheduleTask,
} from "./types";

type Zoom = "weekly" | "monthly" | "full";

const ZOOMS: { key: Zoom; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "full", label: "Full Project" },
];

function parseDate(s: string | null): Date | null {
  return s ? new Date(s + "T00:00:00") : null;
}

function fmtDate(s: string | null): string {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DetailedGanttView({
  phases,
  tasks,
}: {
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
}) {
  const role = useRole();
  const editable = canEdit(role);
  const [zoom, setZoom] = useState<Zoom>("monthly");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(phases.map((p) => p.id)),
  );

  function toggle(phaseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <ZoomControl value={zoom} onChange={setZoom} />
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
          title="Coming soon"
        >
          <FileUp className="h-3.5 w-3.5" />
          Import from MS Project PDF
        </button>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit tasks.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {phases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-zinc-500">
                  No phases yet.
                </td>
              </tr>
            )}
            {phases.map((phase) => {
              const phaseTasks = tasks.filter((t) => t.phase_id === phase.id);
              const open = expanded.has(phase.id);
              return (
                <Fragment key={phase.id}>
                  <tr
                    className="cursor-pointer border-b border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900"
                    onClick={() => toggle(phase.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 font-medium text-zinc-100">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        )}
                        {phase.name}
                        <span className="text-xs font-normal text-zinc-500">
                          ({phaseTasks.length})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={phase.status} />
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(phase.start_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmtDate(phase.end_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">—</td>
                  </tr>
                  {open &&
                    phaseTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-zinc-900 hover:bg-zinc-900/40"
                      >
                        <td className="px-3 py-2 pl-10 text-zinc-200">
                          {task.name}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={task.status} />
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {fmtDate(task.start_date)}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {fmtDate(task.end_date)}
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {task.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SchedulePhase["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      <span className={`text-xs ${STATUS_TEXT[status]}`}>
        {STATUS_LABEL[status]}
      </span>
    </span>
  );
}

function ZoomControl({
  value,
  onChange,
}: {
  value: Zoom;
  onChange: (z: Zoom) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
      {ZOOMS.map((z) => {
        const active = z.key === value;
        return (
          <button
            key={z.key}
            type="button"
            onClick={() => onChange(z.key)}
            className={`rounded px-3 py-1 transition ${
              active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {z.label}
          </button>
        );
      })}
    </div>
  );
}
