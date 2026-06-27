"use client";

import { Calculate } from "./_component/calculate";
import { useState } from "react";
import { Quotation, QuotationProps } from "./_component/quotation";
import { PreviewQuote } from "./_component/previewQuote";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff, X, Save, AlertCircle } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";

export default function QuotationPage() {
  const { hasPermission } = useAuth();
  const [quotation, setQuotation] = useState<QuotationProps[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [creditError, setCreditError] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const previewImages = uploadFiles.map((f) => URL.createObjectURL(f));
  const [listOpen, setListOpen] = useState(false);

  if (!hasPermission("quotations.create")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleAddItem = (item: QuotationProps) => {
    setQuotation((prev) => [...prev, item]);
  };

  const handleRemoveItem = (index: number) => {
    setQuotation((prev) => prev.filter((_, i) => i !== index));
  };

  // Opens the preview modal
  const handleRequestSave = () => {
    if (quotation.length === 0) return;
    setSaveError("");
    setShowPreview(true);
  };

  // Actual save after preview confirmation
  const handleConfirmSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await api.post<{id: number}>("/quotations", {
        items: quotation.map((item) => ({
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
      const quotationId = (res.data as unknown as {id: number}).id;

      // Upload images if any
      if (uploadFiles.length > 0) {
        const formData = new FormData();
        uploadFiles.forEach((f) => formData.append("images", f));
        await api.upload(`/quotations/${quotationId}/images`, formData);
      }

      setQuotation([]);
      setUploadFiles([]);
      setShowPreview(false);
      router.push("/quote-list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      if (msg.includes("เครดิตไม่เพียงพอ")) {
        setShowPreview(false);
        setCreditError(true);
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = quotation.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="h-full flex flex-col gap-y-3">
      <div className="flex flex-row gap-x-5 flex-1 min-h-0">
        <div className="flex flex-col w-full lg:flex-col-reverse justify-center items-center">
          <Calculate onAdd={handleAddItem} onOpenList={() => setListOpen(true)} quotationCount={quotation.length} />
        </div>
        <Quotation
          quotation={quotation}
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
          {/* Header */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="font-bold text-base bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              รายการใบเสนอราคา
            </span>
            <button
              onClick={() => setListOpen(false)}
              className="p-2 rounded-xl hover:bg-black/10 transition-colors text-black/50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Items */}
          <div className="flex flex-col gap-y-2 overflow-y-auto flex-1 scrollbar-hide">
            {quotation.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                กด + เพื่อเพิ่มรายการ
              </div>
            ) : (
              quotation.map((item, index) => (
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

          {/* Save button */}
          <button
            disabled={quotation.length === 0 || saving}
            onClick={() => { setListOpen(false); handleRequestSave(); }}
            className="w-full bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            บันทึกใบเสนอราคา
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onOpenChange={setShowPreview}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  ตัวอย่างใบเสนอราคา
                </span>
              </ModalHeader>
              <ModalBody className="px-2">
                {/* Image upload */}
                <div className="mb-3">
                  <label className="block text-sm font-bold text-black/70 mb-2">อัปโหลดรูปภาพ (ไม่บังคับ)</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-black/20 rounded-2xl cursor-pointer hover:border-[#c09c42]/60 hover:bg-[#c09c42]/5 transition-all">
                    <span className="text-xs text-black/40">คลิกหรือลากรูปมาวาง</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                    />
                  </label>
                  {uploadFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {uploadFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img
                            src={URL.createObjectURL(f)}
                            className="w-16 h-16 object-cover rounded-xl border border-black/10"
                            alt=""
                          />
                          <button
                            type="button"
                            onClick={() => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <PreviewQuote items={quotation} onPrint={() => window.print()} previewImages={previewImages} />
                {saveError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2 mt-2">
                    {saveError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={saving}>
                  แก้ไข
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={handleConfirmSave}
                  isLoading={saving}
                >
                  ยืนยันบันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      {/* Credit insufficient dialog */}
      <Modal isOpen={creditError} onOpenChange={setCreditError} size="sm" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle size={20} />
                  <span>เครดิตไม่เพียงพอ</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <p className="text-sm text-black/70">
                    เครดิตของคุณไม่เพียงพอสำหรับออกใบเสนอราคานี้
                  </p>
                  <div className="flex flex-col gap-y-1 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/50">ยอดรวมใบเสนอราคา</span>
                      <span className="font-bold text-black">
                        {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-black/40 text-center">
                    กรุณาติดต่อเจ้าของร้านเพื่อเติมเครดิตก่อนออกใบเสนอราคา
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="w-full bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={onClose}
                >
                  ตกลง
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
