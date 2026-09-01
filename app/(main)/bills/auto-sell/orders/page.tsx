"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeGold } from "@/hooks/use-realtime-gold";
import { useAutoSellStatus } from "@/hooks/use-auto-sell-status";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  Target,
  ShieldOff,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  Plus,
} from "lucide-react";
import {
  SellOrder,
  STATUS_LABEL,
  STATUS_STYLE,
  isWaiting,
  money,
  plain,
  formatWhen,
} from "../_component/sellOrder";

type Tab = "waiting" | "done";

export default function AutoSellOrdersPage() {
  const { permissions } = useAuth();
  // Same gate as the form page: this list is the customer's own orders.
  const canCreate = permissions.includes("sell_orders.create");

  const { status } = useAutoSellStatus(30000);
  const [orders, setOrders] = useState<SellOrder[] | null>(null);
  const [tab, setTab] = useState<Tab>("waiting");
  const [cancelling, setCancelling] = useState<SellOrder | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // The live price drives the "still X baht away" read-out, which is the whole
  // reason to keep this page open.
  const { data: rt } = useRealtimeGold(true);
  const livePrice = rt?.bar_buy ?? status?.price ?? null;

  const load = useCallback(async () => {
    if (!canCreate) return;
    try {
      const res = await api.get<SellOrder[]>("/sell-orders?limit=100");
      setOrders((res.data as unknown as SellOrder[]) || []);
    } catch {
      /* keep the last known list on a transient error */
    }
  }, [canCreate]);

  useEffect(() => {
    load();
    // An order can fill while this page is open, with nothing on the page to
    // trigger a refetch.
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const waiting = useMemo(() => (orders ?? []).filter(isWaiting), [orders]);
  const done = useMemo(
    () => (orders ?? []).filter((o) => !isWaiting(o)),
    [orders],
  );
  const shown = tab === "waiting" ? waiting : done;

  const doCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      await api.post(`/sell-orders/${cancelling.id}/cancel`, {});
      setCancelling(null);
      await load();
    } catch (err: unknown) {
      // Most likely the engine filled it a moment ago — reload so the row shows
      // what actually happened instead of leaving a stale "ยกเลิก" button.
      setCancelError(
        err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ",
      );
      await load();
    } finally {
      setCancelBusy(false);
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

  if (orders === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  const tabButton = (key: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`text-xs font-bold px-3 py-1.5 rounded-full border-1 transition-all ${
        tab === key
          ? "bg-[#c09c42]/20 border-[#c09c42]/50 text-black/80"
          : "bg-black/5 border-black/10 text-black/50 hover:bg-black/10"
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="flex flex-col gap-y-3">
      {/* Same width discipline as the sell screen — a list of short rows must not
          stretch across a desktop monitor. */}
      <div className="flex flex-row justify-start md:flex-1 md:min-h-0">
        <div className="flex flex-col w-full min-w-0 xl:w-[700px] mb-5 gap-y-3">
          {/* Header */}
          <div className="flex flex-row items-center justify-between gap-x-2 px-1">
            <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate min-w-0">
              คำสั่งขายอัตโนมัติ
            </span>
            <Button
              as={Link}
              href="/bills/auto-sell"
              size="sm"
              className="shrink-0 rounded-2xl bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              startContent={<Plus size={15} />}
            >
              ตั้งคำสั่งใหม่
            </Button>
          </div>

          {/* Live price + caps */}
          <div className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl px-5 py-4 gap-x-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-black/50">
                ราคารับซื้อตอนนี้
              </span>
              <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                {livePrice != null ? money(livePrice) : "—"}
              </span>
            </div>
            <span className="text-[11px] font-bold text-sky-700 text-right shrink-0">
              รออยู่ {waiting.length}/{status?.max_active_orders ?? "-"} รายการ
              <br />
              {plain(waiting.reduce((s, o) => s + o.weight, 0))}/
              {plain(status?.max_active_weight ?? 0)} บาททอง
            </span>
          </div>

          {/* Tabs */}
          <div className="flex flex-row items-center gap-x-2 px-1">
            {tabButton("waiting", "รอราคา", waiting.length)}
            {tabButton("done", "ประวัติ", done.length)}
          </div>

          {/* Rows */}
          {shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-y-2 text-black/40 border-1 border-black/10 bg-black/5 rounded-3xl py-12">
              <Target size={28} />
              <span className="text-sm font-bold">
                {tab === "waiting"
                  ? "ยังไม่มีคำสั่งที่รอราคา"
                  : "ยังไม่มีประวัติคำสั่งขาย"}
              </span>
              {tab === "waiting" && (
                <Link
                  href="/bills/auto-sell"
                  className="text-xs font-bold text-yellow-700 hover:underline"
                >
                  ตั้งคำสั่งขายแรกของคุณ
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-y-2">
              {shown.map((o) => {
                const gap = livePrice != null ? o.target_price - livePrice : null;
                return (
                  <div
                    key={o.id}
                    className="flex flex-row items-center justify-between gap-x-3 border-1 border-black/10 bg-white/50 backdrop-blur-xl rounded-2xl p-3"
                  >
                    <div className="flex flex-col min-w-0 gap-y-0.5">
                      <div className="flex items-center gap-x-2 flex-wrap">
                        <span className="font-bold text-sm">
                          {plain(o.weight)} บาททอง @ {money(o.target_price)} บาท
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_STYLE[o.status]}`}
                        >
                          {STATUS_LABEL[o.status]}
                        </span>
                      </div>

                      {o.status === "active" && (
                        <span className="text-[11px] text-black/50 flex items-center gap-x-1">
                          <Clock size={11} />
                          {gap != null && gap > 0
                            ? `ยังห่างเป้า ${money(gap)} บาท`
                            : "รอรอบตรวจราคาถัดไป"}
                          {" · ประมาณ "}
                          {money(o.target_price * o.weight)} บาท
                        </span>
                      )}
                      {o.status === "filling" && (
                        <span className="text-[11px] text-amber-700 font-bold">
                          ถึงราคาแล้ว กำลังออกบิล…
                        </span>
                      )}
                      {o.status === "filled" && (
                        <span className="text-[11px] text-green-700 flex items-center gap-x-1 flex-wrap">
                          <CheckCircle2 size={11} />
                          ขายที่{" "}
                          {o.filled_price != null ? money(o.filled_price) : "—"}{" "}
                          บาท
                          {o.filled_price != null &&
                            o.filled_price > o.target_price && (
                              <span className="text-green-800 font-bold">
                                (สูงกว่าเป้า{" "}
                                {money(o.filled_price - o.target_price)})
                              </span>
                            )}
                          {o.bill && <> · ยอด {money(o.bill.total_amount)} บาท</>}
                          {o.filled_at && <> · {formatWhen(o.filled_at)}</>}
                        </span>
                      )}
                      {o.status === "cancelled" && (
                        <span className="text-[11px] text-black/40 flex items-center gap-x-1">
                          <XCircle size={11} />
                          {o.cancel_reason || "ยกเลิกแล้ว"}
                        </span>
                      )}
                      {o.note && (
                        <span className="text-[11px] text-black/35 truncate">
                          {o.note}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-x-1 shrink-0">
                      {o.status === "filled" && o.bill && (
                        <Link
                          href="/bills"
                          className="text-[11px] font-bold text-yellow-700 flex items-center gap-x-1 px-2 py-1 rounded-xl hover:bg-black/5 transition-colors"
                        >
                          <Receipt size={13} /> {o.bill.code}
                        </Link>
                      )}
                      {o.status === "active" && (
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          className="rounded-xl font-bold"
                          onPress={() => {
                            setCancelError("");
                            setCancelling(o);
                          }}
                        >
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm cancelling one */}
      <Modal
        isOpen={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        size="sm"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-lg">ยกเลิกคำสั่งขาย</span>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/60">
              ยกเลิกคำสั่งขาย {cancelling ? plain(cancelling.weight) : ""} บาททอง
              ที่ราคา {cancelling ? money(cancelling.target_price) : ""} บาท
              ใช่หรือไม่?
            </p>
            {cancelError && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                {cancelError}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setCancelling(null)}
              isDisabled={cancelBusy}
            >
              ไม่ยกเลิก
            </Button>
            <Button color="danger" onPress={doCancel} isLoading={cancelBusy}>
              ยกเลิกคำสั่งขาย
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
