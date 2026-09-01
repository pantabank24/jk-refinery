"use client";

import { BillCalculate } from "../_component/billCalculate";
import { useState, useEffect, useCallback } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { VerifyBadge } from "@/components/verifyBadge";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff, UserCircle, Search, Check } from "lucide-react";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

interface SellCustomer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  store_name?: string | null;
  verification_status?: string;
}

export default function SellForCustomerPage() {
  const { hasPermission, refreshUnfinishedBills } = useAuth();
  // Staff-only "sell on behalf" flow — gated by bills.sell (master auto-grants).
  const canSell = hasPermission("bills.sell");

  const [customer, setCustomer] = useState<SellCustomer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [pendingItem, setPendingItem] = useState<QuotationProps | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  if (!canSell) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleAdd = (item: QuotationProps) => {
    setSaveError("");
    if (!customer) {
      setPickerOpen(true);
      return;
    }
    setPendingItem(item);
    setShowConfirm(true);
  };

  const doSave = async () => {
    if (!pendingItem || !customer) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.post<{ id: number }>("/bills", {
        customer_id: customer.id,
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
      setJustSaved(true);
      await refreshUnfinishedBills();
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
      {/* Selected customer bar */}
      <div className="flex flex-row items-center justify-between shrink-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-3">
        <div className="flex flex-row items-center gap-x-3 min-w-0">
          {customer ? (
            <>
              <Avatar
                size="sm"
                name={customer.name}
                src={
                  customer.avatar ? `${API_BASE}${customer.avatar}` : undefined
                }
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-black/70 truncate flex items-center gap-x-1">
                  ขายแทน: {customer.name}
                  <VerifyBadge status={customer.verification_status} size={13} />
                </span>
                <span className="text-[11px] text-black/40 truncate">
                  {customer.store_name || customer.email}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-row items-center gap-x-2 text-black/50">
              <UserCircle size={20} className="text-[#c09c42]" />
              <span className="text-sm font-bold">ยังไม่ได้เลือกลูกค้า</span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold shrink-0"
          onPress={() => setPickerOpen(true)}
        >
          {customer ? "เปลี่ยนลูกค้า" : "เลือกลูกค้า"}
        </Button>
      </div>

      {justSaved && (
        <div className="flex flex-row items-center gap-x-2 shrink-0 border-1 border-green-300 bg-green-50 text-green-700 rounded-2xl px-4 py-2">
          <Check size={16} />
          <span className="text-sm font-bold">
            บันทึกรายการขายให้ {customer?.name} แล้ว · ทำรายการต่อได้เลย
          </span>
        </div>
      )}

      <div className="flex flex-row justify-start md:flex-1 md:min-h-0">
        <BillCalculate onAdd={handleAdd} staffMode />
      </div>

      <CustomerPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setPickerOpen(false);
          setJustSaved(false);
        }}
        selectedId={customer?.id}
      />

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
                  ยืนยันการขายแทนลูกค้า
                </span>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <div className="flex flex-row items-center gap-x-2 text-xs text-black/60 bg-black/5 rounded-xl px-3 py-2">
                    <UserCircle size={14} className="text-[#c09c42]" />
                    <span>
                      ขายแทน{" "}
                      <span className="font-bold text-black/80 inline-flex items-center gap-x-1">
                        {customer?.name}
                        <VerifyBadge status={customer?.verification_status} size={13} />
                      </span>
                    </span>
                  </div>
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
                    ต้องการบันทึกรายการขายนี้ให้ลูกค้าหรือไม่?
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

function CustomerPicker({
  isOpen,
  onClose,
  onSelect,
  selectedId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (c: SellCustomer) => void;
  selectedId?: number;
}) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<SellCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/bills/sell-customers";
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await api.get<SellCustomer[]>(url);
      setCustomers((res.data as unknown as SellCustomer[]) || []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Debounce the search so typing doesn't hammer the endpoint.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(fetchCustomers, 250);
    return () => clearTimeout(t);
  }, [isOpen, fetchCustomers]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            เลือกลูกค้าที่จะขายแทน
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-y-3">
            <Input
              placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
              value={search}
              startContent={<Search size={16} className="text-black/40" />}
              onValueChange={setSearch}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner color="warning" />
              </div>
            ) : customers.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                ไม่พบลูกค้า
              </div>
            ) : (
              <div className="flex flex-col gap-y-2">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className={`flex flex-row items-center justify-between rounded-2xl p-3 border-1 transition-colors text-left ${
                      selectedId === c.id
                        ? "border-[#c09c42] bg-[#c09c42]/10"
                        : "border-black/10 bg-black/5 hover:bg-black/10"
                    }`}
                  >
                    <div className="flex flex-row items-center gap-x-3 min-w-0">
                      <Avatar
                        size="sm"
                        name={c.name}
                        src={c.avatar ? `${API_BASE}${c.avatar}` : undefined}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-black/70 truncate flex items-center gap-x-1">
                          {c.name}
                          <VerifyBadge status={c.verification_status} size={13} />
                        </span>
                        <span className="text-[11px] text-black/40 truncate">
                          {c.store_name || c.email}
                        </span>
                      </div>
                    </div>
                    {selectedId === c.id && (
                      <Check size={18} className="text-[#c09c42] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            ปิด
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
