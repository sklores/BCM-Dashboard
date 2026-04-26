"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Loader2,
  MousePointer2,
  Pencil,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { insertPhoto, uploadPhotoBlob } from "./queries";
import type { Photo } from "./types";

type Tool = "pen" | "text" | "arrow" | "rect";

const TOOL_LABEL: Record<Tool, string> = {
  pen: "Pen",
  text: "Text",
  arrow: "Arrow",
  rect: "Rectangle",
};

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f4f4f5",
  "#000000",
];

type Stroke =
  | { kind: "pen"; color: string; size: number; points: Array<[number, number]> }
  | { kind: "text"; color: string; size: number; x: number; y: number; text: string }
  | { kind: "arrow"; color: string; size: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: "rect"; color: string; size: number; x: number; y: number; w: number; h: number };

export function PhotoAnnotator({
  photo,
  onClose,
  onSaved,
}: {
  photo: Photo;
  onClose: () => void;
  onSaved: (newPhoto: Photo) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [textPrompt, setTextPrompt] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the image
  useEffect(() => {
    if (!photo.storage_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      setError(
        "Couldn't load the image (CORS may be blocking). Annotation requires the photos bucket to allow cross-origin reads.",
      );
    };
    img.src = photo.storage_url;
  }, [photo.storage_url]);

  // Render the base canvas at native resolution; overlay gets the same size.
  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const img = imgRef.current;
    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!base || !overlay) return;
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    overlay.width = img.naturalWidth;
    overlay.height = img.naturalHeight;
    const bctx = base.getContext("2d");
    if (bctx) bctx.drawImage(img, 0, 0);
    redrawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  // Redraw the overlay whenever strokes change
  useEffect(() => {
    redrawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, drawing]);

  function redrawOverlay() {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s);
    if (drawing) drawStroke(ctx, drawing);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    if (s.kind === "pen") {
      if (s.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i][0], s.points[i][1]);
      }
      ctx.stroke();
    } else if (s.kind === "rect") {
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.w, s.h);
      ctx.stroke();
    } else if (s.kind === "arrow") {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const angle = Math.atan2(dy, dx);
      const head = Math.max(12, s.size * 4);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      // Arrowhead (filled triangle)
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(
        s.x2 - head * Math.cos(angle - Math.PI / 6),
        s.y2 - head * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        s.x2 - head * Math.cos(angle + Math.PI / 6),
        s.y2 - head * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === "text") {
      const fontPx = Math.max(12, s.size * 6);
      ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      // Drop shadow for legibility against any background
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(s.text, s.x, s.y);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
  }

  // ---- Pointer-to-canvas coordinate mapping ----

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return [x, y];
  }

  // ---- Pointer handlers ----

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (textPrompt) return;
    const [x, y] = pointerPos(e);
    if (tool === "pen") {
      setDrawing({ kind: "pen", color, size, points: [[x, y]] });
    } else if (tool === "rect") {
      setDrawing({ kind: "rect", color, size, x, y, w: 0, h: 0 });
    } else if (tool === "arrow") {
      setDrawing({ kind: "arrow", color, size, x1: x, y1: y, x2: x, y2: y });
    } else if (tool === "text") {
      setTextPrompt({ x, y, value: "" });
    }
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const [x, y] = pointerPos(e);
    if (drawing.kind === "pen") {
      setDrawing({ ...drawing, points: [...drawing.points, [x, y]] });
    } else if (drawing.kind === "rect") {
      setDrawing({ ...drawing, w: x - drawing.x, h: y - drawing.y });
    } else if (drawing.kind === "arrow") {
      setDrawing({ ...drawing, x2: x, y2: y });
    }
  }

  function onPointerUp() {
    if (!drawing) return;
    setStrokes((prev) => [...prev, drawing]);
    setDrawing(null);
  }

  function commitText() {
    if (!textPrompt) return;
    const t = textPrompt.value.trim();
    if (t) {
      setStrokes((prev) => [
        ...prev,
        { kind: "text", color, size, x: textPrompt.x, y: textPrompt.y, text: t },
      ]);
    }
    setTextPrompt(null);
  }

  function cancelText() {
    setTextPrompt(null);
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    if (strokes.length === 0) return;
    if (!window.confirm("Clear all annotations?")) return;
    setStrokes([]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const base = baseCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!base || !overlay) throw new Error("Canvas not ready");
      // Compose: draw overlay onto a copy of base
      const out = document.createElement("canvas");
      out.width = base.width;
      out.height = base.height;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(base, 0, 0);
      ctx.drawImage(overlay, 0, 0);

      const blob: Blob = await new Promise((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      const file = new File([blob], `annotated-${Date.now()}.png`, {
        type: "image/png",
      });
      const newId = crypto.randomUUID();
      const { path, url } = await uploadPhotoBlob(photo.project_id, file, newId);
      const created = await insertPhoto({
        id: newId,
        project_id: photo.project_id,
        storage_path: path,
        storage_url: url,
        taken_at: photo.taken_at,
        tags: [...(photo.tags ?? []), "annotated"],
        room: photo.room,
        stage: photo.stage,
        ai_description: photo.ai_description,
        annotated_from_id: photo.id,
      });
      onSaved(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!photo.storage_url) {
    return null;
  }

  const TOOL_ICONS: Record<Tool, React.ComponentType<{ className?: string }>> = {
    pen: Pencil,
    text: Type,
    arrow: ArrowUpRight,
    rect: Square,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <span className="mr-2 text-sm font-medium text-zinc-100">Annotate</span>
        <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(Object.keys(TOOL_LABEL) as Tool[]).map((t) => {
            const Icon = TOOL_ICONS[t];
            const active = t === tool;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTool(t)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title={TOOL_LABEL[t]}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{TOOL_LABEL[t]}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-2 inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              className={`h-5 w-5 rounded-full border-2 transition ${
                color === c
                  ? "border-zinc-100"
                  : "border-transparent hover:border-zinc-500"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>

        <label className="ml-2 flex items-center gap-1.5 text-xs text-zinc-400">
          Size
          <input
            type="range"
            min={2}
            max={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24 accent-blue-500"
          />
          <span className="w-5 text-right text-zinc-300">{size}</span>
        </label>

        <button
          type="button"
          onClick={undo}
          disabled={strokes.length === 0}
          className="ml-2 flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={strokes.length === 0}
          className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || strokes.length === 0}
            className="flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save annotated copy
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {!imgLoaded && (
          <div className="text-sm text-zinc-400">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading image…
          </div>
        )}
        <div className="relative max-h-full max-w-full">
          <canvas
            ref={baseCanvasRef}
            className="block max-h-[78vh] max-w-full select-none rounded-md shadow-lg"
            style={{ display: imgLoaded ? "block" : "none" }}
          />
          <canvas
            ref={overlayCanvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            className="absolute inset-0 h-full w-full touch-none"
            style={{
              cursor:
                tool === "text"
                  ? "text"
                  : tool === "pen"
                    ? "crosshair"
                    : "crosshair",
              display: imgLoaded ? "block" : "none",
            }}
          />

          {textPrompt && (
            <TextEntryOverlay
              container={containerRef}
              overlay={overlayCanvasRef}
              prompt={textPrompt}
              setPrompt={setTextPrompt}
              onCommit={commitText}
              onCancel={cancelText}
              color={color}
              size={size}
            />
          )}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-[11px] text-zinc-400">
          <MousePointer2 className="mr-1 inline h-3 w-3" />
          {tool === "pen"
            ? "Drag to draw"
            : tool === "text"
              ? "Click to place text"
              : tool === "arrow"
                ? "Drag from base to tip"
                : "Drag to draw a rectangle"}
        </div>
      </div>
    </div>
  );
}

function TextEntryOverlay({
  container,
  overlay,
  prompt,
  setPrompt,
  onCommit,
  onCancel,
  color,
  size,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  overlay: React.RefObject<HTMLCanvasElement | null>;
  prompt: { x: number; y: number; value: string };
  setPrompt: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; value: string } | null>
  >;
  onCommit: () => void;
  onCancel: () => void;
  color: string;
  size: number;
}) {
  // Convert canvas-space (x, y) → DOM pixels relative to the overlay element
  const c = overlay.current;
  const rect = c?.getBoundingClientRect();
  const cont = container.current?.getBoundingClientRect();
  if (!rect || !cont || !c) return null;
  const scaleX = rect.width / c.width;
  const scaleY = rect.height / c.height;
  const left = rect.left - cont.left + prompt.x * scaleX;
  const top = rect.top - cont.top + prompt.y * scaleY;
  const fontPx = Math.max(12, size * 6) * Math.max(scaleX, scaleY);

  return (
    <div
      className="absolute"
      style={{ left, top, transform: "translateY(-2px)" }}
    >
      <input
        autoFocus
        type="text"
        value={prompt.value}
        onChange={(e) =>
          setPrompt((p) => (p ? { ...p, value: e.target.value } : p))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          else if (e.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
        placeholder="Type and press Enter…"
        className="rounded border border-zinc-700 bg-zinc-950/90 px-1.5 py-0.5 outline-none focus:border-blue-500"
        style={{
          color,
          fontSize: `${fontPx}px`,
          fontWeight: 700,
          minWidth: `${fontPx * 4}px`,
        }}
      />
    </div>
  );
}
