"use client";

import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ModuleDef } from "./modules";

export function SettingsModal({
  modules,
  onClose,
  onReorder,
}: {
  modules: ModuleDef[];
  onClose: () => void;
  onReorder: (nextKeys: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.key === active.id);
    const newIndex = modules.findIndex((m) => m.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(modules, oldIndex, newIndex).map((m) => m.key);
    onReorder(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
            <p className="text-xs text-zinc-500">
              Drag tabs to reorder the sidebar. Saved per browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
          Module order
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={modules.map((m) => m.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1">
              {modules.map((m) => (
                <SortableRow key={m.key} module={m} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableRow({ module: m }: { module: ModuleDef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const Icon = m.icon;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-zinc-400" />
      <span>{m.label}</span>
    </li>
  );
}
