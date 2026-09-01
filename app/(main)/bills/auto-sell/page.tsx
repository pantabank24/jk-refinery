"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeGold } from "@/hooks/use-realtime-gold";
import { useAutoSellStatus } from "@/hooks/use-auto-sell-status";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { DecimalInput } from "@/components/decimalInput";
import {
  Minus,
  Plus,
  Target,
  ShieldOff,
  AlertTriangle,
  TrendingUp,
  Zap,
  ChevronRight,
} from "lucide-react";
import {
  SellOrder,
  isWaiting,
  money,
  plain,
} from "./_component/sellOrder";

export default function AutoSellPage() {
  const { permissions } = useAuth();
  // Auto-sell ordering is a customer flow, like bill creation: the raw permission
  // list decides, so master's auto-grant doesn't put a customer form in front of
  // staff. Staff manage every customer's orders from ตั้งค่าขายอัตโนมัติ instead.
  const canCreate = permissions.includes("sell_orders.create");

  // The gates (feed health, shop open, trading hours) change on their own, with
  // nothing in the UI to trigger a refetch.
  const { status, loading: statusLoading, refresh: refreshStatus } =
    useAutoSellStatus(15000);
  const [orders, setOrders] = useState<SellOrder[] | null>(null);

  const [weight, setWeight] = useState(0);
  const [target, setTarget] = useState(0);
  const [note, setNote] = useState("");
  const [targetTouched, setTargetTouched] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [justPlaced, setJustPlaced] = useState(false);

  // The live price. Polled straight from the feed so the number ticks (and
  // flashes) exactly as it does on the sell screen; the status endpoint carries
  // the same price but is polled far less often.
  const { data: rt, dir: rtDir } = useRealtimeGold(true);
  const livePrice = rt?.bar_buy ?? status?.price ?? null;

  // The orders themselves live on their own page — this one only needs them to
  // measure the new order against the caps.
  const loadOrders = useCallback(async () => {
    if (!canCreate) return;
    try {
      const res = await api.get<SellOrder[]>("/sell-orders?limit=100");
      setOrders((res.data as unknown as SellOrder[]) || []);
    } catch {
      /* keep the last known list on a transient error */
    }
  }, [canCreate]);

  useEffect(() => {
    loadOrders();
    const id = setInterval(loadOrders, 15000);
    return () => clearInterval(id);
  }, [loadOrders]);

  const weightStep =
    status?.weight_step && status.weight_step > 0 ? status.weight_step : 1;
  const weightMin = status?.weight_min ?? 5;
  const weightMax = status?.weight_max ?? 1000;

  // Start the weight at the smallest sellable amount once the caps are known.
  useEffect(() => {
    if (status && weight === 0) setWeight(weightMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Suggest a target just above the market until the customer types their own —
  // an empty field gives no hint of what a sensible number even looks like.
  useEffect(() => {
    if (targetTouched || !livePrice) return;
    setTarget(Math.ceil((livePrice + 100) / 50) * 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrice, targetTouched]);

  const waitingOrders = useMemo(
    () => (orders ?? []).filter(isWaiting),
    [orders],
  );
  const waitingWeight = useMemo(
    () => waitingOrders.reduce((sum, o) => sum + o.weight, 0),
    [waitingOrders],
  );

  const stepWeight = (dir: 1 | -1) =>
    setWeight((w) =>
      Math.min(weightMax, Math.max(weightMin, w + dir * weightStep)),
    );

  const estimated = target * weight;

  // Mirror the server's rules so the reason shows before a round trip.
  const validation = (() => {
    if (!status?.enabled) return "ระบบขายอัตโนมัติปิดอยู่";
    if (weight < weightMin || weight > weightMax)
      return `น้ำหนักต้องอยู่ระหว่าง ${plain(weightMin)} – ${plain(weightMax)} บาท`;
    if (status.weight_step > 0 && weight % status.weight_step !== 0)
      return `น้ำหนักต้องเป็นจำนวนเท่าของ ${plain(status.weight_step)} บาท`;
    if (target <= 0) return "กรุณาระบุราคาเป้าหมาย";
    if (livePrice != null && target <= livePrice)
      return `ราคาเป้าหมายต้องสูงกว่าราคารับซื้อปัจจุบัน (${money(livePrice)} บาท)`;
    if (waitingOrders.length >= status.max_active_orders)
      return `ตั้งคำสั่งค้างไว้ได้ไม่เกิน ${status.max_active_orders} รายการ`;
    if (waitingWeight + weight > status.max_active_weight)
      return `น้ำหนักรวมที่รออยู่ต้องไม่เกิน ${plain(status.max_active_weight)} บาท`;
    return "";
  })();

  const submit = async () => {
    setSaving(true);
    setFormError("");
    try {
      await api.post("/sell-orders", { weight, target_price: target, note });
      setConfirmOpen(false);
      setNote("");
      setTargetTouched(false);
      setJustPlaced(true);
      await Promise.all([loadOrders(), refreshStatus()]);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "ตั้งคำสั่งขายไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  // The master can switch the feature off while a customer has this page open.
  if (status && !status.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/60">
        <Zap size={40} className="text-yellow-600/60" />
        <span className="font-bold text-lg">ยังไม่เปิดขายอัตโนมัติ</span>
        <span className="text-sm text-black/40 text-center">
          ขณะนี้ทางร้านปิดระบบตั้งราคาขายอัตโนมัติ กรุณาติดต่อเจ้าหน้าที่
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      {/* Same width discipline as the sell screen: a form this narrow must not
          stretch across a desktop monitor. */}
      <div className="flex flex-row justify-start md:flex-1 md:min-h-0">
        <div className="flex flex-col w-full min-w-0 xl:w-[700px] mb-5 gap-y-3">
          {/* Why nothing will fire right now — the engine's own reason, verbatim. */}
          {status && !status.can_fire_now && status.blocked_reason && (
            <div className="flex items-start gap-x-2 border-1 border-amber-300/60 bg-amber-50/80 rounded-3xl px-4 py-3">
              <AlertTriangle
                size={16}
                className="text-amber-600 mt-0.5 shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-amber-800">
                  {status.blocked_reason}
                </span>
                <span className="text-[11px] text-amber-700/80">
                  ตั้งคำสั่งไว้ล่วงหน้าได้ ระบบจะขายให้เมื่อกลับมาพร้อมและราคาถึงเป้า
                </span>
              </div>
            </div>
          )}

          {/* Live buy price — the exact number a target is compared against */}
          <div
            key={rt?.version}
            className={`flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 ${
              rtDir === "up"
                ? "rt-flash-up"
                : rtDir === "down"
                  ? "rt-flash-down"
                  : ""
            }`}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-black/50 flex items-center gap-x-1">
                <TrendingUp size={13} className="text-[#c09c42]" />{" "}
                ราคารับซื้อทองคำแท่ง (เรียลไทม์)
              </span>
              <span className="font-bold text-3xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                {livePrice != null ? money(livePrice) : "—"}
              </span>
              <span className="text-[11px] text-black/40">
                บาท / บาททอง · เป้าหมายของคุณจะถูกเทียบกับราคานี้
              </span>
            </div>
            <span className="text-[11px] font-bold text-black/40 shrink-0">
              ตรวจราคาทุก {status?.tick_seconds ?? 5} วินาที
            </span>
          </div>

          {/* Order form */}
          <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-4">
            <div className="flex flex-col">
              <span className="font-bold text-md flex items-center gap-x-2">
                <Target size={16} className="text-[#c09c42]" /> ตั้งคำสั่งขายใหม่
              </span>
              <span className="text-xs text-black/50">
                เมื่อราคารับซื้อขึ้นถึงเป้าหมาย ระบบจะออกบิลขายให้ทันทีโดยไม่ต้องกดยืนยันอีก
              </span>
            </div>

            {/* Weight */}
            <div className="flex flex-col gap-y-1">
              <span className="text-xs font-bold text-black/50 pl-1">
                น้ำหนักที่จะขาย (บาท)
                {status?.weight_step
                  ? ` · ปรับทีละ ${plain(status.weight_step)}`
                  : " · พิมพ์เองได้ตอนนี้"}
              </span>
              <div className="flex items-center justify-between gap-x-3">
                <button
                  type="button"
                  onClick={() => stepWeight(-1)}
                  disabled={weight <= weightMin}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-red-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-red-600/60 transition-all"
                >
                  <Minus size={22} className="text-red-700" />
                </button>
                <div className="flex-1 flex flex-col items-center justify-center border-1 border-black/10 bg-black/5 rounded-2xl py-3 select-none">
                  <span className="font-bold text-3xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {weight}
                  </span>
                  <span className="text-[10px] font-bold text-black/40">บาท</span>
                </div>
                <button
                  type="button"
                  onClick={() => stepWeight(1)}
                  disabled={weight >= weightMax}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-green-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-green-600/60 transition-all"
                >
                  <Plus size={22} className="text-green-700" />
                </button>
              </div>
            </div>

            {/* Target price */}
            <div className="flex flex-col gap-y-1">
              <span className="text-xs font-bold text-black/50 pl-1">
                ขายเมื่อราคารับซื้อถึง (บาท/บาททอง)
              </span>
              <DecimalInput
                label="ราคาเป้าหมาย"
                value={target}
                onChange={(n) => {
                  setTargetTouched(true);
                  setTarget(n);
                }}
                maxDecimals={2}
                endContent={
                  <span className="text-xs font-bold text-black/40">บาท</span>
                }
              />
              {livePrice != null && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[100, 200, 500, 1000].map((delta) => {
                    const value = Math.ceil((livePrice + delta) / 50) * 50;
                    return (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => {
                          setTargetTouched(true);
                          setTarget(value);
                        }}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full border-1 border-black/10 bg-white/60 hover:bg-white transition-colors"
                      >
                        +{plain(delta)} ({plain(value)})
                      </button>
                    );
                  })}
                </div>
              )}
              {livePrice != null && target > livePrice && (
                <span className="text-[11px] text-black/40 pl-1">
                  สูงกว่าราคาปัจจุบัน {money(target - livePrice)} บาท
                </span>
              )}
            </div>

            <Input
              label="หมายเหตุ (ไม่บังคับ)"
              value={note}
              onValueChange={setNote}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />

            {/* Estimate */}
            <div className="flex flex-col border-1 border-yellow-200 bg-yellow-50/70 rounded-2xl px-4 py-3">
              <span className="text-xs font-bold text-black/50">
                ถ้าถึงเป้าหมาย จะได้รับประมาณ
              </span>
              <span className="font-bold text-2xl text-yellow-700">
                {estimated > 0 ? money(estimated) : "—"} บาท
              </span>
              <span className="text-[11px] text-black/40">
                {plain(weight)} บาททอง × {target > 0 ? money(target) : "—"} บาท
                {status && status.max_slippage_thb > 0
                  ? ` · ถ้าราคาพุ่งเกินเป้า ระบบขายที่ราคาจริง (ไม่เกิน +${plain(status.max_slippage_thb)} บาท)`
                  : " · ถ้าราคาพุ่งเกินเป้า ระบบขายที่ราคาจริงที่จับได้"}
              </span>
            </div>

            {validation ? (
              <span className="text-xs font-bold text-amber-700">
                {validation}
              </span>
            ) : null}

            <Button
              className="rounded-2xl bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold self-end"
              startContent={<Zap size={16} />}
              isDisabled={!!validation}
              onPress={() => {
                setFormError("");
                setConfirmOpen(true);
              }}
            >
              ตั้งคำสั่งขาย
            </Button>
          </div>

          {/* Link to the orders page, doubling as the caps read-out */}
          <Link
            href="/bills/auto-sell/orders"
            className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 hover:bg-black/10 transition-colors backdrop-blur-xl rounded-3xl p-5"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                คำสั่งขายของคุณ
                {justPlaced && (
                  <span className="ml-2 text-[11px] font-bold text-green-700">
                    ตั้งคำสั่งแล้ว ✓
                  </span>
                )}
              </span>
              <span className="text-xs text-black/50">
                {orders === null
                  ? "กำลังโหลด…"
                  : waitingOrders.length === 0
                    ? "ยังไม่มีคำสั่งที่รอราคา · กดเพื่อดูประวัติทั้งหมด"
                    : `รออยู่ ${waitingOrders.length}/${status?.max_active_orders ?? "-"} รายการ · ${plain(waitingWeight)}/${plain(status?.max_active_weight ?? 0)} บาททอง`}
              </span>
            </div>
            <ChevronRight size={20} className="text-black/40 shrink-0" />
          </Link>
        </div>
      </div>

      {/* Confirm placing the order */}
      <Modal
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        size="sm"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  ยืนยันคำสั่งขายอัตโนมัติ
                </span>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <div className="flex flex-col border-1 border-yellow-200 bg-yellow-50 rounded-2xl p-3 gap-y-1">
                    <span className="text-xs text-black/50">
                      ทองคำแท่ง 96.5%
                    </span>
                    <span className="font-bold text-2xl text-yellow-700">
                      {money(estimated)} บาท
                    </span>
                    <span className="text-xs text-black/40">
                      {plain(weight)} บาททอง · ขายเมื่อราคาถึง {money(target)} บาท
                    </span>
                  </div>
                  <p className="text-sm text-black/60">
                    ระบบจะออกบิลขายให้
                    <span className="font-bold">อัตโนมัติทันที</span>
                    ที่ราคารับซื้อถึงเป้าหมาย โดยไม่ถามยืนยันอีก
                    และคุณต้องนำทองมาส่งตามบิลนั้น
                  </p>
                  <p className="text-xs text-black/40">
                    ยกเลิกได้ตลอดเวลาก่อนที่ราคาจะถึงเป้าหมาย
                  </p>
                  {formError && (
                    <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                      {formError}
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={saving}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={submit}
                  isLoading={saving}
                >
                  ยืนยัน
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <style jsx>{`
        .rt-flash-up {
          animation: rtUp 0.6s ease-out;
        }
        .rt-flash-down {
          animation: rtDown 0.6s ease-out;
        }
        @keyframes rtUp {
          0% {
            background-color: rgba(22, 163, 74, 0.18);
          }
          100% {
            background-color: transparent;
          }
        }
        @keyframes rtDown {
          0% {
            background-color: rgba(220, 38, 38, 0.18);
          }
          100% {
            background-color: transparent;
          }
        }
      `}</style>
    </div>
  );
}
