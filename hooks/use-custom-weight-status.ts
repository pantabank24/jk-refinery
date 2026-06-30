"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface CustomWeightStatus {
  enabled: boolean;
  allowed: boolean;
  open_time: string;
  close_time: string;
  rule_source: string; // range|weekday|none
  now: string;
}

// useCustomWeightStatus fetches whether customers may type the bill weight
// directly right now. Available to any authenticated user (the endpoint is
// not permission-gated).
export function useCustomWeightStatus() {
  const [status, setStatus] = useState<CustomWeightStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<CustomWeightStatus>("/configs/custom-weight-status");
      setStatus((res.data as unknown as CustomWeightStatus) ?? null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, loading, refresh };
}
