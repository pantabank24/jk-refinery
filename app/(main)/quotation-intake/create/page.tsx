"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { StoreBranchSelector } from "@/components/store-branch-selector";
import { PhotoGroup } from "../_component/photoGroup";
import { CustomerPicker, type PickedCustomer } from "../_component/customerPicker";
import type { QuotationIntake } from "../_component/types";

// เปิดใบเสนอราคา — the counter step done while the customer is still standing
// there and the goods have not been melted yet: photograph what came in, capture
// the ID card, take down a name and phone. Pricing happens later, on the
// quotation screen, which this feeds.
export default function CreateIntakePage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading, isMaster, isOwner } = useAuth();
  const { selectedStore, selectedBranch } = useStore();
  const canCreate = hasPermission("quotations.create");
  const canReadCustomers = hasPermission("customers.read");
  // Master/owner are not pinned to one counter, so they say which one took the
  // goods in — that decides whose open list this lands in.
  const canSelectStoreBranch = isMaster || isOwner;

  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [idCardFiles, setIdCardFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !canCreate) router.replace("/");
  }, [authLoading, canCreate, router]);

  const applyCustomer = (picked: PickedCustomer | null) => {
    setCustomer(picked);
    if (picked) {
      setName(picked.name || "");
      setPhone(picked.phone || "");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post<QuotationIntake>("/quotation-intakes", {
        customer_id: customer?.id,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        note,
        // Used only for master; every other role is stamped from their token.
        store_id: selectedStore?.id,
        branch_id: selectedBranch?.id,
      });
      const intake = res.data as unknown as QuotationIntake;

      // Photos need the row's id to file themselves under, so they go up after it.
      const upload = async (files: File[], type: string) => {
        if (files.length === 0) return;
        const fd = new FormData();
        files.forEach((file) => fd.append("images", file));
        fd.append("type", type);
        await api.upload(`/quotation-intakes/${intake.id}/images`, fd);
      };
      await upload(beforeFiles, "before_melt");
      await upload(idCardFiles, "id_card");

      router.push("/quotation-intake");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && !canCreate) return null;

  return (
    <div className="flex flex-col pb-6">
      <div className="flex flex-row items-center gap-x-2 py-5">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => router.push("/quotation-intake")}
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex flex-col">
          <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            เปิดใบเสนอราคาใหม่
          </span>
          <span className="text-xs text-black/40">
            เก็บรูปก่อนหลอมและข้อมูลลูกค้าไว้ก่อน แล้วค่อยกลับมาออกใบเสนอราคาทีหลัง
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-y-4 max-w-2xl">
        {canSelectStoreBranch && (
          <div className="flex flex-col gap-y-1.5 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
            <span className="text-xs font-bold text-[#c09c42]">ร้าน / สาขาที่รับของ</span>
            <StoreBranchSelector />
          </div>
        )}

        <div className="flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
          <span className="text-xs font-bold text-[#c09c42]">ข้อมูลลูกค้า</span>
          {canReadCustomers && (
            <CustomerPicker value={customer} onChange={applyCustomer} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              size="sm"
              label="ชื่อลูกค้า"
              isRequired
              value={name}
              onValueChange={setName}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />
            <Input
              size="sm"
              label="เบอร์โทร"
              inputMode="tel"
              value={phone}
              onValueChange={setPhone}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />
          </div>
          <Textarea
            size="sm"
            minRows={2}
            label="หมายเหตุ (ไม่บังคับ)"
            placeholder="เช่น ของที่รับเข้ามา จำนวนชิ้น หรือสิ่งที่ตกลงกับลูกค้าไว้"
            value={note}
            onValueChange={setNote}
            classNames={{
              inputWrapper:
                "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
            }}
          />
        </div>

        <div className="flex flex-col gap-y-4 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
          <PhotoGroup
            label="รูปบัตรประชาชน"
            hint="เก็บไว้กับใบเสนอราคา ไม่ถูกพิมพ์ลงเอกสาร"
            files={idCardFiles}
            setFiles={setIdCardFiles}
          />
          <PhotoGroup
            label="รูปก่อนหลอม"
            hint="ถ่ายตอนรับของ ก่อนนำไปหลอม"
            files={beforeFiles}
            setFiles={setBeforeFiles}
          />
        </div>

        {beforeFiles.length === 0 && (
          <div className="flex items-start gap-x-2 text-xs text-yellow-800 bg-yellow-50 border-1 border-yellow-200 rounded-2xl px-3 py-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>
              ยังไม่ได้ถ่ายรูปก่อนหลอม — บันทึกได้ แต่จะกลับมาถ่ายทีหลังไม่ได้ถ้าของถูกหลอมไปแล้ว
            </span>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm bg-red-50 border-1 border-red-200 rounded-2xl px-4 py-2">
            {error}
          </div>
        )}

        <Button
          isLoading={saving}
          startContent={!saving && <Save size={16} />}
          onPress={handleSave}
          className="bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold rounded-2xl py-6"
        >
          บันทึกใบเปิดงาน
        </Button>
      </div>
    </div>
  );
}
