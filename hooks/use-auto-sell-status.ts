"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Mirrors service.AutoSellStatus — the same gates and caps the engine applies, so
// a screen can never offer something the engine would refuse.
export interface AutoSellStatus {
  enabled: boolean;
  ignore_hours: boolean;
  max_slippage_thb: number;
  max_active_orders: number;
  max_active_weight: number;
  max_feed_age_sec: number;
  tick_seconds: number;
  // True when an order whose target the price reached would fill right now.
  can_fire_now: boolean;
  // Thai explanation of a false can_fire_now, ready to display.
  blocked_reason: string;
  // The live buy price targets are compared against; null when there is no feed.
  price: number | null;
  premium_thb: number;
  spread_thb: number;
  // Mirrors the sell screen's stepper. Step is 0 when any whole weight is allowed.
  weight_min: number;
  weight_max: number;
  weight_step: number;
}

// useAutoSellStatus fetches whether auto-sell is available right now. Available to
// any authenticated user (the endpoint is not permission-gated), which is what
// lets the sidebar hide the feature while it is switched off.
//
// pollMs re-reads it on an interval — the gates (feed health, shop open, trading
// hours) change on their own, with nothing in the UI to trigger a refetch.
//
// enabled turns the fetching off entirely. Resolving the status makes the API
// call out to the price sidecar, so a caller that renders on every page (the
// sidebar) must not pay for it on behalf of users who can't use the feature.
export function useAutoSellStatus(pollMs = 0, enabled = true) {
  const [status, setStatus] = useState<AutoSellStatus | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get<AutoSellStatus>("/sell-orders/status");
      setStatus((res.data as unknown as AutoSellStatus) ?? null);
    } catch {
      // Keep the last known status: a transient error must not make the menu
      // blink out or the screen claim the feature is off.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    if (!pollMs) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs, enabled]);

  return { status, loading, refresh };
}
