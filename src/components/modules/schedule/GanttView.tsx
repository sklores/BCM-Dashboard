"use client";

import { useMemo, useState } from "react";
import {
  STATUS_BAR,
  STATUS_DOT,
  STATUS_LABEL,
  type SchedulePhase,
  type ScheduleStatus,
  type ScheduleSubtask,
  type ScheduleTask,
} from "./types";

type DetailLevel = "phases" | "tasks" | "subtasks";
type Zoom = "week" | "month" | "full";

const DETAILS: { key: DetailLevel; label: string }[] = [
  { key: "phases", label: "Phases" },
  { key: "tasks", label: "Phases + Tasks" },
  { key: "subtasks", label: "Phases + Tasks + Subtasks" },
];

const ZOOMS: { key: Zoom; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "full", label: "Full Project" },
];

const PX_PER_DAY: Record<Exclude<Zoom, "full">, number> = {
  week: 96,
  month: 32,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type Row = {
  id: string;
  name: string;
  status: ScheduleStatus;
  start_date: string | null;
  end_date: string | null;
  level: 0 | 1 | 2;
};

function parseDate(s: string | null): Date | null {
  return s ? new Date(s + "T00:00:00") : null;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GanttView({
  phases,
  tasks,
  subtasks,
}: {
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
  subtasks: ScheduleSubtask[];
}) {
  const [detail, setDetail] = useState<DetailLevel>("phases");
  const [zoom, setZoom] = useState<Zoom>("full");
  const [showToday, setShowToday] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const phase of phases) {
      out.push({
        id: phase.id,
        name: phase.name,
        status: phase.status,
        start_date: phase.start_date,
        end_date: phase.end_date,
        level: 0,
      });
      if (detail === "tasks" || detail === "subtasks") {
        for (const task of tasks.filter((t) => t.phase_id === phase.id)) {
          out.push({
            id: task.id,
            name: task.name,
            status: task.status,
            start_date: task.start_date,
            end_date: task.end_date,
            level: 1,
          });
          if (detail === "subtasks") {
            for (const sub of subtasks.filter((s) => s.task_id === task.id)) {
              out.push({
                id: sub.id,
                name: sub.name,
                status: sub.status,
                start_date: sub.start_date,
                end_date: sub.end_date,
                level: 2,
              });
            }
          }
        }
      }
    }
    return out;
  }, [phases, tasks, subtasks, detail]);

  const dated = rows.filter((r) => r.start_date && r.end_date);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No phases yet for this project.</p>
    );
  }

  if (dated.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Rows exist but none have dates set.
      </p>
    );
  }

  const minDate = new Date(
    Math.min(...dated.map((r) => parseDate(r.start_date)!.getTime())),
  );
  const maxDate = new Date(
    Math.max(...dated.map((r) => parseDate(r.end_date)!.getTime())),
  );
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInRange = today >= minDate && today <= maxDate;

  const isFull = zoom === "full";
  const trackWidth = isFull ? null : Math.round(totalDays * PX_PER_DAY[zoom]);

  function barLeft(start: Date): string {
    const days = daysBetween(minDate, start);
    if (isFull) return `${(days / totalDays) * 100}%`;
    return `${days * PX_PER_DAY[zoom as Exclude<Zoom, "full">]}px`;
  }

  function barWidth(start: Date, end: Date): string {
    const days = Math.max(daysBetween(start, end), 0.5);
    if (isFull) return `${(days / totalDays) * 100}%`;
    return `${days * PX_PER_DAY[zoom as Exclude<Zoom, "full">]}px`;
  }

  function todayLeft(): string {
    if (!todayInRange) return "0";
    const days = daysBetween(minDate, today);
    if (isFull) return `${(days / totalDays) * 100}%`;
    return `${days * PX_PER_DAY[zoom as Exclude<Zoom, "full">]}px`;
  }

  return (
    <div className="flex flex-col gap-4">
      <Controls
        detail={detail}
        setDetail={setDetail}
        zoom={zoom}
        setZoom={setZoom}
        showToday={showToday}
        setShowToday={setShowToday}
        showLegend={showLegend}
        setShowLegend={setShowLegend}
      />

      {showLegend && <Legend />}

      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <div className="flex">
          <div className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <span>Item</span>
              <span className="text-zinc-600">{fmtDate(minDate)}</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center gap-2 border-b border-zinc-900 px-3 py-1.5 ${
                  row.level === 0
                    ? "bg-zinc-900/40 text-sm font-medium text-zinc-100"
                    : row.level === 1
                      ? "pl-8 text-sm text-zinc-200"
                      : "pl-12 text-xs text-zinc-300"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[row.status]}`}
                />
                <span className="truncate">{row.name}</span>
              </div>
            ))}
          </div>

          <div
            className="relative grow"
            style={trackWidth ? { width: trackWidth, minWidth: trackWidth } : undefined}
          >
            <div className="flex items-center justify-end border-b border-zinc-800 px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <span>{fmtDate(maxDate)}</span>
            </div>
            <div className="relative">
              {rows.map((row) => {
                const start = parseDate(row.start_date);
                const end = parseDate(row.end_date);
                const hasDates = start && end;
                return (
                  <div
                    key={row.id}
                    className="relative h-9 border-b border-zinc-900"
                  >
                    {hasDates && (
                      <div
                        className={`absolute top-1.5 bottom-1.5 rounded ${STATUS_BAR[row.status]}`}
                        style={{
                          left: barLeft(start),
                          width: barWidth(start, end),
                        }}
                        title={`${row.name} · ${STATUS_LABEL[row.status]} · ${fmtDate(start)} – ${fmtDate(end)}`}
                      />
                    )}
                  </div>
                );
              })}
              {showToday && todayInRange && (
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-amber-400/80"
                  style={{ left: todayLeft() }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showToday && todayInRange && (
        <p className="text-xs text-zinc-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
          Today · {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}

function Controls({
  detail,
  setDetail,
  zoom,
  setZoom,
  showToday,
  setShowToday,
  showLegend,
  setShowLegend,
}: {
  detail: DetailLevel;
  setDetail: (d: DetailLevel) => void;
  zoom: Zoom;
  setZoom: (z: Zoom) => void;
  showToday: boolean;
  setShowToday: (b: boolean) => void;
  showLegend: boolean;
  setShowLegend: (b: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Pillbar
        items={DETAILS.map((d) => ({ key: d.key, label: d.label }))}
        value={detail}
        onChange={setDetail}
      />
      <Pillbar
        items={ZOOMS.map((z) => ({ key: z.key, label: z.label }))}
        value={zoom}
        onChange={setZoom}
      />
      <ToggleChip
        active={showToday}
        onChange={setShowToday}
        label="Today line"
      />
      <ToggleChip
        active={showLegend}
        onChange={setShowLegend}
        label="Legend"
      />
    </div>
  );
}

function Pillbar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded px-3 py-1 transition ${
              active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleChip({
  active,
  onChange,
  label,
}: {
  active: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`rounded-md border px-3 py-1 text-xs transition ${
        active
          ? "border-blue-500/40 bg-blue-600/10 text-blue-400"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function Legend() {
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
