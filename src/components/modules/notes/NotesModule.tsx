"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  Loader2,
  Mic,
  Plus,
  Search,
  Square,
  StickyNote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  addAttendee,
  convertActionItemToTask,
  createActionItem,
  createMeeting,
  createPendingItem,
  createScratchNote,
  createTeamPadNote,
  deleteActionItem,
  deleteMeeting,
  deletePendingItem,
  deleteScratchNote,
  deleteTeamPadNote,
  fetchActionItems,
  fetchAttendees,
  fetchContactOptions,
  fetchMeetings,
  fetchPendingItems,
  fetchScratchNotes,
  fetchTeamPadNotes,
  removeAttendee,
  updateActionItem,
  updateMeeting,
  updatePendingItem,
  updateScratchNote,
  updateTeamPadNote,
} from "./queries";
import {
  MEETING_STATUS_LABEL,
  MEETING_STATUS_STYLE,
  PENDING_STATUSES,
  PENDING_STATUS_LABEL,
  PENDING_STATUS_STYLE,
  TAGGABLE_MODULES,
  TAGGABLE_MODULE_LABEL,
  fmtDate,
  fmtDateTime,
  type ActionItem,
  type ActionItemPatch,
  type ContactOption,
  type Meeting,
  type MeetingAttendee,
  type MeetingPatch,
  type MeetingStatus,
  type PendingItem,
  type PendingItemPatch,
  type PendingStatus,
  type ScratchNote,
  type ScratchNotePatch,
  type TaggableModule,
  type TeamPadNote,
  type TeamPadNotePatch,
} from "./types";

type Section = "scratch" | "meetings" | "team_pad" | "pending";

