"use client";

import { useEffect, useRef, useState } from "react";

// Motion on a report has one job: show that the numbers just changed. It is kept
// short and shallow so it never delays reading, and every piece of it is dropped
// entirely for a reader who asked the OS for less motion.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Counts a headline figure up — but ONLY the first time it lands, from zero.
//
// Tweening between two real datasets was the obvious version and it is wrong
// here: switching ทอง → เงิน walked the total down through ทอง's numbers, so for
// a few frames the page stated a silver total of 4,061,639.96 baht when the true
// answer was zero. A figure on a financial report must never be a number that was
// never true. Counting up from zero is unambiguous ("filling in"); every later
// change snaps to the new value and signals itself with a short pulse instead.
export function CountUp({
  value,
  format,
  duration = 650,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const counted = useRef(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      counted.current = true;
      return;
    }

    // Later changes: no tween — swap the number and flash it.
    if (counted.current) {
      setShown(value);
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 260);
      return () => clearTimeout(timer);
    }

    // Nothing to count to yet; wait for the first real figure.
    if (value === 0) {
      setShown(0);
      return;
    }

    counted.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span
      style={
        reduced
          ? undefined
          : {
              opacity: pulse ? 0.35 : 1,
              transition: "opacity 260ms ease-out",
            }
      }
    >
      {format(shown)}
    </span>
  );
}

// Keyframes live with the page that uses them, the way the realtime price flash
// already does elsewhere in this app.
export function ReportMotionStyles() {
  return (
    <style>{`
      @keyframes rpRise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: none; }
      }
      .rp-rise { animation: rpRise 0.42s cubic-bezier(.22,1,.36,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .rp-rise { animation: none; }
      }
    `}</style>
  );
}

// useGrowOnChange drives a "from zero" CSS transition, re-armed whenever `key`
// changes. The DOUBLE requestAnimationFrame is the whole point and not a
// superstition: with a single rAF, React commits the from-state and the
// to-state inside the same frame, the browser never paints the from-state, and
// CSS has no start value to transition from — so the bars simply appeared at
// full height and the animation was silently dead. The first frame lets the
// zero state paint; the second flips it.
export function useGrowOnChange(key: string): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [key]);
  return grown;
}

// riseIn spreads a section's entrance over a few frames so the page assembles
// top-down instead of snapping in all at once. The delay is capped: a long list
// must not have its last row arrive a second late.
export function riseIn(index: number, step = 60, cap = 320) {
  return { animationDelay: `${Math.min(index * step, cap)}ms` };
}
