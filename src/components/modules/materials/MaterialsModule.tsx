"use client";

import { useEffect, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createMaterial,
  deleteMaterial,
  fetchMaterials,
  updateMaterial,
  type MaterialPatch,
} from "./queries";
import type { Material } from "./types";

export function MaterialsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchMaterials(projectId);
        if (cancelled) return;
        setMaterials(rows);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Materials</h1>
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit materials.
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <>
          <p className="text-sm text-zinc-400">
            Catalog for this project. Pricing lives here; Schedule task cards
            link to entries via material_id.
          </p>

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
                  <th className="w-8 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-zinc-500">
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
    </div>
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
