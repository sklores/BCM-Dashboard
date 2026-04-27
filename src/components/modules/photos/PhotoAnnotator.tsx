"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Camera,
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

type Tool = "pen" | "text" | "arrow" | "rect" | "screenshot";

const TOOL_LABEL: Record<Tool, string> = {
  pen: "Pen",
  text: "Text",
  arrow: "Arrow",
  rect: "Rectangle",
  screenshot: "Screenshot",
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
  | { kind: "text"; color: string; size: number; fontPx: number; x: number; y: number; text: string }
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
    fontPx: number;
  } | null>(null);
  // Drag-to-move state for an existing text label.
  const [textDrag, setTextDrag] = useState<{
    index: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Screenshot tool: rectangle being dragged in canvas coords.
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [savingScreenshot, setSavingScreenshot] = useState(false);

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
  }, [strokes, drawing, cropRect]);

  // Enter key triggers screenshot save while a crop is active. Escape cancels.
  useEffect(() => {
    if (tool !== "screenshot" || !cropRect || textPrompt) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        const w = Math.abs(cropRect!.w);
        const h = Math.abs(cropRect!.h);
        if (w >= 8 && h >= 8) void handleSaveScreenshot();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCropRect(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, cropRect, textPrompt]);

  function redrawOverlay() {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s);
    if (drawing) drawStroke(ctx, drawing);
    if (cropRect) drawCropRect(ctx, cropRect);
  }

  function drawCropRect(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
  ) {
    const x = Math.min(rect.x, rect.x + rect.w);
    const y = Math.min(rect.y, rect.y + rect.h);
    const w = Math.abs(rect.w);
    const h = Math.abs(rect.h);
    ctx.save();
    // Dim everything outside the crop rect to spotlight the selection.
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, cw, y);
    ctx.fillRect(0, y + h, cw, ch - (y + h));
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, cw - (x + w), h);
    // Dashed border on the rect itself.
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = Math.max(2, Math.round(cw / 600));
    ctx.setLineDash([Math.max(8, cw / 200), Math.max(6, cw / 280)]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    // Scale strokes 3× so the slider reaches a meaningfully thick line at
    // 20 (and stays usable at low values).
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
    } else if (s.kind === "arrow") {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const angle = Math.atan2(dy, dx);
      // Arrowhead must be visibly larger than the line. Line width is size*3,
      // so size*9 keeps the head ~3× line thickness at every size, with a
      // generous floor so even the thinnest arrows have a clear pointer.
      const head = Math.max(22, s.size * 9);
      // Pull the line back so the line doesn't jut out the front of the head.
      const inset = head * 0.85;
      const baseX = s.x2 - inset * Math.cos(angle);
      const baseY = s.y2 - inset * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
      // Arrowhead (filled triangle).
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
      // Sticky-label style: white fill + black frame + black text. fontPx
      // is canvas pixels chosen at commit time so the rendered text matches
      // the on-screen size of the input regardless of image resolution.
      const fontPx = s.fontPx;
      ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      const padX = Math.round(fontPx * 0.4);
      const padY = Math.round(fontPx * 0.25);
      const metrics = ctx.measureText(s.text);
      const w = Math.ceil(metrics.width) + padX * 2;
      const h = Math.ceil(fontPx * 1.25) + padY * 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x, s.y, w, h);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(1.5, fontPx / 24);
      ctx.strokeRect(s.x, s.y, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillText(s.text, s.x + padX, s.y + padY);
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

  // Compute the canvas <-> display ratio. Anything 1:1 if image fits 1:1.
  function getDisplayRatio(): number {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return 1;
    const r = canvas.getBoundingClientRect();
    return r.width === 0 ? 1 : r.width / canvas.width;
  }
  // The on-screen pixel size we want for text (matches the input).
  // Reduced multiplier so slider 20 is a reasonable header size, not larger
  // than the photo itself.
  function desiredScreenFontPx(): number {
    return Math.max(12, size * 1.5);
  }
  // Convert that to canvas pixels for the actual draw.
  function canvasFontPx(): number {
    const ratio = getDisplayRatio();
    return desiredScreenFontPx() / Math.max(0.05, ratio);
  }

  // Hit-test text strokes (top-down) to support drag-to-move.
  function hitTestText(x: number, y: number): number {
    const canvas = baseCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return -1;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.kind !== "text") continue;
      const padX = Math.round(s.fontPx * 0.4);
      const padY = Math.round(s.fontPx * 0.25);
      ctx.font = `bold ${s.fontPx}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      const metrics = ctx.measureText(s.text);
      const w = Math.ceil(metrics.width) + padX * 2;
      const h = Math.ceil(s.fontPx * 1.25) + padY * 2;
      if (x >= s.x && x <= s.x + w && y >= s.y && y <= s.y + h) return i;
    }
    return -1;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (textPrompt) return;
    const [x, y] = pointerPos(e);

    // Text labels can be picked up and dragged regardless of the active
    // tool — that's the most natural feel.
    const idx = hitTestText(x, y);
    if (idx >= 0) {
      const s = strokes[idx];
      if (s.kind === "text") {
        setTextDrag({ index: idx, offsetX: x - s.x, offsetY: y - s.y });
        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (tool === "pen") {
      setDrawing({ kind: "pen", color, size, points: [[x, y]] });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "rect") {
      setDrawing({ kind: "rect", color, size, x, y, w: 0, h: 0 });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "arrow") {
      setDrawing({ kind: "arrow", color, size, x1: x, y1: y, x2: x, y2: y });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (tool === "text") {
      // Don't capture pointer — the text input needs to take focus.
      setTextPrompt({ x, y, value: "", fontPx: canvasFontPx() });
    } else if (tool === "screenshot") {
      setCropRect({ x, y, w: 0, h: 0 });
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = pointerPos(e);
    if (textDrag) {
      const idx = textDrag.index;
      setStrokes((prev) =>
        prev.map((s, i) =>
          i === idx && s.kind === "text"
            ? { ...s, x: x - textDrag.offsetX, y: y - textDrag.offsetY }
            : s,
        ),
      );
      return;
    }
    if (cropRect && tool === "screenshot") {
      setCropRect({ ...cropRect, w: x - cropRect.x, h: y - cropRect.y });
      return;
    }
    if (!drawing) return;
    if (drawing.kind === "pen") {
      setDrawing({ ...drawing, points: [...drawing.points, [x, y]] });
    } else if (drawing.kind === "rect") {
      setDrawing({ ...drawing, w: x - drawing.x, h: y - drawing.y });
    } else if (drawing.kind === "arrow") {
      setDrawing({ ...drawing, x2: x, y2: y });
    }
  }

  function onPointerUp() {
    if (textDrag) {
      setTextDrag(null);
      return;
    }
    if (cropRect && tool === "screenshot") {
      const w = Math.abs(cropRect.w);
      const h = Math.abs(cropRect.h);
      if (w < 8 || h < 8) {
        // Tiny / accidental drag — discard.
        setCropRect(null);
      } else {
        // Auto-save on release. The crop captures source pixels at native
        // resolution; the parent's onSaved closes the editor and adds the
        // new photo to the gallery.
        void handleSaveScreenshot();
      }
      return;
    }
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
        {
          kind: "text",
          color,
          size,
          fontPx: textPrompt.fontPx,
          x: textPrompt.x,
          y: textPrompt.y,
          text: t,
        },
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

  async function handleSaveScreenshot() {
    if (!cropRect) return;
    setSavingScreenshot(true);
    setError(null);
    try {
      const base = baseCanvasRef.current;
      if (!base) throw new Error("Canvas not ready");
      // Normalize the rect so negative drags work, then clip to image bounds.
      const x = Math.max(0, Math.round(Math.min(cropRect.x, cropRect.x + cropRect.w)));
      const y = Math.max(0, Math.round(Math.min(cropRect.y, cropRect.y + cropRect.h)));
      const w = Math.min(base.width - x, Math.round(Math.abs(cropRect.w)));
      const h = Math.min(base.height - y, Math.round(Math.abs(cropRect.h)));
      if (w < 4 || h < 4) throw new Error("Screenshot region is too small");
      // Native-resolution crop: sample directly from the base canvas (which
      // was drawn at the source image's natural size), so the new photo
      // keeps the original pixels rather than a downscaled view.
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(base, x, y, w, h, 0, 0, w, h);

      const blob: Blob = await new Promise((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      const file = new File([blob], `screenshot-${Date.now()}.png`, {
        type: "image/png",
      });
      const newId = crypto.randomUUID();
      const { path, url } = await uploadPhotoBlob(photo.project_id, file, newId);
      const tags = Array.from(
        new Set([...(photo.tags ?? []), "screenshot"]),
      );
      const created = await insertPhoto({
        id: newId,
        project_id: photo.project_id,
        storage_path: path,
        storage_url: url,
        taken_at: photo.taken_at,
        tags,
        room: photo.room,
        stage: photo.stage,
        ai_description: photo.ai_description,
        annotated_from_id: photo.id,
      });
      onSaved(created);
      setCropRect(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screenshot failed");
    } finally {
      setSavingScreenshot(false);
    }
  }

  function cancelScreenshot() {
    setCropRect(null);
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
    screenshot: Camera,
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
          {tool === "screenshot" && cropRect && (
            <>
              <span className="text-[11px] text-zinc-400">
                {Math.round(Math.abs(cropRect.w))}×
                {Math.round(Math.abs(cropRect.h))}
              </span>
              <button
                type="button"
                onClick={cancelScreenshot}
                disabled={savingScreenshot}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-40"
              >
                Cancel crop
              </button>
              <button
                type="button"
                onClick={handleSaveScreenshot}
                disabled={
                  savingScreenshot ||
                  Math.abs(cropRect.w) < 8 ||
                  Math.abs(cropRect.h) < 8
                }
                className="flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-40"
              >
                {savingScreenshot ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Save screenshot
              </button>
            </>
          )}
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
              overlay={overlayCanvasRef}
              prompt={textPrompt}
              setPrompt={setTextPrompt}
              onCommit={commitText}
              onCancel={cancelText}
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
                : tool === "screenshot"
                  ? "Drag to crop — releases to save as a new tagged photo (Enter to confirm, Esc to cancel)"
                  : "Drag to draw a rectangle"}
        </div>
      </div>
    </div>
  );
}

function TextEntryOverlay({
  overlay,
  prompt,
  setPrompt,
  onCommit,
  onCancel,
}: {
  overlay: React.RefObject<HTMLCanvasElement | null>;
  prompt: { x: number; y: number; value: string; fontPx: number };
  setPrompt: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; value: string; fontPx: number } | null>
  >;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Position is relative to the canvas's immediate parent (the wrapping
  // relative div). The overlay canvas fills its parent via inset-0.
  const c = overlay.current;
  const rect = c?.getBoundingClientRect();
  const scaleX = rect && c ? rect.width / c.width : 1;
  const scaleY = rect && c ? rect.height / c.height : 1;
  const left = prompt.x * scaleX;
  const top = prompt.y * scaleY;
  // Show the input at the same on-screen size as the saved label will be:
  // canvas-px font × display ratio = on-screen px.
  const screenFontPx = prompt.fontPx * scaleY;

  // Focus deliberately after mount (autoFocus is unreliable across pointer
  // events).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="absolute z-20 flex items-center gap-1"
      style={{ left, top, transform: "translateY(-4px)" }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={prompt.value}
        onChange={(e) =>
          setPrompt((p) => (p ? { ...p, value: e.target.value } : p))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Type your note"
        className="rounded-sm border-2 border-black bg-white font-bold text-black outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          minWidth: "180px",
          fontSize: `${screenFontPx}px`,
          padding: `${Math.max(2, screenFontPx * 0.25)}px ${Math.max(6, screenFontPx * 0.4)}px`,
        }}
      />
      <button
        type="button"
        onClick={onCommit}
        className="rounded bg-blue-500/20 px-2 py-1 text-[11px] text-blue-300 hover:bg-blue-500/30"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

