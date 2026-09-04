"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { ImageViewer } from "@/components/image-viewer";
import { PhotoGroup } from "./photoGroup";
import { API_BASE, type IntakeImage, type QuotationIntake } from "./types";

interface Props {
  intake: QuotationIntake | null;
  onClose: () => void;
  onSaved: () => void;
}

// Fixing an open ใบเปิดงาน before it is priced: a mistyped phone number, or the
// ID card nobody remembered to photograph while the customer was still there.
// Only open intakes reach this — once a quotation has been issued the record is
// history and the server refuses to change it.
export function EditIntakeModal({ intake, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [existing, setExisting] = useState<IntakeImage[]>([]);
  const [newBefore, setNewBefore] = useState<File[]>([]);
  const [newIdCard, setNewIdCard] = useState<File[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reseed from the row every time a different intake is opened.
  useEffect(() => {
    if (!intake) return;
    setName(intake.customer_name);
    setPhone(intake.customer_phone);
    setNote(intake.note);
    setExisting(intake.images ?? []);
    setNewBefore([]);
    setNewIdCard([]);
    setError("");
  }, [intake]);

  const labelOf = (type: string) =>
    type === "id_card" ? "บัตรประชาชน" : "ก่อนหลอม";

  const viewerImages = existing.map((img) => ({
    url: `${API_BASE}${img.image_url}`,
    name: labelOf(img.type),
  }));

  const removeExisting = async (image: IntakeImage) => {
    if (!intake) return;
    try {
      await api.delete(`/quotation-intakes/${intake.id}/images/${image.id}`);
      setExisting((prev) => prev.filter((img) => img.id !== image.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบรูปไม่สำเร็จ");
    }
  };

  const handleSave = async () => {
    if (!intake) return;
    if (!name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/quotation-intakes/${intake.id}`, {
        customer_id: intake.customer_id ?? undefined,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        note,
      });
      const upload = async (files: File[], type: string) => {
        if (files.length === 0) return;
        const fd = new FormData();
        files.forEach((file) => fd.append("images", file));
        fd.append("type", type);
        await api.upload(`/quotation-intakes/${intake.id}/images`, fd);
      };
      await upload(newBefore, "before_melt");
      await upload(newIdCard, "id_card");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!intake}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      classNames={{ base: "rounded-3xl border-1 border-black/10" }}
    >
      <ModalContent>
        <ModalHeader className="font-bold">
          แก้ไขใบเปิดงาน #{intake?.id}
        </ModalHeader>
        <ModalBody className="gap-y-3">
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
            label="หมายเหตุ"
            value={note}
            onValueChange={setNote}
            classNames={{
              inputWrapper:
                "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
            }}
          />

          {existing.length > 0 && (
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-bold text-black/70">รูปที่ถ่ายไว้แล้ว</span>
              <div className="flex flex-wrap gap-2">
                {existing.map((img, i) => (
                  <div key={img.id} className="relative w-20 h-20 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_BASE}${img.image_url}`}
                      alt={labelOf(img.type)}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewerIndex(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setViewerIndex(i);
                        }
                      }}
                      className="w-20 h-20 object-cover rounded-xl border-1 border-black/10 cursor-zoom-in"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-bold text-center rounded-b-xl py-0.5">
                      {labelOf(img.type)}
                    </span>
                    <button
                      type="button"
                      aria-label="ลบรูปนี้"
                      onClick={() => void removeExisting(img)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PhotoGroup
            label="เพิ่มรูปบัตรประชาชน"
            files={newIdCard}
            setFiles={setNewIdCard}
          />
          <PhotoGroup
            label="เพิ่มรูปก่อนหลอม"
            files={newBefore}
            setFiles={setNewBefore}
          />

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border-1 border-red-200 rounded-2xl px-4 py-2">
              {error}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>
            ปิด
          </Button>
          <Button
            isLoading={saving}
            startContent={!saving && <Save size={15} />}
            onPress={handleSave}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
          >
            บันทึก
          </Button>
        </ModalFooter>
      </ModalContent>

      <ImageViewer
        images={viewerImages}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </Modal>
  );
}
