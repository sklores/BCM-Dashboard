"use client";

// Plans markup canvas — renders a drawing's PDF first page via pdfjs into
// a base canvas, then layers an overlay canvas with the same drawing
// toolset Photos uses (pen, text, arrow, rect, cloud, zoom). Saves the
// composited result as a photo in the gallery tagged with the drawing
// number so it surfaces alongside annotated photos.

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Cloud,
  Loader2,
  Pencil,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { insertPhoto, uploadPhotoBlob } from "@/components/modules/photos/queries";
import type { Drawing } from "./types";

type Tool = "pen" | "text" | "arrow" | "rect" | "cloud";

const TOOL_LABEL: Record<Tool, string> = {
  pen: "Pen",
  text: "Text",
  arrow: "Arrow",
  rect: "Rectangle",
  cloud: "Cloud",
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
  | {
      kind: "text";
      color: string;
      size: number;
      fontPx: number;
      x: number;
      y: number;
      text: string;
    }
  | {
      kind: "arrow";
      color: string;
      size: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      kind: "rect";
      color: string;
      size: number;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: "cloud";
      color: string;
      size: number;
      x: number;
      y: number;
      w: number;
      h: number;
    };

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w0: number,
  h0: number,
) {
  const x = w0 < 0 ? x0 + w0 : x0;
  const y = h0 < 0 ? y0 + h0 : y0;
  const w = Math.abs(w0);
  const h = Math.abs(h0);
  if (w < 4 || h < 4) return;
  const baseR = Math.max(8, Math.min(w, h) / 8);
  const topCount = Math.max(3, Math.round(w / (baseR * 1.6)));
  const sideCount = Math.max(2, Math.round(h / (baseR * 1.6)));
  ctx.beginPath();
  for (let i = 0; i < topCount; i++) {
    const cx = x + (i + 0.5) * (w / topCount);
    ctx.arc(cx, y, baseR, Math.PI, 2 * Math.PI, false);
  }
  for (let i = 0; i < sideCount; i++) {
    const cy = y + (i + 0.5) * (h / sideCount);
    ctx.arc(x + w, cy, baseR, 1.5 * Math.PI, 0.5 * Math.PI, false);
  }
  for (let i = 0; i < topCount; i++) {
    const cx = x + w - (i + 0.5) * (w / topCount);
    ctx.arc(cx, y + h, baseR, 0, Math.PI, false);
  }
  for (let i = 0; i < sideCount; i++) {
    const cy = y + h - (i + 0.5) * (h / sideCount);
    ctx.arc(x, cy, baseR, 0.5 * Math.PI, 1.5 * Math.PI, false);
  }
  ctx.stroke();
}

