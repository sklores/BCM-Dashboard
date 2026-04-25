"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  STATUS_BAR,
  type ScheduleTask,
  type SchedulePhase,
  type ScheduleStatus,
} from "./types";

type Mode = "month" | "week";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LANE_HEIGHT = 22; // px per stacked bar
const LANE_OFFSET_TOP = 26; // px below day number

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function parseDate(s: string | null): Date | null {
  return s ? startOfDay(new Date(s + "T00:00:00")) : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type TaskSegment = {
  task: ScheduleTask;
  startCol: number; // 0-6
  endCol: number; // 0-6 inclusive
  lane: number;
  isStart: boolean; // bar begins this week
  isEnd: boolean; // bar ends this week
};

function segmentsForWeek(
  tasks: ScheduleTask[],
  weekStart: Date,
): TaskSegment[] {
  const weekEnd = addDays(weekStart, 6);
  const overlapping = tasks
    .map((t) => {
      const start = parseDate(t.start_date);
      const end = parseDate(t.end_date);
      if (!start || !end) return null;
      if (end < weekStart || start > weekEnd) return null;
      const startCol = Math.max(0, daysBetween(weekStart, start));
      const endCol = Math.min(6, daysBetween(weekStart, end));
      return {
        task: t,
        startCol,
        endCol,
        isStart: start >= weekStart,
        isEnd: end <= weekEnd,
        rawStart: start.getTime(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.rawStart - b.rawStart || a.startCol - b.startCol);

  // Greedy lane assignment.
  const laneEnds: number[] = [];
  return overlapping.map((seg) => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= seg.startCol) lane++;
    laneEnds[lane] = seg.endCol;
    return {
      task: seg.task,
      startCol: seg.startCol,
      endCol: seg.endCol,
      isStart: seg.isStart,
      isEnd: seg.isEnd,
      lane,
    };
  });
}

export function CalendarView({
  phases: _phases,
  tasks,
}: {
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
}) {
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const weekStarts = useMemo<Date[]>(() => {
    if (mode === "week") return [startOfWeek(anchor)];
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart);
    const weeks: Date[] = [];
    let cursor = gridStart;
    while (cursor <= monthEnd || weeks.length < 6) {
      weeks.push(cursor);
      cursor = addDays(cursor, 7);
      if (weeks.length >= 6 && cursor > monthEnd) break;
    }
    return weeks;
  }, [mode, anchor]);

  const today = startOfDay(new Date());
  const currentMonth = anchor.getMonth();

  const title =
    mode === "month"
      ? anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : (() => {
          const ws = startOfWeek(anchor);
          const we = addDays(ws, 6);
          return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        })();

  function step(direction: -1 | 1) {
    setAnchor((prev) =>
      mode === "month" ? addMonths(prev, direction) : addDays(prev, 7 * direction),
    );
  }

  function jumpToToday() {
    setAnchor(startOfDay(new Date()));
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500">No tasks yet for this project.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {(["month", "week"] as Mode[]).map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1 capitalize transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={jumpToToday}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm font-medium text-zinc-200">{title}</span>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-800">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>

        {weekStarts.map((weekStart) => {
          const segs = segmentsForWeek(tasks, weekStart);
          const maxLane = segs.reduce((m, s) => Math.max(m, s.lane), -1);
          const cellMinHeight =
            mode === "week"
              ? Math.max(160, LANE_OFFSET_TOP + (maxLane + 1) * LANE_HEIGHT + 12)
              : Math.max(96, LANE_OFFSET_TOP + (maxLane + 1) * LANE_HEIGHT + 8);
          return (
            <div
              key={weekStart.toISOString()}
              className="relative grid grid-cols-7"
              style={{ minHeight: `${cellMinHeight}px` }}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(weekStart, i);
                const isToday = sameDate(day, today);
                const inCurrentMonth =
                  mode === "week" || day.getMonth() === currentMonth;
                return (
                  <div
                    key={i}
                    className={`border-b border-r border-zinc-800 px-2 py-1.5 ${
                      inCurrentMonth ? "" : "bg-zinc-950 text-zinc-600"
                    }`}
                  >
                    <div
                      className={`text-xs ${
                        isToday
                          ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 font-semibold text-zinc-950"
                          : inCurrentMonth
                            ? "text-zinc-300"
                            : "text-zinc-600"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}

              <div className="pointer-events-none absolute inset-0">
                {segs.map((seg, i) => {
                  const left = (seg.startCol / 7) * 100;
                  const width = ((seg.endCol - seg.startCol + 1) / 7) * 100;
                  const top = LANE_OFFSET_TOP + seg.lane * LANE_HEIGHT;
                  const radius = `${seg.isStart ? "rounded-l" : ""} ${seg.isEnd ? "rounded-r" : ""}`;
                  return (
                    <div
                      key={`${seg.task.id}-${i}`}
                      className={`pointer-events-auto absolute mx-1 flex h-[18px] items-center px-2 text-[11px] font-medium text-white ${STATUS_BAR[seg.task.status as ScheduleStatus]} ${radius || "rounded"}`}
                      style={{
                        left: `${left}%`,
                        width: `calc(${width}% - 0.5rem)`,
                        top: `${top}px`,
                      }}
                      title={`${seg.task.name} · ${seg.task.start_date ?? ""} – ${seg.task.end_date ?? ""}`}
                    >
                      <span className="truncate">{seg.task.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
