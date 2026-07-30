"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useAutoSellStatus } from "@/hooks/use-auto-sell-status";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import {
  Zap,
  Clock,
  Gauge,
  Layers,
  Radio,
  RefreshCw,
  AlertTriangle,
  Target,
  Scale,
} from "lucide-react";

interface SystemConfig {
  key: string;
  value: string;
  description: string;
}

// The customer's own list carries more fields; this page only needs who placed
// each waiting order and what it is waiting for.
interface SellOrder {
  id: number;
  weight: number;
  target_price: number;
  status: "active" | "filling" | "filled" | "cancelled";
  price_at_create: number;
  spread_at_create: number;
  user?: { id: number; name: string } | null;
  created_at: string;
}

const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const plain = (n: number) => n.toLocaleString();

export default function AutoSellSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("config.update");
  const canManage = hasPermission("sell_orders.manage");

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [waiting, setWaiting] = useState<SellOrder[]>([]);
  const [checking, setChecking] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The badge, the live price and the blocked reason are all derived server-side
  // from the same gate the engine uses, so they are read back rather than guessed.
  const { status, refresh: loadStatus } = useAutoSellStatus();

  const loadWaiting = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await api.get<SellOrder[]>(
        "/sell-orders?status=active&limit=100",
      );
      setWaiting((res.data as unknown as SellOrder[]) || []);
    } catch {
      /* ignore */
    }
  }, [canManage]);

  useEffect(() => {
    (async () => {
      try {
        const cRes = await api.get<SystemConfig[]>("/configs");
        const map: Record<string, string> = {};
        ((cRes.data as unknown as SystemConfig[]) || []).forEach((c) => {
          map[c.key] = c.value;
        });
        setCfg(map);
      } catch {
        /* ignore */
      }
      // The status is already being fetched by the hook — asking again here would
      // be a second round trip to the price sidecar for the same answer.
      await loadWaiting();
      setLoading(false);
    })();
  }, [loadWaiting]);

  // Persist one key, then re-read the computed status (the badge and the blocked
  // reason are derived server-side, so echoing the local value would lie).
  const saveKey = async (key: string, value: string) => {
    const prev = cfg[key];
    setCfg((p) => ({ ...p, [key]: value }));
    setSaveError("");
    try {
      await api.put("/configs", { key, value });
      await loadStatus();
    } catch (err: unknown) {
      setCfg((p) => ({ ...p, [key]: prev ?? "" }));
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  };

  const runNow = async () => {
    setChecking(true);
    try {
      await api.post("/sell-orders/run-now", {});
      await Promise.all([loadStatus(), loadWaiting()]);
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  };

  const cancelOrder = async (id: number) => {
    try {
      await api.post(`/sell-orders/${id}/cancel`, {
        reason: "ยกเลิกโดยเจ้าหน้าที่",
      });
      await loadWaiting();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  const enabled = cfg["auto_sell_enabled"] === "true";
  const ignoreHours = cfg["auto_sell_ignore_hours"] !== "false"; // default true

  // A numeric config row rendered as an editable field. Saved on blur so a
  // half-typed number never reaches the engine mid-keystroke.
  const NumberRow = ({
    icon,
    title,
    hint,
    keyName,
    unit,
    fallback,
  }: {
    icon: React.ReactNode;
    title: string;
    hint: string;
    keyName: string;
    unit: string;
    fallback: string;
  }) => (
    <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-2">
      <div className="flex flex-col">
        <span className="font-bold text-md flex items-center gap-x-2">
          {icon} {title}
        </span>
        <span className="text-xs text-black/50">{hint}</span>
      </div>
      <Input
        type="number"
        aria-label={title}
        defaultValue={cfg[keyName] ?? fallback}
        isDisabled={!canEdit}
        onBlur={(e) => {
          const v = (e.target as HTMLInputElement).value.trim();
          if (v !== "" && v !== cfg[keyName]) saveKey(keyName, v);
        }}
        endContent={
          <span className="text-xs font-bold text-black/40">{unit}</span>
        }
        classNames={{
          inputWrapper:
            "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between gap-x-2 shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 truncate min-w-0">
          ตั้งค่าขายอัตโนมัติ
        </div>
        {status && (
          <span
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border-1 ${
              status.can_fire_now
                ? "bg-green-500/15 text-green-700 border-green-500/30"
                : "bg-amber-500/15 text-amber-700 border-amber-500/30"
            }`}
          >
            {status.can_fire_now
              ? "พร้อมยิงคำสั่ง"
              : status.blocked_reason || "ยังไม่ยิงคำสั่ง"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-y-4 overflow-y-auto pb-6">
        {saveError && (
          <div className="flex items-center gap-x-2 text-sm text-red-600 bg-red-50 border-1 border-red-200 rounded-2xl px-4 py-2">
            <AlertTriangle size={15} /> {saveError}
          </div>
        )}

        {/* Master toggle */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-1">
          <div className="flex flex-row items-center justify-between gap-x-3">
            <div className="flex flex-col">
              <span className="font-bold text-md flex items-center gap-x-2">
                <Zap size={16} className="text-[#c09c42]" />{" "}
                เปิดระบบขายอัตโนมัติ
              </span>
              <span className="text-xs text-black/50">
                ลูกค้าตั้งราคาเป้าหมายได้
                และระบบจะออกบิลขายให้เองเมื่อราคารับซื้อถึงเป้า
              </span>
            </div>
            <Switch
              isDisabled={!canEdit}
              isSelected={enabled}
              color="warning"
              onValueChange={(v) =>
                saveKey("auto_sell_enabled", v ? "true" : "false")
              }
            />
          </div>
        </div>

        {/* Live price + manual pass */}
        <div className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-x-3">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-black/50 flex items-center gap-x-1">
              <Radio size={13} className="text-sky-600" />{" "}
              ราคารับซื้อที่ใช้เทียบเป้าหมาย
            </span>
            <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {status?.price != null ? money(status.price) : "—"}
            </span>
            <span className="text-[11px] text-black/40">
              ราคากลาง{" "}
              {status
                ? `${status.premium_thb >= 0 ? "+" : ""}${status.premium_thb}`
                : "—"}{" "}
              บาท · ถ่าง {status?.spread_thb ?? "—"} บาท → รับซื้อ = กลาง −
              ถ่าง/2
            </span>
          </div>
          <Button
            size="sm"
            variant="flat"
            className="rounded-2xl font-bold shrink-0"
            startContent={<RefreshCw size={14} />}
            isLoading={checking}
            isDisabled={!canManage}
            onPress={runNow}
          >
            ตรวจเดี๋ยวนี้
          </Button>
        </div>

        {enabled && (
          <>
            {/* Hours */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-1">
              <div className="flex flex-row items-center justify-between gap-x-3">
                <div className="flex flex-col">
                  <span className="font-bold text-md flex items-center gap-x-2">
                    <Clock size={16} className="text-[#c09c42]" />{" "}
                    ยิงคำสั่งนอกเวลาทำการได้
                  </span>
                  <span className="text-xs text-black/50">
                    {ignoreHours
                      ? "ถึงเป้าตอนไหนก็ขายให้ทันที ไม่สนใจตารางเวลาขาย"
                      : "ขายให้เฉพาะช่วงที่ตารางเวลาเปิดขายด้วยราคาเรียลไทม์"}
                    {' · ปุ่ม "ปิดรับซื้อทอง" ยังหยุดการขายอัตโนมัติเสมอ'}
                  </span>
                </div>
                <Switch
                  isDisabled={!canEdit}
                  isSelected={ignoreHours}
                  color="warning"
                  onValueChange={(v) =>
                    saveKey("auto_sell_ignore_hours", v ? "true" : "false")
                  }
                />
              </div>
            </div>

            <NumberRow
              icon={<Gauge size={16} className="text-[#c09c42]" />}
              title="ส่วนต่างสูงสุดที่ยอมให้เกินเป้า"
              hint="ราคาอาจกระโดดข้ามเป้าระหว่างรอบตรวจ ระบบขายที่ราคาจริงที่จับได้ แต่ถ้าเกินเป้ามากกว่าค่านี้จะข้ามไว้ก่อน (ถือว่าราคาน่าสงสัย) · 0 = ไม่จำกัด"
              keyName="auto_sell_max_slippage_thb"
              unit="บาท"
              fallback="0"
            />

            <NumberRow
              icon={<Layers size={16} className="text-[#c09c42]" />}
              title="จำนวนคำสั่งที่รออยู่ได้ต่อลูกค้า"
              hint="ระบบไม่มีการจองทองไว้จริง เพดานนี้กันกรณีราคาพุ่งแล้วยิงพร้อมกันหลายรายการเกินกว่าที่ลูกค้าจะส่งของได้"
              keyName="auto_sell_max_active_orders"
              unit="รายการ"
              fallback="5"
            />

            <NumberRow
              icon={<Scale size={16} className="text-[#c09c42]" />}
              title="น้ำหนักรวมที่รออยู่ได้ต่อลูกค้า"
              hint="รวมทุกคำสั่งที่ยังรอราคาของลูกค้าคนนั้น"
              keyName="auto_sell_max_active_weight"
              unit="บาททอง"
              fallback="200"
            />

            <NumberRow
              icon={<Radio size={16} className="text-[#c09c42]" />}
              title="อายุราคาสูงสุดที่ยอมให้ยิง"
              hint="ถ้าราคาเรียลไทม์ไม่อัปเดตนานกว่านี้ ระบบจะไม่ยิงคำสั่งเลย (กันราคาค้าง/ฟีดหลุดแล้วขายที่ราคาผิด)"
              keyName="auto_sell_max_feed_age_sec"
              unit="วินาที"
              fallback="15"
            />

            <NumberRow
              icon={<RefreshCw size={16} className="text-[#c09c42]" />}
              title="ความถี่ในการตรวจราคา"
              hint="ยิ่งถี่ยิ่งเกาะราคาได้ใกล้ แต่ก็เรียกฟีดถี่ขึ้น (แก้แล้วมีผลทันที ไม่ต้องรีสตาร์ท)"
              keyName="auto_sell_tick_seconds"
              unit="วินาที"
              fallback="5"
            />

            {/* Waiting orders across all customers */}
            {canManage && (
              <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-md flex items-center gap-x-2">
                      <Target size={16} className="text-[#c09c42]" />{" "}
                      คำสั่งขายที่รออยู่
                    </span>
                    <span className="text-xs text-black/50">
                      ทุกลูกค้า · เรียงตามเป้าที่ใกล้ราคาปัจจุบันที่สุด
                    </span>
                  </div>
                  <span className="text-xs font-bold text-black/40 shrink-0">
                    {waiting.length} รายการ
                  </span>
                </div>

                {waiting.length === 0 ? (
                  <span className="text-xs text-black/40">
                    ยังไม่มีคำสั่งขายที่รออยู่
                  </span>
                ) : (
                  <div className="flex flex-col gap-y-2">
                    {[...waiting]
                      .sort((a, b) => a.target_price - b.target_price)
                      .map((o) => {
                        const gap =
                          status?.price != null
                            ? o.target_price - status.price
                            : null;
                        return (
                          <div
                            key={o.id}
                            className="flex flex-row items-center justify-between gap-x-2 p-3 rounded-2xl border-1 border-black/10 bg-white/50"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm truncate">
                                {o.user?.name || `ลูกค้า #${o.id}`}
                              </span>
                              <span className="text-[11px] text-black/50">
                                {plain(o.weight)} บาททอง @{" "}
                                {money(o.target_price)} บาท
                                {gap != null &&
                                  gap > 0 &&
                                  ` · ห่าง ${money(gap)} บาท`}
                                {o.spread_at_create !==
                                  (status?.spread_thb ??
                                    o.spread_at_create) && (
                                  <span className="text-amber-700 font-bold">
                                    {" "}
                                    · ตั้งไว้ตอนถ่าง {o.spread_at_create}
                                  </span>
                                )}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              className="rounded-xl font-bold shrink-0"
                              onPress={() => cancelOrder(o.id)}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
