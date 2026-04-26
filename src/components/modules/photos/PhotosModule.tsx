"use client";

import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Search } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import { Uploader } from "./Uploader";
import { Gallery, PhotoModal } from "./Gallery";
import {
  deletePhoto,
  fetchPhotos,
  updatePhoto,
  type PhotoPatch,
} from "./queries";
import type { GroupMode, Photo } from "./types";

const GROUPS: { key: GroupMode; label: string }[] = [
  { key: "date", label: "By date" },
  { key: "room", label: "By room" },
  { key: "stage", label: "By stage" },
  { key: "none", label: "Ungrouped" },
];

export function PhotosModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupMode>("date");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchPhotos(projectId);
        if (cancelled) return;
        setPhotos(rows);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load photos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) for (const t of p.tags) set.add(t);
    return Array.from(set).sort();
  }, [photos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (activeTags.size > 0) {
        for (const t of activeTags) if (!p.tags.includes(t)) return false;
      }
      if (q) {
        const haystack = `${p.ai_description ?? ""} ${p.notes ?? ""} ${p.tags.join(" ")} ${p.room ?? ""} ${p.stage ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [photos, search, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleUploaded(photo: Photo) {
    setPhotos((rows) => [photo, ...rows]);
  }

  async function handleUpdate(id: string, patch: PhotoPatch) {
    const prev = photos;
    setPhotos((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    if (selected && selected.id === id) {
      setSelected({ ...selected, ...patch });
    }
    try {
      await updatePhoto(id, patch);
    } catch (err) {
      setPhotos(prev);
      setError(err instanceof Error ? err.message : "Failed to save photo");
    }
  }

  async function handleDelete(photo: Photo) {
    const prev = photos;
    setPhotos((rows) => rows.filter((p) => p.id !== photo.id));
    try {
      await deletePhoto(photo.id, photo.storage_path);
    } catch (err) {
      setPhotos(prev);
      setError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ImageIcon className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Photos</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot upload or edit photos.
        </p>
      )}

      <Uploader
        projectId={projectId}
        editable={editable}
        onUploaded={handleUploaded}
      />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
              {GROUPS.map((g) => {
                const active = g.key === group;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroup(g.key)}
                    className={`rounded px-3 py-1 transition ${
                      active
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, tags, notes…"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const active = activeTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                      active
                        ? "border-blue-500/40 bg-blue-600/15 text-blue-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTags.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTags(new Set())}
                  className="text-xs text-zinc-500 hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <Gallery
            photos={filtered}
            group={group}
            editable={editable}
            onSelect={setSelected}
          />

          {selected && (
            <PhotoModal
              photo={selected}
              editable={editable}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </>
      )}
    </div>
  );
}
