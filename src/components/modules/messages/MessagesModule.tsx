"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Inbox,
  Mail,
  Search,
} from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { fetchMessages, fetchProjectInboundEmail } from "./queries";
import type { Message } from "./types";

export function MessagesModule({ projectId }: ModuleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inboundEmail, setInboundEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [senderFilter, setSenderFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [rows, email] = await Promise.all([
          fetchMessages(projectId),
          fetchProjectInboundEmail(projectId),
        ]);
        if (cancelled) return;
        setMessages(rows);
        setInboundEmail(email);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load messages",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const senders = useMemo(() => {
    const set = new Map<string, string>();
    for (const m of messages) {
      const key = m.from_email ?? "";
      if (!key) continue;
      if (!set.has(key)) {
        set.set(key, m.from_name ? `${m.from_name} <${key}>` : key);
      }
    }
    return Array.from(set.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toMs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return messages.filter((m) => {
      if (senderFilter && m.from_email !== senderFilter) return false;
      const t = new Date(m.received_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      if (q) {
        const haystack = `${m.subject ?? ""} ${m.body ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [messages, search, senderFilter, fromDate, toDate]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyEmail() {
    if (!inboundEmail) return;
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function clearFilters() {
    setSearch("");
    setSenderFilter("");
    setFromDate("");
    setToDate("");
  }

  const hasActiveFilters =
    search !== "" || senderFilter !== "" || fromDate !== "" || toDate !== "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Messages</h1>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <Mail className="h-5 w-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Project inbox
              </p>
              <p className="font-mono text-sm text-zinc-100">
                {inboundEmail ?? (
                  <span className="text-zinc-500">— not set —</span>
                )}
              </p>
            </div>
            {inboundEmail && (
              <button
                type="button"
                onClick={copyEmail}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Anyone on the team can forward project emails to the address above
            and they will appear here.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject and body…"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value)}
              className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All senders</option>
              {senders.map(([email, label]) => (
                <option key={email} value={email}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              aria-label="From date"
            />
            <span className="text-xs text-zinc-600">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              aria-label="To date"
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {messages.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No messages yet. Forward an email to the project inbox above.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No messages match these filters.
              </p>
            ) : (
              filtered.map((m) => (
                <MessageCard
                  key={m.id}
                  message={m}
                  expanded={expanded.has(m.id)}
                  onToggle={() => toggleExpand(m.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MessageCard({
  message,
  expanded,
  onToggle,
}: {
  message: Message;
  expanded: boolean;
  onToggle: () => void;
}) {
  const preview = message.body
    ? message.body.replace(/\s+/g, " ").trim().slice(0, 160)
    : "";
  const date = new Date(message.received_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = new Date(message.received_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-zinc-500">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium text-zinc-100">
                {message.from_name || message.from_email || "Unknown sender"}
              </span>
              {message.from_email && message.from_name && (
                <span className="ml-2 text-xs text-zinc-500">
                  {message.from_email}
                </span>
              )}
            </div>
            <div className="shrink-0 text-xs text-zinc-500">
              {date} · {time}
            </div>
          </div>
          <div className="text-sm font-medium text-zinc-200">
            {message.subject || (
              <span className="italic text-zinc-500">(no subject)</span>
            )}
          </div>
          {!expanded && preview && (
            <div className="text-sm text-zinc-400">
              {preview}
              {message.body && message.body.length > 160 ? "…" : ""}
            </div>
          )}
        </div>
      </div>
      {expanded && message.body && (
        <div className="ml-7 mt-2 whitespace-pre-wrap rounded bg-zinc-950 p-3 text-sm text-zinc-300">
          {message.body}
        </div>
      )}
    </button>
  );
}
