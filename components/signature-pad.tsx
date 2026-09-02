"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Check, Eraser, Maximize2, Pen } from "lucide-react";

interface Props {
  // Called whenever the signature changes: a PNG data-URL while there is ink,
  // or null when cleared/empty.
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

type Bounds = { x0: number; y0: number; x1: number; y1: number };

// One drawable canvas surface. Used twice: the small inline box, and the
// fullscreen sign mode.
function useSketch() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inked = useRef(false);
  // Ink bounding box in CSS px, grown as we draw, so exporting can crop
  // without scanning millions of pixels on a fullscreen canvas.
  const bounds = useRef<Bounds | null>(null);
  const [empty, setEmpty] = useState(true);

  // Size the canvas to its container at device-pixel resolution so the line
  // stays crisp. Replacing the bitmap wipes it — only ever done while empty
  // (mount, and the resize that fires when entering fullscreen).
  const fit = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * ratio);
    const h = Math.round(rect.height * ratio);
    if (!w || !h) return;
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  // Callback ref: the canvas is unmounted and remounted when switching
  // between inline / fullscreen / captured-preview, so size it on attach
  // rather than once on mount.
  const setRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      ref.current = node;
      if (node) fit();
    },
    [fit],
  );

  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const reset = useCallback(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawing.current = false;
    last.current = null;
    inked.current = false;
    bounds.current = null;
    setEmpty(true);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // A pen reports pressure; a mouse doesn't, so it gets the old fixed width.
  const strokeWidth = (e: React.PointerEvent) =>
    e.pointerType === "pen" && e.pressure > 0 ? 1.1 + e.pressure * 3.2 : 2.2;

  const grow = (p: { x: number; y: number }, w: number) => {
    const r = w / 2 + 1;
    const b = bounds.current;
    if (!b) {
      bounds.current = { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
      return;
    }
    b.x0 = Math.min(b.x0, p.x - r);
    b.y0 = Math.min(b.y0, p.y - r);
    b.x1 = Math.max(b.x1, p.x + r);
    b.y1 = Math.max(b.y1, p.y + r);
  };

  const start = (e: React.PointerEvent) => {
    if (e.button > 0) return; // pen barrel button / right click
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    ref.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    const w = strokeWidth(e);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    grow(last.current, w);
    grow(p, w);
    last.current = p;
    if (!inked.current) {
      inked.current = true;
      setEmpty(false);
    }
  };

  // Returns true when a stroke actually ended, so the caller only exports then.
  const end = () => {
    if (!drawing.current) return false;
    drawing.current = false;
    last.current = null;
    return true;
  };

  // PNG cropped to the ink. Without this a fullscreen canvas would produce a
  // mostly-empty multi-megapixel image with a small signature in it.
  const toDataUrl = useCallback(() => {
    const canvas = ref.current;
    const b = bounds.current;
    if (!canvas || !b || !inked.current) return null;
    const cssWidth = canvas.getBoundingClientRect().width;
    if (!cssWidth) return null;
    const ratio = canvas.width / cssWidth;
    const x0 = Math.max(0, Math.floor(b.x0 * ratio));
    const y0 = Math.max(0, Math.floor(b.y0 * ratio));
    const x1 = Math.min(canvas.width, Math.ceil(b.x1 * ratio));
    const y1 = Math.min(canvas.height, Math.ceil(b.y1 * ratio));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return null;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d")?.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
    return out.toDataURL("image/png");
  }, []);

  const bind = (onEnd: () => void) => ({
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: () => {
      if (end()) onEnd();
    },
    onPointerCancel: () => {
      if (end()) onEnd();
    },
    onPointerLeave: () => {
      if (end()) onEnd();
    },
  });

  return { setRef, empty, fit, reset, bind, toDataUrl };
}

// A lightweight canvas signature pad (pointer + touch + pen tablet).
//
// Pen tablets (Wacom / XP-Pen / Huion) map their surface to the WHOLE screen,
// so the small inline box only receives a thin slice of the tablet. At the
// counter the signer can't see the monitor and so can't aim at that slice —
// fullscreen sign mode turns the whole viewport into the canvas instead, and
// every point of the tablet then lands on it wherever the pen touches down.
export function SignaturePad({ onChange, height = 180 }: Props) {
  const inline = useSketch();
  const full = useSketch();
  const [fullscreen, setFullscreen] = useState(false);
  // Signature captured in fullscreen mode, shown inline afterwards (the
  // fullscreen canvas itself is gone by then).
  const [captured, setCaptured] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const openFullscreen = () => {
    // flushSync so the overlay exists and we are still inside the click's
    // user activation when requesting fullscreen.
    flushSync(() => setFullscreen(true));
    overlayRef.current?.requestFullscreen?.().catch(() => {
      // Fullscreen refused — the fixed overlay still covers the viewport.
    });
  };

  const closeFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setFullscreen(false);
  }, []);

  // Fit the fullscreen canvas once it is mounted, and keep our state in sync
  // when the browser leaves fullscreen on its own (Esc, F11).
  useEffect(() => {
    if (!fullscreen) return;
    full.reset();
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    // Capture Escape before the surrounding modal sees it, so leaving
    // fullscreen doesn't also close the quotation dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeFullscreen();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey, true);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, closeFullscreen]);

  const commitInline = () => onChange(inline.toDataUrl());

  // Commit on every stroke end, not on "เสร็จสิ้น", so the signature survives
  // an accidental Esc / F11 out of fullscreen.
  const commitFull = () => {
    const url = full.toDataUrl();
    setCaptured(url);
    onChange(url);
  };

  const clearAll = () => {
    inline.reset();
    full.reset();
    setCaptured(null);
    onChange(null);
  };

  const overlay = (
    <div
      ref={overlayRef}
      // The overlay is portalled to <body>, i.e. outside the surrounding
      // HeroUI modal, so react-aria's useInteractOutside would read the very
      // first pen-down as a click outside and dismiss the modal — taking this
      // overlay with it. This attribute is react-aria's own escape hatch: it
      // is honoured by useInteractOutside (don't dismiss), FocusScope (don't
      // pull focus back) and ariaHideOutside (don't aria-hide us).
      data-react-aria-top-layer={true}
      className="fixed inset-0 z-[9999] flex flex-col bg-white"
      style={{ touchAction: "none" }}
    >
      {/* Controls sit outside the drawing area so a signer who can't see the
          screen has no way to hit them mid-signature. */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b-1 border-black/10 bg-gradient-to-b from-black/[0.03] to-transparent px-5">
        <span className="text-sm font-bold text-black/60">
          ให้ลูกค้าเซ็นบนแท็บเล็ตได้เลย — ใช้พื้นที่ได้ทั้งหน้าจอ
        </span>
        <div className="flex items-center gap-x-2">
          <button
            type="button"
            onClick={() => {
              full.reset();
              setCaptured(null);
              onChange(null);
            }}
            className="flex items-center gap-x-1.5 rounded-2xl border-1 border-black/10 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
          >
            <Eraser size={14} /> ล้างลายเซ็น
          </button>
          <button
            type="button"
            onClick={closeFullscreen}
            className="flex items-center gap-x-1.5 rounded-2xl bg-gradient-to-r from-[#c09c42] to-yellow-600 px-5 py-2 text-xs font-bold text-white"
          >
            <Check size={14} /> เสร็จสิ้น
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <canvas
          ref={full.setRef}
          className="absolute inset-0 block h-full w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          {...full.bind(commitFull)}
        />
        {full.empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-3/4 border-b-2 border-dashed border-black/15" />
            <span className="mt-4 flex items-center gap-x-2 text-black/25">
              <Pen size={18} />
              <span className="text-base font-bold">เซ็นชื่อตรงนี้</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-y-2">
      {captured ? (
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-2xl border-2 border-[#c09c42]/40 bg-white"
          style={{ height }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captured}
            alt="ลายเซ็น"
            className="max-h-full max-w-full object-contain"
          />
          <span className="absolute left-2 top-2 rounded-full border-1 border-[#c09c42]/30 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[#c09c42]">
            เซ็นจากโหมดเต็มจอแล้ว
          </span>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-black/20 bg-white">
          <canvas
            ref={inline.setRef}
            style={{ height, touchAction: "none" }}
            className="block w-full cursor-crosshair"
            {...inline.bind(commitInline)}
          />
          {inline.empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-x-2 text-black/30">
              <Pen size={16} />
              <span className="text-sm font-bold">เซ็นชื่อตรงนี้</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openFullscreen}
          className="flex items-center gap-x-1.5 rounded-2xl border-1 border-[#c09c42]/30 bg-[#c09c42]/5 px-3 py-1.5 text-xs font-bold text-[#c09c42] hover:bg-[#c09c42]/10"
        >
          <Maximize2 size={14} />
          {captured ? "เซ็นใหม่เต็มจอ" : "เซ็นแบบเต็มจอ (แท็บเล็ตปากกา)"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-x-1.5 text-xs font-bold text-red-500 hover:text-red-600"
        >
          <Eraser size={14} /> ล้างลายเซ็น
        </button>
      </div>

      {fullscreen && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : null}
    </div>
  );
}
