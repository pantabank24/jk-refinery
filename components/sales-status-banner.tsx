"use client";

import { Clock } from "lucide-react";
import type { SalesStatus } from "@/hooks/use-sales-status";

// Shows a banner reflecting the current sale-hours state. Renders an amber
// "closed" warning when sales are closed, and (optionally) a green "open" note.
export function SalesStatusBanner({
  status,
  showWhenOpen = false,
}: {
  status: SalesStatus | null;
  showWhenOpen?: boolean;
}) {
  if (!status || !status.enabled) return null;

  if (!status.is_open) {
    return (
      <div className="flex items-start gap-x-2 bg-amber-50 border-1 border-amber-300 rounded-2xl p-3">
        <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-amber-700">ขณะนี้ปิดทำการ</span>
          <span className="text-xs text-amber-600">
            เวลาทำการ {status.open_time} - {status.close_time} น. (ขณะนี้ {status.now} น.) — ยังไม่สามารถออกใบเสนอราคา/บิลได้
          </span>
        </div>
      </div>
    );
  }

  if (showWhenOpen) {
    return (
      <div className="flex items-center gap-x-2 bg-green-50 border-1 border-green-300 rounded-2xl p-3">
        <Clock size={16} className="text-green-600 shrink-0" />
        <span className="text-sm font-bold text-green-700">
          เปิดทำการ · เวลาทำการ {status.open_time} - {status.close_time} น.
        </span>
      </div>
    );
  }

  return null;
}
