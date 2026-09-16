"use client";

import { SkeletonList } from "@/components/skeleton";
import { BillCalculate } from "../_component/billCalculate";
import { useState, useEffect } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Clock, ShieldOff, Store } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { SalesStatusBanner } from "@/components/sales-status-banner";

// What POST /bills/price-lock hands back: the shop's price for this sale and
// how long it stands. Confirming sends nothing but lock_id.
interface PriceLock {
  lock_id: string;
  type_name: string;
  metal: string;
  weight: number;
  percent: number;
  price: number;
  per_gram: number;
  total: number;
  price_mode: string;
  expires_at: string;
  expires_in: number;
}

export default function CreateBillPage() {
  const { permissions, refreshUnfinishedBills } = useAuth();
  const { status: salesStatus, loading: salesLoading } = useSalesStatus();
  // Closed for any reason: master switch off, schedule closed, or past the
  // realtime cutoff. (Previously the master-off case slipped through as open.)
  const salesClosed = !!salesStatus && !salesStatus.is_open;
  const [billsOpen, setBillsOpen] = useState<boolean | null>(null);
  // Silver has its own schedule (enable + close-shop + daily cutoff), independent
  // of the gold sales hours. null = not loaded yet.
  const [silverOpen, setSilverOpen] = useState<boolean | null>(null);
  useEffect(() => {
    api
      .get<{ open: boolean }>("/configs/bills-status")
      .then((res) =>
        setBillsOpen((res.data as unknown as { open: boolean }).open ?? true),
      )
      .catch(() => {
        setBillsOpen(true);
      });
    api
      .get<{ is_open: boolean }>("/configs/silver-sell-status")
      .then((res) =>
        setSilverOpen(
          (res.data as unknown as { is_open: boolean }).is_open ?? false,
        ),
      )
      .catch(() => {
        setSilverOpen(false);
      });
  }, []);
  // Creation is customer-only — raw permission, bypassing master's auto-grant.
  const canCreateBill = permissions.includes("bills.create");
  // The price the shop has committed to for this sale, as returned by the
  // server. The browser no longer prices anything: it asks for a lock, shows
  // what came back, and confirms it by id.
  const [lock, setLock] = useState<PriceLock | null>(null);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(0);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  // Bumped when a lock is refused or a confirm fails, so the calculator reloads
  // the prices it shows before the customer presses ส่งขาย again.
  const [priceRefreshKey, setPriceRefreshKey] = useState(0);

  // Count down to the server's own expiry rather than a fixed ten seconds: the
  // window is a shop setting, and the clock that matters is the server's.
  useEffect(() => {
    if (!showConfirm || !lock) return;

    const expiresAt = new Date(lock.expires_at).getTime();
    const tick = () => {
      const left = Math.ceil((expiresAt - Date.now()) / 1000);
      setConfirmCountdown(Math.max(left, 0));
      if (left <= 0) {
        setShowConfirm(false);
        setLock(null);
        setSaveError("");
        setLockError("หมดเวลาราคาที่ล็อกไว้ กรุณากดส่งขายใหม่");
        setPriceRefreshKey((k) => k + 1);
      }
    };
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [showConfirm, lock]);

  if (!canCreateBill) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  if (billsOpen === null || silverOpen === null || salesLoading) {
    return (
      <SkeletonList rows={6} />
    );
  }

  // Gold and silver open independently. Gold follows bills_open + sales hours;
  // silver follows its own schedule. Show the sell screen if either is open.
  const goldOpen = billsOpen && !salesClosed;
  const silverAllowed = !!silverOpen;

  if (!goldOpen && !silverAllowed) {
    // Nothing sellable — prefer the specific gold reason.
    if (!billsOpen) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/60">
          <Store size={40} className="text-yellow-600/60" />
          <span className="font-bold text-lg">ปิดรับซื้อชั่วคราว</span>
          <span className="text-sm text-black/40 text-center">
            ขณะนี้ยังไม่เปิดรับซื้อ กรุณาติดต่อเจ้าหน้าที่
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/60">
        <Clock size={40} className="text-amber-500/70" />
        <span className="font-bold text-lg">ขณะนี้ร้านปิดทำการ</span>
        <span className="text-sm text-black/40 text-center">
          {salesStatus?.enabled
            ? `เวลาทำการ ${salesStatus.open_time} - ${salesStatus.close_time} น.${salesStatus.realtime_after_hours && salesStatus.realtime_until ? ` (เรียลไทม์ถึง ${salesStatus.realtime_until} น.)` : ""} — ยังไม่สามารถขายได้ในขณะนี้`
            : "ร้านปิดการขายชั่วคราว กรุณาติดต่อเจ้าหน้าที่"}
        </span>
      </div>
    );
  }

  // ส่งขาย asks the server to price the sale and hold that price; the figure in
  // the confirm dialog is the one the bill will carry.
  const handleAdd = async (item: QuotationProps) => {
    setSaveError("");
    setLockError("");
    setLocking(true);
    try {
      const res = await api.post<PriceLock>("/bills/price-lock", {
        type_id: item.typeId,
        metal: item.metal ?? "gold",
        weight: item.weight,
        percent: item.percent,
      });
      setLock((res.data as unknown as PriceLock) || null);
      setShowConfirm(true);
    } catch (err: unknown) {
      setLockError(
        err instanceof Error ? err.message : "ขอราคาไม่สำเร็จ กรุณาลองใหม่",
      );
      setPriceRefreshKey((k) => k + 1);
    } finally {
      setLocking(false);
    }
  };

  const doSave = async () => {
    if (!lock) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.post<{ id: number }>("/bills", { lock_id: lock.lock_id });
      const metal = lock.metal;
      setLock(null);
      setShowConfirm(false);
      await refreshUnfinishedBills();
      // Gold and silver sells land in separate bills, each on its own list page.
      router.push(metal === "silver" ? "/bills/silver" : "/bills");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      setSaveError(msg);
      setPriceRefreshKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className=" flex flex-col gap-y-3">
      {/* Gold sales-hours banner is gold-only — don't show it when gold is closed
          but silver is still open (that would look like the whole shop is closed). */}
      {goldOpen && <SalesStatusBanner status={salesStatus} />}
      {lockError && (
        <div className="text-red-600 text-sm font-bold bg-red-50 border-1 border-red-200 rounded-2xl px-4 py-3">
          {lockError}
        </div>
      )}
      <div className="flex flex-row justify-start md:flex-1 md:min-h-0">
        <BillCalculate
          onAdd={handleAdd}
          allowGold={goldOpen}
          allowSilver={silverAllowed}
          priceRefreshKey={priceRefreshKey}
          busy={locking}
        />
      </div>

      <Modal
        isOpen={showConfirm}
        onOpenChange={setShowConfirm}
        size="sm"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  ยืนยันการขาย
                </span>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <div className="flex flex-col border-1 border-yellow-200 bg-yellow-50 rounded-2xl p-3 gap-y-1">
                    <span className="text-xs text-black/50">
                      {lock?.type_name}
                    </span>
                    <span className="font-bold text-2xl text-yellow-700">
                      {lock?.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                    <span className="text-xs text-black/40">
                      น้ำหนัก {lock?.weight}{" "}
                      {lock?.metal === "silver" ? "กรัม" : "บาท"} · ราคา{" "}
                      {lock?.price.toLocaleString()}{" "}
                      {lock?.metal === "silver" ? "บาท/กก." : "บาท/บาท"}
                    </span>
                  </div>
                  {/* The price is the shop's, not this page's — say so, because
                      the ticker underneath keeps moving while the dialog is up. */}
                  <p className="text-sm text-black/60 text-center">
                    ร้านล็อกราคานี้ไว้ให้แล้ว กดยืนยันภายในเวลาที่เหลือเพื่อขายที่ราคานี้
                    หลังบันทึกต้องรอทางร้านออกบิลให้
                  </p>
                  {confirmCountdown > 0 && (
                    <div className="flex items-center justify-center gap-x-1.5 text-sm font-medium text-amber-600">
                      <Clock size={16} />
                      <span>
                        ราคานี้ใช้ได้อีก {confirmCountdown} วินาที
                      </span>
                    </div>
                  )}
                  {saveError && (
                    <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                      {saveError}
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
                  onPress={doSave}
                  isLoading={saving}
                >
                  ยืนยันการขาย
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
