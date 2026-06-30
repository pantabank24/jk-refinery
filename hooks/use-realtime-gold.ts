"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

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

// useRealtimeGold polls jk-api's /gold-prices/realtime (which proxies the
// tv-price-svc sidecar over the internal Docker network) while `active`. Going
// through jk-api keeps the call authenticated and needs no extra public
// endpoint for the sidecar. Returns the latest price + the direction of the
// last change so callers can flash the number.
export function useRealtimeGold(active: boolean, intervalMs = 2000) {
  const [data, setData] = useState<RealtimeGold | null>(null);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");
  const prevSpot = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await api.get<RealtimeGold>("/gold-prices/realtime");
        const d = (res.data as unknown as RealtimeGold) || null;
        if (stopped || !d || d.spot == null) return;
        if (prevSpot.current != null) {
          setDir(d.spot > prevSpot.current ? "up" : d.spot < prevSpot.current ? "down" : "flat");
        }
        prevSpot.current = d.spot;
        setData(d);
      } catch {
        /* keep last value on transient errors */
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return { data, dir };
}
