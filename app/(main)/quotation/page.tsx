"use client";

import { Calculate } from "./_component/calculate";
import { useState, useEffect } from "react";
import { Quotation, QuotationProps } from "./_component/quotation";
import { PreviewQuote } from "./_component/previewQuote";
import { TermsForm } from "./_component/termsForm";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  ShieldOff,
  X,
  Save,
  AlertCircle,
  Receipt,
  Trash2,
  Camera,
  Image as ImageIcon,
  UserCheck,
  PenLine,
  Store,
} from "lucide-react";
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
import { StoreBranchSelector } from "@/components/store-branch-selector";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { SalesStatusBanner } from "@/components/sales-status-banner";
import { SignaturePad } from "@/components/signature-pad";
import { WebcamCaptureModal } from "@/components/webcam-capture-modal";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

// A customer's submitted line shown in the reference card, tagged with the source
// bill + item id so the master can delete it from the customer's actual bill.
type ReferenceItem = QuotationProps & { billId: number; itemId: number };

// Reusable typed image-upload block — a single compact row of thumbnails
// with an inline "+" tile to add more, instead of a separate dropzone box.
// The "+" tile offers a choice between picking a file or capturing from the webcam.
function ImageUploadGroup({
  label,
  files,
  setFiles,
}: {
  label: string;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
}) {
  const [showWebcam, setShowWebcam] = useState(false);

  return (
    <div>
      <label className="block text-xs font-bold text-black/60 mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f, i) => (
          <div key={i} className="relative w-12 h-12 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(f)}
              className="w-12 h-12 object-cover rounded-lg border border-black/10"
              alt=""
            />
            <button
              type="button"
              onClick={() =>
                setFiles((prev) => prev.filter((_, idx) => idx !== i))
              }
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
              if (e.target.files)
                setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
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
  const {
    hasPermission,
    permissions,
    credits,
    refreshUser,
    user,
    isMaster,
    isOwner,
  } = useAuth();
  const { selectedStore, selectedBranch } = useStore();
  // Store/branch picker (receipt header) now lives inside the preview modal on this
  // page instead of the global navbar — only master/owner can change it.
  const canSelectStoreBranch = isMaster || isOwner;
  // Issue the document without a receipt header (master/owner opt-out) — the
  // store/branch link is still saved for lists/reports; only the printed
  // header is omitted.
  const [noHeader, setNoHeader] = useState(false);
  // Receipt header now comes from the branch (each branch prints its own):
  // employee → their assigned branch; owner/master → the branch they selected
  // (defaults to the store's main branch, see store-context).
  const headerStore =
    selectedBranch && !noHeader
      ? {
          name: selectedBranch.header_name,
          branch: selectedBranch.name,
          address: selectedBranch.address,
          phone: selectedBranch.phone,
          tax_id: selectedBranch.tax_id,
          tax_name: selectedBranch.tax_name,
          website: selectedBranch.website,
          logo: selectedBranch.logo,
        }
      : undefined;
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
  const [savedQuotation, setSavedQuotation] = useState<{
    id: number;
    code: string;
  } | null>(null);
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
  const [quotationDate, setQuotationDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const beforeImages = beforeFiles.map((f) => URL.createObjectURL(f));
  const afterImages = afterFiles.map((f) => URL.createObjectURL(f));
  const [listOpen, setListOpen] = useState(false);

  // When a master issues a customer's bill, this page is opened with ?billId=X:
  // pre-fill the sold items and the customer's name as the signer.
  const searchParams = useSearchParams();
  const billId = searchParams.get("billId");
  // editIssued=1: reopened from "แก้ไขบิล" to fix an already-issued quote. The bill
  // stays "รอตรวจบิล"; the old issuance is reversed at save time (see doSave), not now.
  const editIssued = searchParams.get("editIssued") === "1";
  const [billCustomer, setBillCustomer] = useState("");
  // The customer's registered profile (suggested for the signer fields) + their
  // most recent signature (offered for reuse), loaded in bill mode.
  const [customerProfile, setCustomerProfile] = useState<{
    name: string;
    phone: string;
    store_name: string;
    address: string;
    tax_id: string;
  } | null>(null);
  const [prevSignatureUrl, setPrevSignatureUrl] = useState<string | null>(null);
  const [usingPrevSig, setUsingPrevSig] = useState(false);
  // Which registered field to use as the signer name when applying the
  // suggestion — the person's name (default) or the company/store name.
  const [nameSource, setNameSource] = useState<"person" | "company">("person");
  const [billIds, setBillIds] = useState<number[]>([]);
  // The customer's submitted items — shown for reference (gold already melted, so
  // the master builds a fresh quote). billId/itemId let the master delete one from
  // the customer's actual bill.
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [removingRef, setRemovingRef] = useState<ReferenceItem | null>(null);
  const [removingRefBusy, setRemovingRefBusy] = useState(false);
  // Which submitted items the master TICKED for this round. The locked price
  // averages only the ticked items; unticked ones stay in the bill (the backend
  // splits the bill) waiting for a later round. Defaults to everything ticked.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );

  // Delete the bill being issued — เผื่อกรณีกดเข้ามาผิดหรือบิลนี้ไม่ควรออกแล้ว.
  const deleteBillDisc = useDisclosure();
  const [deletingBill, setDeletingBill] = useState(false);

  type BillItemLite = {
    id: number;
    type_id: string;
    type_name: string;
    metal?: string;
    price: number;
    percent: number;
    plus: number;
    weight: number;
    per_gram: number;
    total: number;
  };
  type BillLite = {
    id: number;
    total_amount: number;
    processed_weight: number;
    processed_amount: number;
    items?: BillItemLite[];
    creator?: {
      id: number;
      name: string;
      phone?: string;
      store_name?: string;
      address?: string;
      tax_id?: string;
    };
  };

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
        if (clicked?.creator) {
          setCustomerProfile({
            name: clicked.creator.name || "",
            phone: clicked.creator.phone || "",
            store_name: clicked.creator.store_name || "",
            address: clicked.creator.address || "",
            tax_id: clicked.creator.tax_id || "",
          });
          if (clicked.creator.phone) setSignerPhone(clicked.creator.phone);
        }
        // Auto-load the customer's most recent signature (they can still redraw).
        if (clicked?.creator?.id) {
          api
            .get<{ image_url: string }>(
              `/quotations/latest-signature?created_by=${clicked.creator.id}`,
            )
            .then((r) => {
              const u = (r.data as unknown as { image_url: string })?.image_url;
              if (u) {
                setPrevSignatureUrl(u);
                setSignatureDataUrl(`${API_BASE}${u}`);
                setUsingPrevSig(true);
              }
            })
            .catch(() => {});
        }
        // Edit mode: fixing an already-issued quote. Use the stashed bill group and
        // the previously-issued items (pre-filled into the calculator), and do NOT
        // merge the customer's other pending bills. The current issuance is
        // reversed at save time before re-issuing.
        if (editIssued) {
          const stashedIds = sessionStorage.getItem("editBillIds");
          const gids = stashedIds
            ? (JSON.parse(stashedIds) as number[])
            : [clicked?.id ?? Number(billId)];
          setBillIds(gids);
          const editRef = (clicked?.items ?? []).map((i) => ({
            typeId: i.type_id,
            typeName: i.type_name,
            metal: i.metal || "gold",
            price: i.price,
            plus: i.plus,
            percent: i.percent,
            weight: i.weight,
            perGram: i.per_gram,
            total: i.total,
            billId: clicked?.id ?? Number(billId),
            itemId: i.id,
          }));
          setReferenceItems(editRef);
          setSelectedItemIds(new Set(editRef.map((r) => r.itemId)));
          const stashedItems = sessionStorage.getItem("editBillItems");
          if (stashedItems) {
            try {
              const items = JSON.parse(stashedItems) as QuotationProps[];
              if (Array.isArray(items) && items.length > 0) setQuotation(items);
            } catch {
              /* ignore */
            }
          }
          sessionStorage.removeItem("editBillItems");
          sessionStorage.removeItem("editBillIds");
          return;
        }

        // Combine ALL of this customer's pending (รอออกบิล) bills' submitted items
        // as reference (their gold was melted; the master re-assesses from scratch).
        let bills: BillLite[] = [];
        if (clicked?.creator?.id) {
          const listRes = await api.get(
            `/bills?created_by=${clicked.creator.id}&status=10&limit=100`,
          );
          bills = (listRes.data as unknown as { data: BillLite[] }).data || [];
        }
        if (bills.length === 0 && clicked) bills = [clicked];

        const ids: number[] = [];
        const reference: ReferenceItem[] = [];
        for (const b of bills) {
          ids.push(b.id);
          for (const i of b.items ?? []) {
            reference.push({
              typeId: i.type_id,
              typeName: i.type_name,
              metal: i.metal || "gold",
              price: i.price,
              plus: i.plus,
              percent: i.percent,
              weight: i.weight,
              perGram: i.per_gram,
              total: i.total,
              billId: b.id,
              itemId: i.id,
            });
          }
        }
        setBillIds(ids);
        setReferenceItems(reference); // reference only — quote stays empty
        // Everything ticked by default — untick (via แก้ไขรายการ) to hold items
        // for a later round.
        setSelectedItemIds(new Set(reference.map((r) => r.itemId)));
      } catch {
        /* ignore */
      }
    })();
  }, [billId, editIssued]);

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

  // Master deletes one of the customer's submitted lines from their actual bill —
  // immediately, in both normal and edit mode. The backend recomputes the bill total
  // (and, for an already-issued bill, keeps its debt/credit ledger in sync); if the
  // bill empties it is deleted. We mirror the removal locally so the reference totals
  // + suggested price update at once.
  const confirmRemoveReference = async () => {
    const ref = removingRef;
    if (!ref) return;
    setRemovingRefBusy(true);
    try {
      const res = await api.delete<{ deleted: boolean }>(
        `/bills/${ref.billId}/items/${ref.itemId}`,
      );
      const deleted =
        (res.data as unknown as { deleted?: boolean })?.deleted ?? false;
      setReferenceItems((prev) => prev.filter((r) => r.itemId !== ref.itemId));
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(ref.itemId);
        return next;
      });
      setRemovingRef(null);
      if (deleted) {
        setBillIds((prev) => prev.filter((id) => id !== ref.billId));
        // Editing a bill that just emptied out → nothing left to re-issue.
        if (editIssued && Number(billId) === ref.billId) {
          router.push("/bills");
          return;
        }
      }
    } catch {
      /* ignore */
    } finally {
      setRemovingRefBusy(false);
    }
  };

  // Save entry: in bill mode at least one submitted item must be ticked — the
  // quotation is issued FOR those items (unticked ones stay for a later round).
  const handleRequestSave = () => {
    if (quotation.length === 0) return;
    if (salesClosed && !canBypassSales) {
      setSaveError("ขณะนี้ปิดทำการ ไม่สามารถออกใบเสนอราคาได้");
      return;
    }
    if (billId && referenceItems.length > 0 && selectedItemIds.size === 0) {
      setSaveError("กรุณาติ๊กเลือกรายการของลูกค้าอย่างน้อย 1 รายการ");
      return;
    }
    setSaveError("");
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
    } catch {
      /* ignore */
    } finally {
      setDeletingBill(false);
    }
  };

  // Missing metal means gold — items created before the metal tag existed.
  const isGoldItem = (i: QuotationProps) => (i.metal || "gold") === "gold";

  // From the terms step → preview. Signature is optional (the seller may sign
  // in person but it isn't required).
  const proceedToPreview = () => {
    setSaveError("");
    setShowTerms(false);
    setShowPreview(true);
  };

  // Only the TICKED submitted items count: they define this round's locked
  // average price. Unticked items stay in the bill for a later round.
  const selectedRef = referenceItems.filter((r) =>
    selectedItemIds.has(r.itemId),
  );
  const selTotal = selectedRef.reduce((s, i) => s + i.total, 0);
  // Gold and silver are weighed in different units (baht vs grams), so weight and
  // the locked average price are computed from the GOLD portion only. The average
  // feeds the gold tab's forced price; silver (per-gram) must never distort it.
  const selGoldWeight = selectedRef
    .filter(isGoldItem)
    .reduce((s, i) => s + (i.weight || 0), 0);
  const selGoldTotal = selectedRef
    .filter(isGoldItem)
    .reduce((s, i) => s + i.total, 0);
  const selSilverWeight = selectedRef
    .filter((i) => !isGoldItem(i))
    .reduce((s, i) => s + (i.weight || 0), 0);
  // Weighted-average effective rate of the gold selection: Σ(total) / Σ(weight) —
  // what the customer was locked in at (total includes percent/plus adjustments).
  const selAvgPrice = selGoldWeight > 0 ? selGoldTotal / selGoldWeight : 0;
  const effectiveForcedPrice = billId && selAvgPrice > 0 ? selAvgPrice : 0;

  // The receipt's "ชื่อลูกค้า / เบอร์โทร" line names the actual customer, which is
  // independent of who signs: in bill mode it comes from the bill's registered
  // customer (so changing the signer to a company name doesn't overwrite it);
  // walk-in quotes have no customer, so they fall back to the signer fields.
  const previewCustomerName = billId
    ? customerProfile?.name || billCustomer || signerName
    : signerName;
  const previewCustomerPhone = billId
    ? customerProfile?.phone || signerPhone
    : signerPhone;

  // In bill mode, consolidate the keyed lines per METAL: gold collapses into one
  // line, and each other metal gets its own consolidated line. Each round is
  // self-contained — no aggregates from earlier rounds.
  const previewItems: QuotationProps[] = (() => {
    if (billIds.length === 0 || quotation.length === 0) return quotation;

    const lines: QuotationProps[] = [];
    const byMetal = new Map<string, QuotationProps[]>();
    for (const item of quotation) {
      const m = item.metal || "gold";
      const group = byMetal.get(m);
      if (group) group.push(item);
      else byMetal.set(m, [item]);
    }
    // Gold first so the document leads with the main line.
    const metalKeys: string[] = [];
    byMetal.forEach((_, k) => metalKeys.push(k));
    const metals = ["gold", ...metalKeys.filter((m) => m !== "gold")];
    for (const m of metals) {
      const group = byMetal.get(m);
      if (!group) continue;
      const w = group.reduce((s, i) => s + (i.weight || 0), 0);
      const t = group.reduce((s, i) => s + i.total, 0);
      const first = group[0];
      const avg = w > 0 ? t / w : first.price;
      lines.push({
        ...first,
        price: Math.round(avg * 100) / 100,
        weight: w,
        perGram: w > 0 ? t / w : first.perGram,
        total: t,
      });
    }
    return lines;
  })();

  // Page 1 of the preview lists each keyed line individually (not the
  // consolidated per-metal lines used for the total / page 2).
  const page1Items: QuotationProps[] = quotation;

  const totalAmount = previewItems.reduce((sum, item) => sum + item.total, 0);
  const totalWeight = previewItems.reduce(
    (sum, item) => sum + (item.weight || 0),
    0,
  );
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
      setSaveError(
        "กรุณายอมรับเงื่อนไขการเก็บข้อมูลส่วนบุคคล (PDPA) ก่อนบันทึก",
      );
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
    // Master/owner have no fixed branch, so the receipt header comes from the
    // branch they pick. Warn when there's none — unless they explicitly opted
    // into a headerless document, which is a supported way to issue.
    if (!noHeader && !user?.branch_id && !selectedBranch) {
      setSaveError(
        'กรุณาเลือกร้าน/สาขาสำหรับหัวใบเสร็จ หรือติ๊ก "ออกใบโดยไม่มีหัวใบเสร็จ"',
      );
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // Editing an issued quote: reverse the old issuance now (delete the old quote,
      // its balance entry and delivery logs, and return the bill(s) to รอออกบิล) so
      // the re-issue below replaces it instead of double-counting. Deferred to here
      // so that abandoning the edit leaves the original issuance untouched.
      if (editIssued && billId) {
        await api.post(`/bills/${billId}/revert`, {});
      }

      // previewItems already contains the per-metal consolidated lines in bill
      // mode, so reuse it directly.
      const saveItems = previewItems.map((item) => ({
        type_id: item.typeId,
        type_name: item.typeName,
        metal: item.metal || "gold",
        plus: item.plus,
        plus_type: item.plus_type ?? 0,
        price: item.price,
        percent: item.percent,
        weight: item.weight,
        per_gram: item.perGram,
        total: item.total,
      }));

      // Only bills that actually have ticked items are covered by this round.
      // In editIssued mode the whole reverted group is re-issued (no ticking),
      // so the legacy whole-bill payload is kept.
      const tickedBillIds = selectedRef
        .map((r) => r.billId)
        .filter((v, i, a) => a.indexOf(v) === i);
      const res = await api.post<{ id: number; code: string }>("/quotations", {
        signer_name: signerName,
        signer_phone: signerPhone,
        pdpa_consent: consent,
        store_id: selectedStore?.id, // used only for master; others derive from JWT
        // Which branch's receipt header to snapshot (master/owner choose; employees
        // are locked to their JWT branch on the server).
        branch_id: selectedBranch?.id,
        // Skip the header snapshot server-side (store/branch link is still kept).
        no_header: noHeader,
        bill_ids: editIssued
          ? billIds.length
            ? billIds
            : undefined
          : tickedBillIds.length
            ? tickedBillIds
            : undefined,
        bill_item_ids: editIssued
          ? undefined
          : selectedRef.length
            ? selectedRef.map((r) => r.itemId)
            : undefined,
        items: saveItems,
        // Detailed per-item lines for the printed page 1. `items` above is stored
        // consolidated (one line per metal); this keeps the itemised view so
        // reprints never fall back to the merged lines (covers partial ticking too).
        page1_items: quotation,
        created_at: quotationDate,
      });
      const saved = res.data as unknown as { id: number; code: string };
      const quotationId = saved.id;

      // Persist the keyed lines for page-1 reprints. A delivery log attaches to a
      // bill row, so only log to a bill that ends up issued: a FULLY-ticked bill.
      // (A partially-ticked bill is split server-side and we don't know the new id
      // — those reprints fall back to the quotation's consolidated lines.)
      const logTargetBill = editIssued
        ? Number(billId)
        : tickedBillIds.find((bid) =>
            referenceItems
              .filter((r) => r.billId === bid)
              .every((r) => selectedItemIds.has(r.itemId)),
          );
      if (logTargetBill && quotation.length > 0) {
        const goldFinal = quotation.filter(isGoldItem);
        const w = goldFinal.reduce((s, i) => s + (i.weight || 0), 0);
        const a = goldFinal.reduce((s, i) => s + i.total, 0);
        try {
          await api.post(`/bills/${logTargetBill}/partial-deliver`, {
            weight: w,
            amount: a,
            items: quotation,
            log_only: true,
          });
        } catch {
          /* non-fatal */
        }
      }

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
      const msg =
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
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

  // Reference card listing the customer's submitted items — shared between the
  // desktop right column and the mobile drawer (extraClass tunes the height cap
  // per layout). Only shown in bill mode when there are submitted items.
  const toggleRefItem = (itemId: number) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const renderReferenceCard = (extraClass = "") => {
    if (!billId || referenceItems.length === 0) return null;
    const allSelected = selectedItemIds.size === referenceItems.length;
    return (
      <div
        className={`flex flex-col gap-y-2 border-1 border-black/10 bg-white/15 shadow-xl backdrop-blur-xl rounded-4xl p-3 shrink-0 ${extraClass}`}
      >
        <div className="flex items-center justify-between pl-2 pr-1">
          <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            รายการที่ลูกค้าส่งมา — ติ๊กเลือกที่จะออกรอบนี้
          </span>
          {!editIssued && (
            <button
              type="button"
              onClick={() =>
                setSelectedItemIds(
                  allSelected
                    ? new Set<number>()
                    : new Set(referenceItems.map((r) => r.itemId)),
                )
              }
              className="text-[11px] font-bold text-yellow-700 hover:text-yellow-800 shrink-0"
            >
              {allSelected ? "ไม่เลือกทั้งหมด" : "เลือกทั้งหมด"}
            </button>
          )}
        </div>
        {/* Summary of the TICKED items — these define this round's locked price. */}
        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
          <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
            <span className="font-bold text-[10px] text-black/50 pl-1">
              เลือกแล้ว
            </span>
            <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
              {selectedItemIds.size}/{referenceItems.length} รายการ
            </span>
          </div>
          <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
            <span className="font-bold text-[10px] text-black/50 pl-1">
              ราคาเฉลี่ย (ทอง/บาท)
            </span>
            <span className="font-bold text-sm text-yellow-700 pl-1">
              {selAvgPrice > 0
                ? selAvgPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "-"}
            </span>
          </div>
          <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
            <span className="font-bold text-[10px] text-black/50 pl-1">
              ยอดที่เลือก
            </span>
            <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
              {selTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="font-bold text-[10px] text-black/35 pl-1 mt-0.5">
              น้ำหนัก{" "}
              {selGoldWeight > 0
                ? `${selGoldWeight.toLocaleString(undefined, { maximumFractionDigits: 4 })} บาท`
                : ""}
              {selGoldWeight > 0 && selSilverWeight > 0 ? " + " : ""}
              {selSilverWeight > 0
                ? `${selSilverWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} กรัม`
                : ""}
              {selGoldWeight === 0 && selSilverWeight === 0 ? "0" : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-y-1 overflow-y-auto scrollbar-hide">
          {referenceItems.map((it, i) => {
            const ticked = selectedItemIds.has(it.itemId);
            return (
              <div
                key={it.itemId}
                className={`flex items-center justify-between gap-x-2 border rounded-xl px-2 py-2 text-xs transition-colors ${ticked ? "bg-yellow-500/10 border-yellow-500/30" : "bg-black/5 border-black/10 opacity-60"}`}
              >
                <div className="flex items-center gap-x-1 min-w-0">
                  <Checkbox
                    size="sm"
                    color="warning"
                    isSelected={ticked}
                    onValueChange={() => toggleRefItem(it.itemId)}
                    isDisabled={editIssued}
                    aria-label={`เลือก ${it.typeName}`}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-black/70 font-bold truncate">
                      {i + 1}. {it.typeName}
                      {!ticked && (
                        <span className="ml-1 text-[9px] font-normal text-black/40">
                          (รอรอบหน้า)
                        </span>
                      )}
                    </span>
                    <span className="text-black/50 text-[10px] whitespace-nowrap">
                      ราคา {it.price.toLocaleString()} · น้ำหนัก {it.weight} ·
                      รวม {it.total.toLocaleString()} บาท
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  title="ลบรายการนี้ออกจากบิลลูกค้า"
                  onClick={() => setRemovingRef(it)}
                  className="h-5 w-5 shrink-0 bg-gradient-to-br from-red-600/50 to-transparent border-1 border-black/10 rounded-full flex items-center justify-center"
                >
                  <X size={13} className="text-red-600" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-y-3">
      {salesClosed && <SalesStatusBanner status={salesStatus} />}
      {billId && (
        <div className="flex items-center gap-x-2 bg-blue-50 border-1 border-blue-200 rounded-2xl p-3">
          <Receipt size={16} className="text-blue-600 shrink-0" />
          <span className="text-sm font-bold text-blue-700 flex-1">
            ออกบิลให้ลูกค้า{billCustomer ? ` : ${billCustomer}` : ""}
            {billIds.length > 1 ? ` (${billIds.length} รายการ)` : ""} —
            กรอกรายการใหม่จากทองที่หลอมเสร็จ
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
        <div className="flex flex-col w-full min-w-0 items-start">
          <Calculate
            onAdd={handleAddItem}
            onOpenList={() => setListOpen(true)}
            quotationCount={quotation.length}
            lockMeltType={!!billId}
            forcedPrice={
              effectiveForcedPrice > 0 ? effectiveForcedPrice : undefined
            }
          />
        </div>
        {/* Right column: reference card (customer's submitted items) above the quote card */}
        <div className="flex flex-col gap-y-3 w-[500px] min-w-0 max-lg:hidden">
          {renderReferenceCard("max-h-[38%]")}
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
          listOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
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

          {/* Reference card — same customer-submitted items shown on desktop */}
          {renderReferenceCard("max-h-[45%]")}

          {/* Items */}
          <div className="flex flex-col gap-y-2 overflow-y-auto flex-1 scrollbar-hide">
            {quotation.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                กด + เพื่อเพิ่มรายการ
              </div>
            ) : (
              quotation.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col w-full border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3"
                >
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
                      <div
                        key={f.label}
                        className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1"
                      >
                        <span className="font-bold text-[10px] text-black/50 pl-1">
                          {f.label}
                        </span>
                        <span className="font-bold text-xs bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
                          {f.value}
                        </span>
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
            onClick={() => {
              setListOpen(false);
              handleRequestSave();
            }}
            className="w-full bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            บันทึกใบเสนอราคา
          </button>
        </div>
      </div>

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
                <span className="text-xs font-normal text-black/50">
                  กรุณาอ่านและลงลายมือชื่อก่อนดำเนินการต่อ
                </span>
              </ModalHeader>
              <ModalBody className="px-3">
                {/* The rules rendered as an A5 paper document (with live signature) */}
                <TermsForm
                  signatureImage={signatureDataUrl}
                  signerName={signerName}
                  onPrint={() => window.print()}
                />

                {/* Signature input — ผู้ขาย/เจ้าของสินทรัพย์ */}
                <div className="flex flex-col gap-y-2 mt-4">
                  <label className="block text-sm font-bold text-black/70">
                    เซ็นชื่อ ผู้ขาย / เจ้าของสินทรัพย์
                  </label>

                  {/* Suggestion: fill signer fields from the customer's registered profile */}
                  {customerProfile &&
                    (customerProfile.name || customerProfile.phone) && (
                      <div className="flex flex-col gap-2 border-1 border-[#c09c42]/30 bg-[#c09c42]/5 rounded-2xl p-3">
                        <div className="flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42]">
                          <UserCheck size={14} /> ข้อมูลลูกค้าที่ลงทะเบียนไว้
                        </div>
                        <div className="text-xs text-black/60 leading-relaxed">
                          {customerProfile.name || "-"}
                          {customerProfile.phone
                            ? ` · ${customerProfile.phone}`
                            : ""}
                          {customerProfile.address ? (
                            <div className="text-black/40">
                              {customerProfile.address}
                            </div>
                          ) : null}
                          {customerProfile.tax_id ? (
                            <div className="text-black/40">
                              เลขภาษี: {customerProfile.tax_id}
                            </div>
                          ) : null}
                        </div>

                        {/* Choose which name to put as the signer (default: person) */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-black/50">
                            ใช้ชื่อผู้เซ็นเป็น
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNameSource("person")}
                              className={`text-xs font-bold px-3 py-1 rounded-full border-1 transition-colors ${nameSource === "person" ? "bg-[#c09c42] text-white border-[#c09c42]" : "bg-white/60 text-black/60 border-black/10"}`}
                            >
                              ชื่อลูกค้า
                            </button>
                            <button
                              type="button"
                              onClick={() => setNameSource("company")}
                              disabled={!customerProfile.store_name}
                              className={`text-xs font-bold px-3 py-1 rounded-full border-1 transition-colors disabled:opacity-40 ${nameSource === "company" ? "bg-[#c09c42] text-white border-[#c09c42]" : "bg-white/60 text-black/60 border-black/10"}`}
                            >
                              ชื่อบริษัท
                              {customerProfile.store_name
                                ? ` (${customerProfile.store_name})`
                                : ""}
                            </button>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="flat"
                          className="self-start border-1 border-[#c09c42]/30 bg-white/60 font-bold text-[#c09c42]"
                          onPress={() => {
                            if (!customerProfile) return;
                            setSignerName(
                              nameSource === "company" &&
                                customerProfile.store_name
                                ? customerProfile.store_name
                                : customerProfile.name,
                            );
                            setSignerPhone(customerProfile.phone);
                          }}
                        >
                          ใช้ข้อมูลที่ลงทะเบียนไว้
                        </Button>
                      </div>
                    )}

                  <Input
                    size="sm"
                    type="date"
                    label="วันที่ในเอกสาร"
                    value={quotationDate}
                    onValueChange={setQuotationDate}
                    classNames={{
                      inputWrapper:
                        "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      size="sm"
                      label="ชื่อผู้เซ็น"
                      value={signerName}
                      onValueChange={setSignerName}
                      classNames={{
                        inputWrapper:
                          "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                      }}
                    />
                    <Input
                      size="sm"
                      label="เบอร์โทร"
                      value={signerPhone}
                      onValueChange={setSignerPhone}
                      classNames={{
                        inputWrapper:
                          "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                      }}
                    />
                  </div>

                  {usingPrevSig && signatureDataUrl ? (
                    // Reusing the customer's previous signature — show it with an option to draw a new one.
                    <div className="flex flex-col gap-y-2">
                      <div
                        className="relative rounded-2xl border-2 border-[#c09c42]/40 bg-white overflow-hidden flex items-center justify-center"
                        style={{ height: 180 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={signatureDataUrl}
                          alt="ลายเซ็นเดิม"
                          className="max-h-full max-w-full object-contain"
                        />
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-[#c09c42] bg-white/80 rounded-full px-2 py-0.5 border-1 border-[#c09c42]/30">
                          ใช้ลายเซ็นเดิม
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUsingPrevSig(false);
                          setSignatureDataUrl(null);
                        }}
                        className="self-end flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700"
                      >
                        <PenLine size={14} /> เซ็นใหม่
                      </button>
                    </div>
                  ) : (
                    <>
                      {prevSignatureUrl && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="self-start border-1 border-[#c09c42]/30 bg-[#c09c42]/5 font-bold text-[#c09c42]"
                          startContent={<PenLine size={14} />}
                          onPress={() => {
                            setSignatureDataUrl(
                              `${API_BASE}${prevSignatureUrl}`,
                            );
                            setUsingPrevSig(true);
                          }}
                        >
                          ใช้ลายเซ็นเดิม
                        </Button>
                      )}
                      <SignaturePad onChange={setSignatureDataUrl} />
                    </>
                  )}
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
                {/* Receipt-header store/branch picker (master & owner) — placed here
                    so the header preview below updates as it's changed. */}
                {canSelectStoreBranch && (
                  <div className="flex flex-col gap-1.5 border-1 border-black/10 bg-black/5 rounded-2xl p-3 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#c09c42]">
                      <Store size={14} /> หัวใบเสร็จ (ร้าน / สาขา)
                    </div>
                    {!noHeader && <StoreBranchSelector />}
                    <Checkbox
                      size="sm"
                      isSelected={noHeader}
                      onValueChange={setNoHeader}
                    >
                      <span className="text-xs text-black/60">
                        ออกใบโดยไม่มีหัวใบเสร็จ
                      </span>
                    </Checkbox>
                  </div>
                )}
                {/* Typed image uploads — before/after side by side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <ImageUploadGroup
                    label="รูปก่อนหลอม (ไม่บังคับ)"
                    files={beforeFiles}
                    setFiles={setBeforeFiles}
                  />
                  <ImageUploadGroup
                    label="รูปบนตราชั่ง / หลังหลอม (ไม่บังคับ)"
                    files={afterFiles}
                    setFiles={setAfterFiles}
                  />
                </div>
                <PreviewQuote
                  hidePrint
                  items={previewItems}
                  page1Items={page1Items}
                  store={headerStore}
                  customerName={previewCustomerName}
                  customerPhone={previewCustomerPhone}
                  customerAddress={customerProfile?.address}
                  customerTaxId={customerProfile?.tax_id}
                  date={quotationDate}
                  beforeImages={beforeImages}
                  afterImages={afterImages}
                  signatureImage={signatureDataUrl}
                  signerName={signerName}
                />

                {/* Summary: weight and total of this quotation */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-black/50">
                      น้ำหนักรวม
                    </span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {totalWeight.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-black/50">
                      ยอดรวม (บาท)
                    </span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {/* PDPA consent — required before saving */}
                <div className="mt-4 bg-black/5 border-1 border-black/10 rounded-2xl p-3">
                  <Checkbox
                    size="sm"
                    isSelected={consent}
                    onValueChange={setConsent}
                  >
                    <span className="text-xs text-black/70 leading-relaxed">
                      ข้าพเจ้ายินยอมให้ร้านเก็บรวบรวม ใช้
                      และเปิดเผยข้อมูลส่วนบุคคล รวมถึงรูปภาพและลายเซ็น
                      เพื่อวัตถุประสงค์ในการออกใบเสนอราคาและทำธุรกรรม
                      ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
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
        onOpenChange={(open) => {
          if (!open) handleFinishPostSave();
        }}
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
                  page1Items={page1Items}
                  onPrint={() => window.print()}
                  store={headerStore}
                  documentNo={savedQuotation?.code}
                  customerName={previewCustomerName}
                  customerPhone={previewCustomerPhone}
                  customerAddress={customerProfile?.address}
                  customerTaxId={customerProfile?.tax_id}
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
                    คุณยังไม่ได้แนบรายการต่อไปนี้
                    ต้องการบันทึกโดยไม่แนบจริงหรือไม่?
                  </p>
                  <ul className="flex flex-col gap-y-1">
                    {missingImages().map((m) => (
                      <li
                        key={m}
                        className="flex items-center gap-x-2 text-sm bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                      >
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
                  onPress={() => {
                    setShowMissingWarn(false);
                    handleConfirmSave();
                  }}
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
                    เครดิตของคุณไม่เพียงพอ การออกใบเสนอราคานี้จะทำให้เครดิตติดลบ
                    ยืนยันที่จะสร้างหรือไม่?
                  </p>
                  <div className="flex flex-col gap-y-1 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/50">เครดิตคงเหลือ</span>
                      <span className="font-bold text-black">
                        {credits.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        บาท
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/50">ยอดรวมใบเสนอราคา</span>
                      <span className="font-bold text-black">
                        {totalAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        บาท
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-amber-200 mt-1 pt-1">
                      <span className="text-black/50">เครดิตหลังหัก</span>
                      <span className="font-bold text-red-600">
                        {(credits - totalAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        บาท
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

      {/* Delete one of the customer's submitted reference items from their bill */}
      <ConfirmDeleteModal
        isOpen={!!removingRef}
        onClose={() => setRemovingRef(null)}
        onConfirm={confirmRemoveReference}
        name={
          removingRef
            ? `รายการ "${removingRef.typeName}" ที่ลูกค้าส่งมา`
            : undefined
        }
        related="รายการนี้จะถูกลบออกจากบิลของลูกค้าจริง และยอดรวมบิล/ยอดขาด-เกินจะถูกคำนวณใหม่ (ถ้าไม่เหลือรายการ บิลจะถูกลบทั้งใบ)"
        loading={removingRefBusy}
      />
    </div>
  );
}
