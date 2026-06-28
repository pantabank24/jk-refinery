"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface SalesStatus {
  enabled: boolean;
  is_open: boolean;
  open_time: string;
  close_time: string;
  now: string;
}

// useSalesStatus fetches whether sales are currently open. Available to any
// authenticated user (the endpoint is not permission-gated).
export function useSalesStatus() {
  const [status, setStatus] = useState<SalesStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<SalesStatus>("/configs/sales-status");
      setStatus((res.data as unknown as SalesStatus) ?? null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, loading, refresh };
}
