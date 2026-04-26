"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  GripHorizontal,
  Minimize2,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import {
  createScratchNote,
  createTeamPadNote,
  deleteScratchNote,
  deleteTeamPadNote,
  fetchScratchNotes,
  fetchTeamPadNotes,
  updateScratchNote,
  updateTeamPadNote,
} from "@/components/modules/notes/queries";
import {
  fmtDateTime,
  type ScratchNote,
  type TeamPadNote,
} from "@/components/modules/notes/types";

// ---------- Context ----------

export type FloatingTab = "scratch" | "team_pad";

type FloatingNotesContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Open the notes window AND immediately request the OS-level PiP
   *  popout. Falls back to the in-browser draggable window if the
   *  Document Picture-in-Picture API isn't supported. */
  openInPiP: () => void;
  pendingPopOut: boolean;
  consumePendingPopOut: () => void;
  activeTab: FloatingTab;
  setActiveTab: (tab: FloatingTab) => void;
  activeNoteId: string | null;
  openNote: (tab: FloatingTab, id: string) => void;
};

const FloatingNotesContext = createContext<FloatingNotesContextValue | null>(
  null,
);

export function useFloatingNotes(): FloatingNotesContextValue {
  const ctx = useContext(FloatingNotesContext);
  if (!ctx)
    throw new Error("useFloatingNotes must be used inside FloatingNotesProvider");
  return ctx;
}

const STATE_KEY = "bcm-floating-notes-v1";

type PersistedState = {
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen: boolean;
  activeTab: FloatingTab;
};

function loadState(): PersistedState {
  if (typeof window === "undefined") {
    return defaultState();
  }
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : defaultState().x,
      y: typeof parsed.y === "number" ? parsed.y : defaultState().y,
      width: typeof parsed.width === "number" ? parsed.width : 420,
      height: typeof parsed.height === "number" ? parsed.height : 480,
      isOpen: parsed.isOpen === true,
      activeTab: parsed.activeTab === "team_pad" ? "team_pad" : "scratch",
    };
  } catch {
    return defaultState();
  }
}

function defaultState(): PersistedState {
  return {
    x: 80,
    y: 80,
    width: 420,
    height: 480,
    isOpen: false,
    activeTab: "scratch",
  };
}

// ---------- Provider ----------

export function FloatingNotesProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  // Window position + size + open
  const [persisted, setPersisted] = useState<PersistedState>(defaultState);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pendingPopOut, setPendingPopOut] = useState(false);

  useEffect(() => {
    setPersisted(loadState());
  }, []);

  // Persist position/size/open/tab to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(persisted));
    } catch {
      /* ignore */
    }
  }, [persisted]);

  const open = useCallback(
    () => setPersisted((s) => ({ ...s, isOpen: true })),
    [],
  );
  const close = useCallback(
    () => setPersisted((s) => ({ ...s, isOpen: false })),
    [],
  );
  const toggle = useCallback(
    () => setPersisted((s) => ({ ...s, isOpen: !s.isOpen })),
    [],
  );
  const setActiveTab = useCallback(
    (tab: FloatingTab) => setPersisted((s) => ({ ...s, activeTab: tab })),
    [],
  );

  const openNote = useCallback(
    (tab: FloatingTab, id: string) => {
      setPersisted((s) => ({ ...s, isOpen: true, activeTab: tab }));
      setActiveNoteId(id);
    },
    [],
  );

  const openInPiP = useCallback(() => {
    setPersisted((s) => ({ ...s, isOpen: true }));
    setPendingPopOut(true);
  }, []);

  const consumePendingPopOut = useCallback(() => {
    setPendingPopOut(false);
  }, []);

  const ctx = useMemo<FloatingNotesContextValue>(
    () => ({
      isOpen: persisted.isOpen,
      open,
      close,
      toggle,
      openInPiP,
      pendingPopOut,
      consumePendingPopOut,
      activeTab: persisted.activeTab,
      setActiveTab,
      activeNoteId,
      openNote,
    }),
    [
      persisted.isOpen,
      persisted.activeTab,
      activeNoteId,
      open,
      close,
      toggle,
      openInPiP,
      pendingPopOut,
      consumePendingPopOut,
      setActiveTab,
      openNote,
    ],
  );

  return (
    <FloatingNotesContext.Provider value={ctx}>
      {children}
      <FloatingNotesWindow
        projectId={projectId}
        persisted={persisted}
        setPersisted={setPersisted}
        activeNoteId={activeNoteId}
        setActiveNoteId={setActiveNoteId}
      />
      <FloatingNotesFab />
    </FloatingNotesContext.Provider>
  );
}

