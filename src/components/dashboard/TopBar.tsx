"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Inbox,
  Loader2,
  MapPin,
  Moon,
  Search,
  ScrollText,
  Settings,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export type Project = {
  id: string;
  name: string;
  address: string;
};

type Props = {
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (id: string) => void;
  onOpenSettings?: () => void;
};

export function TopBar({
  projects,
  activeProjectId,
  onProjectChange,
  onOpenSettings,
}: Props) {
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [light, setLight] = useState(false);
  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    setLight(document.documentElement.classList.contains("bcm-light"));
  }, []);

  function toggleTheme() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.classList.add("bcm-light");
    else document.documentElement.classList.remove("bcm-light");
    try {
      localStorage.setItem("bcm-theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="bcm-topbar flex h-14 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-6">
      {logoFailed ? (
        <div className="text-sm font-bold tracking-widest text-zinc-300">
          BCM
        </div>
      ) : (
        <Image
          src="/bcm-logo.png"
          alt="Bruno Clay Construction & Management"
          width={180}
          height={40}
          priority
          onError={() => setLogoFailed(true)}
          className="h-9 w-auto object-contain"
        />
      )}
      <div className="mx-6 h-6 w-px bg-zinc-800" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 rounded-md px-3 py-1.5 transition hover:bg-zinc-800/60"
        >
          <MapPin className="h-4 w-4 text-zinc-500" />
          <div className="text-left">
            <div className="text-xs text-zinc-500">{active.name}</div>
            <div className="text-sm font-medium text-zinc-100">
              {active.address}
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-full z-20 mt-1 w-96 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
              {projects.map((p) => {
                const isActive = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onProjectChange(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-zinc-800 ${
                      isActive ? "bg-zinc-800/50" : ""
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500">{p.name}</div>
                      <div className="truncate text-sm text-zinc-100">
                        {p.address}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch projectId={active.id} />
        <NotificationsBell projectId={active.id} />
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
          aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
          title={light ? "Switch to dark mode" : "Switch to light mode"}
        >
          {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

// ---------- Module key → icon + color (matches Calendar) ----------

type ModuleKey =
  | "tasks"
  | "contacts"
  | "messages"
  | "plans"
  | "permits"
  | "notes"
  | "billing"
  | "estimating"
  | "schedule"
  | "photos"
  | "paperwork";

const MODULE_META: Record<
  ModuleKey,
  { label: string; icon: typeof Bell; dot: string; text: string }
> = {
  tasks: {
    label: "Tasks",
    icon: ClipboardList,
    dot: "bg-orange-400",
    text: "text-orange-300",
  },
  contacts: {
    label: "Contacts",
    icon: Users,
    dot: "bg-blue-400",
    text: "text-blue-300",
  },
  messages: {
    label: "Messages",
    icon: Inbox,
    dot: "bg-violet-400",
    text: "text-violet-300",
  },
  plans: {
    label: "Plans",
    icon: FileText,
    dot: "bg-yellow-400",
    text: "text-yellow-300",
  },
  permits: {
    label: "Permits",
    icon: ScrollText,
    dot: "bg-red-400",
    text: "text-red-300",
  },
  notes: {
    label: "Notes",
    icon: FileText,
    dot: "bg-violet-400",
    text: "text-violet-300",
  },
  billing: {
    label: "Billing",
    icon: Wallet,
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  estimating: {
    label: "Estimating",
    icon: Wallet,
    dot: "bg-teal-400",
    text: "text-teal-300",
  },
  schedule: {
    label: "Schedule",
    icon: CalendarDays,
    dot: "bg-blue-400",
    text: "text-blue-300",
  },
  photos: {
    label: "Photos",
    icon: ImageIcon,
    dot: "bg-pink-400",
    text: "text-pink-300",
  },
  paperwork: {
    label: "Paperwork",
    icon: FileText,
    dot: "bg-zinc-400",
    text: "text-zinc-300",
  },
};

function navigateTo(moduleKey: ModuleKey, recordId?: string): void {
  if (recordId) {
    try {
      sessionStorage.setItem(
        "bcm-navigate-target",
        JSON.stringify({ moduleKey, recordId, ts: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(
    new CustomEvent("bcm-navigate", {
      detail: { moduleKey, recordId },
    }),
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------- Global Search ----------

type SearchResult = {
  id: string;
  moduleKey: ModuleKey;
  title: string;
  snippet: string;
};

function GlobalSearch({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const out = await runSearch(projectId, q);
      setResults(out);
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, projectId]);

  const grouped = useMemo(() => {
    const map = new Map<ModuleKey, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.moduleKey) ?? [];
      arr.push(r);
      map.set(r.moduleKey, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        aria-label="Search"
        title="Search"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across the project…"
          className="w-72 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Dropdown */}
      {(query.trim().length >= 2 || loading) && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-20 mt-1 max-h-[70vh] w-[28rem] overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching…
              </div>
            )}
            {!loading && searched && results.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                No matches for &quot;{query.trim()}&quot;.
              </div>
            )}
            {!loading &&
              grouped.map(([key, items]) => {
                const meta = MODULE_META[key];
                const Icon = meta.icon;
                return (
                  <div
                    key={key}
                    className="border-b border-zinc-800/60 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                      <span className="ml-auto">{items.length}</span>
                    </div>
                    {items.map((r) => (
                      <button
                        key={`${r.moduleKey}-${r.id}`}
                        type="button"
                        onClick={() => {
                          navigateTo(r.moduleKey, r.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-zinc-800/60"
                      >
                        <Icon className={`mt-0.5 h-4 w-4 ${meta.text}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-zinc-100">
                            {r.title}
                          </div>
                          {r.snippet && (
                            <div className="truncate text-[11px] text-zinc-500">
                              {r.snippet}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

async function runSearch(
  projectId: string,
  q: string,
): Promise<SearchResult[]> {
  const like = `%${q}%`;
  const PER = 5;
  const out: SearchResult[] = [];

  async function safe<T>(p: PromiseLike<T>): Promise<T | null> {
    try {
      return await p;
    } catch {
      return null;
    }
  }

  const [
    tasksRes,
    contactsRes,
    messagesRes,
    rfisRes,
    submittalsRes,
    permitsRes,
    meetingsRes,
    drawingsRes,
  ] = await Promise.all([
    safe(
      supabase
        .from("tasks")
        .select("id, title, description, status")
        .eq("project_id", projectId)
        .ilike("title", like)
        .limit(PER),
    ),
    safe(
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email, role_type")
        .eq("project_id", projectId)
        .or(`first_name.ilike.${like},last_name.ilike.${like}`)
        .limit(PER),
    ),
    safe(
      supabase
        .from("messages")
        .select("id, subject, body, from_name, from_email")
        .eq("project_id", projectId)
        .or(`subject.ilike.${like},body.ilike.${like}`)
        .limit(PER),
    ),
    safe(
      supabase
        .from("rfis")
        .select("id, rfi_number, question, status")
        .eq("project_id", projectId)
        .ilike("question", like)
        .limit(PER),
    ),
    safe(
      supabase
        .from("submittals")
        .select("id, submittal_number, description, status")
        .eq("project_id", projectId)
        .ilike("description", like)
        .limit(PER),
    ),
    safe(
      supabase
        .from("permits")
        .select("id, permit_number, jurisdiction, permit_type, status")
        .eq("project_id", projectId)
        .or(`permit_number.ilike.${like},jurisdiction.ilike.${like}`)
        .limit(PER),
    ),
    safe(
      supabase
        .from("meetings")
        .select("id, meeting_name, date, location")
        .eq("project_id", projectId)
        .ilike("meeting_name", like)
        .limit(PER),
    ),
    safe(
      supabase
        .from("drawings")
        .select("id, title, drawing_number, type")
        .eq("project_id", projectId)
        .ilike("title", like)
        .limit(PER),
    ),
  ]);

  if (tasksRes?.data) {
    for (const t of tasksRes.data) {
      out.push({
        id: t.id as string,
        moduleKey: "tasks",
        title: (t.title as string) ?? "Untitled task",
        snippet: ((t.description as string | null) ?? "").slice(0, 80),
      });
    }
  }
  if (contactsRes?.data) {
    for (const c of contactsRes.data) {
      const name = `${(c.first_name as string) ?? ""} ${(c.last_name as string) ?? ""}`.trim();
      out.push({
        id: c.id as string,
        moduleKey: "contacts",
        title: name || ((c.email as string) ?? "Contact"),
        snippet:
          (c.role_type as string | null) ?? (c.email as string | null) ?? "",
      });
    }
  }
  if (messagesRes?.data) {
    for (const m of messagesRes.data) {
      out.push({
        id: m.id as string,
        moduleKey: "messages",
        title: (m.subject as string) ?? "(no subject)",
        snippet: (
          (m.from_name as string | null) ??
          (m.from_email as string | null) ??
          ""
        ).concat(
          ((m.body as string | null) ?? "")
            ? ` · ${((m.body as string) ?? "").slice(0, 60)}`
            : "",
        ),
      });
    }
  }
  if (rfisRes?.data) {
    for (const r of rfisRes.data) {
      out.push({
        id: r.id as string,
        moduleKey: "plans",
        title: `RFI #${(r.rfi_number as string) ?? "?"}`,
        snippet: ((r.question as string | null) ?? "").slice(0, 80),
      });
    }
  }
  if (submittalsRes?.data) {
    for (const s of submittalsRes.data) {
      out.push({
        id: s.id as string,
        moduleKey: "plans",
        title: `Submittal ${(s.submittal_number as string) ?? "?"}`,
        snippet: ((s.description as string | null) ?? "").slice(0, 80),
      });
    }
  }
  if (permitsRes?.data) {
    for (const p of permitsRes.data) {
      out.push({
        id: p.id as string,
        moduleKey: "permits",
        title: `${(p.permit_type as string | null) ?? "Permit"} · ${(p.permit_number as string | null) ?? "(no number)"}`,
        snippet: (p.jurisdiction as string | null) ?? "",
      });
    }
  }
  if (meetingsRes?.data) {
    for (const m of meetingsRes.data) {
      out.push({
        id: m.id as string,
        moduleKey: "notes",
        title: (m.meeting_name as string) ?? "Meeting",
        snippet:
          (m.date as string | null) ??
          (m.location as string | null) ??
          "",
      });
    }
  }
  if (drawingsRes?.data) {
    for (const d of drawingsRes.data) {
      out.push({
        id: d.id as string,
        moduleKey: "plans",
        title: (d.title as string) ?? "Drawing",
        snippet:
          ((d.drawing_number as string | null) ?? "") +
          ((d.type as string | null) ? ` · ${d.type}` : ""),
      });
    }
  }

  return out;
}

// ---------- Notifications Bell ----------

type Alert = {
  id: string;
  project_id: string;
  module_key: string;
  event_type: string;
  message: string;
  created_at: string;
  read: boolean;
};

function NotificationsBell({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("alerts")
        .select("id, project_id, module_key, event_type, message, created_at, read")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("read", false),
    ]);
    setAlerts((rows ?? []) as Alert[]);
    setUnread(count ?? 0);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh every 60s while bell is closed
  useEffect(() => {
    if (open) return;
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [open, refresh]);

  async function markAllRead() {
    const ids = alerts.filter((a) => !a.read).map((a) => a.id);
    if (ids.length === 0) return;
    setAlerts((rows) => rows.map((a) => ({ ...a, read: true })));
    setUnread(0);
    await supabase
      .from("alerts")
      .update({ read: true })
      .in("id", ids);
  }

  async function markOneAndNavigate(a: Alert) {
    if (!a.read) {
      setAlerts((rows) =>
        rows.map((x) => (x.id === a.id ? { ...x, read: true } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
      await supabase
        .from("alerts")
        .update({ read: true })
        .eq("id", a.id);
    }
    const moduleKey = mapAlertModule(a.module_key);
    if (moduleKey) navigateTo(moduleKey);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-20 mt-1 max-h-[70vh] w-96 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Notifications {unread > 0 && `(${unread})`}
              </span>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
              >
                Mark all read
              </button>
            </div>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            )}
            {!loading && alerts.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">
                No notifications. Alerts from inspections, materials, plans,
                and schedule will surface here.
              </div>
            )}
            {!loading &&
              alerts.map((a) => {
                const mk = mapAlertModule(a.module_key);
                const meta = mk ? MODULE_META[mk] : null;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => markOneAndNavigate(a)}
                    className={`flex w-full items-start gap-2 border-b border-zinc-800/60 px-3 py-2 text-left transition hover:bg-zinc-800/60 ${
                      a.read ? "opacity-60" : ""
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        meta?.dot ?? "bg-zinc-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                        <span>{meta?.label ?? a.module_key}</span>
                        <span>·</span>
                        <span>{a.event_type.replaceAll("_", " ")}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-zinc-200">
                        {a.message}
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-500">
                        {timeAgo(a.created_at)}
                      </div>
                    </div>
                    {!a.read && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

function mapAlertModule(moduleKey: string): ModuleKey | null {
  switch (moduleKey) {
    case "tasks":
      return "tasks";
    case "schedule":
      return "schedule";
    case "permits":
      return "permits";
    case "plans":
      return "plans";
    case "billing":
      return "billing";
    case "notes":
      return "notes";
    case "messages":
      return "messages";
    case "estimating":
      return "estimating";
    case "contacts":
      return "contacts";
    case "photos":
      return "photos";
    default:
      return null;
  }
}
