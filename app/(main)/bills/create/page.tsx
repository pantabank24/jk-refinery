"use client";

import { BillCalculate } from "../_component/billCalculate";
import { useState } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";
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
  const { status: salesStatus } = useSalesStatus();
  const salesClosed = !!salesStatus?.enabled && !salesStatus.is_open;
  // Creation is customer-only — raw permission, bypassing master's auto-grant.
  const canCreateBill = permissions.includes("bills.create");
  const [pendingItem, setPendingItem] = useState<QuotationProps | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");

  if (!canCreateBill) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleAdd = (item: QuotationProps) => {
    setSaveError(salesClosed ? "ขณะนี้ปิดทำการ ไม่สามารถขายได้" : "");
    setPendingItem(item);
    setShowConfirm(true);
  };

  const doSave = async () => {
    if (!pendingItem) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.post<{ id: number }>("/bills", {
        items: [
          {
            type_id: pendingItem.typeId,
            type_name: pendingItem.typeName,
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
      router.push("/bills");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-y-3">
      {salesClosed && <SalesStatusBanner status={salesStatus} />}
      <div className="flex flex-row justify-start flex-1 min-h-0">
        <BillCalculate onAdd={handleAdd} />
      </div>

      <Modal isOpen={showConfirm} onOpenChange={setShowConfirm} size="sm" backdrop="blur">
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
                    <span className="text-xs text-black/50">{pendingItem?.typeName}</span>
                    <span className="font-bold text-2xl text-yellow-700">
                      {pendingItem?.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                    </span>
                    <span className="text-xs text-black/40">
                      น้ำหนัก {pendingItem?.weight} บาท · ราคา {pendingItem?.price.toLocaleString()} บาท/บาท
                    </span>
                  </div>
                  <p className="text-sm text-black/60 text-center">
                    ต้องการบันทึกรายการขายนี้หรือไม่? หลังบันทึกต้องรอทางร้านออกบิลให้
                  </p>
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
                  isDisabled={salesClosed}
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
