"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";

export interface ViewerImage {
  url: string;
  /** Shown in the caption bar; the file name in most cases. */
  name?: string;
}

interface Props {
  images: ViewerImage[];
  /** Index to open on. Null = closed. */
  index: number | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
// Where the button and double-tap land. One step is enough to read an ID card
// photographed at arm's length, which is what this is mostly for.
const STEP_SCALE = 2.5;
// Below this the image is treated as un-zoomed: swipes page, panning resets.
const ZOOMED_AT = 1.02;

const distance = (a: Touch, b: Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// Full-screen image viewer. Opening a document in a new tab loses the page behind
// it and, on a phone, drops the user into a bare browser view they then have to
// back out of — so images are shown here instead. Non-image files (pdf/docx/xlsx)
// still need the tab; callers decide which is which.
export function ImageViewer({ images, index, onClose }: Props) {
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  // Live mirrors of the transform. The native touch handlers below are bound once
  // and would otherwise close over the first render's values.
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  // Drag start, in page coordinates, plus the offset the drag began from.
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // Where a one-finger touch started, to tell a swipe from a tap.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // Pinch baseline: finger distance and the transform when the second finger landed.
  const pinch = useRef<{ dist: number; scale: number; ox: number; oy: number } | null>(null);

  // The viewer is portalled to <body>. position: fixed is only relative to the
  // viewport while no ancestor establishes a containing block — and backdrop-blur
  // does exactly that, so rendering in place leaves the viewer trapped inside
  // whichever frosted card holds the thumbnail that opened it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = index !== null;
  const total = images.length;

  const apply = useCallback((s: number, o: { x: number; y: number }) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    // Nothing to pan when the image fits, so snap back rather than leaving it
    // parked off-centre.
    const next = clamped < ZOOMED_AT ? { x: 0, y: 0 } : o;
    scaleRef.current = clamped;
    offsetRef.current = next;
    setScale(clamped);
    setOffset(next);
  }, []);

  const reset = useCallback(() => apply(1, { x: 0, y: 0 }), [apply]);

  useEffect(() => {
    if (index !== null) {
      setCurrent(index);
      reset();
    }
  }, [index, reset]);

  const go = useCallback(
    (delta: number) => {
      if (total < 2) return;
      setCurrent((c) => (c + delta + total) % total);
      reset();
    },
    [total, reset],
  );

  // Zoom about a screen point, keeping whatever is under that point in place. The
  // stage is untransformed and the image is centred in it, so the stage's centre
  // is the image's centre at scale 1 — which is the anchor the maths needs.
  const zoomTo = useCallback(
    (nextScale: number, px: number, py: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return apply(nextScale, offsetRef.current);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const s = scaleRef.current;
      const o = offsetRef.current;
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const k = clamped / s;
      apply(clamped, {
        x: px - cx - k * (px - cx - o.x),
        y: py - cy - k * (py - cy - o.y),
      });
    },
    [apply],
  );

  const toggleZoom = useCallback(
    (px?: number, py?: number) => {
      if (scaleRef.current >= ZOOMED_AT) reset();
      else if (px === undefined || py === undefined) apply(STEP_SCALE, { x: 0, y: 0 });
      else zoomTo(STEP_SCALE, px, py);
    },
    [apply, reset, zoomTo],
  );

  // Esc closes, arrows move. Bound while open only, so it never fights the page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  // The viewer covers the screen, so the page behind it should not scroll under it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Touch handling is bound natively rather than through React props: React's
  // touchmove listeners are passive, and a passive listener cannot preventDefault,
  // which is what stops iOS from pinch-zooming the whole page out from under the
  // viewer mid-gesture.
  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        swipe.current = null;
        drag.current = null;
        pinch.current = {
          dist: distance(e.touches[0], e.touches[1]),
          scale: scaleRef.current,
          ox: offsetRef.current.x,
          oy: offsetRef.current.y,
        };
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        swipe.current = { x: t.clientX, y: t.clientY };
        if (scaleRef.current >= ZOOMED_AT) {
          drag.current = {
            x: t.clientX,
            y: t.clientY,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
          };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        const p = pinch.current;
        const next = p.scale * (distance(e.touches[0], e.touches[1]) / p.dist);
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        // Anchored on the baseline transform, so the pinch tracks the fingers for
        // the whole gesture instead of drifting frame by frame.
        const rect = stage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
        const k = clamped / p.scale;
        apply(clamped, {
          x: mx - cx - k * (mx - cx - p.ox),
          y: my - cy - k * (my - cy - p.oy),
        });
        return;
      }
      if (drag.current && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const d = drag.current;
        apply(scaleRef.current, { x: d.ox + (t.clientX - d.x), y: d.oy + (t.clientY - d.y) });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
      if (e.touches.length === 0) {
        drag.current = null;
        const s = swipe.current;
        swipe.current = null;
        // Only an un-zoomed, one-finger, mostly-horizontal drag pages the set.
        if (s && scaleRef.current < ZOOMED_AT && e.changedTouches.length === 1) {
          const t = e.changedTouches[0];
          const dx = t.clientX - s.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? 1 : -1);
        }
      }
    };

