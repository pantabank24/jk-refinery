"use client";

import { Calculate } from "./_component/calculate";
import { useState, useEffect } from "react";
import { Quotation, QuotationProps } from "./_component/quotation";
import { consolidateByMetal } from "./_component/consolidate";
import { PreviewQuote, type PayMethod } from "./_component/previewQuote";
import { TermsForm } from "./_component/termsForm";
import { api } from "@/lib/api";
import { BillCalculate } from "../bills/_component/billCalculate";
import { GoldType, computeItem } from "@/lib/gold-calc";
import { roundedGrandTotal, roundQuoteLines } from "@/lib/quote-rounding";
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
  ShoppingBag,
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
import { Tabs, Tab } from "@heroui/tabs";
import { Spinner } from "@heroui/spinner";
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
    display_code?: string;
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
  // Which half of the mobile drawer is showing: what the customer submitted, or
  // what has been keyed into this quotation. Desktop stacks both, a phone can't.
  const [listTab, setListTab] = useState<"reference" | "saved">("saved");

  // When a master issues a customer's bill, this page is opened with ?billId=X:
  // pre-fill the sold items and the customer's name as the signer.
  const searchParams = useSearchParams();
  const billId = searchParams.get("billId");
  // editIssued=1: reopened from "แก้ไขบิล" to fix an already-issued quote. The bill
  // stays "รอตรวจบิล"; the old issuance is reversed at save time (see doSave), not now.
  const editIssued = searchParams.get("editIssued") === "1";
  const [billCustomer, setBillCustomer] = useState("");
  // Who the bill belongs to — the master sells on their behalf straight from this
  // screen when the melted result comes out over (or under) what they submitted.
  const [billCustomerId, setBillCustomerId] = useState<number | null>(null);
  // The bill's metal decides which list page to return to (รายการขายทอง/เงิน).
  const [billMetal, setBillMetal] = useState("gold");
  const billsListHref = billMetal === "gold" ? "/bills" : "/bills/silver";
  // The customer's registered profile (suggested for the signer fields) + their
  // most recent signature (offered for reuse), loaded in bill mode.
  const [customerProfile, setCustomerProfile] = useState<{
    name: string;
    phone: string;
    store_name: string;
    address: string;
    tax_id: string;
    bank_name: string;
    bank_account_no: string;
    bank_account_name: string;
  } | null>(null);
  // ชำระโดย — ติ๊กในพรีวิว แล้วบันทึกไปกับใบเสนอราคา
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>(null);
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

  // ── ขายแทนลูกค้า (bill mode) ──
  // The melted result routinely comes out over or under what the customer
  // submitted; the master settles the difference by selling for them, which used
  // to mean leaving this screen for /bills/sell and walking back.
  const sellDisc = useDisclosure();
  const [sellSaving, setSellSaving] = useState(false);
  const [sellError, setSellError] = useState("");
  // Set after a sale reprices the keyed lines, so the numbers never move silently.
  const [repriceNote, setRepriceNote] = useState("");
  // Gold types (with their formulas) — needed to recompute keyed lines at the new
  // locked price, the same way the calculator computed them in the first place.
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);
  useEffect(() => {
    if (!billId) return;
    api
      .get<GoldType[]>("/gold-types")
      .then((r) => setGoldTypes((r.data as unknown as GoldType[]) || []))
      .catch(() => { });
  }, [billId]);

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
    // Which list the bill belongs to (gold|silver); bills are single-metal.
    metal?: string;
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
      bank?: { id: number; name: string } | null;
      bank_account_no?: string;
      bank_account_name?: string;
    };
  };

  // Every pending (รอออกบิล) bill this customer has in this metal, flattened into
  // the reference card's lines. Called on load and again after the master sells
  // for them, so the card and billIds always describe the same set of bills.
  const fetchReferences = async (
    creatorId: number | undefined,
    metal: string,
    fallback?: BillLite | null,
  ) => {
    let bills: BillLite[] = [];
    if (creatorId) {
      const listRes = await api.get<BillLite[]>(
        `/bills?created_by=${creatorId}&status=10&limit=100&metal=${metal}`,
      );
      // res.data IS the array — reading a further .data off it always yielded
      // undefined, so this quietly fell back to the clicked bill every time.
      bills = (listRes.data as unknown as BillLite[]) || [];
    }
    if (bills.length === 0 && fallback) bills = [fallback];

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
    return { ids, reference };
  };

  useEffect(() => {
    if (!billId) return;
    (async () => {
      try {
        const res = await api.get(`/bills/${billId}`);
        const clicked = res.data as unknown as BillLite;
        setBillMetal(clicked?.metal || "gold");
        setBillCustomerId(clicked?.creator?.id ?? null);
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
            bank_name: clicked.creator.bank?.name || "",
            bank_account_no: clicked.creator.bank_account_no || "",
            bank_account_name: clicked.creator.bank_account_name || "",
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
            .catch(() => { });
        }
        // Edit mode: fixing an already-issued quote. Use the stashed bill group and
        // the previously-issued items (pre-filled into the calculator), and do NOT
        // merge the customer's other pending bills. The current issuance is
        // reversed at save time before re-issuing.
        if (editIssued) {
          // The stash is tagged with the bill it was written for: a stale stash
          // (edit abandoned, then this URL reached again) must never bleed into a
          // different bill's group. It is cleared only once the re-issue succeeds
          // (see doSave), so refreshing mid-edit doesn't silently drop the group.
          const stashValid =
            sessionStorage.getItem("editBillFor") === String(billId);
          const stashedIds = stashValid
            ? sessionStorage.getItem("editBillIds")
            : null;
          const gids = stashedIds
            ? (JSON.parse(stashedIds) as number[])
            : [clicked?.id ?? Number(billId)];
          setBillIds(gids);

          // Bills issued together form one group. Pull EVERY bill's submitted
          // items, not just the clicked one — the reference card and the locked
          // average price (forcedPrice) are derived from these, so covering only
          // part of the group forces the master to key at the wrong price.
          const groupBills = await Promise.all(
            gids.map((gid) =>
              gid === clicked?.id
                ? Promise.resolve(clicked)
                : api
                  .get(`/bills/${gid}`)
                  .then((r) => r.data as unknown as BillLite)
                  .catch(() => null),
            ),
          );
          const editRef: ReferenceItem[] = [];
          for (const b of groupBills) {
            if (!b) continue;
            for (const i of b.items ?? []) {
              editRef.push({
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
          setReferenceItems(editRef);
          setSelectedItemIds(new Set(editRef.map((r) => r.itemId)));
          const stashedItems = stashValid
            ? sessionStorage.getItem("editBillItems")
            : null;
          if (stashedItems) {
            try {
              const items = JSON.parse(stashedItems) as QuotationProps[];
              if (Array.isArray(items) && items.length > 0) setQuotation(items);
            } catch {
              /* ignore */
            }
          }
          return;
        }

        // Combine ALL of this customer's pending (รอออกบิล) bills' submitted items
        // as reference (their gold was melted; the master re-assesses from scratch).
        // Same metal only — a gold issuance must never pull in their silver bill.
        const { ids, reference } = await fetchReferences(
          clicked?.creator?.id,
          clicked?.metal || "gold",
          clicked,
        );
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
      const nextRef = referenceItems.filter((r) => r.itemId !== ref.itemId);
      const nextTicked = new Set(selectedItemIds);
      nextTicked.delete(ref.itemId);
      setReferenceItems(nextRef);
      setSelectedItemIds(nextTicked);
      setRemovingRef(null);
      if (deleted) {
        setBillIds((prev) => prev.filter((id) => id !== ref.billId));
        // Editing a bill that just emptied out → nothing left to re-issue.
        if (editIssued && Number(billId) === ref.billId) {
          router.push(billsListHref);
          return;
        }
      }
      // The deleted line was part of this round's locked average, so lines already
      // keyed at the old rate no longer add up to what the customer has submitted —
      // move them exactly the way a sale does.
      repriceKeyedLines(nextRef, nextTicked);
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
      router.push(billsListHref);
    } catch {
      /* ignore */
    } finally {
      setDeletingBill(false);
    }
  };

  // Missing metal means gold — items created before the metal tag existed.
  const isGoldItem = (i: QuotationProps) => (i.metal || "gold") === "gold";
  // Bills are single-metal, so "the bill's metal" is the only side that matters
  // when locking a price or repricing keyed lines.
  const isBillMetalItem = (i: QuotationProps) =>
    isGoldItem(i) === (billMetal === "gold");

  // ราคาล็อกเฉลี่ยของรายการที่ลูกค้าส่งมา — ถ่วงน้ำหนักเสมอ แต่คนละสูตรตามโลหะ เพราะ
  // สองฝั่งคิดคนละหน่วย:
  //   ทอง — ราคาเป็น บาท/บาททอง และน้ำหนักเป็นบาททอง Σยอดเงิน ÷ Σน้ำหนัก จึงได้หน่วย
  //          เดียวกับช่องราคาพอดี และครอบคลุมส่วนบวก/เปอร์เซ็นต์ที่ติดมากับรายการด้วย
  //   เงิน — ราคาเป็น บาท/กก. แต่น้ำหนักเป็นกรัม สูตรเดียวกันจะได้ บาท/กรัม ซึ่งผิดหน่วย
  //          ไป 1,000 เท่า จึงถัวเฉลี่ย "ราคาฐาน" ของแต่ละรายการตามน้ำหนักแทน (ส่วนบวก
  //          ตามช่วงน้ำหนักไม่ได้เก็บในช่องราคาอยู่แล้ว — ถูกคิดใหม่ตอนคีย์รายการ)
  const lockedAvgPrice = (rows: ReferenceItem[], metal: string): number => {
    const w = rows.reduce((s, i) => s + (i.weight || 0), 0);
    if (w <= 0) return 0;
    if (metal === "gold") return rows.reduce((s, i) => s + i.total, 0) / w;
    return rows.reduce((s, i) => s + i.price * (i.weight || 0), 0) / w;
  };

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
  // Gold and silver are weighed in different units (baht vs grams), so the two
  // weights are only ever shown side by side, never summed.
  const selGoldWeight = selectedRef
    .filter(isGoldItem)
    .reduce((s, i) => s + (i.weight || 0), 0);
  const selSilverWeight = selectedRef
    .filter((i) => !isGoldItem(i))
    .reduce((s, i) => s + (i.weight || 0), 0);
  // ราคาที่ลูกค้าถูกล็อกไว้ตอนขาย ถัวเฉลี่ยจากรายการที่ติ๊กไว้ — บิลเป็นโลหะเดียว จึงคิด
  // จากฝั่งของโลหะนั้นและส่งไปล็อกช่องราคาในเครื่องคิดเลข (ทั้งทองและเงิน)
  const selAvgPrice = lockedAvgPrice(
    selectedRef.filter(isBillMetalItem),
    billMetal,
  );
  const effectiveForcedPrice = billId && selAvgPrice > 0 ? selAvgPrice : 0;
  // หน่วยของราคาล็อก — ทองคิดต่อบาททอง เงินคิดต่อกิโลกรัม
  const lockPriceLabel = billMetal === "gold" ? "ทอง/บาท" : "เงิน/กก.";
  const lockPriceUnit = billMetal === "gold" ? "บาท" : "บาท/กก.";

  // Sell on the customer's behalf without leaving the issue screen. The sale
  // lands in the very bill being issued (same customer, same metal, still
  // รอออกบิล), so the reference card and billIds only need re-reading.
  const handleSellForCustomer = async (item: QuotationProps) => {
    if (!billCustomerId) return;
    setSellSaving(true);
    setSellError("");
    try {
      await api.post("/bills", {
        customer_id: billCustomerId,
        items: [
          {
            type_id: item.typeId,
            type_name: item.typeName,
            metal: item.metal ?? "gold",
            plus: item.plus,
            price: item.price,
            percent: item.percent,
            weight: item.weight,
            per_gram: item.perGram,
            total: item.total,
          },
        ],
      });

      const { ids, reference } = await fetchReferences(billCustomerId, billMetal);
      // Keep whatever the master had unticked (held for a later round); anything
      // that wasn't there before — the line just sold — starts ticked.
      const known = new Set(referenceItems.map((r) => r.itemId));
      const ticked = new Set<number>();
      for (const r of reference) {
        if (!known.has(r.itemId) || selectedItemIds.has(r.itemId)) {
          ticked.add(r.itemId);
        }
      }
      setBillIds(ids);
      setReferenceItems(reference);
      setSelectedItemIds(ticked);
      repriceKeyedLines(reference, ticked);
      sellDisc.onClose();
    } catch (err: unknown) {
      setSellError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSellSaving(false);
    }
  };

  // The locked price is the weighted average of the ticked reference lines of the
  // bill's metal, so a sale moves it — and lines already keyed at the old rate
  // would no longer add up to what the customer has now submitted. Recompute them
  // through the same formula the calculator used, changing only the base price.
  const repriceKeyedLines = (
    reference: ReferenceItem[],
    ticked: Set<number>,
  ) => {
    const sel = reference
      .filter((r) => ticked.has(r.itemId))
      .filter(isBillMetalItem);
    const avg = lockedAvgPrice(sel, billMetal);
    if (avg <= 0) return;

    const lines = quotation.filter(isBillMetalItem);
    if (lines.length === 0) return;
    const from = lines[0].price;
    if (Math.abs(from - avg) < 0.005) return;

    setQuotation((prev) =>
      prev.map((line) => {
        if (!isBillMetalItem(line)) return line;
        const gt =
          goldTypes.find((g) => String(g.id) === String(line.typeId)) ?? null;
        const vars = {
          goldType: gt,
          percent: line.percent,
          plus: line.plus,
          weight: line.weight,
          plusType: line.plus_type ?? 0,
        };
        // ขยับด้วย "ส่วนต่าง" แทนการคำนวณทั้งบรรทัดใหม่: บรรทัดเงินเก็บราคาฐานไว้ในช่อง
        // ราคา แต่ยอดของมันรวมส่วนบวกตามช่วงน้ำหนักไว้แล้ว การคำนวณใหม่จากช่องราคา
        // อย่างเดียวจะทำให้ส่วนบวกนั้นหายไป. สูตรเป็นเชิงเส้นกับราคา ผลของทองจึงเท่ากับ
        // คำนวณใหม่ทั้งก้อนเป๊ะ ๆ เหมือนเดิม
        const now = computeItem({ ...vars, price: avg });
        const was = computeItem({ ...vars, price: line.price });
        return {
          ...line,
          price: avg,
          perGram: line.perGram + (now.perGram - was.perGram),
          total: line.total + (now.total - was.total),
        };
      }),
    );
    const fmt = (n: number) =>
      n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    setRepriceNote(
      `ราคาล็อกเปลี่ยน — ปรับ ${lines.length} รายการที่คีย์ไว้จาก ${fmt(from)} เป็น ${fmt(avg)} ${lockPriceUnit}`,
    );
  };

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
  const rawPreviewItems: QuotationProps[] =
    billIds.length === 0 || quotation.length === 0
      ? quotation
      : consolidateByMetal(quotation);

  // ราคา/กรัม และ จำนวนเงิน ของใบที่ออกใหม่เป็นจำนวนเต็ม โดยปันส่วนให้ทุกบรรทัดบวกกัน
  // แล้วเท่ายอดรวมพอดี. ปัดตรงนี้ที่เดียวแล้วใช้ทั้งพรีวิวและตอนบันทึก — สิ่งที่ลูกค้าเห็น
  // ก่อนกดยืนยันจึงเป็นตัวเลขชุดเดียวกับที่ลงฐานข้อมูลเป๊ะ
  //
  // ใบเก่าที่บันทึกไว้ก่อนหน้าไม่ถูกแตะ: PreviewQuote แสดงค่าตามที่เก็บมาตรง ๆ ไม่ปัดซ้ำ
  // เปิดใบเก่าดูจึงยังเห็นทศนิยมเดิมเหมือนวันที่ออกใบ
  const savedTotal = roundedGrandTotal(rawPreviewItems);
  const previewItems = roundQuoteLines(rawPreviewItems, savedTotal);

  // Page 1 of the preview lists each keyed line individually (not the
  // consolidated per-metal lines used for the total / page 2).
  const page1Items: QuotationProps[] = roundQuoteLines(quotation, savedTotal);

  const totalAmount = savedTotal;
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

      // previewItems / page1Items ถูกปัดไว้แล้วตอนสร้าง (ดูด้านบน) — บันทึกชุดเดียวกับ
      // ที่พรีวิวแสดง เพื่อให้ตัวเลขใน DB ตรงกับกระดาษที่ลูกค้าเพิ่งเห็นและเซ็นไป
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
      const res = await api.post<{ id: number; code: string; display_code?: string }>("/quotations", {
        signer_name: signerName,
        signer_phone: signerPhone,
        // ชำระโดย ที่ติ๊กไว้ในพรีวิว — เก็บไว้กับใบ ไม่งั้นเปิดดูภายหลังจะว่างเปล่า
        payment_method: paymentMethod ?? "",
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
        page1_items: page1Items,
        created_at: quotationDate,
      });
      const saved = res.data as unknown as { id: number; code: string; display_code?: string };
      const quotationId = saved.id;

      // The group has been re-issued — the edit stash has done its job and must
      // not survive to be re-applied. Kept until here (rather than dropped on
      // load) so a refresh mid-edit still restores the full group.
      if (editIssued) {
        sessionStorage.removeItem("editBillItems");
        sessionStorage.removeItem("editBillIds");
        sessionStorage.removeItem("editBillFor");
      }

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
  // ชำระโดย — ในพรีวิวก่อนบันทึก แค่เก็บลง state (POST พาไปด้วย); ในพรีวิวหลังบันทึก
  // ใบถูกสร้างแล้ว จึงต้อง PATCH ตามไปทันที ไม่งั้นการติ๊กตอนพิมพ์จะไม่ถูกบันทึก
  const handlePaymentMethodChange = (m: PayMethod) => {
    setPaymentMethod(m);
    if (savedQuotation?.id) {
      api
        .patch(`/quotations/${savedQuotation.id}/payment-method`, {
          payment_method: m ?? "",
        })
        .catch(() => { });
    }
  };

  const handleFinishPostSave = () => {
    setPaymentMethod(null);
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
    router.push(billId ? billsListHref : "/quote-list");
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

  // The customer's submitted lines only exist in bill mode. Without them the
  // drawer has a single list and needs no tab strip.
  const hasReference = !!billId && referenceItems.length > 0;

  const renderReferenceCard = (extraClass = "") => {
    if (!hasReference) return null;
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
              ราคาเฉลี่ย ({lockPriceLabel})
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
        <div className="flex items-center gap-x-2 bg-blue-50 border-1 border-blue-200 rounded-2xl p-3 max-md:flex-col">
          <div className="flex items-center gap-x-2 w-full">
            <Receipt size={16} className="text-blue-600 shrink-0" />
            <span className="text-sm font-bold text-blue-700 flex-1 min-w-0 w-full truncate text-ellipsis">
              ออกบิลให้ลูกค้า{billCustomer ? ` : ${billCustomer}` : ""}
              {billIds.length > 1 ? ` (${billIds.length} รายการ)` : ""} —
              กรอกรายการใหม่จากทองที่หลอมเสร็จ
            </span>
          </div>

          {/* Hidden while fixing an already-issued quote: that bill is no longer
              "รอออกบิล", so a sale would land in a different bill entirely. */}
          <div className="flex  gap-x-2 max-md:mt-1">
            {!editIssued && billCustomerId && hasPermission("bills.sell") && (
              <Button
                size="sm"
                className="shrink-0 bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                startContent={<ShoppingBag size={14} />}
                onPress={() => {
                  setSellError("");
                  sellDisc.onOpen();
                }}
              >
                ขายแทนลูกค้า
              </Button>
            )}
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
        </div>
      )}

      {/* Keyed lines were recomputed at the new locked price — say so, since the
          master is looking at numbers they typed at a different rate. */}
      {repriceNote && (
        <div className="flex items-center gap-x-2 bg-amber-50 border-1 border-amber-200 rounded-2xl px-3 py-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-amber-700 flex-1">
            {repriceNote}
          </span>
          <button
            type="button"
            onClick={() => setRepriceNote("")}
            className="text-amber-600 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex flex-row gap-x-5 flex-1 min-h-0">
        <div className="flex flex-col w-full min-w-0 items-start">
          <Calculate
            onAdd={handleAddItem}
            onOpenList={() => {
              // Nothing keyed yet means the master is still working from the
              // customer's list — open there instead of on an empty tab.
              setListTab(hasReference && quotation.length === 0 ? "reference" : "saved");
              setListOpen(true);
            }}
            quotationCount={quotation.length}
            lockMeltType={!!billId}
            // Issuing a bill opens on that bill's metal (bills are single-metal).
            initialMetal={billId ? billMetal : "gold"}
            forcedPrice={
              effectiveForcedPrice > 0 ? effectiveForcedPrice : undefined
            }
            // ราคาล็อกเป็นของโลหะที่บิลนี้ถืออยู่ — ล็อกเฉพาะแท็บนั้น ไม่ให้ราคาทองไปโผล่
            // ในแท็บเงิน (หรือกลับกัน) ถ้าผู้ใช้สลับแท็บ
            forcedPriceMetal={billMetal}
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
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${listOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
          }`}
      />

      {/* Mobile drawer — full screen. A 20rem panel left the reference card and
          the keyed items fighting over the same few hundred pixels.
          The wrapper clips the panel while it sits off-screen (at full width it
          would otherwise add a viewport of horizontal scroll to the page) and
          lets clicks through, so the margin around it still hits the backdrop. */}
      <div className="lg:hidden fixed inset-0 z-50 p-2 overflow-hidden pointer-events-none">
        <div
          className={`pointer-events-auto flex flex-col h-full border-1 border-black/10 bg-white/90 shadow-2xl backdrop-blur-xs rounded-3xl p-3 gap-y-2 transition-transform duration-300 ease-in-out ${listOpen ? "translate-x-0" : "translate-x-[calc(100%+0.5rem)]"
            }`}
        >
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

          {/* One list at a time — desktop shows both stacked, a phone gets tabs */}
          {hasReference && (
            <div className="w-full flex justify-center">
              <Tabs
                aria-label="รายการ"
                selectedKey={listTab}
                onSelectionChange={(k) => setListTab(k as "reference" | "saved")}
                variant="solid"
                radius="full"
                classNames={{
                  tabList: "bg-black/5 border-1 border-black/10",
                  cursor: "bg-gradient-to-l from-transparent to-yellow-600/50",
                }}
              >
                <Tab
                  key="reference"
                  title={
                    <span className="font-bold text-xs">
                      ลูกค้าส่งมา ({referenceItems.length})
                    </span>
                  }
                />
                <Tab
                  key="saved"
                  title={
                    <span className="font-bold text-xs">
                      รายการที่บันทึก ({quotation.length})
                    </span>
                  }
                />
              </Tabs>
            </div>
          )}

          {/* Reference card — same customer-submitted items shown on desktop */}
          {hasReference && listTab === "reference" && renderReferenceCard("flex-1 min-h-0")}

          {/* Items */}
          <div
            className={`flex-col gap-y-2 overflow-y-auto flex-1 scrollbar-hide ${hasReference && listTab === "reference" ? "hidden" : "flex"
              }`}
          >
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
                  bankName={customerProfile?.bank_name}
                  bankAccountNo={customerProfile?.bank_account_no}
                  bankAccountName={customerProfile?.bank_account_name}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={handlePaymentMethodChange}
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
                  documentNo={savedQuotation?.display_code ?? savedQuotation?.code}
                  customerName={previewCustomerName}
                  customerPhone={previewCustomerPhone}
                  customerAddress={customerProfile?.address}
                  customerTaxId={customerProfile?.tax_id}
                  bankName={customerProfile?.bank_name}
                  bankAccountNo={customerProfile?.bank_account_no}
                  bankAccountName={customerProfile?.bank_account_name}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={handlePaymentMethodChange}
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

      {/* ขายแทนลูกค้า — same calculator as /bills/sell, but the customer is already
          known and only the bill's own metal is on offer (bills are single-metal,
          so selling the other one would open a bill this issuance can't cover). */}
      <Modal
        isOpen={sellDisc.isOpen}
        onClose={sellDisc.onClose}
        size="3xl"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              ขายแทนลูกค้า{billCustomer ? ` : ${billCustomer}` : ""}
            </span>
            <span className="text-xs font-normal text-black/50">
              รายการที่เพิ่มจะเข้าบิลใบที่กำลังออกนี้ และราคาล็อกจะคิดใหม่ให้อัตโนมัติ
            </span>
          </ModalHeader>
          <ModalBody className="pb-4">
            {sellSaving ? (
              <div className="flex flex-col items-center justify-center py-16 gap-y-3">
                <Spinner size="lg" color="warning" />
                <span className="text-sm text-black/50">กำลังบันทึก...</span>
              </div>
            ) : (
              <>
                {sellError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-2">
                    {sellError}
                  </div>
                )}
                <BillCalculate
                  onAdd={handleSellForCustomer}
                  staffMode
                  fluid
                  allowGold={billMetal === "gold"}
                  allowSilver={billMetal !== "gold"}
                />
              </>
            )}
          </ModalBody>
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
