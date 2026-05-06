"use client";

// TimelineView — chronological activity timeline sourced from the alerts
// table. The same rows the TopBar bell summarizes, but with full text,
// level styling, and per-row jump-to-module navigation.

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { supabase } from "@/lib/supabase";

type Alert = {
  id: string;
  project_id: string;
  module_key: string | null;
  event_type: string | null;
  message: string | null;
  level: string | null;
  actor: string | null;
  read: boolean | null;
  created_at: string;
};

type LevelTone = "info" | "warn" | "critical";

const LEVEL_STYLE: Record<LevelTone, string> = {
  info: "border-zinc-700 bg-zinc-900 text-zinc-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
};

function levelTone(level: string | null): LevelTone {
  if (!level) return "info";
  const l = level.toLowerCase();
  if (l === "warn" || l === "warning") return "warn";
  if (l === "critical" || l === "error" || l === "danger") return "critical";
  return "info";
}

function fmtModule(key: string | null): string {
  if (!key) return "—";
  return key
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function TimelineView({ projectId }: ModuleProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("alerts")
          .select(
            "id, project_id, module_key, event_type, message, level, actor, read, created_at",
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!cancelled) setAlerts((data ?? []) as Alert[]);
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

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) if (a.module_key) set.add(a.module_key);
    return ["all", ...Array.from(set).sort()];
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (!showRead && a.read) return false;
      if (moduleFilter !== "all" && a.module_key !== moduleFilter) return false;
      return true;
    });
  }, [alerts, showRead, moduleFilter]);

  async function markAllRead() {
    const ids = alerts.filter((a) => !a.read).map((a) => a.id);
    if (ids.length === 0) return;
    setAlerts((prev) =>
      prev.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a)),
    );
    try {
      await supabase.from("alerts").update({ read: true }).in("id", ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark read");
    }
  }

  async function markRead(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a)),
    );
    try {
      await supabase.from("alerts").update({ read: true }).eq("id", id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark read");
    }
  }

  function jumpTo(moduleKey: string | null) {
    if (!moduleKey) return;
    window.dispatchEvent(
      new CustomEvent("bcm-navigate", { detail: { moduleKey } }),
    );
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading feed…
      </div>
    );
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-zinc-500">
          Activity from every module on this project. {unread > 0 ? `${unread} unread.` : "All caught up."}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none [color-scheme:dark]"
          >
            {moduleOptions.map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All modules" : fmtModule(m)}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={showRead}
              onChange={(e) => setShowRead(e.target.checked)}
              className="h-3 w-3"
            />
            Show read
          </label>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {showRead
            ? "No activity yet."
            : "No unread activity. Toggle Show read to see history."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const tone = levelTone(a.level);
            return (
              <li
                key={a.id}
                className={`flex items-start gap-2 rounded-md border bg-zinc-900/40 px-3 py-2.5 transition ${
                  a.read ? "border-zinc-800 opacity-60" : "border-zinc-800"
                }`}
              >
                <Bell
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    tone === "critical"
                      ? "text-red-300"
                      : tone === "warn"
                        ? "text-amber-300"
                        : "text-zinc-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    {a.module_key && (
                      <button
                        type="button"
                        onClick={() => jumpTo(a.module_key)}
                        className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
                        title={`Open ${fmtModule(a.module_key)}`}
                      >
                        {fmtModule(a.module_key)}
                      </button>
                    )}
                    {a.event_type && (
                      <span className="font-mono text-zinc-500">
                        {a.event_type}
                      </span>
                    )}
                    {a.level && a.level !== "info" && (
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${LEVEL_STYLE[tone]}`}
                      >
                        {a.level}
                      </span>
                    )}
                    <span className="ml-auto">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-100">
                    {a.message ?? "(no message)"}
                  </p>
                  {a.actor && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      by {a.actor}
                    </p>
                  )}
                </div>
                {!a.read && (
                  <button
                    type="button"
                    onClick={() => markRead(a.id)}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    title="Mark as read"
                    aria-label="Mark as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
