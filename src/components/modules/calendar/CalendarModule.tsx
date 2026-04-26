"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sunrise,
  X,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import { supabase } from "@/lib/supabase";

// ---------- Event Model ----------

type SourceModule =
  | "schedule"
  | "permits"
  | "notes"
  | "tasks"
  | "plans"
  | "billing"
  | "estimating"
  | "general";

type CalendarEvent = {
  id: string;
  source: SourceModule;
  sourceLabel: string; // "Schedule", "Permits", etc.
  kind: string; // "Milestone", "Task Due", "Inspection", etc.
  title: string;
  date: string; // ISO YYYY-MM-DD
  endDate?: string; // for multi-day events
  status?: string;
  detail?: string; // assignee, sub-info, etc.
  warning?: boolean; // e.g. permit expiring within 30 days
};

const SOURCE_COLOR: Record<SourceModule, { bg: string; border: string; dot: string; text: string }> =
  {
    schedule: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      dot: "bg-blue-400",
      text: "text-blue-300",
    },
    permits: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      dot: "bg-red-400",
      text: "text-red-300",
    },
    notes: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      dot: "bg-violet-400",
      text: "text-violet-300",
    },
    tasks: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      dot: "bg-orange-400",
      text: "text-orange-300",
    },
    plans: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      dot: "bg-yellow-400",
      text: "text-yellow-300",
    },
    billing: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      dot: "bg-emerald-400",
      text: "text-emerald-300",
    },
    estimating: {
      bg: "bg-teal-500/10",
      border: "border-teal-500/30",
      dot: "bg-teal-400",
      text: "text-teal-300",
    },
    general: {
      bg: "bg-zinc-700/40",
      border: "border-zinc-700",
      dot: "bg-zinc-400",
      text: "text-zinc-300",
    },
  };

// ---------- Date helpers ----------

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(s: string | null): Date | null {
  if (!s) return null;
  // Treat as local midnight to avoid TZ shifts on calendar grids
  return new Date(s + "T00:00:00");
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d: Date): Date {
  // Sunday-first
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
function fmtShortDate(s: string | null): string {
  const d = fromISO(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------- Module ----------

type View = "month" | "week" | "agenda";

export function CalendarModule({ projectId }: ModuleProps) {
  const role = useRole();

  const [view, setView] = useState<View>("agenda");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [openDayISO, setOpenDayISO] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (role === "super") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWarnings([]);
    fetchAllEvents(projectId)
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setWarnings(res.warnings);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, role]);

  // Group events by ISO date for easy lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      // For multi-day events, populate every day in the range
      const start = fromISO(e.date);
      const end = e.endDate ? fromISO(e.endDate) : start;
      if (!start) continue;
      const last = end ?? start;
      let cur = new Date(start);
      while (cur <= last) {
        const k = toISO(cur);
        const arr = map.get(k) ?? [];
        arr.push(e);
        map.set(k, arr);
        cur = addDays(cur, 1);
      }
    }
    return map;
  }, [events]);

  const todayISO = toISO(new Date());

  if (role === "super") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">Calendar</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Calendar is mobile-only for the Super role.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Calendar</h1>
      </div>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">Some sources couldn&apos;t load:</span>{" "}
            {warnings.join(", ")}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(
            [
              ["agenda", "Agenda"],
              ["month", "Month"],
              ["week", "Week"],
            ] as const
          ).map(([key, label]) => {
            const active = key === view;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded px-4 py-1.5 text-sm transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {(view === "month" || view === "week") && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCursor((c) =>
                  view === "month" ? addMonths(c, -1) : addDays(c, -7),
                )
              }
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setCursor((c) =>
                  view === "month" ? addMonths(c, 1) : addDays(c, 7),
                )
              }
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-2 text-sm font-medium text-zinc-300">
              {view === "month"
                ? fmtMonth(cursor)
                : `${fmtMonth(startOfWeek(cursor))} · week of ${fmtShortDate(toISO(startOfWeek(cursor)))}`}
            </span>
          </div>
        )}

        <Legend />
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && view === "month" && (
        <MonthGrid
          cursor={cursor}
          eventsByDate={eventsByDate}
          todayISO={todayISO}
          onDayClick={setOpenDayISO}
        />
      )}

      {!loading && !error && view === "week" && (
        <WeekView
          cursor={cursor}
          eventsByDate={eventsByDate}
          todayISO={todayISO}
          onEventClick={setOpenEvent}
        />
      )}

      {!loading && !error && view === "agenda" && (
        <AgendaView
          events={events}
          todayISO={todayISO}
          showPast={showPast}
          onTogglePast={() => setShowPast((v) => !v)}
          onEventClick={setOpenEvent}
        />
      )}

      {openDayISO && (
        <DayPanel
          dateISO={openDayISO}
          events={eventsByDate.get(openDayISO) ?? []}
          onClose={() => setOpenDayISO(null)}
          onEventClick={(e) => {
            setOpenDayISO(null);
            setOpenEvent(e);
          }}
        />
      )}

      {openEvent && (
        <EventDetail event={openEvent} onClose={() => setOpenEvent(null)} />
      )}
    </div>
  );
}

