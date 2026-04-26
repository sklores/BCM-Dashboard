"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import exifr from "exifr";
import { insertPhoto, uploadPhotoBlob } from "./queries";

const uuidv4 = () => crypto.randomUUID();
import type { Photo, PhotoAnalysis } from "./types";

type Status = "queued" | "uploading" | "analyzing" | "saving" | "done" | "error";

type UploadJob = {
  id: string;
  file: File;
  status: Status;
  message?: string;
};

async function analyzeWithClaude(url: string): Promise<PhotoAnalysis | null> {
  const res = await fetch("/api/photos/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `analyze failed: ${res.status}`);
  }
  return (await res.json()) as PhotoAnalysis;
}

async function extractTakenAt(file: File): Promise<string | null> {
  try {
    // Array shorthand: only pull these tags. Avoids strict-typed Options shape.
    const exif = await exifr.parse(file, ["DateTimeOriginal"]);
    const d = exif?.DateTimeOriginal as Date | string | undefined;
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
    if (typeof d === "string") {
      const parsed = new Date(d);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  } catch {
    // no exif — fall through
  }
  if (file.lastModified) return new Date(file.lastModified).toISOString();
  return null;
}

export function Uploader({
  projectId,
  editable,
  onUploaded,
}: {
  projectId: string;
  editable: boolean;
  onUploaded: (photo: Photo) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function patch(jobId: string, p: Partial<UploadJob>) {
    setJobs((rows) => rows.map((j) => (j.id === jobId ? { ...j, ...p } : j)));
  }

  async function handleFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    const newJobs: UploadJob[] = images.map((file) => ({
      id: uuidv4(),
      file,
      status: "queued",
    }));
    setJobs((rows) => [...rows, ...newJobs]);

    for (const job of newJobs) {
      try {
        patch(job.id, { status: "uploading" });
        const photoId = uuidv4();
        const { path, url } = await uploadPhotoBlob(
          projectId,
          job.file,
          photoId,
        );

        patch(job.id, { status: "analyzing" });
        const takenAt = await extractTakenAt(job.file);
        let analysis: PhotoAnalysis | null = null;
        try {
          analysis = await analyzeWithClaude(url);
        } catch (err) {
          patch(job.id, {
            message: `AI tagging failed: ${err instanceof Error ? err.message : "unknown"} — saving without tags`,
          });
        }

        patch(job.id, { status: "saving" });
        const created = await insertPhoto({
          id: photoId,
          project_id: projectId,
          storage_path: path,
          storage_url: url,
          taken_at: takenAt,
          tags: analysis?.tags ?? [],
          room: analysis?.room ?? null,
          stage: analysis?.stage ?? null,
          ai_description: analysis?.description ?? null,
        });

        patch(job.id, { status: "done" });
        onUploaded(created);
      } catch (err) {
        patch(job.id, {
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    // Auto-clear successful jobs after a moment so the UI doesn't pile up
    setTimeout(() => {
      setJobs((rows) => rows.filter((j) => j.status !== "done"));
    }, 1500);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!editable) return;
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }

  if (!editable) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 text-sm transition ${
          dragOver
            ? "border-blue-500 bg-blue-500/5 text-blue-300"
            : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        }`}
      >
        <Upload className="h-6 w-6" />
        <span>Drop a folder of photos or click to choose files</span>
        <span className="text-xs text-zinc-600">
          Each photo is uploaded, tagged with Claude vision, and added below
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          // @ts-expect-error - webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            handleFiles(files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <div className="flex flex-col gap-1 text-xs">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5"
            >
              {job.status !== "done" && job.status !== "error" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              )}
              <span className="flex-1 truncate text-zinc-300">{job.file.name}</span>
              <span
                className={`text-[11px] uppercase tracking-wider ${
                  job.status === "error"
                    ? "text-red-400"
                    : job.status === "done"
                      ? "text-emerald-400"
                      : "text-zinc-500"
                }`}
              >
                {job.status}
              </span>
              {job.message && (
                <span className="text-zinc-500">· {job.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
