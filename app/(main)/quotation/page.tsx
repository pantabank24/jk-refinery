"use client";

import { Calculate } from "./_component/calculate";
import { useState, useEffect } from "react";
import { Quotation, QuotationProps } from "./_component/quotation";
import { PreviewQuote } from "./_component/previewQuote";
import { TermsForm } from "./_component/termsForm";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff, X, Save, AlertCircle, Receipt, Trash2, Camera, Image as ImageIcon } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { useStore } from "@/contexts/store-context";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { SalesStatusBanner } from "@/components/sales-status-banner";
import { SignaturePad } from "@/components/signature-pad";
import { WebcamCaptureModal } from "@/components/webcam-capture-modal";
import { Truck } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

// Reusable typed image-upload block — a single compact row of thumbnails
// with an inline "+" tile to add more, instead of a separate dropzone box.
// The "+" tile offers a choice between picking a file or capturing from the webcam.
function ImageUploadGroup({
  label, files, setFiles,
}: { label: string; files: File[]; setFiles: React.Dispatch<React.SetStateAction<File[]>> }) {
  const [showWebcam, setShowWebcam] = useState(false);

  return (
    <div>
      <label className="block text-xs font-bold text-black/60 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f, i) => (
          <div key={i} className="relative w-12 h-12 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(f)} className="w-12 h-12 object-cover rounded-lg border border-black/10" alt="" />
            <button
              type="button"
              onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
        <label
          title="เลือกไฟล์"
          className="flex items-center justify-center w-12 h-12 shrink-0 border-2 border-dashed border-black/20 rounded-lg cursor-pointer hover:border-[#c09c42]/60 hover:bg-[#c09c42]/5 transition-all"
        >
          <ImageIcon size={16} className="text-black/30" />
          <input
            key={files.length}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
            }}
          />
        </label>
        <button
          type="button"
          title="ถ่ายภาพจากกล้อง"
          onClick={() => setShowWebcam(true)}
          className="flex items-center justify-center w-12 h-12 shrink-0 border-2 border-dashed border-black/20 rounded-lg cursor-pointer hover:border-[#c09c42]/60 hover:bg-[#c09c42]/5 transition-all"
        >
          <Camera size={16} className="text-black/30" />
        </button>
      </div>

      <WebcamCaptureModal
        isOpen={showWebcam}
        onClose={() => setShowWebcam(false)}
        onCapture={(file) => setFiles((prev) => [...prev, file])}
      />
    </div>
  );
}

