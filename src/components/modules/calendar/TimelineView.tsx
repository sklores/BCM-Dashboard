"use client";

// TimelineView — chronological project activity, NOT the alerts feed.
// Five sources merged client-side, newest first:
//   1. Daily Logs           (each daily_logs row = one event)
//   2. Incident Reports     (each incident_reports row = one event)
//   3. Schedule changes     (timeline_events module_key = 'schedule')
//   4. Photos uploaded      (timeline_events module_key = 'photos')
//   5. Budget updates       (timeline_events module_key = 'budget')

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  DollarSign,
  GanttChart,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { supabase } from "@/lib/supabase";

type SourceKey =
  | "daily_log"
  | "incident"
  | "schedule"
  | "budget"
  | "photo";

type TimelineEntry = {
  id: string;
  source: SourceKey;
  title: string;
  subtitle?: string | null;
  detailsLines?: string[];
  occurred_at: string; // ISO timestamp used for sort + display
  module_label: string;
  navigateTo?: string; // module key for jump-to button
  severity?: "info" | "warn" | "critical";
};

type DailyLogRow = {
  id: string;
  log_date: string;
  notes: string | null;
  created_at: string;
};

type DailyLogEntryRow = {
  id: string;
  daily_log_id: string;
  contractor_trade: string | null;
  manpower: number | null;
  work_hours: number | null;
  description: string | null;
};

type IncidentRow = {
  id: string;
  incident_date: string;
  incident_time: string | null;
  location: string | null;
  severity: string | null;
  incident_type: string | null;
  description: string;
  reported_at: string;
};

type TimelineEventRow = {
  id: string;
  module_key: string;
  event_type: string;
  title: string;
  details: Record<string, unknown> | null;
  ref_table: string | null;
  ref_id: string | null;
  actor: string | null;
  created_at: string;
};

const SOURCE_LABEL: Record<SourceKey, string> = {
  daily_log: "Daily Log",
  incident: "Incident",
  schedule: "Schedule",
  budget: "Budget",
  photo: "Photos",
};

const SOURCE_ICON: Record<SourceKey, typeof ClipboardList> = {
  daily_log: ClipboardList,
  incident: AlertTriangle,
  schedule: GanttChart,
  budget: DollarSign,
  photo: ImageIcon,
};

const SOURCE_TINT: Record<SourceKey, string> = {
  daily_log: "text-zinc-300",
  incident: "text-red-300",
  schedule: "text-blue-300",
  budget: "text-emerald-300",
  photo: "text-violet-300",
};

