"use client";

import { Flag, Share2 } from "lucide-react";
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type SchedulePhase,
  type ScheduleMilestone,
  type ScheduleStatus,
} from "./types";

type DerivedMilestone = {
  id: string;
  name: string;
  date: string | null;
  status: ScheduleStatus;
  source: "phase" | "milestone";
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function compare(a: DerivedMilestone, b: DerivedMilestone): number {
  const ad = a.date ?? "9999-12-31";
  const bd = b.date ?? "9999-12-31";
  return ad.localeCompare(bd);
}

export function MilestoneView({
  phases,
  milestones,
}: {
  phases: SchedulePhase[];
  milestones: ScheduleMilestone[];
}) {
  const fromPhases: DerivedMilestone[] = phases
    .filter((p) => p.is_milestone)
    .map((p) => ({
      id: `phase-${p.id}`,
      name: p.name,
      date: p.end_date,
      status: p.status,
      source: "phase" as const,
    }));

  const fromMilestones: DerivedMilestone[] = milestones.map((m) => ({
    id: `ms-${m.id}`,
    name: m.name,
    date: m.date,
    status: m.status,
    source: "milestone" as const,
  }));

  const all = [...fromPhases, ...fromMilestones].sort(compare);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Key dates for client presentation. Mark phases as milestones in the
          Detailed view to add them here.
        </p>
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500"
          title="Coming soon"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share public link
        </button>
      </div>

      {all.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No milestones yet. Open the Detailed view and check the{" "}
          <span className="text-amber-400">Milestone</span> chip on a phase to
          surface it here.
        </p>
      ) : (
        <ol className="relative ml-4 border-l border-zinc-800">
          {all.map((m) => (
            <li key={m.id} className="relative mb-8 pl-6 last:mb-0">
              <span
                className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ring-zinc-950 ${STATUS_DOT[m.status]}`}
              />
              <div className="flex flex-col gap-1">
                <h3 className="flex items-center gap-2 text-base font-medium text-zinc-100">
                  {m.name}
                  {m.source === "phase" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                      <Flag className="h-2.5 w-2.5" />
                      Phase
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{fmtDate(m.date)}</span>
                  <span className={STATUS_TEXT[m.status]}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
