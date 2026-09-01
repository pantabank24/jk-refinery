"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { EMPTY_SETTINGS, IMG_BASE, type ReceiptSettings } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: ReceiptSettings;
  // Hands the saved settings back so the list (and any open preview) refreshes.
  onSaved: (s: ReceiptSettings) => void;
}

// ค่าเริ่มต้นใบเสร็จ — everything on the printed form that is the same on every
// receipt. Stored once server-side, so an edit here changes what future prints
// (and reprints) show; the per-receipt fields live in the receipt form instead.
export function ReceiptSettingsModal({ isOpen, onClose, settings, onSaved }: Props) {
  const [form, setForm] = useState<ReceiptSettings>(settings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reload the stored values every time the modal opens — a cancelled edit must
  // not leave its half-typed state behind for the next open.
  useEffect(() => {
    if (isOpen) {
      setForm(settings);
      setLogoFile(null);
    }
  }, [isOpen, settings]);

  const set = (k: keyof ReceiptSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));


  const preview = logoFile
    ? URL.createObjectURL(logoFile)
    : form.logo_url
      ? `${IMG_BASE}${form.logo_url}`
      : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload first: it writes logo_url server-side, so the PUT that follows must
      // carry the new path or it would overwrite it with the old one.
      let logoUrl = form.logo_url;
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        const up = await api.post<ReceiptSettings>("/receipts/settings/logo", fd);
        logoUrl = (up.data as unknown as ReceiptSettings).logo_url;
      }
      const res = await api.put<ReceiptSettings>("/receipts/settings", {
        ...form,
        logo_url: logoUrl,
      });
      onSaved((res.data as unknown as ReceiptSettings) ?? { ...form, logo_url: logoUrl });
      onClose();
    } catch {
      /* the api layer surfaces the error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            ตั้งค่าเริ่มต้นใบเสร็จ
          </span>
          <span className="text-xs font-normal text-black/50">
            ข้อมูลที่เหมือนกันทุกใบ — หัวกระดาษ ผู้ขาย และชื่อบัญชี
          </span>
        </ModalHeader>

        <ModalBody className="flex flex-col gap-y-3">
          <div className="flex items-center gap-x-3">
            <div className="h-20 w-20 shrink-0 rounded-2xl border-1 border-black/10 bg-black/5 flex items-center justify-center overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <ImagePlus size={22} className="text-black/30" />
              )}
            </div>
            <div className="flex flex-col gap-y-1">
              <span className="text-xs font-semibold text-black/60">โลโก้ (มุมซ้ายบนของใบ)</span>
              <div className="flex items-center gap-x-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => fileRef.current?.click()}
                  className="rounded-xl border-1 border-black/10 bg-black/5"
                >
                  เลือกรูป
                </Button>
                {(logoFile || form.logo_url) && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => {
                      setLogoFile(null);
                      set("logo_url", "");
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <Input
            label="ชื่อบริษัท"
            value={form.company_name}
            onValueChange={(v) => set("company_name", v)}
            variant="bordered"
          />
          <Textarea
            label="ที่อยู่ (บรรทัดละ 1 แถว)"
            description="พิมพ์ออกมาตามที่ขึ้นบรรทัดไว้ทุกประการ"
            value={form.company_address}
            onValueChange={(v) => set("company_address", v)}
            variant="bordered"
            minRows={2}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="เลขประจำตัวผู้เสียภาษีอากร"
              value={form.company_tax_id}
              onValueChange={(v) => set("company_tax_id", v)}
              variant="bordered"
            />
            <Input
              label="โทร"
              value={form.company_phone}
              onValueChange={(v) => set("company_phone", v)}
              variant="bordered"
            />
          </div>
          <Input
            label="ชื่อเอกสาร"
            value={form.doc_title}
            onValueChange={(v) => set("doc_title", v)}
            variant="bordered"
          />
          <Input
            label="ผู้ขาย"
            value={form.seller_name}
            onValueChange={(v) => set("seller_name", v)}
            variant="bordered"
          />

          <span className="text-xs font-bold text-black/40 uppercase tracking-wide pt-1">
            รับชำระโดย
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="ธนาคาร"
              value={form.bank_name}
              onValueChange={(v) => set("bank_name", v)}
              variant="bordered"
            />
            <Input
              label="เลขที่บัญชี"
              description={'พิมพ์บนใบตรงช่อง "เลขที่"'}
              value={form.bank_account_no}
              onValueChange={(v) => set("bank_account_no", v)}
              variant="bordered"
            />
          </div>
          <Input
            label="ชื่อบัญชี"
            value={form.account_name}
            onValueChange={(v) => set("account_name", v)}
            variant="bordered"
          />
          <span className="text-[10px] text-black/35">
            วันที่รับชำระเลือกเองในแต่ละใบ ส่วนจำนวนใช้ยอดรวมของใบนั้น
          </span>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>
            ยกเลิก
          </Button>
          <Button
            onPress={handleSave}
            isLoading={saving}
            className="bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold"
          >
            บันทึกค่าเริ่มต้น
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export { EMPTY_SETTINGS };
