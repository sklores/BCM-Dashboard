"use client";

import { Share2 } from "lucide-react";
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_TEXT,
  type SchedulePhase,
} from "./types";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function MilestoneView({ phases }: { phases: SchedulePhase[] }) {
  const all = phases
    .filter((p) => p.is_milestone)
    .slice()
    .sort((a, b) => {
      const ad = a.end_date ?? "9999-12-31";
      const bd = b.end_date ?? "9999-12-31";
      return ad.localeCompare(bd);
    });

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
                <h3 className="text-base font-medium text-zinc-100">{m.name}</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{fmtDate(m.end_date)}</span>
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
