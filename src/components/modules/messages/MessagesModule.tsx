"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Flag,
  Inbox,
  Loader2,
  Mail,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  aiTagMessage,
  createFollowUpTaskFromMessage,
  fetchMessages,
  fetchProjectInboundEmail,
  updateMessagePriority,
  updateMessageTags,
} from "./queries";
import {
  ENTRY_TYPE_LABEL,
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  TAG_OPTIONS,
  normalizeSubject,
  type EntryType,
  type Message,
  type Priority,
} from "./types";
import { MessagesComposer } from "./Composer";

export function MessagesModule({ projectId }: ModuleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inboundEmail, setInboundEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [copied, setCopied] = useState(false);
  const [tagging, setTagging] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [creatingTaskFor, setCreatingTaskFor] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  function toggleThread(key: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  // All tags currently in use, plus the canonical list — so chips show even if
  // not yet applied to any message.
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages) {
      for (const t of m.tags) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toMs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return messages.filter((m) => {
      if (priorityOnly && (m.priority === "normal" || !m.priority)) return false;
      if (activeTags.size > 0) {
        for (const t of activeTags) if (!m.tags.includes(t)) return false;
      }
      const t = new Date(m.received_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      if (q) {
        const haystack = `${m.subject ?? ""} ${m.body ?? ""} ${m.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [messages, search, activeTags, fromDate, toDate, priorityOnly]);

  // Email threading: emails with the same subject (after stripping
  // "Re:" / "Fwd:" prefixes) collapse into one thread. Manual entries
  // (call, field note, screenshot) always render as standalone rows.
  const groupedThreads = useMemo(() => {
    type Standalone = { kind: "single"; message: Message };
    type Thread = { kind: "thread"; key: string; messages: Message[] };
    const out: Array<Standalone | Thread> = [];
    const threadMap = new Map<string, Message[]>();
    for (const m of filtered) {
      if (m.entry_type !== "email") {
        out.push({ kind: "single", message: m });
        continue;
      }
      const key = normalizeSubject(m.subject) || `__id_${m.id}`;
      const list = threadMap.get(key) ?? [];
      list.push(m);
      threadMap.set(key, list);
    }
    for (const [key, list] of threadMap.entries()) {
      list.sort(
        (a, b) =>
          new Date(b.received_at).getTime() -
          new Date(a.received_at).getTime(),
      );
      if (list.length === 1) {
        out.push({ kind: "single", message: list[0] });
      } else {
        out.push({ kind: "thread", key, messages: list });
      }
    }
    out.sort((a, b) => {
      const aTs =
        a.kind === "single" ? a.message.received_at : a.messages[0].received_at;
      const bTs =
        b.kind === "single" ? b.message.received_at : b.messages[0].received_at;
      return new Date(bTs).getTime() - new Date(aTs).getTime();
    });
    return out;
  }, [filtered]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTagFilter(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
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
    setActiveTags(new Set());
    setFromDate("");
    setToDate("");
    setPriorityOnly(false);
  }

  async function handleAiTag(messageId: string) {
    setTagging((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    try {
      const tags = await aiTagMessage(messageId);
      setMessages((rows) =>
        rows.map((m) => (m.id === messageId ? { ...m, tags } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI tagging failed");
    } finally {
      setTagging((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function handleSetTags(messageId: string, tags: string[]) {
    const prev = messages;
    setMessages((rows) =>
      rows.map((m) => (m.id === messageId ? { ...m, tags } : m)),
    );
    try {
      await updateMessageTags(messageId, tags);
    } catch (err) {
      setMessages(prev);
      setError(err instanceof Error ? err.message : "Failed to save tags");
    }
  }

  async function handleSetPriority(messageId: string, priority: Priority) {
    const prev = messages;
    setMessages((rows) =>
      rows.map((m) => (m.id === messageId ? { ...m, priority } : m)),
    );
    try {
      await updateMessagePriority(messageId, priority);
    } catch (err) {
      setMessages(prev);
      setError(err instanceof Error ? err.message : "Failed to save priority");
    }
  }

  async function handleFollowUp(message: Message) {
    setCreatingTaskFor(message.id);
    try {
      const taskId = await createFollowUpTaskFromMessage(projectId, message);
      setMessages((rows) =>
        rows.map((m) =>
          m.id === message.id ? { ...m, follow_up_task_id: taskId } : m,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreatingTaskFor(null);
    }
  }

  const untaggedCount = messages.filter((m) => m.tags.length === 0).length;
  const hasActiveFilters =
    search !== "" ||
    activeTags.size > 0 ||
    fromDate !== "" ||
    toDate !== "" ||
    priorityOnly;

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
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/25"
              title="Add a call log, field note, or text screenshot"
            >
              <Plus className="h-3.5 w-3.5" />
              New entry
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Anyone on the team can forward project emails to the address above.
            Each message is auto-tagged by Claude with relevant module tags
            (budget, materials, schedule…). Click a tag chip to filter.
          </p>

          {/* Filter row: search + date range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, body, tags…"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
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
            <button
              type="button"
              onClick={() => setPriorityOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${
                priorityOnly
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Show only High / Urgent priority"
            >
              <Flag className="h-3.5 w-3.5" />
              Priority only
            </button>
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

          {/* Tag filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((tag) => {
              const active = activeTags.has(tag);
              const count = tagCounts[tag] ?? 0;
              if (count === 0 && !active) return null;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                    active
                      ? "border-blue-500/40 bg-blue-600/15 text-blue-300"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tag} <span className="text-zinc-600">({count})</span>
                </button>
              );
            })}
            {Object.keys(tagCounts).length === 0 && (
              <span className="text-xs italic text-zinc-500">
                No tags yet — click "AI tag" on a message to auto-tag.
              </span>
            )}
          </div>

          {untaggedCount > 0 && (
            <p className="text-xs text-zinc-500">
              {untaggedCount} message{untaggedCount === 1 ? "" : "s"} without
              tags. Use the AI tag button on each card to fill them in.
            </p>
          )}

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
              groupedThreads.map((group) =>
                group.kind === "thread" ? (
                  <ThreadGroup
                    key={group.key}
                    messages={group.messages}
                    expandedThreads={expandedThreads}
                    onToggleThread={() => toggleThread(group.key)}
                    cardProps={{
                      expanded,
                      tagging,
                      creatingTaskFor,
                      onToggle: toggleExpand,
                      onAiTag: handleAiTag,
                      onSetTags: handleSetTags,
                      onSetPriority: handleSetPriority,
                      onFollowUp: handleFollowUp,
                    }}
                  />
                ) : (
                  <MessageCard
                    key={group.message.id}
                    message={group.message}
                    expanded={expanded.has(group.message.id)}
                    tagging={tagging.has(group.message.id)}
                    creatingTask={creatingTaskFor === group.message.id}
                    onToggle={() => toggleExpand(group.message.id)}
                    onAiTag={() => handleAiTag(group.message.id)}
                    onSetTags={(tags) =>
                      handleSetTags(group.message.id, tags)
                    }
                    onSetPriority={(p) =>
                      handleSetPriority(group.message.id, p)
                    }
                    onFollowUp={() => handleFollowUp(group.message)}
                  />
                ),
              )
            )}
          </div>
        </>
      )}

      {composing && (
        <MessagesComposer
          projectId={projectId}
          onCreated={(m) => setMessages((rows) => [m, ...rows])}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}

function ThreadGroup({
  messages,
  expandedThreads,
  onToggleThread,
  cardProps,
}: {
  messages: Message[];
  expandedThreads: Set<string>;
  onToggleThread: () => void;
  cardProps: {
    expanded: Set<string>;
    tagging: Set<string>;
    creatingTaskFor: string | null;
    onToggle: (id: string) => void;
    onAiTag: (id: string) => void;
    onSetTags: (id: string, tags: string[]) => void;
    onSetPriority: (id: string, p: Priority) => void;
    onFollowUp: (m: Message) => void;
  };
}) {
  const head = messages[0];
  const rest = messages.slice(1);
  const open = expandedThreads.has(head.id);
  return (
    <div className="rounded-md border border-blue-500/20 bg-blue-500/[.03] p-1">
      <MessageCard
        message={head}
        expanded={cardProps.expanded.has(head.id)}
        tagging={cardProps.tagging.has(head.id)}
        creatingTask={cardProps.creatingTaskFor === head.id}
        onToggle={() => cardProps.onToggle(head.id)}
        onAiTag={() => cardProps.onAiTag(head.id)}
        onSetTags={(tags) => cardProps.onSetTags(head.id, tags)}
        onSetPriority={(p) => cardProps.onSetPriority(head.id, p)}
        onFollowUp={() => cardProps.onFollowUp(head)}
      />
      <button
        type="button"
        onClick={onToggleThread}
        className="ml-7 mt-1 inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300 hover:bg-blue-500/20"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {rest.length} earlier message{rest.length === 1 ? "" : "s"} in this thread
      </button>
      {open && (
        <div className="ml-4 mt-2 space-y-2 border-l border-blue-500/30 pl-3">
          {rest.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              expanded={cardProps.expanded.has(m.id)}
              tagging={cardProps.tagging.has(m.id)}
              creatingTask={cardProps.creatingTaskFor === m.id}
              onToggle={() => cardProps.onToggle(m.id)}
              onAiTag={() => cardProps.onAiTag(m.id)}
              onSetTags={(tags) => cardProps.onSetTags(m.id, tags)}
              onSetPriority={(p) => cardProps.onSetPriority(m.id, p)}
              onFollowUp={() => cardProps.onFollowUp(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  expanded,
  tagging,
  creatingTask,
  onToggle,
  onAiTag,
  onSetTags,
  onSetPriority,
  onFollowUp,
}: {
  message: Message;
  expanded: boolean;
  tagging: boolean;
  creatingTask: boolean;
  onToggle: () => void;
  onAiTag: () => void;
  onSetTags: (tags: string[]) => void;
  onSetPriority: (p: Priority) => void;
  onFollowUp: () => void;
}) {
  const [editing, setEditing] = useState(false);

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

  function removeTag(tag: string) {
    onSetTags(message.tags.filter((t) => t !== tag));
  }

  function addTag(tag: string) {
    if (!message.tags.includes(tag)) {
      onSetTags([...message.tags, tag]);
    }
  }

  const availableToAdd = TAG_OPTIONS.filter(
    (t) => !message.tags.includes(t),
  );

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition hover:border-zinc-700">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 text-zinc-500 hover:text-zinc-200"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
                title="Entry type"
              >
                {ENTRY_TYPE_LABEL[(message.entry_type ?? "email") as EntryType]}
              </span>
              {message.priority && message.priority !== "normal" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${PRIORITY_STYLE[message.priority]}`}
                >
                  <Flag className="h-2.5 w-2.5" />
                  {PRIORITY_LABEL[message.priority]}
                </span>
              )}
              <span className="font-medium text-zinc-100">
                {message.from_name || message.from_email || "Unknown sender"}
              </span>
              {message.from_email && message.from_name && (
                <span className="text-xs text-zinc-500">
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

      {/* Tags row */}
      <div className="ml-7 flex flex-wrap items-center gap-1.5">
        {message.tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-600/10 px-2 py-0.5 text-[11px] text-blue-300"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="text-blue-300/60 hover:text-red-400"
              aria-label={`Remove tag ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!editing && availableToAdd.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-200"
          >
            + tag
          </button>
        )}

        {editing && (
          <select
            autoFocus
            value=""
            onChange={(e) => {
              if (e.target.value) {
                addTag(e.target.value);
              }
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="" disabled>
              Pick a tag…
            </option>
            {availableToAdd.map((t) => (
              <option key={t} value={t} className="bg-zinc-900">
                {t}
              </option>
            ))}
          </select>
        )}

        <select
          value={message.priority ?? "normal"}
          onChange={(e) => onSetPriority(e.target.value as Priority)}
          className="ml-auto rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400 outline-none focus:border-blue-500 [color-scheme:dark]"
          title="Set priority"
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        {message.follow_up_task_id ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            <CheckSquare className="h-3 w-3" />
            Task created
          </span>
        ) : (
          <button
            type="button"
            onClick={onFollowUp}
            disabled={creatingTask}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-50"
            title="Create a Work → Task from this message"
          >
            {creatingTask ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckSquare className="h-3 w-3" />
            )}
            Follow up
          </button>
        )}
        <button
          type="button"
          onClick={onAiTag}
          disabled={tagging}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-50"
          title="Re-tag this message with Claude"
        >
          {tagging ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {message.tags.length === 0 ? "AI tag" : "Re-tag"}
        </button>
      </div>

      {expanded && message.body && (
        <div className="ml-7 mt-2 whitespace-pre-wrap rounded bg-zinc-950 p-3 text-sm text-zinc-300">
          {message.body}
        </div>
      )}
      {expanded && message.attachment_url && (
        <a
          href={message.attachment_url}
          target="_blank"
          rel="noreferrer"
          className="ml-7 mt-2 block w-fit overflow-hidden rounded border border-zinc-800 hover:border-blue-500/50"
        >
          <img
            src={message.attachment_url}
            alt="Attachment"
            className="max-h-72 max-w-full"
          />
        </a>
      )}
    </div>
  );
}
