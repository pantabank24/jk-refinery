"use client";

import { useEffect, useRef, useState } from "react";

// Same sidecar URL the /realtime-gold POC page uses. The browser connects to
// tv-price-svc directly over SSE (live, like the POC) instead of polling jk-api.
const RT_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:8000";

export interface RealtimeGold {
  spot: number | null;
  bar_buy: number | null;
  bar_sell: number | null;
  bar_mid: number | null;
  change: number | null;
  change_pct: number | null;
  usdthb: number | null;
  connected: boolean;
  version: number;
}

// useRealtimeGold streams the live gold price from the tv-price-svc sidecar via
// SSE while `active`. Returns the latest price plus the direction of the last
// change so callers can flash the number (exactly like the /realtime-gold page).
export function useRealtimeGold(active: boolean) {
  const [data, setData] = useState<RealtimeGold | null>(null);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");
  const prevSpot = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const es = new EventSource(`${RT_URL}/stream`);

    es.onmessage = (e) => {
      let d: RealtimeGold;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      if (d.spot == null) return;
      if (prevSpot.current != null) {
        setDir(d.spot > prevSpot.current ? "up" : d.spot < prevSpot.current ? "down" : "flat");
      }
      prevSpot.current = d.spot;
      setData(d);
    };

    return () => es.close();
  }, [active]);

  return { data, dir };
}
