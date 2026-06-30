"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { ArrowUp, ArrowDown, Minus, Radio, Wifi, WifiOff } from "lucide-react";

// Sidecar base URL. In the POC the browser talks to tv-price-svc directly;
// once wired through jk-api this becomes a normal /api/v1 call instead.
const RT_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:8000";

interface RtState {
  symbol: string;
  spot: number | null;
  change: number | null;
  change_pct: number | null;
  spot_time: number | null;
  usdthb: number | null;
  bar_mid: number | null;
  bar_buy: number | null;
  bar_sell: number | null;
  connected: boolean;
  version: number;
}

interface Tick {
  v: number;
  spot: number;
  bar_buy: number;
  bar_sell: number;
  dir: "up" | "down" | "flat";
  ts: number | null;
}

const baht = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

const fmtTime = (ts: number | null) =>
  ts == null ? "-" : new Date(ts * 1000).toLocaleTimeString("th-TH");

export default function RealtimeGoldPage() {
  const [state, setState] = useState<RtState | null>(null);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [live, setLive] = useState(false);
  // Direction of the very latest change, used to flash the main price.
  const [flash, setFlash] = useState<{ dir: "up" | "down" | "flat"; key: number }>({
    dir: "flat",
    key: 0,
  });
  const prevSpot = useRef<number | null>(null);

  useEffect(() => {
    const es = new EventSource(`${RT_URL}/stream`);

    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      let d: RtState;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      if (d.spot == null) return;

      // Work out direction vs the previous spot we rendered.
      let dir: "up" | "down" | "flat" = "flat";
      if (prevSpot.current != null) {
        if (d.spot > prevSpot.current) dir = "up";
        else if (d.spot < prevSpot.current) dir = "down";
      }
      prevSpot.current = d.spot;

      setState(d);
      setFlash({ dir, key: d.version });
      setTicks((prev) =>
        [
          {
            v: d.version,
            spot: d.spot!,
            bar_buy: d.bar_buy!,
            bar_sell: d.bar_sell!,
            dir,
            ts: d.spot_time,
          },
          ...prev,
        ].slice(0, 30)
      );
    };

    return () => es.close();
  }, []);

  const up = (state?.change ?? 0) >= 0;
  const flashClass =
    flash.dir === "up" ? "flash-up" : flash.dir === "down" ? "flash-down" : "";

  return (
    <div className="flex flex-col gap-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-x-3">
          <span className="text-[#c09c42]">
            <Radio size={26} />
          </span>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-b from-black/80 to-[#c09c42]/70 bg-clip-text text-transparent">
              ราคาทองเรียลไทม์
            </h1>
            <p className="text-xs font-bold text-black/40">
              XAU/USD · TradingView socket → ราคาทองไทย (96.5%)
            </p>
          </div>
        </div>
        <Chip
          color={live ? "success" : "danger"}
          variant="flat"
          startContent={live ? <Wifi size={14} /> : <WifiOff size={14} />}
          className="font-bold"
        >
          {live ? "เชื่อมต่อแล้ว" : "หลุดการเชื่อมต่อ"}
        </Chip>
      </div>

      {!state ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Spinner color="warning" />
          <span className="text-sm font-bold text-black/40">กำลังเชื่อมต่อราคา…</span>
        </div>
      ) : (
        <>
          {/* Main price cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* รับซื้อ */}
            <div className="flex flex-col gap-y-1 p-5 rounded-3xl border-1 border-black/10 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <span className="text-sm font-bold text-black/50">ราคารับซื้อ (บาท)</span>
              <span
                key={`buy-${flash.key}`}
                className={`text-4xl font-extrabold text-emerald-700 ${flashClass}`}
              >
                {baht(state.bar_buy)}
              </span>
            </div>
            {/* ขายออก */}
            <div className="flex flex-col gap-y-1 p-5 rounded-3xl border-1 border-black/10 bg-gradient-to-br from-amber-500/10 to-transparent">
              <span className="text-sm font-bold text-black/50">ราคาขายออก (บาท)</span>
              <span
                key={`sell-${flash.key}`}
                className={`text-4xl font-extrabold text-amber-700 ${flashClass}`}
              >
                {baht(state.bar_sell)}
              </span>
            </div>
            {/* Spot */}
            <div className="flex flex-col gap-y-1 p-5 rounded-3xl border-1 border-black/10 bg-gradient-to-br from-black/10 to-transparent">
              <span className="text-sm font-bold text-black/50">XAU/USD (spot)</span>
              <span
                key={`spot-${flash.key}`}
                className={`text-4xl font-extrabold text-black/80 ${flashClass}`}
              >
                {state.spot?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  up ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {state.change?.toFixed(2)} ({state.change_pct?.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-black/40">
            <span>USD/THB: {state.usdthb?.toFixed(4)}</span>
            <span>กลางราคา: {baht(state.bar_mid)} บาท</span>
            <span>อัปเดต: {fmtTime(state.spot_time)}</span>
          </div>

          {/* Recent ticks table */}
          <div className="rounded-3xl border-1 border-black/10 overflow-hidden">
            <div className="px-5 py-3 font-bold text-sm bg-black/5">
              รายการล่าสุด ({ticks.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-black/40 border-b border-black/10">
                    <th className="px-5 py-2 font-bold">เวลา</th>
                    <th className="px-5 py-2 font-bold text-right">XAU/USD</th>
                    <th className="px-5 py-2 font-bold text-right">รับซื้อ</th>
                    <th className="px-5 py-2 font-bold text-right">ขายออก</th>
                    <th className="px-5 py-2 font-bold text-center">ทิศทาง</th>
                  </tr>
                </thead>
                <tbody>
                  {ticks.map((t) => (
                    <tr
                      key={t.v}
                      className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
                    >
                      <td className="px-5 py-2 text-black/60">{fmtTime(t.ts)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {t.spot.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums">{baht(t.bar_buy)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{baht(t.bar_sell)}</td>
                      <td className="px-5 py-2">
                        <span
                          className={`flex items-center justify-center ${
                            t.dir === "up"
                              ? "text-emerald-600"
                              : t.dir === "down"
                              ? "text-red-600"
                              : "text-black/30"
                          }`}
                        >
                          {t.dir === "up" ? (
                            <ArrowUp size={16} />
                          ) : t.dir === "down" ? (
                            <ArrowDown size={16} />
                          ) : (
                            <Minus size={16} />
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Flash animation — replays on each price change via the `key` remount */}
      <style jsx>{`
        .flash-up {
          animation: flashUp 0.6s ease-out;
        }
        .flash-down {
          animation: flashDown 0.6s ease-out;
        }
        @keyframes flashUp {
          0% {
            color: #16a34a;
            text-shadow: 0 0 14px rgba(22, 163, 74, 0.7);
            transform: scale(1.06);
          }
          100% {
            text-shadow: none;
            transform: scale(1);
          }
        }
        @keyframes flashDown {
          0% {
            color: #dc2626;
            text-shadow: 0 0 14px rgba(220, 38, 38, 0.7);
            transform: scale(1.06);
          }
          100% {
            text-shadow: none;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
