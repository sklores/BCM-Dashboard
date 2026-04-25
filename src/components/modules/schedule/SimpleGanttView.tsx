"use client";

import { Fragment } from "react";
import {
  STATUS_BAR,
  STATUS_DOT,
  STATUS_LABEL,
  type SchedulePhase,
  type ScheduleStatus,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDate(s: string | null): Date | null {
  return s ? new Date(s + "T00:00:00") : null;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

export function SimpleGanttView({ phases }: { phases: SchedulePhase[] }) {
  if (phases.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No phases yet for this project.
      </p>
    );
  }

  const dated = phases.filter((p) => p.start_date && p.end_date);
  if (dated.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Phases exist but none have dates set.
      </p>
    );
  }

  const minDate = new Date(
    Math.min(...dated.map((p) => parseDate(p.start_date)!.getTime())),
  );
  const maxDate = new Date(
    Math.max(...dated.map((p) => parseDate(p.end_date)!.getTime())),
  );
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPct =
    today >= minDate && today <= maxDate
      ? (daysBetween(minDate, today) / totalDays) * 100
      : null;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <StatusLegend />

      <div className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 items-center">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
          Phase
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
          <span>{fmt(minDate)}</span>
          <span>{fmt(maxDate)}</span>
        </div>

        {phases.map((phase) => {
          const start = parseDate(phase.start_date);
          const end = parseDate(phase.end_date);
          const hasDates = start && end;
          const left = hasDates
            ? (daysBetween(minDate, start) / totalDays) * 100
            : 0;
          const width = hasDates
            ? (daysBetween(start, end) / totalDays) * 100
            : 0;

          return (
            <Fragment key={phase.id}>
              <div className="flex items-center gap-2 text-sm text-zinc-200">
                <span
                  className={`h-2 w-2 rounded-full ${STATUS_DOT[phase.status]}`}
                />
                {phase.name}
              </div>
              <div className="relative h-7 rounded bg-zinc-900">
                {hasDates && (
                  <div
                    className={`absolute inset-y-1 rounded ${STATUS_BAR[phase.status]}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${STATUS_LABEL[phase.status]} · ${fmt(start)} – ${fmt(end)}`}
                  />
                )}
                {todayPct !== null && (
                  <div
                    className="absolute inset-y-0 w-px bg-amber-400/80"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {todayPct !== null && (
        <p className="text-xs text-zinc-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
          Today
        </p>
      )}
    </div>
  );
}

function StatusLegend() {
  const order: ScheduleStatus[] = [
    "not_started",
    "in_progress",
    "complete",
    "delayed",
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
      {order.map((s) => (
        <span key={s} className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded ${STATUS_BAR[s]}`} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