export default function QuotationPage() {
  const { hasPermission, permissions, credits, refreshUser, user } = useAuth();
  const { selectedStore } = useStore();
  // Header store: owner/employee → their own store; master → the store they
  // selected (master users have no personal store_id).
  const headerStore = user?.store ?? selectedStore ?? undefined;
  const { status: salesStatus } = useSalesStatus();
  const salesClosed = !!salesStatus?.enabled && !salesStatus.is_open;
  const canBypassSales = hasPermission("sales.bypass");
  const [quotation, setQuotation] = useState<QuotationProps[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTerms, setShowTerms] = useState(false); // rules + signature, before preview
  const [showPreview, setShowPreview] = useState(false); // pre-save review step — no print here
  // Post-save: shown after the quotation is actually saved, with the real
  // document number + a print button. The form's state is kept around until
  // this is dismissed, so the print preview still has its data.
  const [showPostSavePreview, setShowPostSavePreview] = useState(false);
  const [savedQuotation, setSavedQuotation] = useState<{ id: number; code: string } | null>(null);
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [showMissingWarn, setShowMissingWarn] = useState(false);
  const [consent, setConsent] = useState(false); // PDPA consent (required to save)
  // Images are categorised by type; signature is drawn on a pad.
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const beforeImages = beforeFiles.map((f) => URL.createObjectURL(f));
  const afterImages = afterFiles.map((f) => URL.createObjectURL(f));
  const [listOpen, setListOpen] = useState(false);

  // When a master issues a customer's bill, this page is opened with ?billId=X:
  // pre-fill the sold items and the customer's name as the signer.
  const searchParams = useSearchParams();
  const billId = searchParams.get("billId");
  const [billCustomer, setBillCustomer] = useState("");
  const [billBalance, setBillBalance] = useState<number | null>(null);
  const [billWeight, setBillWeight] = useState(0);
  const [billAvgPrice, setBillAvgPrice] = useState(0);
  const [billIds, setBillIds] = useState<number[]>([]);
  // The customer's submitted items — shown only for reference. The gold has been
  // melted, so the master builds a fresh quote; these are NOT added to it.
  const [referenceItems, setReferenceItems] = useState<QuotationProps[]>([]);
  // Partial delivery tracking: accumulated processed weight/amount across all customer's bills.
  const [processedWeight, setProcessedWeight] = useState(0);
  const [processedAmount, setProcessedAmount] = useState(0);
  // "รอส่งเพิ่ม / บันทึกเลย" choice modal — shown when master clicks the save button in bill mode.
  const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);
  const [partialSaving, setPartialSaving] = useState(false);
  const [partialError, setPartialError] = useState("");

  // Delete the bill being issued — เผื่อกรณีกดเข้ามาผิดหรือบิลนี้ไม่ควรออกแล้ว.
  const deleteBillDisc = useDisclosure();
  const [deletingBill, setDeletingBill] = useState(false);

  type BillItemLite = { type_id: string; type_name: string; price: number; percent: number; plus: number; weight: number; per_gram: number; total: number };
  type BillLite = { id: number; total_amount: number; processed_weight: number; processed_amount: number; items?: BillItemLite[]; creator?: { id: number; name: string } };

  useEffect(() => {
    if (!billId) return;
    (async () => {
      try {
        const res = await api.get(`/bills/${billId}`);
        const clicked = res.data as unknown as BillLite;
        if (clicked?.creator?.name) {
          setBillCustomer(clicked.creator.name);
          setSignerName(clicked.creator.name);
        }
        // Combine ALL of this customer's pending (รอออกบิล) bills' submitted items
        // as reference (their gold was melted; the master re-assesses from scratch).
        let bills: BillLite[] = [];
        if (clicked?.creator?.id) {
          const listRes = await api.get(`/bills?created_by=${clicked.creator.id}&status=10&limit=100`);
          bills = (listRes.data as unknown as { data: BillLite[] }).data || [];
          api.get(`/bills/balance?user_id=${clicked.creator.id}`)
            .then((res) => {
              const d = res.data as unknown as { balance: number; total_weight: number; avg_price: number };
              setBillBalance(d.balance ?? 0);
              setBillWeight(d.total_weight ?? 0);
              setBillAvgPrice(d.avg_price ?? 0);
            })
            .catch(() => {});
        }
        if (bills.length === 0 && clicked) bills = [clicked];

        const ids: number[] = [];
        const reference: QuotationProps[] = [];
        let totalProcessedW = 0;
        let totalProcessedA = 0;
        for (const b of bills) {
          ids.push(b.id);
          totalProcessedW += b.processed_weight || 0;
          totalProcessedA += b.processed_amount || 0;
          for (const i of b.items ?? []) {
            reference.push({
              typeId: i.type_id, typeName: i.type_name, price: i.price, plus: i.plus,
              percent: i.percent, weight: i.weight, perGram: i.per_gram, total: i.total,
            });
          }
        }
        setBillIds(ids);
        setReferenceItems(reference); // reference only — quote stays empty
        setProcessedWeight(totalProcessedW);
        setProcessedAmount(totalProcessedA);
      } catch { /* ignore */ }
    })();
  }, [billId]);

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

  // Opens delivery choice ("รอส่งเพิ่ม" vs "บันทึกเลย") in bill mode, else goes
  // straight to the terms step.
  const handleRequestSave = () => {
    if (quotation.length === 0) return;
    if (salesClosed && !canBypassSales) {
      setSaveError("ขณะนี้ปิดทำการ ไม่สามารถออกใบเสนอราคาได้");
      return;
    }
    setSaveError("");
    if (billId) {
      setPartialError("");
      setShowDeliveryChoice(true);
      return;
    }
    setShowTerms(true);
  };

  // Delete the bill that this page was opened to issue, then return to the list.
  const handleDeleteBill = async () => {
    if (!billId) return;
    setDeletingBill(true);
    try {
      await api.delete(`/bills/${billId}`);
      deleteBillDisc.onClose();
      router.push("/bills");
    } catch { /* ignore */ } finally {
      setDeletingBill(false);
    }
  };

  // "รอส่งเพิ่ม": record partial delivery for all bill IDs and stay on page.
  const handlePartialDeliver = async () => {
    setPartialSaving(true);
    setPartialError("");
    const totalW = quotation.reduce((s, i) => s + (i.weight || 0), 0);
    const totalA = quotation.reduce((s, i) => s + i.total, 0);
    try {
      for (const bid of billIds) {
        await api.post(`/bills/${bid}/partial-deliver`, { weight: totalW, amount: totalA });
      }
      setProcessedWeight((p) => p + totalW);
      setProcessedAmount((p) => p + totalA);
      setQuotation([]);
      setShowDeliveryChoice(false);
    } catch {
      setPartialError("บันทึกส่งบางส่วนไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setPartialSaving(false);
    }
  };

  // From the terms step → preview. Signature is optional (the seller may sign
  // in person but it isn't required).
  const proceedToPreview = () => {
    setSaveError("");
    setShowTerms(false);
    setShowPreview(true);
  };

  const refTotal = referenceItems.reduce((s, i) => s + i.total, 0);
  const refWeight = referenceItems.reduce((s, i) => s + (i.weight || 0), 0);
  // Weighted-average effective rate: Σ(total) / Σ(weight) — this is what
  // the customer was actually locked in at (total includes percent/plus adjustments).
  const refAvgPrice = refWeight > 0 ? refTotal / refWeight : 0;
  const hasBalance = billBalance !== null && billBalance !== 0;
  const combinedWeight = billWeight + refWeight;
  const blendedAvgPrice = hasBalance && combinedWeight > 0
    ? (billAvgPrice * billWeight + refAvgPrice * refWeight) / combinedWeight
    : 0;
  const effectiveForcedPrice = billId
    ? (blendedAvgPrice > 0 ? blendedAvgPrice : refAvgPrice > 0 ? refAvgPrice : 0)
    : 0;

  // In bill mode ("บันทึกเลย"), combine all partial deliveries + current batch
  // into ONE item so the preview and the saved quotation both show the full amount.
  const previewItems: QuotationProps[] = (() => {
    if (billIds.length === 0 || quotation.length === 0) return quotation;
    const currentW = quotation.reduce((s, i) => s + (i.weight || 0), 0);
    const currentT = quotation.reduce((s, i) => s + i.total, 0);
    const totalW = processedWeight + currentW;
    const totalT = processedAmount + currentT;
    const avgPrice = totalW > 0 ? totalT / totalW : quotation[0].price;
    const first = quotation[0];
    return [{
      ...first,
      price: Math.round(avgPrice * 100) / 100,
      weight: totalW,
      perGram: totalW > 0 ? totalT / totalW : first.perGram,
      total: totalT,
    }];
  })();

  const totalAmount = previewItems.reduce((sum, item) => sum + item.total, 0);
  const totalWeight = previewItems.reduce((sum, item) => sum + (item.weight || 0), 0);
  // Whether the current user's quotations deduct credits (role holds credits.use).
  // Strict check — credits.use is a constraint, not a privilege, so master is
  // never auto-granted it (mirrors the backend's HasPermissionStrict).
  const usesCredits = permissions.includes("credits.use");
  // Would this quotation push the user's credit balance below zero?
  const willGoNegative = usesCredits && credits - totalAmount < 0;

  // Image types that haven't been provided yet (used to warn before saving).
  const missingImages = () => {
    const m: string[] = [];
    if (beforeFiles.length === 0) m.push("รูปก่อนหลอม");
    if (afterFiles.length === 0) m.push("รูปบนตราชั่ง (หลังหลอม)");
    return m;
  };

  // Clicking ยืนยันบันทึก: require PDPA consent, then confirm missing images.
  const handleConfirmClick = () => {
    if (!consent) {
      setSaveError("กรุณายอมรับเงื่อนไขการเก็บข้อมูลส่วนบุคคล (PDPA) ก่อนบันทึก");
      return;
    }
    if (missingImages().length > 0) {
      setShowMissingWarn(true);
      return;
    }
    handleConfirmSave();
  };

  // Confirm from preview: if it would overdraw credits, surface a warning first;
  // otherwise save straight away.
  const handleConfirmSave = () => {
    if (willGoNegative) {
      setShowPreview(false);
      setShowCreditWarning(true);
      return;
    }
    void doSave();
  };

  // Actual save (after preview, and after the overdraw warning if shown)
  const doSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      // previewItems already contains the correctly-combined single item in bill
      // mode (processedAmount + current batch), so reuse it directly.
      const saveItems = previewItems.map((item) => ({
        type_id: item.typeId,
        type_name: item.typeName,
        plus: item.plus,
        plus_type: item.plus_type ?? 0,
        price: item.price,
        percent: item.percent,
        weight: item.weight,
        per_gram: item.perGram,
        total: item.total,
      }));

      const res = await api.post<{id: number; code: string}>("/quotations", {
        signer_name: signerName,
        signer_phone: signerPhone,
        pdpa_consent: consent,
        store_id: selectedStore?.id, // used only for master; others derive from JWT
        bill_ids: billIds.length ? billIds : undefined, // links to the customer's bill(s)
        items: saveItems,
        created_at: quotationDate,
      });
      const saved = res.data as unknown as { id: number; code: string };
      const quotationId = saved.id;

      // Upload images grouped by type
      const uploadGroup = async (files: File[], type: string) => {
        if (files.length === 0) return;
        const fd = new FormData();
        files.forEach((f) => fd.append("images", f));
        fd.append("type", type);
        await api.upload(`/quotations/${quotationId}/images`, fd);
      };
      await uploadGroup(beforeFiles, "before_melt");
      await uploadGroup(afterFiles, "after_melt");
      // Signature: convert the data-URL to a file and upload as type=signature
      if (signatureDataUrl) {
        const blob = await (await fetch(signatureDataUrl)).blob();
        const fd = new FormData();
        fd.append("images", blob, "signature.png");
        fd.append("type", "signature");
        await api.upload(`/quotations/${quotationId}/images`, fd);
      }

      // Saved — show the post-save preview (real document number, today's
      // date, print button) instead of navigating away immediately. The
      // form state (quotation/files/signature) stays put until the user
      // dismisses that preview, since it's still needed to render it.
      setShowPreview(false);
      setShowCreditWarning(false);
      setSavedQuotation(saved);
      setShowPostSavePreview(true);
      await refreshUser(); // credit balance changed
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Dismiss the post-save print preview: now it's safe to clear the form and
  // navigate away (deferred from doSave so the preview still had its data).
  const handleFinishPostSave = () => {
    setQuotation([]);
    setBeforeFiles([]);
    setAfterFiles([]);
    setSignatureDataUrl(null);
    setSignerName("");
    setSignerPhone("");
    setQuotationDate(new Date().toISOString().split("T")[0]);
    setConsent(false);
    setShowPostSavePreview(false);
    setSavedQuotation(null);
    router.push(billId ? "/bills" : "/quote-list");
  };

  return (
    <div className="h-full flex flex-col gap-y-3">
      {salesClosed && <SalesStatusBanner status={salesStatus} />}
      {billId && (
        <div className="flex items-center gap-x-2 bg-blue-50 border-1 border-blue-200 rounded-2xl p-3">
          <Receipt size={16} className="text-blue-600 shrink-0" />
          <span className="text-sm font-bold text-blue-700 flex-1">
            ออกบิลให้ลูกค้า{billCustomer ? ` : ${billCustomer}` : ""}
            {billIds.length > 1 ? ` (${billIds.length} รายการ)` : ""} — กรอกรายการใหม่จากทองที่หลอมเสร็จ
          </span>
          {hasPermission("bills.approve") && (
            <Button
              size="sm"
              color="danger"
              variant="flat"
              startContent={<Trash2 size={14} />}
              onPress={deleteBillDisc.onOpen}
              className="shrink-0"
            >
              ลบบิล
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-row gap-x-5 flex-1 min-h-0">
        <div className="flex flex-col w-full min-w-0 lg:flex-col-reverse justify-center items-center">
          <Calculate
            onAdd={handleAddItem}
            onOpenList={() => setListOpen(true)}
            quotationCount={quotation.length}
            lockMeltType={!!billId}
            forcedPrice={effectiveForcedPrice > 0 ? effectiveForcedPrice : undefined}
          />
        </div>
        {/* Right column: reference card (customer's submitted items) above the quote card */}
        <div className="flex flex-col gap-y-3 w-[500px] min-w-0 max-lg:hidden">
          {billId && referenceItems.length > 0 && (
            <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-white/15 shadow-xl backdrop-blur-xl rounded-4xl p-3 shrink-0 max-h-[38%]">
              <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
                รายการที่ลูกค้าส่งมา (อ้างอิง · หลอมแล้ว)
              </span>
              {/* Summary: sold total, processed so far, remaining (can go negative) */}
              {(() => {
                const netTotal = hasBalance ? refTotal - (billBalance ?? 0) : refTotal;
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                      <span className="font-bold text-[10px] text-black/50 pl-1">ราคาเฉลี่ย (บาท)</span>
                      <span className="font-bold text-sm text-yellow-700 pl-1">
                        {(hasBalance && billWeight > 0 && blendedAvgPrice > 0 ? blendedAvgPrice : refAvgPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {hasBalance && billWeight > 0 && blendedAvgPrice > 0 && (
                        <span className="font-bold text-[10px] text-black/35 pl-1 mt-0.5">
                          บิลนี้ {refAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                      <span className="font-bold text-[10px] text-black/50 pl-1">ยอดรวมที่ขาย</span>
                      <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
                        {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      {hasBalance && (
                        <span className="font-bold text-[10px] text-black/35 pl-1 mt-0.5">
                          {billBalance! > 0
                            ? `หักจากที่จ่ายเกิน ${billBalance!.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : `บวกจากที่ขาดไป ${Math.abs(billBalance!).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </span>
                      )}
                    </div>
                    {processedAmount > 0 && (
                      <>
                        <div className="flex flex-col border-1 border-blue-200 bg-blue-50 rounded-xl p-1.5">
                          <span className="font-bold text-[10px] text-black/50 pl-1">ส่งไปแล้ว</span>
                          <span className="font-bold text-sm text-blue-700 pl-1">
                            {processedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className={`flex flex-col border-1 rounded-xl p-1.5 ${(refTotal - processedAmount) < 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                          <span className="font-bold text-[10px] text-black/50 pl-1">คงเหลือ</span>
                          <span className={`font-bold text-sm pl-1 ${(refTotal - processedAmount) < 0 ? "text-red-600" : "text-green-700"}`}>
                            {(refTotal - processedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              <div className="flex flex-col gap-y-1 overflow-y-auto scrollbar-hide">
                {referenceItems.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-x-2 bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs">
                    <span className="text-black/70 font-bold truncate min-w-0">{i + 1}. {it.typeName}</span>
                    <span className="text-black/50 shrink-0 whitespace-nowrap">น้ำหนัก {it.weight} · {it.total.toLocaleString()} บาท</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <Quotation
              quotation={quotation}
              onRemove={handleRemoveItem}
              onSave={handleRequestSave}
              saving={saving}
            />
          </div>
        </div>
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

      {/* Delivery choice: รอส่งเพิ่ม vs บันทึกเลย — shown in bill mode only */}
      <Modal
        isOpen={showDeliveryChoice}
        onOpenChange={setShowDeliveryChoice}
        size="sm"
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-yellow-600" />
                  <span className="font-bold text-base bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    บันทึกทองที่หลอม
                  </span>
                </div>
                <span className="text-xs font-normal text-black/50">เลือกการดำเนินการสำหรับรายการนี้</span>
              </ModalHeader>
              <ModalBody className="gap-y-3">
                {partialError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    {partialError}
                  </div>
                )}
                <div className="flex flex-col gap-y-2">
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-1">
                    <span className="font-bold text-sm text-black/70">น้ำหนักรวม</span>
                    <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {quotation.reduce((s, i) => s + (i.weight || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  </div>
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-1">
                    <span className="font-bold text-sm text-black/70">ยอดรวม</span>
                    <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {quotation.reduce((s, i) => s + i.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex-col gap-y-2">
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold"
                  onPress={handlePartialDeliver}
                  isLoading={partialSaving}
                >
                  รอส่งเพิ่ม
                </Button>
                <Button
                  className="w-full bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={() => { onClose(); setShowTerms(true); }}
                  isDisabled={partialSaving}
                >
                  บันทึกเลย (ออกบิล)
                </Button>
                <Button variant="light" onPress={onClose} isDisabled={partialSaving} className="w-full">
                  ยกเลิก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Rules + signature step — shown before the quotation preview */}
      <Modal
        isOpen={showTerms}
        onOpenChange={setShowTerms}
        size="2xl"
        scrollBehavior="inside"
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  กฎและรายละเอียดการรับซื้อทอง เงิน และนาก
                </span>
                <span className="text-xs font-normal text-black/50">กรุณาอ่านและลงลายมือชื่อก่อนดำเนินการต่อ</span>
              </ModalHeader>
              <ModalBody className="px-3">
                {/* The rules rendered as an A5 paper document (with live signature) */}
                <TermsForm signatureImage={signatureDataUrl} signerName={signerName} onPrint={() => window.print()} />

                {/* Signature input — ผู้ขาย/เจ้าของสินทรัพย์ */}
                <div className="flex flex-col gap-y-2 mt-4">
                  <label className="block text-sm font-bold text-black/70">เซ็นชื่อ ผู้ขาย / เจ้าของสินทรัพย์</label>
                  <Input
                    size="sm"
                    type="date"
                    label="วันที่ในเอกสาร"
                    value={quotationDate}
                    onValueChange={setQuotationDate}
                    classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      size="sm"
                      label="ชื่อผู้เซ็น"
                      value={signerName}
                      onValueChange={setSignerName}
                      classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
                    />
                    <Input
                      size="sm"
                      label="เบอร์โทร"
                      value={signerPhone}
                      onValueChange={setSignerPhone}
                      classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
                    />
                  </div>
                  <SignaturePad onChange={setSignatureDataUrl} />
                </div>

                {saveError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2 mt-2">
                    {saveError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={saving}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={proceedToPreview}
                >
                  ยอมรับและถัดไป
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onOpenChange={setShowPreview}
        size="3xl"
        scrollBehavior="inside"
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
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
                {/* Typed image uploads — before/after side by side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <ImageUploadGroup label="รูปก่อนหลอม (ไม่บังคับ)" files={beforeFiles} setFiles={setBeforeFiles} />
                  <ImageUploadGroup label="รูปบนตราชั่ง / หลังหลอม (ไม่บังคับ)" files={afterFiles} setFiles={setAfterFiles} />
                </div>
                <PreviewQuote
                  hidePrint
                  items={previewItems}
                  store={headerStore}
                  customerName={signerName}
                  customerPhone={signerPhone}
                  date={quotationDate}
                  beforeImages={beforeImages}
                  afterImages={afterImages}
                  signatureImage={signatureDataUrl}
                  signerName={signerName}
                />

                {/* Summary: weight and total of this quotation */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-black/50">น้ำหนักรวม</span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-black/50">ยอดรวม (บาท)</span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* PDPA consent — required before saving */}
                <div className="mt-4 bg-black/5 border-1 border-black/10 rounded-2xl p-3">
                  <Checkbox size="sm" isSelected={consent} onValueChange={setConsent}>
                    <span className="text-xs text-black/70 leading-relaxed">
                      ข้าพเจ้ายินยอมให้ร้านเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล รวมถึงรูปภาพและลายเซ็น
                      เพื่อวัตถุประสงค์ในการออกใบเสนอราคาและทำธุรกรรม ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
                    </span>
                  </Checkbox>
                </div>

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
                  onPress={handleConfirmClick}
                  isLoading={saving}
                  isDisabled={!consent}
                >
                  ยืนยันบันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Post-save preview: shown after the quotation is actually saved —
          real document number, today's date, and a clear print button. */}
      <Modal
        isOpen={showPostSavePreview}
        onOpenChange={(open) => { if (!open) handleFinishPostSave(); }}
        size="3xl"
        scrollBehavior="inside"
        isDismissable={false}
        isKeyboardDismissDisabled
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  บันทึกสำเร็จ — พิมพ์ใบเสนอราคา
                </span>
              </ModalHeader>
              <ModalBody className="px-2">
                <PreviewQuote
                  items={previewItems}
                  onPrint={() => window.print()}
                  store={headerStore}
                  documentNo={savedQuotation?.code}
                  customerName={signerName}
                  customerPhone={signerPhone}
                  date={quotationDate}
                  beforeImages={beforeImages}
                  afterImages={afterImages}
                  signatureImage={signatureDataUrl}
                  signerName={signerName}
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={handleFinishPostSave}
                >
                  เสร็จสิ้น
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Missing-image confirmation (asks before saving without some image types) */}
      <Modal
        isOpen={showMissingWarn}
        onOpenChange={setShowMissingWarn}
        size="sm"
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle size={20} />
                  <span>ยังไม่ได้แนบรูป</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <p className="text-sm text-black/70">
                    คุณยังไม่ได้แนบรายการต่อไปนี้ ต้องการบันทึกโดยไม่แนบจริงหรือไม่?
                  </p>
                  <ul className="flex flex-col gap-y-1">
                    {missingImages().map((m) => (
                      <li key={m} className="flex items-center gap-x-2 text-sm bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <span className="text-amber-500">•</span>
                        <span className="font-bold text-black/70">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={saving}>
                  กลับไปแนบรูป
                </Button>
                <Button
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold"
                  onPress={() => { setShowMissingWarn(false); handleConfirmSave(); }}
                  isLoading={saving}
                >
                  บันทึกโดยไม่แนบ
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Credit overdraw warning (credits will go negative) */}
      <Modal
        isOpen={showCreditWarning}
        onOpenChange={setShowCreditWarning}
        size="sm"
        classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle size={20} />
                  <span>เครดิตจะติดลบ</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-y-3">
                  <p className="text-sm text-black/70">
                    เครดิตของคุณไม่เพียงพอ การออกใบเสนอราคานี้จะทำให้เครดิตติดลบ ยืนยันที่จะสร้างหรือไม่?
                  </p>
                  <div className="flex flex-col gap-y-1 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/50">เครดิตคงเหลือ</span>
                      <span className="font-bold text-black">
                        {credits.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/50">ยอดรวมใบเสนอราคา</span>
                      <span className="font-bold text-black">
                        {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-amber-200 mt-1 pt-1">
                      <span className="text-black/50">เครดิตหลังหัก</span>
                      <span className="font-bold text-red-600">
                        {(credits - totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                  </div>
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
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold"
                  onPress={doSave}
                  isLoading={saving}
                >
                  ยืนยันสร้าง
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete the bill being issued */}
      <ConfirmDeleteModal
        isOpen={deleteBillDisc.isOpen}
        onClose={deleteBillDisc.onClose}
        onConfirm={handleDeleteBill}
        name={billCustomer ? `บิลของ ${billCustomer}` : undefined}
        related="รายการสินค้า ประวัติการส่ง และยอดหนี้/เครดิตของบิลนี้จะถูกลบออกจากการคำนวณ"
        loading={deletingBill}
      />
    </div>
  );
}
