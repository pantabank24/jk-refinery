"use client";

import { BillCalculate } from "../_component/billCalculate";
import { useState } from "react";
import { Quotation, QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff, X, Save } from "lucide-react";
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
  const [items, setItems] = useState<QuotationProps[]>([]);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  if (!canCreateBill) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleAddItem = (item: QuotationProps) => setItems((prev) => [...prev, item]);
  const handleRemoveItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleRequestSave = () => {
    if (items.length === 0) return;
    if (salesClosed) {
      setSaveError("ขณะนี้ปิดทำการ ไม่สามารถขายได้");
      return;
    }
    setSaveError("");
    setShowConfirm(true);
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await api.post<{ id: number }>("/bills", {
        items: items.map((item) => ({
          type_id: item.typeId,
          type_name: item.typeName,
          plus: item.plus,
          price: item.price,
          percent: item.percent,
          weight: item.weight,
          per_gram: item.perGram,
          total: item.total,
        })),
      });
      setItems([]);
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
      <div className="flex flex-row gap-x-5 flex-1 min-h-0">
        <div className="flex flex-col w-full lg:flex-col-reverse justify-center items-center">
          <BillCalculate onAdd={handleAddItem} onOpenList={() => setListOpen(true)} billCount={items.length} />
        </div>
        <Quotation
          quotation={items}
          onRemove={handleRemoveItem}
          onSave={handleRequestSave}
          saving={saving}
        />
      </div>

      {/* Mobile backdrop */}
      <div
        onClick={() => setListOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          listOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Mobile right drawer */}
      <div
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-80 pt-5 pb-5 px-4 flex flex-col transition-transform duration-300 ease-in-out ${
          listOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full border-1 border-black/10 bg-white/75 shadow-2xl backdrop-blur-xs rounded-4xl p-4 gap-y-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="font-bold text-base bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              รายการขาย
            </span>
            <button
              onClick={() => setListOpen(false)}
              className="p-2 rounded-xl hover:bg-black/10 transition-colors text-black/50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-y-2 overflow-y-auto flex-1 scrollbar-hide">
            {items.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                กด + เพื่อเพิ่มรายการ
              </div>
            ) : (
              items.map((item, index) => (
                <div key={index} className="flex flex-col w-full border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3">
                  <div className="flex w-full justify-between mb-2">
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
                      {index + 1}. {item.typeName}
                    </span>
                    <div
                      onClick={() => handleRemoveItem(index)}
                      className="cursor-pointer h-5 w-5 bg-gradient-to-br from-red-600/50 to-transparent border-1 border-black/10 rounded-full flex items-center justify-center"
                    >
                      <X size={13} className="text-red-600" />
                    </div>
                  </div>
                  <div className="w-full grid grid-cols-3 gap-1.5">
                    {[
                      { label: "ราคา", value: item.price.toLocaleString() },
                      { label: "บวก", value: item.plus.toLocaleString() },
                      { label: "%", value: String(item.percent) },
                      { label: "น้ำหนัก", value: String(item.weight) },
                      { label: "ต่อกรัม", value: item.perGram.toFixed(2) },
                      { label: "รวม", value: item.total.toLocaleString() },
                    ].map((f) => (
                      <div key={f.label} className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1">
                        <span className="font-bold text-[10px] text-black/50 pl-1">{f.label}</span>
                        <span className="font-bold text-xs bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            disabled={items.length === 0 || saving}
            onClick={() => { setListOpen(false); handleRequestSave(); }}
            className="w-full bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            บันทึกการขาย
          </button>
        </div>
      </div>

      {/* Confirm sale modal (no quotation preview — just confirm) */}
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
                    <span className="text-xs text-black/50">ยอดรวม ({items.length} รายการ)</span>
                    <span className="font-bold text-2xl text-yellow-700">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
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