export function NotesModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role) || role === "apm";

  const [section, setSection] = useState<Section>("scratch");
  const [scratch, setScratch] = useState<ScratchNote[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [teamPad, setTeamPad] = useState<TeamPadNote[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const [openNote, setOpenNote] = useState<ScratchNote | null>(null);
  const [openPad, setOpenPad] = useState<TeamPadNote | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [s, m, tp, pi, co] = await Promise.all([
          fetchScratchNotes(projectId),
          fetchMeetings(projectId),
          fetchTeamPadNotes(projectId),
          fetchPendingItems(projectId),
          fetchContactOptions(projectId),
        ]);
        if (cancelled) return;
        setScratch(s);
        setMeetings(m);
        setTeamPad(tp);
        setPending(pi);
        setContacts(co);
        const meetingIds = m.map((row) => row.id);
        const [att, ai] = await Promise.all([
          fetchAttendees(meetingIds),
          fetchActionItems(meetingIds),
        ]);
        if (cancelled) return;
        setAttendees(att);
        setActionItems(ai);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ----- Scratch handlers -----

  async function handleAddScratch() {
    try {
      const created = await createScratchNote(projectId);
      setScratch((rows) => [created, ...rows]);
      setOpenNote(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function handleUpdateScratch(id: string, patch: ScratchNotePatch) {
    const prev = scratch;
    setScratch((rows) =>
      rows
        .map((n) =>
          n.id === id
            ? { ...n, ...patch, updated_at: new Date().toISOString() }
            : n,
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    );
    if (openNote?.id === id)
      setOpenNote({ ...openNote, ...patch, updated_at: new Date().toISOString() });
    try {
      await updateScratchNote(id, patch);
    } catch (err) {
      setScratch(prev);
      setError(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  async function handleDeleteScratch(id: string) {
    if (!window.confirm("Delete this note?")) return;
    const prev = scratch;
    setScratch((rows) => rows.filter((n) => n.id !== id));
    if (openNote?.id === id) setOpenNote(null);
    try {
      await deleteScratchNote(id);
    } catch (err) {
      setScratch(prev);
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  // ----- Meeting handlers -----

  async function handleAddMeeting() {
    try {
      const created = await createMeeting(projectId);
      setMeetings((rows) => [created, ...rows]);
      // Auto-include current open pending items as the meeting's leading body
      const openItems = pending.filter((p) => p.status === "open");
      if (openItems.length > 0) {
        const header =
          "Pending Items (carried in):\n" +
          openItems.map((p) => `• ${p.description ?? ""}`).join("\n") +
          "\n\n";
        try {
          await updateMeeting(created.id, {
            notes_body: header,
          });
          setMeetings((rows) =>
            rows.map((m) =>
              m.id === created.id ? { ...m, notes_body: header } : m,
            ),
          );
          created.notes_body = header;
        } catch {
          /* non-fatal */
        }
      }
      setOpenMeeting(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add meeting");
    }
  }

  async function handleUpdateMeeting(id: string, patch: MeetingPatch) {
    const prev = meetings;
    setMeetings((rows) =>
      rows.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    if (openMeeting?.id === id) setOpenMeeting({ ...openMeeting, ...patch });
    try {
      await updateMeeting(id, patch);
    } catch (err) {
      setMeetings(prev);
      setError(err instanceof Error ? err.message : "Failed to save meeting");
    }
  }

  async function handleDeleteMeeting(id: string) {
    if (!window.confirm("Delete this meeting?")) return;
    const prev = meetings;
    setMeetings((rows) => rows.filter((m) => m.id !== id));
    setAttendees((rows) => rows.filter((a) => a.meeting_id !== id));
    setActionItems((rows) => rows.filter((a) => a.meeting_id !== id));
    if (openMeeting?.id === id) setOpenMeeting(null);
    try {
      await deleteMeeting(id);
    } catch (err) {
      setMeetings(prev);
      setError(err instanceof Error ? err.message : "Failed to delete meeting");
    }
  }

  async function handleAddAttendee(
    meetingId: string,
    contactId: string | null,
    name: string | null,
  ) {
    try {
      const created = await addAttendee(meetingId, contactId, name);
      setAttendees((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add attendee");
    }
  }

  async function handleRemoveAttendee(id: string) {
    const prev = attendees;
    setAttendees((rows) => rows.filter((a) => a.id !== id));
    try {
      await removeAttendee(id);
    } catch (err) {
      setAttendees(prev);
      setError(err instanceof Error ? err.message : "Failed to remove attendee");
    }
  }

  async function handleAddActionItem(meetingId: string) {
    try {
      const created = await createActionItem(meetingId);
      setActionItems((rows) => [...rows, created]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add action item",
      );
    }
  }

  async function handleUpdateActionItem(id: string, patch: ActionItemPatch) {
    const prev = actionItems;
    setActionItems((rows) =>
      rows.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    try {
      await updateActionItem(id, patch);
    } catch (err) {
      setActionItems(prev);
      setError(
        err instanceof Error ? err.message : "Failed to save action item",
      );
    }
  }

  async function handleDeleteActionItem(id: string) {
    const prev = actionItems;
    setActionItems((rows) => rows.filter((a) => a.id !== id));
    try {
      await deleteActionItem(id);
    } catch (err) {
      setActionItems(prev);
      setError(
        err instanceof Error ? err.message : "Failed to delete action item",
      );
    }
  }

  async function handleConvertToTask(item: ActionItem) {
    const contact = item.assigned_to
      ? contacts.find((c) => c.id === item.assigned_to)
      : null;
    try {
      const taskId = await convertActionItemToTask(
        projectId,
        item,
        contact?.name ?? null,
      );
      setActionItems((rows) =>
        rows.map((a) =>
          a.id === item.id
            ? { ...a, converted_to_task: true, task_id: taskId }
            : a,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to convert to task",
      );
    }
  }

  // ----- Team Pad handlers -----

  async function handleAddTeamPad() {
    try {
      const created = await createTeamPadNote(projectId);
      setTeamPad((rows) => [created, ...rows]);
      setOpenPad(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add pad");
    }
  }

  async function handleUpdateTeamPad(
    id: string,
    patch: TeamPadNotePatch,
  ) {
    const prev = teamPad;
    setTeamPad((rows) =>
      rows
        .map((n) =>
          n.id === id
            ? { ...n, ...patch, updated_at: new Date().toISOString() }
            : n,
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    );
    if (openPad?.id === id)
      setOpenPad({ ...openPad, ...patch, updated_at: new Date().toISOString() });
    try {
      await updateTeamPadNote(id, patch);
    } catch (err) {
      setTeamPad(prev);
      setError(err instanceof Error ? err.message : "Failed to save pad");
    }
  }

  async function handleDeleteTeamPad(id: string) {
    if (!window.confirm("Delete this shared pad? This affects everyone."))
      return;
    const prev = teamPad;
    setTeamPad((rows) => rows.filter((n) => n.id !== id));
    if (openPad?.id === id) setOpenPad(null);
    try {
      await deleteTeamPadNote(id);
    } catch (err) {
      setTeamPad(prev);
      setError(err instanceof Error ? err.message : "Failed to delete pad");
    }
  }

  // ----- Pending items handlers -----

  async function handleAddPending() {
    try {
      const created = await createPendingItem(projectId);
      setPending((rows) => [created, ...rows]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function handleUpdatePending(id: string, patch: PendingItemPatch) {
    const prev = pending;
    setPending((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    try {
      await updatePendingItem(id, patch);
    } catch (err) {
      setPending(prev);
      setError(err instanceof Error ? err.message : "Failed to save item");
    }
  }

  async function handleResolvePending(id: string, resolved: boolean) {
    const patch: PendingItemPatch = resolved
      ? { status: "resolved", resolved_at: new Date().toISOString() }
      : { status: "open", resolved_at: null };
    await handleUpdatePending(id, patch);
  }

  async function handleDeletePending(id: string) {
    if (!window.confirm("Delete this item?")) return;
    const prev = pending;
    setPending((rows) => rows.filter((p) => p.id !== id));
    try {
      await deletePendingItem(id);
    } catch (err) {
      setPending(prev);
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <StickyNote className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Notes</h1>
      </div>

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["scratch", `Scratch Pad (${scratch.length})`],
            ["meetings", `Meeting Notes (${meetings.length})`],
            ["team_pad", `Team Pad (${teamPad.length})`],
            ["pending", `Pending Items (${pending.filter((p) => p.status === "open").length})`],
          ] as const
        ).map(([key, label]) => {
          const active = key === section;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
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

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit notes.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && section === "scratch" && (
        <ScratchSection
          notes={scratch}
          editable={editable}
          onAdd={handleAddScratch}
          onOpen={setOpenNote}
        />
      )}

      {!loading && !error && section === "meetings" && (
        <MeetingsSection
          meetings={meetings}
          attendees={attendees}
          actionItems={actionItems}
          editable={editable}
          onAdd={handleAddMeeting}
          onOpen={setOpenMeeting}
        />
      )}

      {!loading && !error && section === "team_pad" && (
        <TeamPadSection
          notes={teamPad}
          editable={editable}
          onAdd={handleAddTeamPad}
          onOpen={setOpenPad}
        />
      )}

      {!loading && !error && section === "pending" && (
        <PendingSection
          pending={pending}
          meetings={meetings}
          contacts={contacts}
          editable={editable}
          onAdd={handleAddPending}
          onUpdate={handleUpdatePending}
          onResolve={handleResolvePending}
          onDelete={handleDeletePending}
        />
      )}

      {openNote && (
        <ScratchNoteModal
          note={openNote}
          editable={editable}
          onClose={() => setOpenNote(null)}
          onUpdate={handleUpdateScratch}
          onDelete={handleDeleteScratch}
        />
      )}

      {openPad && (
        <TeamPadModal
          note={openPad}
          editable={editable}
          onClose={() => setOpenPad(null)}
          onUpdate={handleUpdateTeamPad}
          onDelete={handleDeleteTeamPad}
        />
      )}

      {openMeeting && (
        <MeetingModal
          meeting={openMeeting}
          attendees={attendees.filter((a) => a.meeting_id === openMeeting.id)}
          actionItems={actionItems.filter(
            (a) => a.meeting_id === openMeeting.id,
          )}
          contacts={contacts}
          editable={editable}
          onClose={() => setOpenMeeting(null)}
          onUpdate={handleUpdateMeeting}
          onDelete={handleDeleteMeeting}
          onAddAttendee={handleAddAttendee}
          onRemoveAttendee={handleRemoveAttendee}
          onAddActionItem={handleAddActionItem}
          onUpdateActionItem={handleUpdateActionItem}
          onDeleteActionItem={handleDeleteActionItem}
          onConvertToTask={handleConvertToTask}
        />
      )}
    </div>
  );
}

// ---------- Scratch Section ----------

function ScratchSection({
  notes,
  editable,
  onAdd,
  onOpen,
}: {
  notes: ScratchNote[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onOpen: (n: ScratchNote) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.title ?? "", n.body ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [notes, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your notes…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-zinc-600">
          Private to you (auth coming with v2)
        </span>
        {editable && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            New note
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No notes yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(n)}
              className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 text-sm font-medium text-zinc-100">
                  {n.title || "Untitled"}
                </h3>
                {n.tagged_module && (
                  <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-300">
                    {TAGGABLE_MODULE_LABEL[n.tagged_module as TaggableModule] ??
                      n.tagged_module}
                  </span>
                )}
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-xs text-zinc-400">
                {n.body || "(empty)"}
              </p>
              <span className="mt-auto text-[10px] text-zinc-600">
                Updated {fmtDateTime(n.updated_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScratchNoteModal({
  note,
  editable,
  onClose,
  onUpdate,
  onDelete,
}: {
  note: ScratchNote;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: ScratchNotePatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <Modal title="Note" icon={StickyNote} onClose={onClose}>
      <Field label="Title" wide>
        <input
          type="text"
          defaultValue={note.title ?? ""}
          disabled={!editable}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (note.title ?? ""))
              onUpdate(note.id, { title: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>
      <Field label="Body (markdown supported)" wide>
        <textarea
          defaultValue={note.body ?? ""}
          disabled={!editable}
          rows={12}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (note.body ?? "")) onUpdate(note.id, { body: v });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tag to module">
          <select
            value={note.tagged_module ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(note.id, {
                tagged_module: e.target.value === "" ? null : e.target.value,
                tagged_record_id: null,
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="">— None —</option>
            {TAGGABLE_MODULES.map((m) => (
              <option key={m} value={m}>
                {TAGGABLE_MODULE_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Record ID (optional)">
          <input
            type="text"
            defaultValue={note.tagged_record_id ?? ""}
            disabled={!editable || !note.tagged_module}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (note.tagged_record_id ?? ""))
                onUpdate(note.id, { tagged_record_id: v || null });
            }}
            placeholder="UUID of the record"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>
      </div>
      <p className="text-[11px] text-zinc-600">
        Tagged notes will surface inside the referenced module record once
        those modules are wired to read scratch_notes — data is captured now.
      </p>
      <div className="mt-2 flex justify-end border-t border-zinc-800 pt-3">
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(note.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete note
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Meetings Section ----------

function MeetingsSection({
  meetings,
  attendees,
  actionItems,
  editable,
  onAdd,
  onOpen,
}: {
  meetings: Meeting[];
  attendees: MeetingAttendee[];
  actionItems: ActionItem[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onOpen: (m: Meeting) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          One record per meeting. Type, dictate, or upload a recording.
        </p>
        {editable && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            New meeting
          </button>
        )}
      </div>
      {meetings.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No meetings yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => {
            const att = attendees.filter((a) => a.meeting_id === m.id).length;
            const ai = actionItems.filter((a) => a.meeting_id === m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpen(m)}
                  className="flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <CalendarDays className="h-4 w-4 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-100">
                      {m.meeting_name || "Untitled meeting"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
                      <span>{fmtDate(m.date)}</span>
                      {m.location && <span>{m.location}</span>}
                      <span>{att} attendee{att === 1 ? "" : "s"}</span>
                      <span>{ai.length} action item{ai.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${MEETING_STATUS_STYLE[m.status]}`}
                  >
                    {MEETING_STATUS_LABEL[m.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MeetingModal({
  meeting,
  attendees,
  actionItems,
  contacts,
  editable,
  onClose,
  onUpdate,
  onDelete,
  onAddAttendee,
  onRemoveAttendee,
  onAddActionItem,
  onUpdateActionItem,
  onDeleteActionItem,
  onConvertToTask,
}: {
  meeting: Meeting;
  attendees: MeetingAttendee[];
  actionItems: ActionItem[];
  contacts: ContactOption[];
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: MeetingPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddAttendee: (
    meetingId: string,
    contactId: string | null,
    name: string | null,
  ) => Promise<void>;
  onRemoveAttendee: (id: string) => Promise<void>;
  onAddActionItem: (meetingId: string) => Promise<void>;
  onUpdateActionItem: (id: string, patch: ActionItemPatch) => Promise<void>;
  onDeleteActionItem: (id: string) => Promise<void>;
  onConvertToTask: (item: ActionItem) => Promise<void>;
}) {
  return (
    <Modal title="Meeting" icon={CalendarDays} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meeting name" wide>
          <input
            type="text"
            defaultValue={meeting.meeting_name ?? ""}
            disabled={!editable}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (meeting.meeting_name ?? ""))
                onUpdate(meeting.id, { meeting_name: v || null });
            }}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={meeting.date ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(meeting.id, {
                date: e.target.value === "" ? null : e.target.value,
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          />
        </Field>
        <Field label="Location / virtual">
          <input
            type="text"
            defaultValue={meeting.location ?? ""}
            disabled={!editable}
            placeholder="On site / Zoom / Teams…"
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (meeting.location ?? ""))
                onUpdate(meeting.id, { location: v || null });
            }}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
        </Field>
        <Field label="Status">
          <select
            value={meeting.status}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(meeting.id, { status: e.target.value as MeetingStatus })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>
      </div>

      <AttendeeEditor
        meetingId={meeting.id}
        attendees={attendees}
        contacts={contacts}
        editable={editable}
        onAdd={onAddAttendee}
        onRemove={onRemoveAttendee}
      />

      <NotesBodyEditor
        meeting={meeting}
        editable={editable}
        onUpdate={onUpdate}
      />

      <ActionItemsEditor
        meetingId={meeting.id}
        items={actionItems}
        contacts={contacts}
        editable={editable}
        onAdd={onAddActionItem}
        onUpdate={onUpdateActionItem}
        onDelete={onDeleteActionItem}
        onConvertToTask={onConvertToTask}
      />

      <div className="mt-2 flex justify-between border-t border-zinc-800 pt-3">
        <p className="text-[11px] text-zinc-600">
          Generate the formal Meeting Minutes from the Reports module.
        </p>
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(meeting.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete meeting
          </button>
        )}
      </div>
    </Modal>
  );
}

function AttendeeEditor({
  meetingId,
  attendees,
  contacts,
  editable,
  onAdd,
  onRemove,
}: {
  meetingId: string;
  attendees: MeetingAttendee[];
  contacts: ContactOption[];
  editable: boolean;
  onAdd: (
    meetingId: string,
    contactId: string | null,
    name: string | null,
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [picker, setPicker] = useState("");
  const [adHoc, setAdHoc] = useState("");

  function nameFor(a: MeetingAttendee): string {
    if (a.contact_id) {
      const c = contacts.find((co) => co.id === a.contact_id);
      return c?.name ?? "(unknown contact)";
    }
    return a.name ?? "Ad hoc";
  }

  const usedContactIds = new Set(
    attendees.map((a) => a.contact_id).filter(Boolean) as string[],
  );

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Attendees</h3>
      </div>
      {attendees.length === 0 ? (
        <p className="text-xs text-zinc-500">No attendees yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {attendees.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-xs"
            >
              <span className="text-zinc-200">{nameFor(a)}</span>
              {!a.contact_id && (
                <span className="rounded bg-amber-500/10 px-1 text-[10px] uppercase tracking-wider text-amber-300">
                  Ad hoc
                </span>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => onRemove(a.id)}
                  className="text-zinc-500 hover:text-red-400"
                  aria-label="Remove attendee"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          >
            <option value="">Add from contacts…</option>
            {contacts
              .filter((c) => !usedContactIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!picker}
            onClick={async () => {
              await onAdd(meetingId, picker, null);
              setPicker("");
            }}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
          >
            Add
          </button>
          <span className="text-xs text-zinc-600">or</span>
          <input
            type="text"
            value={adHoc}
            onChange={(e) => setAdHoc(e.target.value)}
            placeholder="Ad hoc name"
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!adHoc.trim()}
            onClick={async () => {
              await onAdd(meetingId, null, adHoc.trim());
              setAdHoc("");
            }}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function NotesBodyEditor({
  meeting,
  editable,
  onUpdate,
}: {
  meeting: Meeting;
  editable: boolean;
  onUpdate: (id: string, patch: MeetingPatch) => Promise<void>;
}) {
  const [body, setBody] = useState(meeting.notes_body ?? "");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  // Web Speech API types are not in the default TS DOM lib, so we use `any`
  // and feature-check at call time.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setBody(meeting.notes_body ?? "");
  }, [meeting.id, meeting.notes_body]);

  function commit() {
    if (body !== (meeting.notes_body ?? ""))
      onUpdate(meeting.id, { notes_body: body });
  }

  function startSpeechRecognition() {
    setTranscribeErr(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setTranscribeErr(
        "Speech recognition is not supported in this browser. Try Chrome or Safari.",
      );
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          chunk += event.results[i][0].transcript + " ";
      }
      if (chunk) {
        setBody((prev) => (prev ? prev + " " + chunk.trim() : chunk.trim()));
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      setTranscribeErr(`Speech error: ${e?.error ?? "unknown"}`);
      setRecording(false);
    };
    recognition.onend = () => {
      setRecording(false);
      onUpdate(meeting.id, { notes_body: bodyRef.current });
    };
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function stopSpeechRecognition() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  // Keep a ref to the latest body so onend can persist
  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  async function handleUpload(file: File) {
    setTranscribing(true);
    setTranscribeErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/notes/transcribe", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Transcription failed: ${res.status}`);
      }
      const j = (await res.json()) as { text: string };
      const next = (body ? body + "\n\n" : "") + j.text;
      setBody(next);
      onUpdate(meeting.id, { notes_body: next });
    } catch (err) {
      setTranscribeErr(
        err instanceof Error ? err.message : "Transcription failed",
      );
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-200">Notes</h3>
        {editable && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={
                recording ? stopSpeechRecognition : startSpeechRecognition
              }
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                recording
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              {recording ? "Stop dictation" : "Dictate"}
            </button>
            <label
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                transcribing
                  ? "cursor-wait border-zinc-800 bg-zinc-900 text-zinc-500"
                  : "cursor-pointer border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              {transcribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload recording
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                disabled={transcribing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>
      <textarea
        value={body}
        disabled={!editable}
        onChange={(e) => setBody(e.target.value)}
        onBlur={commit}
        rows={12}
        placeholder="Type, dictate, or upload a recording…"
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
      />
      {transcribeErr && (
        <p className="text-xs text-red-400">{transcribeErr}</p>
      )}
    </div>
  );
}

function ActionItemsEditor({
  meetingId,
  items,
  contacts,
  editable,
  onAdd,
  onUpdate,
  onDelete,
  onConvertToTask,
}: {
  meetingId: string;
  items: ActionItem[];
  contacts: ContactOption[];
  editable: boolean;
  onAdd: (meetingId: string) => Promise<void>;
  onUpdate: (id: string, patch: ActionItemPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConvertToTask: (item: ActionItem) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Action items</h3>
        {editable && (
          <button
            type="button"
            onClick={() => onAdd(meetingId)}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">No action items yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-2"
            >
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  defaultValue={it.description ?? ""}
                  disabled={!editable}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (it.description ?? ""))
                      onUpdate(it.id, { description: v });
                  }}
                  placeholder="Action item"
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {editable && (
                  <button
                    type="button"
                    onClick={() => onDelete(it.id)}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                    aria-label="Delete action item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={it.assigned_to ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    onUpdate(it.id, {
                      assigned_to: e.target.value === "" ? null : e.target.value,
                    })
                  }
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                >
                  <option value="">— Unassigned —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={it.due_date ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    onUpdate(it.id, {
                      due_date:
                        e.target.value === "" ? null : e.target.value,
                    })
                  }
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
                />
                {it.converted_to_task ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                    <CheckSquare className="h-3 w-3" />
                    Task created
                  </span>
                ) : (
                  editable && (
                    <button
                      type="button"
                      onClick={() => onConvertToTask(it)}
                      disabled={!it.description?.trim()}
                      className="ml-auto rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
                    >
                      Convert to Task
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Team Pad Section ----------

function TeamPadSection({
  notes,
  editable,
  onAdd,
  onOpen,
}: {
  notes: TeamPadNote[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onOpen: (n: TeamPadNote) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.title ?? "", n.body ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [notes, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shared pads…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-zinc-600">
          Visible to the whole team — last write wins (real-time sync coming
          later)
        </span>
        {editable && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            New pad
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No shared pads yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(n)}
              className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <h3 className="line-clamp-1 text-sm font-medium text-zinc-100">
                {n.title || "Untitled"}
              </h3>
              <p className="line-clamp-4 whitespace-pre-wrap text-xs text-zinc-400">
                {n.body || "(empty)"}
              </p>
              <span className="mt-auto text-[10px] text-zinc-600">
                Updated {fmtDateTime(n.updated_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamPadModal({
  note,
  editable,
  onClose,
  onUpdate,
  onDelete,
}: {
  note: TeamPadNote;
  editable: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: TeamPadNotePatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <Modal title="Team Pad" icon={StickyNote} onClose={onClose}>
      <Field label="Title" wide>
        <input
          type="text"
          defaultValue={note.title ?? ""}
          disabled={!editable}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (note.title ?? ""))
              onUpdate(note.id, { title: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>
      <Field label="Body (markdown supported, shared with team)" wide>
        <textarea
          defaultValue={note.body ?? ""}
          disabled={!editable}
          rows={14}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (note.body ?? "")) onUpdate(note.id, { body: v });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>
      <p className="text-[11px] text-zinc-600">
        Last updated {fmtDateTime(note.updated_at)}. Last-write-wins for now —
        real-time multi-cursor sync lands in a follow-up.
      </p>
      <div className="mt-2 flex justify-end border-t border-zinc-800 pt-3">
        {editable && (
          <button
            type="button"
            onClick={() => {
              onDelete(note.id);
              onClose();
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Delete pad
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Pending Section ----------

function PendingSection({
  pending,
  meetings,
  contacts,
  editable,
  onAdd,
  onUpdate,
  onResolve,
  onDelete,
}: {
  pending: PendingItem[];
  meetings: Meeting[];
  contacts: ContactOption[];
  editable: boolean;
  onAdd: () => Promise<void>;
  onUpdate: (id: string, patch: PendingItemPatch) => Promise<void>;
  onResolve: (id: string, resolved: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<PendingStatus | "all">(
    "all",
  );
  const [meetingFilter, setMeetingFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pending.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (meetingFilter !== "all" && p.meeting_id !== meetingFilter)
        return false;
      if (q && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pending, statusFilter, meetingFilter, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PendingStatus | "all")
          }
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All statuses</option>
          {PENDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PENDING_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={meetingFilter}
          onChange={(e) => setMeetingFilter(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All meetings</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.meeting_name || "Untitled"}
            </option>
          ))}
        </select>
        {editable && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add item
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          No pending items matching the current filters.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => {
            const raisedBy = p.raised_by
              ? contacts.find((c) => c.id === p.raised_by)
              : null;
            const meeting = p.meeting_id
              ? meetings.find((m) => m.id === p.meeting_id)
              : null;
            return (
              <li
                key={p.id}
                className={`flex items-start gap-3 rounded-md border bg-zinc-900/40 p-3 ${
                  p.status === "deferred"
                    ? "border-zinc-800 opacity-70"
                    : "border-zinc-800"
                }`}
              >
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() =>
                    onResolve(p.id, p.status !== "resolved")
                  }
                  className={`mt-0.5 rounded p-1 ${
                    editable ? "hover:bg-zinc-800" : "opacity-60"
                  }`}
                  aria-label={p.status === "resolved" ? "Reopen" : "Resolve"}
                >
                  {p.status === "resolved" ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4 text-zinc-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    defaultValue={p.description ?? ""}
                    disabled={!editable}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (p.description ?? ""))
                        onUpdate(p.id, { description: v });
                    }}
                    placeholder="Pending item"
                    className={`w-full bg-transparent text-sm outline-none ${
                      p.status === "resolved"
                        ? "text-zinc-500 line-through"
                        : "text-zinc-200"
                    }`}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    <span>Raised: {fmtDate(p.created_at.slice(0, 10))}</span>
                    {raisedBy && <span>By {raisedBy.name}</span>}
                    {meeting && <span>From {meeting.meeting_name}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={p.status}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdate(p.id, { status: e.target.value as PendingStatus })
                    }
                    className={`rounded-full border px-2 py-0.5 text-[11px] outline-none [color-scheme:dark] ${PENDING_STATUS_STYLE[p.status]}`}
                  >
                    {PENDING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PENDING_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={p.raised_by ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onUpdate(p.id, {
                        raised_by: e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                  >
                    <option value="">Raised by…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Delete item"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Reusable bits ----------

function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: typeof StickyNote;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
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
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-[11px] uppercase tracking-wider text-zinc-500 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