// ---------- Legend ----------

function Legend() {
  const items: Array<[SourceModule, string]> = [
    ["schedule", "Schedule"],
    ["permits", "Permits"],
    ["notes", "Meetings"],
    ["tasks", "Tasks"],
    ["plans", "Plans"],
    ["billing", "Billing"],
    ["estimating", "Estimating"],
  ];
  return (
    <div className="ml-auto hidden flex-wrap items-center gap-3 text-[11px] text-zinc-500 lg:flex">
      {items.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${SOURCE_COLOR[k].dot}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------- Month View ----------

function MonthGrid({
  cursor,
  eventsByDate,
  todayISO,
  onDayClick,
}: {
  cursor: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  todayISO: string;
  onDayClick: (iso: string) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  const monthIdx = cursor.getMonth();

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40">
      <div className="grid grid-cols-7 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === monthIdx;
          const isToday = iso === todayISO;
          const dayEvents = eventsByDate.get(iso) ?? [];
          // Up to 4 unique sources as colored dots, plus +N more
          const uniqueSources = Array.from(
            new Set(dayEvents.map((e) => e.source)),
          );
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              className={`group min-h-24 border-b border-r border-zinc-800 p-1.5 text-left transition ${
                inMonth ? "bg-transparent" : "bg-zinc-900/20"
              } hover:bg-zinc-900`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                      : inMonth
                        ? "text-zinc-300"
                        : "text-zinc-600"
                  }`}
                >
                  {d.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-0.5">
                {uniqueSources.slice(0, 5).map((src) => (
                  <span
                    key={src}
                    className={`h-1.5 w-1.5 rounded-full ${SOURCE_COLOR[src].dot}`}
                  />
                ))}
              </div>
              <div className="mt-0.5 hidden flex-col gap-0.5 text-[10px] sm:flex">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={`truncate rounded px-1 py-0.5 ${SOURCE_COLOR[e.source].bg} ${SOURCE_COLOR[e.source].text}`}
                    title={e.title}
                  >
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-zinc-500">
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Week View ----------

function WeekView({
  cursor,
  eventsByDate,
  todayISO,
  onEventClick,
}: {
  cursor: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  todayISO: string;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const iso = toISO(d);
        const isToday = iso === todayISO;
        const dayEvents = eventsByDate.get(iso) ?? [];
        return (
          <div
            key={iso}
            className={`flex flex-col gap-2 rounded-md border bg-zinc-900/40 p-2 ${
              isToday ? "border-blue-500/40" : "border-zinc-800"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={`text-base font-semibold ${
                  isToday ? "text-blue-300" : "text-zinc-200"
                }`}
              >
                {d.getDate()}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dayEvents.length === 0 && (
                <span className="text-[11px] text-zinc-600">—</span>
              )}
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEventClick(e)}
                  className={`flex items-start gap-1.5 rounded px-1.5 py-1 text-left text-[11px] ${SOURCE_COLOR[e.source].bg} ${SOURCE_COLOR[e.source].text} hover:brightness-125`}
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_COLOR[e.source].dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="truncate text-[10px] opacity-75">
                      {e.kind}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Agenda View ----------

function AgendaView({
  events,
  todayISO,
  showPast,
  onTogglePast,
  onEventClick,
}: {
  events: CalendarEvent[];
  todayISO: string;
  showPast: boolean;
  onTogglePast: () => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );

  const upcoming = useMemo(() => {
    return sorted.filter((e) => (showPast ? true : e.date >= todayISO));
  }, [sorted, showPast, todayISO]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of upcoming) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcoming]);

  // Briefing buckets
  const todayDate = new Date();
  const tomorrowISO = toISO(addDays(todayDate, 1));
  const sevenISO = toISO(addDays(todayDate, 7));
  const todayEvents = sorted.filter((e) => e.date === todayISO);
  const tomorrowEvents = sorted.filter((e) => e.date === tomorrowISO);
  const thisWeekEvents = sorted.filter(
    (e) => e.date > tomorrowISO && e.date <= sevenISO,
  );

  return (
    <div className="flex flex-col gap-4">
      <BriefingCard
        today={todayEvents}
        tomorrow={tomorrowEvents}
        thisWeek={thisWeekEvents}
        onEventClick={onEventClick}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          {showPast ? "All events" : "Upcoming"}
        </h2>
        <button
          type="button"
          onClick={onTogglePast}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
        >
          {showPast ? "Hide past events" : "Show past events"}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {showPast
            ? "No events recorded yet."
            : "Nothing on the books — add dates in any module to populate the calendar."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([dateISO, items]) => (
            <DateGroup
              key={dateISO}
              dateISO={dateISO}
              events={items}
              isToday={dateISO === todayISO}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DateGroup({
  dateISO,
  events,
  isToday,
  onEventClick,
}: {
  dateISO: string;
  events: CalendarEvent[];
  isToday: boolean;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const date = fromISO(dateISO);
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className={`text-sm font-semibold ${isToday ? "text-blue-300" : "text-zinc-200"}`}
        >
          {date ? fmtDayLabel(date) : dateISO}
        </span>
        {isToday && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-300">
            Today
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {events.map((e) => (
          <EventRow key={e.id} event={e} onClick={() => onEventClick(e)} />
        ))}
      </div>
    </div>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const c = SOURCE_COLOR[event.source];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md border ${c.border} ${c.bg} px-3 py-2 text-left transition hover:brightness-125`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
      <span
        className={`text-[10px] uppercase tracking-wider ${c.text} shrink-0`}
      >
        {event.sourceLabel}
      </span>
      <span className="flex-1 truncate text-sm text-zinc-100">
        {event.title}
      </span>
      <span className="hidden text-xs text-zinc-400 sm:inline">{event.kind}</span>
      {event.warning && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Soon
        </span>
      )}
    </button>
  );
}

// ---------- Morning Briefing ----------

function BriefingCard({
  today,
  tomorrow,
  thisWeek,
  onEventClick,
}: {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  thisWeek: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const totalUpcoming =
    today.length + tomorrow.length + thisWeek.length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-300">
          <Sunrise className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Morning briefing
          </div>
          <div className="text-base font-semibold text-zinc-100">
            {dateLine}
          </div>
          {totalUpcoming === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              Nothing on the books. Quiet stretch ahead.
            </p>
          )}
        </div>
      </div>

      {totalUpcoming > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <BriefingBucket
            title="Today"
            events={today}
            empty="Clear schedule today."
            onEventClick={onEventClick}
          />
          <BriefingBucket
            title="Tomorrow"
            events={tomorrow}
            empty="Nothing scheduled."
            onEventClick={onEventClick}
          />
          <BriefingBucket
            title="This Week"
            events={thisWeek}
            empty="Open week."
            onEventClick={onEventClick}
          />
        </div>
      )}
    </div>
  );
}

function BriefingBucket({
  title,
  events,
  empty,
  onEventClick,
}: {
  title: string;
  events: CalendarEvent[];
  empty: string;
  onEventClick: (e: CalendarEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-zinc-600">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEventClick(e)}
                className="flex w-full items-center gap-2 rounded p-1 text-left transition hover:bg-zinc-900"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_COLOR[e.source].dot}`}
                />
                <span className="flex-1 truncate text-xs text-zinc-200">
                  {e.title}
                </span>
                <span className="text-[10px] text-zinc-500">{e.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Day panel (Month → click) ----------

function DayPanel({
  dateISO,
  events,
  onClose,
  onEventClick,
}: {
  dateISO: string;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const date = fromISO(dateISO);
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Day view
            </div>
            <h3 className="text-base font-semibold text-zinc-100">
              {date ? fmtDayLabel(date) : dateISO}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing scheduled.</p>
          ) : (
            events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                onClick={() => onEventClick(e)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Event Detail ----------

function EventDetail({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const c = SOURCE_COLOR[event.source];
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span
                className={`text-[10px] uppercase tracking-wider ${c.text}`}
              >
                {event.sourceLabel} · {event.kind}
              </span>
            </div>
            <h3 className="mt-1 truncate text-base font-semibold text-zinc-100">
              {event.title}
            </h3>
            <div className="mt-0.5 text-xs text-zinc-500">
              {fmtShortDate(event.date)}
              {event.endDate && event.endDate !== event.date && (
                <> → {fmtShortDate(event.endDate)}</>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 text-sm">
          {event.status && (
            <DetailRow label="Status" value={event.status} />
          )}
          {event.detail && (
            <DetailRow label="Detail" value={event.detail} />
          )}
          {event.warning && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Action soon — within 30 days.
            </div>
          )}
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
            Open the {event.sourceLabel} module from the sidebar to edit this
            record.
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="text-sm text-zinc-200">{value}</div>
    </div>
  );
}

// ---------- Data fetch ----------

async function fetchAllEvents(
  projectId: string,
): Promise<{ events: CalendarEvent[]; warnings: string[] }> {
  const events: CalendarEvent[] = [];
  const warnings: string[] = [];

  async function safe<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      warnings.push(name);
      // eslint-disable-next-line no-console
      console.warn(`[calendar] ${name} failed`, err);
      return null;
    }
  }

  // 1. Schedule milestones (schedule_phases where is_milestone=true)
  const phases = await safe("Schedule milestones", async () => {
    const { data, error } = await supabase
      .from("schedule_phases")
      .select("id, name, start_date, end_date, status, is_milestone")
      .eq("project_id", projectId)
      .eq("is_milestone", true);
    if (error) throw error;
    return data ?? [];
  });
  if (phases) {
    for (const p of phases) {
      const date = (p.end_date as string | null) ?? (p.start_date as string | null);
      if (!date) continue;
      events.push({
        id: `phase:${p.id}`,
        source: "schedule",
        sourceLabel: "Schedule",
        kind: "Milestone",
        title: (p.name as string) ?? "Untitled milestone",
        date,
        endDate: (p.end_date as string | null) ?? undefined,
        status: (p.status as string | null) ?? undefined,
      });
    }
  }

  // 2. Schedule tasks
  const sTasks = await safe("Schedule tasks", async () => {
    const { data, error } = await supabase
      .from("schedule_tasks")
      .select("id, name, end_date, status");
    if (error) throw error;
    return data ?? [];
  });
  if (sTasks) {
    for (const t of sTasks) {
      const date = t.end_date as string | null;
      if (!date) continue;
      events.push({
        id: `stask:${t.id}`,
        source: "schedule",
        sourceLabel: "Schedule",
        kind: "Task Due",
        title: (t.name as string) ?? "Untitled task",
        date,
        status: (t.status as string | null) ?? undefined,
      });
    }
  }

  // 3. Permits / Inspections
  const inspections = await safe("Inspections", async () => {
    const { data, error } = await supabase
      .from("inspections")
      .select("id, scheduled_date, inspection_type, result, inspector_name")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (inspections) {
    for (const i of inspections) {
      const date = i.scheduled_date as string | null;
      if (!date) continue;
      events.push({
        id: `insp:${i.id}`,
        source: "permits",
        sourceLabel: "Permits",
        kind: "Inspection",
        title: (i.inspection_type as string) ?? "Inspection",
        date,
        status: (i.result as string | null) ?? undefined,
        detail: (i.inspector_name as string | null) ?? undefined,
      });
    }
  }

  // 4. Permit expirations
  const permits = await safe("Permits", async () => {
    const { data, error } = await supabase
      .from("permits")
      .select("id, expiration_date, permit_number, permit_type, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (permits) {
    for (const p of permits) {
      const date = p.expiration_date as string | null;
      if (!date) continue;
      const target = fromISO(date);
      const days = target
        ? Math.floor(
            (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;
      const warn = days !== null && days >= 0 && days <= 30;
      const num = (p.permit_number as string | null) ?? "(no number)";
      const type = (p.permit_type as string | null) ?? "Permit";
      events.push({
        id: `permit:${p.id}`,
        source: "permits",
        sourceLabel: "Permits",
        kind: "Permit Expires",
        title: `${type} · ${num}`,
        date,
        status: (p.status as string | null) ?? undefined,
        warning: warn,
      });
    }
  }

  // 5. Meetings (Notes)
  const meetings = await safe("Meetings", async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("id, meeting_name, date, location, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (meetings) {
    for (const m of meetings) {
      const date = m.date as string | null;
      if (!date) continue;
      events.push({
        id: `meeting:${m.id}`,
        source: "notes",
        sourceLabel: "Meetings",
        kind: "Meeting",
        title: (m.meeting_name as string) ?? "Meeting",
        date,
        status: (m.status as string | null) ?? undefined,
        detail: (m.location as string | null) ?? undefined,
      });
    }
  }

  // 6. Tasks
  const tasks = await safe("Tasks", async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (tasks) {
    for (const t of tasks) {
      const date = t.due_date as string | null;
      if (!date) continue;
      events.push({
        id: `task:${t.id}`,
        source: "tasks",
        sourceLabel: "Tasks",
        kind: "Task Due",
        title: (t.title as string) ?? "Task",
        date,
        status: (t.status as string | null) ?? undefined,
      });
    }
  }

  // 7. Submittals
  const submittals = await safe("Submittals", async () => {
    const { data, error } = await supabase
      .from("submittals")
      .select(
        "id, submittal_number, description, date_submitted, date_returned, status",
      )
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (submittals) {
    for (const s of submittals) {
      const num = (s.submittal_number as string | null) ?? "Submittal";
      const desc = (s.description as string | null) ?? "";
      const titleBase = `${num}${desc ? " · " + desc : ""}`;
      if (s.date_submitted) {
        events.push({
          id: `subSub:${s.id}`,
          source: "plans",
          sourceLabel: "Plans",
          kind: "Submittal Submitted",
          title: titleBase,
          date: s.date_submitted as string,
          status: (s.status as string | null) ?? undefined,
        });
      }
      if (s.date_returned) {
        events.push({
          id: `subRet:${s.id}`,
          source: "plans",
          sourceLabel: "Plans",
          kind: "Submittal Returned",
          title: titleBase,
          date: s.date_returned as string,
          status: (s.status as string | null) ?? undefined,
        });
      }
    }
  }

  // 8. Pay applications (client billing)
  const payApps = await safe("Pay applications", async () => {
    const { data, error } = await supabase
      .from("pay_applications")
      .select("id, application_number, period_end, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (payApps) {
    for (const p of payApps) {
      const date = p.period_end as string | null;
      if (!date) continue;
      const num = (p.application_number as number | null) ?? "?";
      events.push({
        id: `payapp:${p.id}`,
        source: "billing",
        sourceLabel: "Billing",
        kind: "Requisition Due",
        title: `Pay App #${num}`,
        date,
        status: (p.status as string | null) ?? undefined,
      });
    }
  }

  // 9. Sub requisitions
  const subReqs = await safe("Sub requisitions", async () => {
    const { data, error } = await supabase
      .from("sub_requisitions")
      .select("id, period_end, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (subReqs) {
    for (const r of subReqs) {
      const date = r.period_end as string | null;
      if (!date) continue;
      events.push({
        id: `subreq:${r.id}`,
        source: "billing",
        sourceLabel: "Billing",
        kind: "Sub Requisition",
        title: "Sub requisition period end",
        date,
        status: (r.status as string | null) ?? undefined,
      });
    }
  }

  // 10. Bid requests
  const bidReqs = await safe("Bid requests", async () => {
    const { data, error } = await supabase
      .from("bid_requests")
      .select("id, trade_name, due_date, status")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  });
  if (bidReqs) {
    for (const b of bidReqs) {
      const date = b.due_date as string | null;
      if (!date) continue;
      events.push({
        id: `bid:${b.id}`,
        source: "estimating",
        sourceLabel: "Estimating",
        kind: "Bid Due",
        title: (b.trade_name as string) ?? "Bid",
        date,
        status: (b.status as string | null) ?? undefined,
      });
    }
  }

  return { events, warnings };
}
