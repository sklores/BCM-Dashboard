"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Mail,
  PhoneCall,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import {
  createManualMessage,
  ocrScreenshot,
  uploadMessageAttachment,
} from "./queries";
import {
  ENTRY_TYPE_LABEL,
  PRIORITY_LABEL,
  type EntryType,
  type Message,
  type Priority,
} from "./types";

const ENTRY_OPTIONS: {
  key: Exclude<EntryType, "email">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "call", label: "Call log", icon: PhoneCall },
  { key: "field_note", label: "Field note", icon: StickyNote },
  { key: "text_screenshot", label: "Text screenshot", icon: ImageIcon },
];

export function MessagesComposer({
  projectId,
  onCreated,
  onClose,
}: {
  projectId: string;
  onCreated: (m: Message) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<Exclude<EntryType, "email">>("call");
  const [priority, setPriority] = useState<Priority>("normal");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "uploading" | "ocr" | "saving">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(f: File) {
    setError(null);
    setBusy("uploading");
    try {
      const { url } = await uploadMessageAttachment(projectId, f);
      setUploadedUrl(url);
      // For text screenshots, immediately OCR the result into the body.
      if (type === "text_screenshot") {
        setBusy("ocr");
        try {
          const text = await ocrScreenshot(url);
          setBody((prev) => (prev ? `${prev}\n\n${text}` : text));
        } catch (err) {
          setError(err instanceof Error ? err.message : "OCR failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy("idle");
    }
  }

  async function handleSave() {
    setError(null);
    setBusy("saving");
    try {
      const created = await createManualMessage(projectId, {
        entry_type: type,
        subject:
          subject.trim() ||
          (type === "call"
            ? `Call with ${fromName || "contact"}`
            : type === "field_note"
              ? "Field note"
              : "Text screenshot"),
        body: body || null,
        from_name: fromName || null,
        from_email: fromEmail || null,
        priority,
        attachment_url: uploadedUrl,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy("idle");
    }
  }

  const showAttachment = type === "field_note" || type === "text_screenshot";
  const attachmentRequired = type === "text_screenshot";
  const canSave =
    busy === "idle" &&
    (type !== "text_screenshot" || !!uploadedUrl) &&
    (body.trim() !== "" || subject.trim() !== "" || !!uploadedUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-10"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            New message entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {ENTRY_OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = type === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setType(o.key)}
                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition ${
                  active
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-500">
          <Mail className="h-3 w-3" />
          Inbound emails arrive automatically — use this for{" "}
          {ENTRY_TYPE_LABEL[type].toLowerCase()}s.
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label={
                type === "call"
                  ? "Caller name"
                  : type === "field_note"
                    ? "Author"
                    : "From"
              }
              value={fromName}
              onChange={setFromName}
            />
            <Input
              label={type === "call" ? "Phone" : "Email"}
              value={fromEmail}
              onChange={setFromEmail}
              type={type === "call" ? "tel" : "email"}
            />
          </div>

          <Input
            label={
              type === "call"
                ? "Topic"
                : type === "field_note"
                  ? "Title"
                  : "Subject"
            }
            value={subject}
            onChange={setSubject}
          />

          {showAttachment && (
            <label className="block text-xs">
              <span className="mb-1 block uppercase tracking-wider text-zinc-500">
                {attachmentRequired
                  ? "Screenshot image *"
                  : "Photo (optional)"}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={busy === "uploading" || busy === "ocr"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    void handleUpload(f);
                  }
                }}
                className="block w-full text-xs text-zinc-300 file:mr-2 file:rounded file:border file:border-zinc-800 file:bg-zinc-900 file:px-2 file:py-1 file:text-xs file:text-zinc-200 hover:file:border-blue-500/50"
              />
              {(busy === "uploading" || busy === "ocr") && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {busy === "ocr"
                    ? "Reading text from screenshot…"
                    : "Uploading…"}
                </span>
              )}
              {uploadedUrl && busy === "idle" && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  {file?.name ?? "image"} attached
                </span>
              )}
            </label>
          )}

          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              {type === "call"
                ? "Call summary"
                : type === "field_note"
                  ? "Note"
                  : "Transcribed text"}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder={
                type === "call"
                  ? "Who you spoke to, what was discussed, next steps…"
                  : type === "field_note"
                    ? "What you saw / want to remember from the field…"
                    : "Transcribed automatically from the screenshot — edit if needed."
              }
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500">
              Priority
            </span>
            <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
              {(["normal", "high", "urgent"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded px-2 py-0.5 text-[11px] transition ${
                    priority === p
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
          >
            {busy === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
            Save entry
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}