    // Safari fires its own gesture events alongside the touch ones; without this
    // the page zooms behind the viewer.
    const stopGesture = (e: Event) => e.preventDefault();

    stage.addEventListener("touchstart", onTouchStart, { passive: false });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    stage.addEventListener("gesturestart", stopGesture as EventListener);
    stage.addEventListener("gesturechange", stopGesture as EventListener);
    return () => {
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
      stage.removeEventListener("gesturestart", stopGesture as EventListener);
      stage.removeEventListener("gesturechange", stopGesture as EventListener);
    };
  }, [open, apply, go]);

  if (!open || total === 0 || !mounted) return null;

  const image = images[Math.min(current, total - 1)];
  const zoomed = scale >= ZOOMED_AT;

  return createPortal(
    // Above the navbar (z-50) — this is the topmost thing on screen while open.
    <div
      className="fixed inset-0 z-[60] bg-black/95 select-none"
      onMouseMove={(e) => {
        const d = drag.current;
        if (!d) return;
        apply(scaleRef.current, { x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
      }}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => (drag.current = null)}
    >
      {/* Top bar — floats over the image on a scrim, so white controls stay legible
          against a pale photo without stealing a strip of the picture. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-x-2 px-3 h-16 text-white/90 bg-gradient-to-b from-black/70 to-transparent pointer-events-none [&>*]:pointer-events-auto">
        <span className="text-sm font-bold truncate">{image.name ?? ""}</span>
        <div className="flex items-center gap-x-1 shrink-0">
          {zoomed && (
            <span className="text-xs text-white/60 tabular-nums px-1">{scale.toFixed(1)}×</span>
          )}
          {total > 1 && (
            <span className="text-xs text-white/60 tabular-nums px-2">
              {current + 1} / {total}
            </span>
          )}
          <button
            type="button"
            aria-label={zoomed ? "ย่อ" : "ขยาย"}
            onClick={() => toggleZoom()}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            title="เปิดไฟล์เต็มในแท็บใหม่"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <ExternalLink size={19} />
          </a>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Stage. touch-action: none hands every gesture to the handlers above rather
          than letting the browser scroll or zoom the page instead. Clicking the
          empty space closes; clicking the image itself does not, so a mis-tap while
          panning a zoomed photo doesn't dismiss it. */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.name ?? ""}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => toggleZoom(e.clientX, e.clientY)}
          onMouseDown={(e) => {
            if (!zoomed) return;
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onWheel={(e) => zoomTo(scaleRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY)}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: zoomed ? "grab" : "zoom-in",
            // Animating during a pinch would lag a frame behind the fingers.
            transition: pinch.current || drag.current ? "none" : "transform 0.18s",
          }}
          className="max-h-full max-w-full object-contain"
        />

        {total > 1 && !zoomed && (
          <>
            <button
              type="button"
              aria-label="ก่อนหน้า"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              aria-label="ถัดไป"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip — also floating, and only when there is a set to page through */}
      {total > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-x-2 overflow-x-auto scrollbar-hide px-3 pt-8 pb-3 bg-gradient-to-t from-black/70 to-transparent">
          {images.map((im, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrent(i);
                reset();
              }}
              className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === current ? "border-[#c09c42]" : "border-white/20 opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
