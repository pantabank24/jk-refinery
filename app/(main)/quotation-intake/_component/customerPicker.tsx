"use client";

import { SkeletonLines } from "@/components/skeleton";
import { useCallback, useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Search, UserCheck, X } from "lucide-react";
import { api } from "@/lib/api";

export interface PickedCustomer {
  id: number;
  name: string;
  phone: string;
}

interface Props {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
}

// Optional link to a registered customer. Walk-ins are the common case at the
// counter, so this never blocks the form — picking one only fills the name and
// phone in and records who the goods belong to.
export function CustomerPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const q = term ? `&search=${encodeURIComponent(term)}` : "";
      const res = await api.get<PickedCustomer[]>(`/customers?limit=30${q}`);
      setResults((res.data as unknown as PickedCustomer[]) || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchCustomers(search), 300);
    return () => clearTimeout(timer);
  }, [open, search, fetchCustomers]);

  if (value) {
    return (
      <div className="flex flex-row items-center justify-between gap-x-2 border-1 border-[#c09c42]/30 bg-[#c09c42]/5 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-x-2 min-w-0">
          <UserCheck size={15} className="text-[#c09c42] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-black/70 truncate">{value.name}</span>
            <span className="text-[10px] text-black/40 truncate">
              {value.phone || "ไม่มีเบอร์โทร"} · ลูกค้าที่ลงทะเบียนไว้
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="ยกเลิกการผูกลูกค้า"
          onClick={() => onChange(null)}
          className="shrink-0 text-black/40 hover:text-red-500"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-x-2 border-1 border-dashed border-black/20 rounded-2xl px-3 py-2 text-xs font-bold text-black/50 hover:border-[#c09c42]/60 hover:text-[#c09c42] transition-all"
      >
        <Search size={14} /> เลือกลูกค้าที่ลงทะเบียนไว้ (ไม่บังคับ)
      </button>

      <Modal
        isOpen={open}
        onOpenChange={setOpen}
        size="md"
        scrollBehavior="inside"
        classNames={{ base: "rounded-3xl border-1 border-black/10" }}
      >
        <ModalContent>
          <ModalHeader className="text-base font-bold">เลือกลูกค้า</ModalHeader>
          <ModalBody className="pb-5">
            <Input
              autoFocus
              size="sm"
              variant="bordered"
              placeholder="ค้นหาชื่อ / เบอร์โทร / อีเมล"
              startContent={<Search size={15} className="text-black/30" />}
              value={search}
              onValueChange={setSearch}
            />
            {loading ? (
              <SkeletonLines count={3} className="py-2" />
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-xs text-black/40">ไม่พบลูกค้า</div>
            ) : (
              <div className="flex flex-col gap-y-1.5">
                {results.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      onChange(customer);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start border-1 border-black/10 bg-black/5 rounded-2xl px-3 py-2 hover:bg-[#c09c42]/10 hover:border-[#c09c42]/30 transition-all"
                  >
                    <span className="text-sm font-bold text-black/70">{customer.name}</span>
                    <span className="text-[10px] text-black/40">
                      {customer.phone || "ไม่มีเบอร์โทร"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
