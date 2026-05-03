"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileDown,
  Globe,
  ImagePlus,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createMaterial,
  deleteMaterial,
  deleteMaterialPhoto,
  fetchMaterialPhotos,
  fetchMaterials,
  syncDeliveryDelayAlerts,
  updateMaterial,
  uploadMaterialPhoto,
  type MaterialPatch,
} from "./queries";
import {
  DETAILED_STATUSES,
  DETAILED_STATUS_LABEL,
  DETAILED_STATUS_STYLE,
  isMaterialDelayed,
  type DetailedStatus,
  type Material,
  type MaterialPhoto,
} from "./types";

type Section = "catalog" | "detailed" | "finish";

type ImportedFields = {
  product_name: string | null;
  manufacturer: string | null;
  supplier: string | null;
  sku: string | null;
  price: number | null;
  lead_time: string | null;
  notes: string | null;
  dimensions: string | null;
  qty: number | null;
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function importedToPatch(
  fields: ImportedFields,
  sourceUrl?: string,
): Partial<MaterialPatch> {
  return {
    product_name: fields.product_name ?? "New material",
    manufacturer: fields.manufacturer,
    supplier: fields.supplier,
    sku: fields.sku,
    price: fields.price,
    lead_time: fields.lead_time,
    notes: fields.notes,
    dimensions: fields.dimensions,
    qty: fields.qty,
    source_url: sourceUrl ?? null,
  };
}

export function MaterialsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [section, setSection] = useState<Section>("catalog");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [photos, setPhotos] = useState<MaterialPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import controls
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const fresh = await fetchMaterials(projectId);
        if (cancelled) return;
        const rows = await syncDeliveryDelayAlerts(projectId, fresh);
        if (cancelled) return;
        setMaterials(rows);
        const photoRows = await fetchMaterialPhotos(rows.map((r) => r.id));
        if (cancelled) return;
        setPhotos(photoRows);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load materials",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleUpdate(id: string, patch: MaterialPatch) {
    const prev = materials;
    setMaterials((rows) =>
      rows.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    try {
      await updateMaterial(id, patch);
    } catch (err) {
      setMaterials(prev);
      setError(err instanceof Error ? err.message : "Failed to save material");
    }
  }

  async function handleAdd() {
    try {
      const created = await createMaterial(projectId);
      setMaterials((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add material");
    }
  }

  async function importViaApi(
    payload:
      | { url: string }
      | { fileBase64: string; mimeType: string },
  ): Promise<ImportedFields> {
    const res = await fetch("/api/materials/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.error || `Import failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as ImportedFields;
  }

  async function handleImportUrl() {
    const url = urlValue.trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const parsed = await importViaApi({ url });
      const created = await createMaterial(
        projectId,
        importedToPatch(parsed, url),
      );
      setMaterials((rows) => [...rows, created]);
      setUrlValue("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportFiles(files: File[]) {
    const supported = files.filter(
      (f) =>
        f.type === "application/pdf" || f.type.startsWith("image/"),
    );
    if (supported.length === 0) {
      setImportError("Drop a PDF or image file (spec sheet or product photo).");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      for (const file of supported) {
        const fileBase64 = await fileToBase64(file);
        const parsed = await importViaApi({ fileBase64, mimeType: file.type });
        const created = await createMaterial(
          projectId,
          importedToPatch(parsed),
        );
        setMaterials((rows) => [...rows, created]);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!editable) return;
    const files = Array.from(e.dataTransfer.files);
    handleImportFiles(files);
  }

  async function handleDelete(id: string) {
    const prev = materials;
    setMaterials((rows) => rows.filter((m) => m.id !== id));
    try {
      await deleteMaterial(id);
    } catch (err) {
      setMaterials(prev);
      setError(
        err instanceof Error ? err.message : "Failed to delete material",
      );
    }
  }

  async function handleAddPhoto(materialId: string, file: File) {
    try {
      const existing = photos.filter((p) => p.material_id === materialId);
      const nextOrder = existing.length;
      const created = await uploadMaterialPhoto(materialId, file, nextOrder);
      setPhotos((rows) => [...rows, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    }
  }

  async function handleDeletePhoto(photo: MaterialPhoto) {
    const prev = photos;
    setPhotos((rows) => rows.filter((p) => p.id !== photo.id));
    try {
      await deleteMaterialPhoto(photo.id, photo.storage_path);
    } catch (err) {
      setPhotos(prev);
      setError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Materials</h1>
      </div>

      <div className="inline-flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {(
          [
            ["catalog", "Catalog"],
            ["detailed", "Detailed List"],
            ["finish", "Finish Schedule"],
          ] as const
        ).map(([key, label]) => {
          const active = key === section;
          const count =
            key === "finish"
              ? materials.filter((m) => m.is_finish).length
              : materials.length;
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
              {label} ({count})
            </button>
          );
        })}
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit materials.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && section === "catalog" && (
        <>
          <p className="text-sm text-zinc-400">
            Catalog for this project. Pricing lives here; Schedule task cards
            link to entries via material_id.
          </p>

          {editable && (
            <div className="flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 text-sm transition ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/5 text-blue-300"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {importing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                <span>
                  Drop a spec sheet (PDF) or product photo — Claude will read
                  it and add a material entry
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    handleImportFiles(files);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-zinc-500" />
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImportUrl();
                  }}
                  placeholder="…or paste a product URL"
                  disabled={importing}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleImportUrl}
                  disabled={importing || urlValue.trim() === ""}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Import
                </button>
              </div>

              {importError && (
                <p className="text-xs text-red-400">{importError}</p>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Manufacturer</th>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Lead time</th>
                  <th className="w-20 px-3 py-2 font-medium">Finish</th>
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-zinc-500">
                      No materials yet.
                    </td>
                  </tr>
                )}
                {materials.map((m) => (
                  <tr
                    key={m.id}
                    className="group border-b border-zinc-900 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <EditableText
                        value={m.product_name}
                        editable={editable}
                        onCommit={(v) =>
                          handleUpdate(m.id, { product_name: v })
                        }
                        className="text-zinc-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={m.manufacturer ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(m.id, { manufacturer: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={m.supplier ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(m.id, { supplier: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={m.sku ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(m.id, { sku: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PriceCell
                        value={m.price}
                        editable={editable}
                        onCommit={(v) => handleUpdate(m.id, { price: v })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableText
                        value={m.lead_time ?? ""}
                        editable={editable}
                        placeholder="—"
                        onCommit={(v) =>
                          handleUpdate(m.id, { lead_time: v || null })
                        }
                        className="text-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={m.is_finish}
                        disabled={!editable}
                        onChange={(e) =>
                          handleUpdate(m.id, { is_finish: e.target.checked })
                        }
                        className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed [color-scheme:dark]"
                        aria-label="Include in finish schedule"
                      />
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      {editable && (
                        <RowDeleteButton
                          label="Delete material"
                          onClick={() => handleDelete(m.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-fit items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Plus className="h-4 w-4" />
              Add material
            </button>
          )}
        </>
      )}

      {!loading && !error && section === "detailed" && (
        <DetailedListSection
          materials={materials}
          photos={photos}
          editable={editable}
          onUpdate={handleUpdate}
        />
      )}

      {!loading && !error && section === "finish" && (
        <FinishScheduleSection
          materials={materials.filter((m) => m.is_finish)}
          photos={photos}
          editable={editable}
          onUpdate={handleUpdate}
          onUncheck={(id) => handleUpdate(id, { is_finish: false })}
          onAddPhoto={handleAddPhoto}
          onDeletePhoto={handleDeletePhoto}
        />
      )}
    </div>
  );
}

function DetailedListSection({
  materials,
  photos,
  editable,
  onUpdate,
}: {
  materials: Material[];
  photos: MaterialPhoto[];
  editable: boolean;
  onUpdate: (id: string, patch: MaterialPatch) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<DetailedStatus | "all">(
    "all",
  );

  const counts = DETAILED_STATUSES.reduce(
    (acc, s) => {
      acc[s] = materials.filter((m) => m.status === s).length;
      return acc;
    },
    {} as Record<DetailedStatus, number>,
  );

  const filtered = statusFilter === "all"
    ? materials
    : materials.filter((m) => m.status === statusFilter);

  function photoCount(id: string): number {
    return photos.filter((p) => p.material_id === id).length;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-full border px-2 py-0.5 text-xs transition ${
            statusFilter === "all"
              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
          }`}
        >
          All ({materials.length})
        </button>
        {DETAILED_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              statusFilter === s
                ? DETAILED_STATUS_STYLE[s]
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {DETAILED_STATUS_LABEL[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {materials.length === 0
            ? "No materials yet — add some in the Catalog tab or via URL/PDF import."
            : "No materials match this filter."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="w-32 px-3 py-2 font-medium">Status</th>
                <th className="w-36 px-3 py-2 font-medium">Expected delivery</th>
                <th className="px-3 py-2 font-medium">Dimensions</th>
                <th className="w-20 px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="w-20 px-3 py-2 font-medium">Photos</th>
                <th className="w-20 px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-zinc-900 hover:bg-zinc-900/40"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-zinc-100">{m.product_name}</div>
                        {m.manufacturer && (
                          <div className="text-[11px] text-zinc-500">
                            {m.manufacturer}
                          </div>
                        )}
                      </div>
                      {isMaterialDelayed(m) && (
                        <span
                          className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300"
                          title="Past expected delivery date"
                        >
                          Delayed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.status}
                      disabled={!editable}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          status: e.target.value as DetailedStatus,
                          // Clear the alerted flag when status reaches a
                          // non-delayed state so a future re-delay re-alerts.
                          delivery_delay_alerted_at:
                            e.target.value === "delivered" ||
                            e.target.value === "installed"
                              ? null
                              : m.delivery_delay_alerted_at,
                        })
                      }
                      className={`rounded-full border px-2 py-0.5 text-[11px] outline-none [color-scheme:dark] ${DETAILED_STATUS_STYLE[m.status]}`}
                    >
                      {DETAILED_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {DETAILED_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={m.expected_delivery_date ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          expected_delivery_date: e.target.value || null,
                          delivery_delay_alerted_at: null,
                        })
                      }
                      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EditableText
                      value={m.dimensions ?? ""}
                      editable={editable}
                      placeholder="—"
                      onCommit={(v) =>
                        onUpdate(m.id, { dimensions: v || null })
                      }
                      className="text-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <NumberCell
                      value={m.qty}
                      editable={editable}
                      onCommit={(v) => onUpdate(m.id, { qty: v })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EditableText
                      value={m.supplier ?? ""}
                      editable={editable}
                      placeholder="—"
                      onCommit={(v) => onUpdate(m.id, { supplier: v || null })}
                      className="text-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-zinc-400">
                      <ImagePlus className="h-3 w-3 text-zinc-500" />
                      {photoCount(m.id)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {m.source_url ? (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NumberCell({
  value,
  editable,
  onCommit,
}: {
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  if (!editable) {
    return (
      <span className="text-zinc-300">
        {value === null ? <span className="text-zinc-500">—</span> : value}
      </span>
    );
  }
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim() === "" ? null : Number(draft);
        if (next === null || !Number.isNaN(next)) {
          if (next !== value) onCommit(next);
        } else {
          setDraft(value === null ? "" : String(value));
        }
      }}
      placeholder="—"
      className="w-full cursor-text rounded bg-transparent px-1 py-0.5 text-zinc-300 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function FinishScheduleSection({
  materials,
  photos,
  editable,
  onUpdate,
  onUncheck,
  onAddPhoto,
  onDeletePhoto,
}: {
  materials: Material[];
  photos: MaterialPhoto[];
  editable: boolean;
  onUpdate: (id: string, patch: MaterialPatch) => Promise<void>;
  onUncheck: (id: string) => void;
  onAddPhoto: (materialId: string, file: File) => Promise<void>;
  onDeletePhoto: (photo: MaterialPhoto) => Promise<void>;
}) {
  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
        <p>No materials in the finish schedule yet.</p>
        <p className="text-xs text-zinc-500">
          In the Catalog tab, tick the <span className="text-zinc-300">Finish</span> column
          on a material to add it here with extended fields and photos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          title="Open the browser print dialog — Save as PDF"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1 print:gap-6">
        {materials.map((m) => (
          <FinishCard
            key={m.id}
            material={m}
            photos={photos.filter((p) => p.material_id === m.id)}
            editable={editable}
            onUpdate={onUpdate}
            onUncheck={onUncheck}
            onAddPhoto={onAddPhoto}
            onDeletePhoto={onDeletePhoto}
          />
        ))}
      </div>
    </div>
  );
}

function FinishCard({
  material,
  photos,
  editable,
  onUpdate,
  onUncheck,
  onAddPhoto,
  onDeletePhoto,
}: {
  material: Material;
  photos: MaterialPhoto[];
  editable: boolean;
  onUpdate: (id: string, patch: MaterialPatch) => Promise<void>;
  onUncheck: (id: string) => void;
  onAddPhoto: (materialId: string, file: File) => Promise<void>;
  onDeletePhoto: (photo: MaterialPhoto) => Promise<void>;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setUploading(true);
    try {
      for (const file of images) {
        await onAddPhoto(material.id, file);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-100">
            {material.product_name}
          </div>
          <div className="text-xs text-zinc-500">
            {[material.manufacturer, material.supplier]
              .filter(Boolean)
              .join(" · ") || "—"}
            {material.sku ? ` · ${material.sku}` : ""}
          </div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => onUncheck(material.id)}
            className="text-xs text-zinc-500 hover:text-red-400"
            title="Remove from finish schedule"
          >
            Remove
          </button>
        )}
      </div>

      {/* Photo gallery */}
      <div
        onDragOver={(e) => {
          if (!editable) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!editable) return;
          const files = Array.from(e.dataTransfer.files);
          handleFiles(files);
        }}
        className={`grid grid-cols-4 gap-2 rounded-md border-2 border-dashed p-2 transition ${
          dragOver
            ? "border-blue-500 bg-blue-500/5"
            : "border-zinc-800 bg-zinc-950"
        }`}
      >
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.storage_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="group relative aspect-square overflow-hidden rounded border border-zinc-800 bg-zinc-900"
            onClick={(e) => {
              if (!photo.storage_url) e.preventDefault();
            }}
          >
            {photo.storage_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.storage_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-600">
                no preview
              </div>
            )}
            {editable && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.confirm("Delete this photo?"))
                    onDeletePhoto(photo);
                }}
                className="absolute right-1 top-1 rounded bg-black/70 p-1 text-zinc-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete photo"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </a>
        ))}
        {editable && (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-500 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
            aria-label="Add photo"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </button>
        )}
        <input
          ref={photoInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            handleFiles(files);
            if (photoInputRef.current) photoInputRef.current.value = "";
          }}
        />
      </div>

      {/* Extended fields */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Room / location">
          <EditableText
            value={material.room ?? ""}
            editable={editable}
            placeholder="—"
            onCommit={(v) => onUpdate(material.id, { room: v || null })}
            className="text-zinc-200"
          />
        </Field>
        <Field label="Color / finish">
          <EditableText
            value={material.color_finish ?? ""}
            editable={editable}
            placeholder="—"
            onCommit={(v) =>
              onUpdate(material.id, { color_finish: v || null })
            }
            className="text-zinc-200"
          />
        </Field>
      </div>

      <Field label="Installation notes">
        <textarea
          defaultValue={material.installation_notes ?? ""}
          disabled={!editable}
          onBlur={(e) => {
            const v = e.target.value;
            const current = material.installation_notes ?? "";
            if (v !== current) {
              onUpdate(material.id, { installation_notes: v || null });
            }
          }}
          rows={3}
          placeholder="—"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>

      {/* Catalog reference summary */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
        <span>
          Price:{" "}
          <span className="text-zinc-300">
            {material.price === null
              ? "—"
              : `$${material.price.toFixed(2)}`}
          </span>
        </span>
        <span>
          Lead time:{" "}
          <span className="text-zinc-300">{material.lead_time ?? "—"}</span>
        </span>
        {material.notes && (
          <span className="ml-auto inline-flex items-center gap-1 text-zinc-400">
            <ExternalLink className="h-3 w-3" />
            Has catalog notes
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function PriceCell({
  value,
  editable,
  onCommit,
}: {
  value: number | null;
  editable: boolean;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  if (!editable) {
    return (
      <span className="text-zinc-300">
        {value === null ? <span className="text-zinc-500">—</span> : `$${value.toFixed(2)}`}
      </span>
    );
  }

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim() === "" ? null : Number(draft);
        if (next !== value && (next === null || !Number.isNaN(next))) {
          onCommit(next);
        } else if (Number.isNaN(next)) {
          setDraft(value === null ? "" : String(value));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value === null ? "" : String(value));
          e.currentTarget.blur();
        }
      }}
      placeholder="—"
      className="w-24 cursor-text rounded bg-transparent px-1 py-0.5 text-zinc-300 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 [color-scheme:dark] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function EditableText({
  value,
  editable,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  onCommit: (next: string) => Promise<void> | void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  if (!editable) {
    return (
      <span className={className}>
        {value ||
          (placeholder ? (
            <span className="text-zinc-500">{placeholder}</span>
          ) : null)}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full cursor-text rounded bg-transparent px-1 py-0.5 outline-none transition placeholder:text-zinc-600 hover:bg-zinc-800/60 focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}

function RowDeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`${label}?`)) onClick();
      }}
      className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
      aria-label={label}
      title={label}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