function severityFromIncident(s: string | null): "info" | "warn" | "critical" {
  if (!s) return "info";
  const v = s.toLowerCase();
  if (v === "critical" || v === "severe") return "critical";
  if (v === "moderate") return "warn";
  return "info";
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDateOnly(date: string): string {
  // input is "YYYY-MM-DD"
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimelineView({ projectId }: ModuleProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceKey>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Fire all five queries in parallel.
        const [logsRes, logEntriesRes, incidentsRes, eventsRes] =
          await Promise.all([
            supabase
              .from("daily_logs")
              .select("id, log_date, notes, created_at")
              .eq("project_id", projectId)
              .order("log_date", { ascending: false })
              .limit(60),
            // We pull entries for the most recent 60 logs to summarize
            // crew counts; cheap because the inner join is small.
            supabase
              .from("daily_log_entries")
              .select(
                "id, daily_log_id, contractor_trade, manpower, work_hours, description",
              ),
            supabase
              .from("incident_reports")
              .select(
                "id, incident_date, incident_time, location, severity, incident_type, description, reported_at",
              )
              .eq("project_id", projectId)
              .order("reported_at", { ascending: false })
              .limit(60),
            supabase
              .from("timeline_events")
              .select(
                "id, module_key, event_type, title, details, ref_table, ref_id, actor, created_at",
              )
              .eq("project_id", projectId)
              .in("module_key", ["schedule", "budget", "photos"])
              .order("created_at", { ascending: false })
              .limit(200),
          ]);

        if (logsRes.error) throw logsRes.error;
        if (logEntriesRes.error) throw logEntriesRes.error;
        if (incidentsRes.error) throw incidentsRes.error;
        if (eventsRes.error) throw eventsRes.error;

        const logs = (logsRes.data ?? []) as DailyLogRow[];
        const logEntries = (logEntriesRes.data ?? []) as DailyLogEntryRow[];
        const incidents = (incidentsRes.data ?? []) as IncidentRow[];
        const events = (eventsRes.data ?? []) as TimelineEventRow[];

        // Group log entries by daily_log_id to summarize manpower per day.
        const entriesByLog = new Map<string, DailyLogEntryRow[]>();
        for (const e of logEntries) {
          const arr = entriesByLog.get(e.daily_log_id) ?? [];
          arr.push(e);
          entriesByLog.set(e.daily_log_id, arr);
        }

        const merged: TimelineEntry[] = [];

        for (const log of logs) {
          const rows = entriesByLog.get(log.id) ?? [];
          const totalManpower = rows.reduce(
            (acc, r) => acc + (r.manpower ?? 0),
            0,
          );
          const trades = Array.from(
            new Set(rows.map((r) => r.contractor_trade).filter(Boolean)),
          ) as string[];
          const summaryParts: string[] = [];
          if (totalManpower > 0)
            summaryParts.push(`${totalManpower} on site`);
          if (trades.length > 0)
            summaryParts.push(trades.slice(0, 4).join(", "));
          merged.push({
            id: `log-${log.id}`,
            source: "daily_log",
            title: `Daily log — ${fmtDateOnly(log.log_date)}`,
            subtitle: summaryParts.join(" · ") || undefined,
            detailsLines: log.notes ? [log.notes] : undefined,
            occurred_at: log.created_at,
            module_label: SOURCE_LABEL.daily_log,
          });
        }

        for (const inc of incidents) {
          const tint = severityFromIncident(inc.severity);
          const subtitleParts: string[] = [];
          if (inc.incident_type) subtitleParts.push(inc.incident_type);
          if (inc.severity) subtitleParts.push(inc.severity);
          if (inc.location) subtitleParts.push(inc.location);
          merged.push({
            id: `inc-${inc.id}`,
            source: "incident",
            title: `Incident — ${fmtDateOnly(inc.incident_date)}${inc.incident_time ? ` ${inc.incident_time.slice(0, 5)}` : ""}`,
            subtitle: subtitleParts.join(" · ") || undefined,
            detailsLines: [inc.description],
            occurred_at: inc.reported_at,
            module_label: SOURCE_LABEL.incident,
            severity: tint,
          });
        }

        for (const ev of events) {
          const src: SourceKey =
            ev.module_key === "photos"
              ? "photo"
              : ev.module_key === "budget"
                ? "budget"
                : "schedule";
          // For budget line-item / division updates the title already
          // contains the diff. For schedule status changes the title is
          // the human-readable summary.
          merged.push({
            id: `ev-${ev.id}`,
            source: src,
            title: ev.title,
            subtitle:
              ev.actor || ev.event_type
                ? [ev.actor, ev.event_type].filter(Boolean).join(" · ")
                : undefined,
            occurred_at: ev.created_at,
            module_label: SOURCE_LABEL[src],
            navigateTo: ev.module_key === "photos" ? "photos" : ev.module_key,
          });
        }

        merged.sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() -
            new Date(a.occurred_at).getTime(),
        );

        if (!cancelled) setEntries(merged);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sourceCounts = useMemo(() => {
    const c: Record<SourceKey, number> = {
      daily_log: 0,
      incident: 0,
      schedule: 0,
      budget: 0,
      photo: 0,
    };
    for (const e of entries) c[e.source]++;
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return entries;
    return entries.filter((e) => e.source === sourceFilter);
  }, [entries, sourceFilter]);

  function jumpTo(moduleKey?: string) {
    if (!moduleKey) return;
    window.dispatchEvent(
      new CustomEvent("bcm-navigate", { detail: { moduleKey } }),
    );
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading timeline…
      </div>
    );
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-zinc-500">
          {entries.length === 0
            ? "No project activity yet."
            : `${entries.length} events on this project.`}
        </p>
        <div className="ml-auto inline-flex flex-wrap items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          <FilterButton
            active={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
            label="All"
            count={entries.length}
          />
          {(
            ["daily_log", "incident", "schedule", "budget", "photo"] as const
          ).map((k) => (
            <FilterButton
              key={k}
              active={sourceFilter === k}
              onClick={() => setSourceFilter(k)}
              label={SOURCE_LABEL[k]}
              count={sourceCounts[k]}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {entries.length === 0
            ? "Nothing's happened on this project yet. Daily logs, incident reports, schedule status changes, photo uploads, and budget edits will all show up here."
            : "No events match this filter."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const Icon = SOURCE_ICON[e.source];
            const tint = SOURCE_TINT[e.source];
            const sevTint =
              e.severity === "critical"
                ? "border-red-500/40 bg-red-500/5"
                : e.severity === "warn"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-zinc-800 bg-zinc-900/40";
            return (
              <li
                key={e.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${sevTint}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tint}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <button
                      type="button"
                      onClick={() => jumpTo(e.navigateTo ?? e.source)}
                      className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
                      title={`Open ${e.module_label}`}
                    >
                      {e.module_label}
                    </button>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {fmtDateTime(e.occurred_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-100">{e.title}</p>
                  {e.subtitle && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {e.subtitle}
                    </p>
                  )}
                  {e.detailsLines?.map((line, i) => (
                    <p
                      key={i}
                      className="mt-1 whitespace-pre-wrap text-xs text-zinc-300"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 transition ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1 text-[10px] text-zinc-500">{count}</span>
      )}
    </button>
  );
}
