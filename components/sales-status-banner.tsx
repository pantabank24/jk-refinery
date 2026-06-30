"use client";

import { Clock, Radio, Building2 } from "lucide-react";
import type { SalesStatus } from "@/hooks/use-sales-status";

// Banner reflecting the current price mode:
//   closed      → amber "ปิดทำการ" warning
//   association → (optional) green note, association price
//   realtime    → blue "ราคาเรียลไทม์" note
export function SalesStatusBanner({
  status,
  showWhenOpen = false,
}: {
  status: SalesStatus | null;
  showWhenOpen?: boolean;
}) {
  if (!status || !status.enabled) return null;

  const mode = status.price_mode;

  if (mode === "closed") {
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

  if (mode === "realtime") {
    return (
      <div className="flex items-center gap-x-2 bg-sky-50 border-1 border-sky-300 rounded-2xl p-3">
        <Radio size={16} className="text-sky-600 shrink-0" />
        <span className="text-sm font-bold text-sky-700">
          ราคาเรียลไทม์ · นอกเวลาสมาคม ({status.open_time} - {status.close_time} น.) — ราคาอัปเดตสด
        </span>
      </div>
    );
  }

  // association
  if (showWhenOpen) {
    return (
      <div className="flex items-center gap-x-2 bg-green-50 border-1 border-green-300 rounded-2xl p-3">
        <Building2 size={16} className="text-green-600 shrink-0" />
        <span className="text-sm font-bold text-green-700">
          ราคาสมาคม · เปิดทำการ {status.open_time} - {status.close_time} น.
        </span>
      </div>
    );
  }

  return null;
}

// PriceModeChip — compact label for the top of calculate panels.
export function PriceModeChip({ status }: { status: SalesStatus | null }) {
  if (!status) return null;
  const mode = !status.enabled ? "closed" : status.price_mode;

  const cfg = {
    closed: { label: "ปิดการขาย", cls: "bg-amber-100 text-amber-700 border-amber-300", icon: <Clock size={13} /> },
    association: { label: "ราคาสมาคม", cls: "bg-green-100 text-green-700 border-green-300", icon: <Building2 size={13} /> },
    realtime: { label: "ราคาเรียลไทม์", cls: "bg-sky-100 text-sky-700 border-sky-300", icon: <Radio size={13} /> },
  }[mode];

  return (
    <span className={`inline-flex items-center gap-x-1 px-2.5 py-1 rounded-full border text-xs font-bold ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