// ---------- FAB ----------

function FloatingNotesFab() {
  const { isOpen, close, openInPiP } = useFloatingNotes();
  function handleClick() {
    if (isOpen) {
      close();
    } else {
      // Try to pop out into a real OS-level window. If unsupported, the
      // window component falls back to the in-browser draggable panel.
      openInPiP();
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      title={isOpen ? "Hide notes" : "Open notes"}
      className={`fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition ${
        isOpen
          ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
      }`}
      aria-label="Open notes"
    >
      <StickyNote className="h-5 w-5" />
    </button>
  );
}

// ---------- Window ----------

const MIN_WIDTH = 320;
const MIN_HEIGHT = 280;

function FloatingNotesWindow({
  projectId,
  persisted,
  setPersisted,
  activeNoteId,
  setActiveNoteId,
}: {
  projectId: string;
  persisted: PersistedState;
  setPersisted: React.Dispatch<React.SetStateAction<PersistedState>>;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
}) {
  const { activeTab, setActiveTab, close, isOpen, pendingPopOut, consumePendingPopOut } =
    useFloatingNotes();

  const [scratch, setScratch] = useState<ScratchNote[]>([]);
  const [teamPad, setTeamPad] = useState<TeamPadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notes when project or window opens
  useEffect(() => {
    if (!isOpen || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchScratchNotes(projectId), fetchTeamPadNotes(projectId)])
      .then(([s, t]) => {
        if (cancelled) return;
        setScratch(s);
        setTeamPad(t);
        // If no active note for the current tab, auto-select most recent
        if (!activeNoteId) {
          const list = persisted.activeTab === "team_pad" ? t : s;
          if (list.length > 0) setActiveNoteId(list[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, persisted.activeTab, activeNoteId, setActiveNoteId]);

  // Drag
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragOffset.current) {
        const { dx, dy } = dragOffset.current;
        const x = clamp(e.clientX - dx, 0, window.innerWidth - 100);
        const y = clamp(e.clientY - dy, 0, window.innerHeight - 40);
        setPersisted((s) => ({ ...s, x, y }));
      } else if (resizeStart.current) {
        const r = resizeStart.current;
        const w = Math.max(MIN_WIDTH, r.startW + (e.clientX - r.startX));
        const h = Math.max(MIN_HEIGHT, r.startH + (e.clientY - r.startY));
        setPersisted((s) => ({
          ...s,
          width: Math.min(w, window.innerWidth - s.x),
          height: Math.min(h, window.innerHeight - s.y),
        }));
      }
    }
    function onUp() {
      dragOffset.current = null;
      resizeStart.current = null;
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [setPersisted]);

  function startDrag(e: React.MouseEvent) {
    dragOffset.current = {
      dx: e.clientX - persisted.x,
      dy: e.clientY - persisted.y,
    };
    document.body.style.userSelect = "none";
  }

  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    resizeStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: persisted.width,
      startH: persisted.height,
    };
    document.body.style.userSelect = "none";
  }

  // ----- Note actions -----

  async function handleNew() {
    try {
      if (activeTab === "scratch") {
        const created = await createScratchNote(projectId);
        setScratch((rows) => [created, ...rows]);
        setActiveNoteId(created.id);
      } else {
        const created = await createTeamPadNote(projectId);
        setTeamPad((rows) => [created, ...rows]);
        setActiveNoteId(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    }
  }

  async function handleUpdateScratch(
    id: string,
    patch: { title?: string | null; body?: string | null },
  ) {
    setScratch((rows) =>
      rows.map((n) =>
        n.id === id
          ? { ...n, ...patch, updated_at: new Date().toISOString() }
          : n,
      ),
    );
    try {
      await updateScratchNote(id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleUpdateTeamPad(
    id: string,
    patch: { title?: string | null; body?: string | null },
  ) {
    setTeamPad((rows) =>
      rows.map((n) =>
        n.id === id
          ? { ...n, ...patch, updated_at: new Date().toISOString() }
          : n,
      ),
    );
    try {
      await updateTeamPadNote(id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    try {
      if (activeTab === "scratch") {
        setScratch((rows) => rows.filter((n) => n.id !== id));
        if (activeNoteId === id) setActiveNoteId(null);
        await deleteScratchNote(id);
      } else {
        setTeamPad((rows) => rows.filter((n) => n.id !== id));
        if (activeNoteId === id) setActiveNoteId(null);
        await deleteTeamPadNote(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // ----- Picture-in-Picture (popped-out OS window) -----

  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipSupported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window as any).documentPictureInPicture;

  async function popOut() {
    if (!pipSupported) {
      window.alert(
        "Pop-out requires Chrome or Edge 116+. Your browser doesn't support the Document Picture-in-Picture API.",
      );
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dpip = (window as any).documentPictureInPicture;
      const w: Window = await dpip.requestWindow({
        width: persisted.width,
        height: persisted.height,
      });
      // Copy stylesheets so Tailwind classes work in the popped window.
      copyStylesIntoWindow(w);
      // Match the dashboard dark theme.
      w.document.documentElement.classList.add("dark");
      w.document.body.style.margin = "0";
      w.document.body.style.background = "#09090b"; // zinc-950
      w.document.body.style.color = "#f4f4f5"; // zinc-100
      w.document.body.style.fontFamily =
        getComputedStyle(document.body).fontFamily;
      w.document.title = "Notes";
      // When the OS-level window is dismissed, fully close the notes
      // surface — don't fall back to the in-browser draggable panel.
      w.addEventListener(
        "pagehide",
        () => {
          setPipWindow(null);
          close();
        },
        { once: true },
      );
      setPipWindow(w);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pop-out failed");
    }
  }

  function popIn() {
    if (pipWindow && !pipWindow.closed) pipWindow.close();
    setPipWindow(null);
  }

  // The FAB sets pendingPopOut to request the OS-level window. Honour it as
  // soon as we render (must be inside a user-gesture-derived stack — React
  // batches the setState from FAB synchronously into this render).
  useEffect(() => {
    if (!pendingPopOut) return;
    if (pipWindow) {
      consumePendingPopOut();
      return;
    }
    if (!pipSupported) {
      // Silently fall through to the in-browser draggable window.
      consumePendingPopOut();
      return;
    }
    consumePendingPopOut();
    void popOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPopOut, pipWindow, pipSupported]);

  if (!isOpen && !pipWindow) return null;

  const list = activeTab === "scratch" ? scratch : teamPad;
  const active = list.find((n) => n.id === activeNoteId) ?? null;

  const popped = !!pipWindow;

  const titleBar = (
    <div
      onMouseDown={popped ? undefined : startDrag}
      className={`flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2 select-none ${
        popped ? "" : "cursor-move rounded-t-lg"
      }`}
    >
      {!popped && <GripHorizontal className="h-4 w-4 text-zinc-600" />}
      <StickyNote className="h-4 w-4 text-blue-400" />
      <span className="text-sm font-medium text-zinc-100">Notes</span>
      <div className="ml-3 inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(["scratch", "team_pad"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setActiveTab(tab);
              setActiveNoteId(null);
            }}
            className={`rounded px-2 py-0.5 text-xs transition ${
              activeTab === tab
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab === "scratch" ? "Scratch" : "Team Pad"}
          </button>
        ))}
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleNew}
        title="New note"
        className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400"
      >
        <Plus className="h-4 w-4" />
      </button>
      {popped ? (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={popIn}
          title="Bring back into the dashboard"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={popOut}
          disabled={!pipSupported}
          title={
            pipSupported
              ? "Pop out as a separate window"
              : "Pop-out needs Chrome or Edge 116+"
          }
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 disabled:opacity-40"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}
      {!popped && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={close}
          title="Close"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const picker = (
    <div className="shrink-0 border-b border-zinc-800 px-3 py-1.5">
      {list.length === 0 ? (
        <div className="text-xs text-zinc-500">
          No notes yet — click + to create one.
        </div>
      ) : (
        <select
          value={activeNoteId ?? ""}
          onChange={(e) =>
            setActiveNoteId(e.target.value === "" ? null : e.target.value)
          }
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="">Pick a note…</option>
          {list.map((n) => (
            <option key={n.id} value={n.id}>
              {(n.title || "Untitled").slice(0, 60)}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const editorArea = (
    <div className="flex min-h-0 flex-1 flex-col">
      {loading && !active && (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
          Loading…
        </div>
      )}
      {error && (
        <div className="px-3 py-2 text-xs text-red-400">{error}</div>
      )}
      {active && (
        <NoteEditor
          key={active.id}
          note={active}
          onTitle={(v) =>
            activeTab === "scratch"
              ? handleUpdateScratch(active.id, { title: v || null })
              : handleUpdateTeamPad(active.id, { title: v || null })
          }
          onBody={(v) =>
            activeTab === "scratch"
              ? handleUpdateScratch(active.id, { body: v })
              : handleUpdateTeamPad(active.id, { body: v })
          }
          onDelete={() => handleDelete(active.id)}
        />
      )}
      {!active && !loading && list.length > 0 && (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
          Pick a note above, or click + to create one.
        </div>
      )}
      {!active && !loading && list.length === 0 && (
        <button
          type="button"
          onClick={handleNew}
          className="m-3 rounded-md border border-dashed border-zinc-700 bg-zinc-950/60 px-3 py-6 text-sm text-zinc-400 transition hover:border-blue-500 hover:text-blue-400"
        >
          <Plus className="mx-auto h-4 w-4" />
          <span className="mt-1 block">Start a new note</span>
        </button>
      )}
    </div>
  );

  if (popped && pipWindow) {
    return createPortal(
      <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
        {titleBar}
        {picker}
        {editorArea}
      </div>,
      pipWindow.document.body,
    );
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Notes window"
      className="fixed z-40 flex flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
      style={{
        left: persisted.x,
        top: persisted.y,
        width: persisted.width,
        height: persisted.height,
      }}
    >
      {titleBar}
      {picker}
      {editorArea}
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-br-lg bg-zinc-700 hover:bg-blue-500"
        style={{
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
        aria-label="Resize"
      />
    </div>
  );
}

function NoteEditor({
  note,
  onTitle,
  onBody,
  onDelete,
}: {
  note: ScratchNote | TeamPadNote;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body ?? "");

  useEffect(() => {
    setTitle(note.title ?? "");
    setBody(note.body ?? "");
  }, [note.id]);

  const titleSavedRef = useRef(note.title ?? "");
  const bodySavedRef = useRef(note.body ?? "");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
      <input
        type="text"
        value={title}
        placeholder="Title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== titleSavedRef.current) {
            titleSavedRef.current = title;
            onTitle(title);
          }
        }}
        className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-base font-medium text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-800 focus:bg-zinc-950"
      />
      <textarea
        value={body}
        placeholder="Start writing…"
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (body !== bodySavedRef.current) {
            bodySavedRef.current = body;
            onBody(body);
          }
        }}
        className="min-h-0 flex-1 resize-none rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <span>Updated {fmtDateTime(note.updated_at)}</span>
        <button
          type="button"
          onClick={onDelete}
          title="Delete note"
          className="flex items-center gap-1 rounded p-1 hover:bg-zinc-800 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function copyStylesIntoWindow(target: Window): void {
  const heads = Array.from(
    document.head.querySelectorAll('link[rel="stylesheet"], style'),
  );
  for (const node of heads) {
    target.document.head.appendChild(node.cloneNode(true));
  }
  // Mirror future-injected stylesheets (Next.js dev) so styles stay in sync.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (
          n instanceof HTMLElement &&
          (n.tagName === "STYLE" ||
            (n.tagName === "LINK" && n.getAttribute("rel") === "stylesheet"))
        ) {
          target.document.head.appendChild(n.cloneNode(true));
        }
      });
    }
  });
  observer.observe(document.head, { childList: true });
  target.addEventListener("pagehide", () => observer.disconnect(), {
    once: true,
  });
}
