"use client";

import { Building2, Radio, Clock } from "lucide-react";
import type { SalesStatus } from "@/hooks/use-sales-status";

// Which gold feed prices the item being keyed in: the association price
// (/gold-prices/latest) or the live real-time feed (/gold-prices/realtime).
export type GoldPriceSource = "association" | "realtime";

// The shop's schedule (price_mode) is the default. A user may override it for the
// document they're keying in — `picked` (null = still following the config) wins.
// The override is per-document only: it never writes back to the shop config.
export function resolveGoldSource(
  picked: GoldPriceSource | null,
  status: SalesStatus | null,
): GoldPriceSource {
  if (picked) return picked;
  return status?.price_mode === "realtime" ? "realtime" : "association";
}

const LABEL: Record<GoldPriceSource, string> = {
  association: "ราคาสมาคม",
  realtime: "ราคาเรียลไทม์",
};

// Segmented control that REPLACES PriceModeChip on the gold calculators: it says
// which price is in use (same job as the chip) and lets it be switched. Switching
// applies to the document being keyed in only — the shop config is untouched, and
// picking the scheduled side again goes back to following it.
export function GoldPriceSourceToggle({
  value,
  onChange,
  status,
  /** Real-time picked but no live price has arrived yet (sidecar down/starting) —
   *  the association price is used meanwhile, so say so. */
  waitingRealtime = false,
}: {
  value: GoldPriceSource;
  /** null = go back to following the shop config. */
  onChange: (v: GoldPriceSource | null) => void;
  status: SalesStatus | null;
  waitingRealtime?: boolean;
}) {
  const closed = !!status && (!status.enabled || status.price_mode === "closed");
  const scheduled: GoldPriceSource =
    status?.price_mode === "realtime" ? "realtime" : "association";
  const overridden = value !== scheduled && !closed;

  const ACTIVE: Record<GoldPriceSource, string> = {
    association: "bg-green-100 text-green-700 border-green-300",
    realtime: "bg-sky-100 text-sky-700 border-sky-300",
  };

  const pill = (key: GoldPriceSource) => {
    const active = value === key;
    const waiting = active && key === "realtime" && waitingRealtime;
    return (
      <button
        type="button"
        onClick={() => onChange(key === scheduled ? null : key)}
        title={
          waiting
            ? "ยังไม่ได้รับราคาเรียลไทม์ — ใช้ราคาสมาคมชั่วคราว"
            : key === scheduled
              ? `${LABEL[key]} — ตามที่ตั้งค่าไว้`
              : `ขายด้วย${LABEL[key]} เฉพาะใบนี้ (ไม่เปลี่ยนการตั้งค่าของร้าน)`
        }
        className={`inline-flex items-center gap-x-1 px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap transition-colors ${
          waiting
            ? "bg-amber-100 text-amber-700 border-amber-300"
            : active
              ? ACTIVE[key]
              : "border-transparent text-black/40 hover:text-black/70"
        }`}
      >
        {key === "realtime" ? <Radio size={13} /> : <Building2 size={13} />}
        {LABEL[key]}
        {waiting && "…"}
      </button>
    );
  };

  return (
    <span className="inline-flex items-center gap-x-1 shrink-0">
      {closed && (
        <span className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap bg-amber-100 text-amber-700 border-amber-300">
          <Clock size={13} />
          ปิดการขาย
        </span>
      )}
      <span
        className={`inline-flex items-center gap-0.5 p-0.5 rounded-full border-1 ${
          // Overridden = deliberately not what the shop config says; the amber
          // outline is the only hint needed since the pills already name the price.
          overridden ? "border-amber-300 bg-amber-50" : "border-black/10 bg-black/5"
        }`}
      >
        {pill("association")}
        {pill("realtime")}
      </span>
    </span>
  );
}