export function DrawingMarkupOverlay({
  drawing,
  onClose,
  onSaved,
}: {
  drawing: Drawing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [renderState, setRenderState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("cloud");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(6);
  const [zoom, setZoom] = useState<number>(1);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing_, setDrawing_] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);

  // Render PDF page 1 onto the base canvas via pdfjs.
  useEffect(() => {
    let cancelled = false;
    setRenderState("loading");
    setError(null);
    if (!drawing.pdf_url) {
      setRenderState("error");
      setError("No PDF to mark up.");
      return;
    }
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const task = pdfjs.getDocument(drawing.pdf_url!);
        const pdf = await task.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        // Render at 2x device scale so markup stays sharp at zoom.
        const viewport = page.getViewport({ scale: 2 });
        const base = baseCanvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!base || !overlay) return;
        base.width = viewport.width;
        base.height = viewport.height;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        const bctx = base.getContext("2d");
        if (!bctx) return;
        await page.render({ canvas: base, canvasContext: bctx, viewport })
          .promise;
        if (cancelled) return;
        setRenderState("ready");
      } catch (err) {
        if (!cancelled) {
          setRenderState("error");
          setError(err instanceof Error ? err.message : "PDF render failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawing.pdf_url]);

  // Redraw overlay whenever strokes change.
  useEffect(() => {
    redrawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, drawing_, renderState]);

  function redrawOverlay() {
    const c = overlayCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes) drawStroke(ctx, s);
    if (drawing_) drawStroke(ctx, drawing_);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size * 3;
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
    } else if (s.kind === "cloud") {
      drawCloud(ctx, s.x, s.y, s.w, s.h);
    } else if (s.kind === "arrow") {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const angle = Math.atan2(dy, dx);
      const head = Math.max(20, s.size * 8);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(
        s.x2 - head * Math.cos(angle - Math.PI / 7),
        s.y2 - head * Math.sin(angle - Math.PI / 7),
      );
      ctx.lineTo(
        s.x2 - head * Math.cos(angle + Math.PI / 7),
        s.y2 - head * Math.sin(angle + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === "text") {
      ctx.font = `bold ${s.fontPx}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      const padX = Math.round(s.fontPx * 0.4);
      const padY = Math.round(s.fontPx * 0.25);
      const m = ctx.measureText(s.text);
      const w = Math.ceil(m.width) + padX * 2;
      const h = Math.ceil(s.fontPx * 1.25) + padY * 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x, s.y, w, h);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(2, s.size);
      ctx.strokeRect(s.x, s.y, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillText(s.text, s.x + padX, s.y + padY);
    }
  }

  function pointerPos(
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] {
    const c = overlayCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    return [x, y];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = pointerPos(e);
    if (tool === "pen") {
      setDrawing_({ kind: "pen", color, size, points: [[x, y]] });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "rect") {
      setDrawing_({ kind: "rect", color, size, x, y, w: 0, h: 0 });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "cloud") {
      setDrawing_({ kind: "cloud", color, size, x, y, w: 0, h: 0 });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "arrow") {
      setDrawing_({ kind: "arrow", color, size, x1: x, y1: y, x2: x, y2: y });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "text") {
      const txt = window.prompt("Label text?");
      if (txt && txt.trim()) {
        const fontPx = Math.max(20, size * 8);
        setStrokes((prev) => [
          ...prev,
          {
            kind: "text",
            color,
            size,
            fontPx,
            x,
            y,
            text: txt.trim(),
          },
        ]);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing_) return;
    const [x, y] = pointerPos(e);
    if (drawing_.kind === "pen") {
      setDrawing_({ ...drawing_, points: [...drawing_.points, [x, y]] });
    } else if (drawing_.kind === "rect" || drawing_.kind === "cloud") {
      setDrawing_({ ...drawing_, w: x - drawing_.x, h: y - drawing_.y });
    } else if (drawing_.kind === "arrow") {
      setDrawing_({ ...drawing_, x2: x, y2: y });
    }
  }

  function onPointerUp() {
    if (!drawing_) return;
    setStrokes((prev) => [...prev, drawing_]);
    setDrawing_(null);
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
      const file = new File(
        [blob],
        `plan-markup-${drawing.drawing_number ?? drawing.id}-${Date.now()}.png`,
        { type: "image/png" },
      );
      const newId = crypto.randomUUID();
      const { path, url } = await uploadPhotoBlob(
        drawing.project_id,
        file,
        newId,
      );
      await insertPhoto({
        id: newId,
        project_id: drawing.project_id,
        storage_path: path,
        storage_url: url,
        taken_at: null,
        tags: [
          "plans-markup",
          drawing.drawing_number ?? "drawing",
        ].filter(Boolean) as string[],
        room: null,
        stage: null,
        ai_description: null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const TOOL_ICONS: Record<Tool, React.ComponentType<{ className?: string }>> = {
    pen: Pencil,
    text: Type,
    arrow: ArrowUpRight,
    rect: Square,
    cloud: Cloud,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <span className="mr-2 text-sm font-medium text-zinc-100">
          Mark up: {drawing.drawing_number ?? drawing.title ?? "drawing"}
        </span>
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

        <div className="ml-2 inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
            disabled={zoom <= 0.5}
            className="rounded p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-1 text-[11px] text-zinc-300 hover:text-zinc-100"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
            disabled={zoom >= 4}
            className="rounded p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

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
            disabled={saving || strokes.length === 0 || renderState !== "ready"}
            className="flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save markup
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
        {renderState === "loading" && (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Rendering page 1…
          </div>
        )}
        <div
          className="relative"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          <canvas
            ref={baseCanvasRef}
            className="block max-h-[78vh] max-w-full select-none rounded-md shadow-lg"
            style={{
              display: renderState === "ready" ? "block" : "none",
              background: "white",
            }}
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
              cursor: tool === "text" ? "text" : "crosshair",
              display: renderState === "ready" ? "block" : "none",
            }}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-zinc-700 bg-zinc-950/70 p-2 text-zinc-300 hover:bg-zinc-900"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
