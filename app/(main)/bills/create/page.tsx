"use client";

import { BillCalculate } from "../_component/billCalculate";
import { useState, useEffect } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Clock, ShieldOff, Store } from "lucide-react";
import { Spinner } from "@heroui/spinner";
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
  const [pendingItem, setPendingItem] = useState<QuotationProps | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(10);
  const [countdownActive, setCountdownActive] = useState(false);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!showConfirm || !countdownActive) return;

    const intervalId = window.setInterval(() => {
      setConfirmCountdown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      setShowConfirm(false);
      setCountdownActive(false);
      setPendingItem(null);
      setSaveError("");
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [showConfirm, countdownActive]);

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
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
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

  const handleAdd = (item: QuotationProps) => {
    setSaveError("");
    setPendingItem(item);
    setConfirmCountdown(10);
    setCountdownActive(true);
    setShowConfirm(true);
  };

  const doSave = async () => {
    if (!pendingItem) return;
    setCountdownActive(false);
    setSaving(true);
    setSaveError("");
    try {
      await api.post<{ id: number }>("/bills", {
        items: [
          {
            type_id: pendingItem.typeId,
            type_name: pendingItem.typeName,
            metal: pendingItem.metal ?? "gold",
            plus: pendingItem.plus,
            price: pendingItem.price,
            percent: pendingItem.percent,
            weight: pendingItem.weight,
            per_gram: pendingItem.perGram,
            total: pendingItem.total,
          },
        ],
      });
      setPendingItem(null);
      setShowConfirm(false);
      await refreshUnfinishedBills();
      // Gold and silver sells land in separate bills, each on its own list page.
      router.push(pendingItem.metal === "silver" ? "/bills/silver" : "/bills");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className=" flex flex-col gap-y-3">
      {/* Gold sales-hours banner is gold-only — don't show it when gold is closed
          but silver is still open (that would look like the whole shop is closed). */}
      {goldOpen && <SalesStatusBanner status={salesStatus} />}
      <div className="flex flex-row justify-start md:flex-1 md:min-h-0">
        <BillCalculate
          onAdd={handleAdd}
          allowGold={goldOpen}
          allowSilver={silverAllowed}
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
                      {pendingItem?.typeName}
                    </span>
                    <span className="font-bold text-2xl text-yellow-700">
                      {pendingItem?.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                    <span className="text-xs text-black/40">
                      น้ำหนัก {pendingItem?.weight}{" "}
                      {pendingItem?.metal === "silver" ? "กรัม" : "บาท"} · ราคา{" "}
                      {pendingItem?.price.toLocaleString()}{" "}
                      {pendingItem?.metal === "silver" ? "บาท/กก." : "บาท/บาท"}
                    </span>
                  </div>
                  <p className="text-sm text-black/60 text-center">
                    ต้องการบันทึกรายการขายนี้หรือไม่?
                    หลังบันทึกต้องรอทางร้านออกบิลให้
                  </p>
                  {countdownActive && (
                    <div className="flex items-center justify-center gap-x-1.5 text-sm font-medium text-amber-600">
                      <Clock size={16} />
                      <span>
                        กรุณายืนยันภายใน {confirmCountdown} วินาที
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
