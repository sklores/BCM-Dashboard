"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FileUp } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type ScheduleStatus,
  type SchedulePhase,
  type ScheduleTask,
} from "./types";
import type { PhasePatch, TaskPatch } from "./queries";

type Zoom = "weekly" | "monthly" | "full";

const ZOOMS: { key: Zoom; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "full", label: "Full Project" },
];

const STATUS_OPTIONS: ScheduleStatus[] = [
  "not_started",
  "in_progress",
  "complete",
  "delayed",
];

export function DetailedGanttView({
  phases,
  tasks,
  onUpdatePhase,
  onUpdateTask,
}: {
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
  onUpdatePhase: (id: string, patch: PhasePatch) => Promise<void>;
  onUpdateTask: (id: string, patch: TaskPatch) => Promise<void>;
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
        <table className="w-full min-w-[760px] text-sm">
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
                  <tr className="border-b border-zinc-800 bg-zinc-900/40">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(phase.id)}
                          className="text-zinc-500 hover:text-zinc-200"
                          aria-label={open ? "Collapse" : "Expand"}
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <EditableText
                          value={phase.name}
                          editable={editable}
                          onCommit={(v) => onUpdatePhase(phase.id, { name: v })}
                          className="font-medium text-zinc-100"
                        />
                        <span className="text-xs font-normal text-zinc-500">
                          ({phaseTasks.length})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusCell
                        value={phase.status}
                        editable={editable}
                        onChange={(s) =>
                          onUpdatePhase(phase.id, { status: s })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <DateCell
                        value={phase.start_date}
                        editable={editable}
                        onCommit={(v) =>
                          onUpdatePhase(phase.id, { start_date: v })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <DateCell
                        value={phase.end_date}
                        editable={editable}
                        onCommit={(v) =>
                          onUpdatePhase(phase.id, { end_date: v })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-zinc-500">—</td>
                  </tr>
                  {open &&
                    phaseTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-zinc-900 hover:bg-zinc-900/40"
                      >
                        <td className="px-3 py-2 pl-10">
                          <EditableText
                            value={task.name}
                            editable={editable}
                            onCommit={(v) =>
                              onUpdateTask(task.id, { name: v })
                            }
                            className="text-zinc-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <StatusCell
                            value={task.status}
                            editable={editable}
                            onChange={(s) =>
                              onUpdateTask(task.id, { status: s })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <DateCell
                            value={task.start_date}
                            editable={editable}
                            onCommit={(v) =>
                              onUpdateTask(task.id, { start_date: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <DateCell
                            value={task.end_date}
                            editable={editable}
                            onCommit={(v) =>
                              onUpdateTask(task.id, { end_date: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <EditableText
                            value={task.notes ?? ""}
                            editable={editable}
                            placeholder="—"
                            onCommit={(v) =>
                              onUpdateTask(task.id, { notes: v || null })
                            }
                            className="text-zinc-300"
                          />
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

function EditableText({
  value,
  editable,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => Promise<void> | void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  if (!editable) {
    return (
      <span className={className}>
        {value || (placeholder ? <span className="text-zinc-500">{placeholder}</span> : null)}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full cursor-text rounded bg-transparent px-1 py-0.5 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}

function DateCell({
  value,
  editable,
  onCommit,
}: {
  value: string | null;
  editable: boolean;
  onCommit: (next: string | null) => Promise<void> | void;
}) {
  if (!editable) {
    return <span className="text-zinc-400">{formatDate(value)}</span>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => {
        const next = e.target.value || null;
        if (next !== value) onCommit(next);
      }}
      className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-zinc-400 outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:text-zinc-200 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
    />
  );
}

function StatusCell({
  value,
  editable,
  onChange,
}: {
  value: ScheduleStatus;
  editable: boolean;
  onChange: (next: ScheduleStatus) => Promise<void> | void;
}) {
  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
        <span className={`text-xs ${STATUS_TEXT[value]}`}>
          {STATUS_LABEL[value]}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ScheduleStatus)}
        className={`cursor-pointer appearance-none rounded bg-transparent px-1 py-0.5 pr-1 text-xs outline-none transition hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${STATUS_TEXT[value]}`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
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

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
