"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { ArrowLeft, Pencil, ShieldOff, Upload, FolderOpen, Trash2, Printer, Receipt, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { CustomerCard } from "../_components/customerCard";
import { CustomerActivityLogs } from "../_components/activityLogs";
import { DocumentList, DOC_ACCEPT, fmtSize, isPendingReview, type CustomerDocument } from "../_components/documentList";
import { VerifyBadge } from "@/components/verifyBadge";
import type { DocumentTypeDto } from "@/dtos/document-type-dto";
import { PreviewQuote, PreviewQuoteHandle, type PayMethod } from "../../../quotation/_component/previewQuote";
import { QuotationProps } from "../../../quotation/_component/quotation";
import {
  buildStoreHeader,
  type QuotationStoreSnapshot,
  type StoreHeaderSnapshot,
} from "../../../quotation/_component/storeHeader";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  tax_id?: string;
  bank?: { id: number; name: string; code?: string } | null;
  bank_account_no?: string;
  bank_account_name?: string;
  avatar?: string;
  is_active: boolean;
  verification_status?: string;
  store_name?: string | null;
  store?: { id: number; name: string } | null;
}

interface Bill {
  id: number;
  code: string;
  status: number;
  // total_amount = ยอดที่ลูกค้าล็อกไว้ตอนกดขาย ไม่ใช่ยอดที่จ่ายจริงเสมอไป — เมื่อออกบิลแล้ว
  // ยอดของใบเสนอราคาที่ออก (หลังชั่ง/ตรวจจริง) คือยอดที่เราจ่ายให้ลูกค้า ส่วนต่างไปเป็น
  // หนี้/เครดิตยกไปรอบหน้า /bills preload IssuedQuotation มาให้แล้ว
  total_amount: number;
  issued_quotation_id?: number | null;
  issued_quotation?: { id: number; total_amount: number; created_at?: string } | null;
  gold_round?: string;
  created_at: string;
  // เวลาที่ status ถูกเปลี่ยนครั้งล่าสุด — คนละอย่างกับ updated_at ที่ขยับทุกครั้งที่เขียนอะไรก็ตาม
  status_changed_at?: string | null;
  items?: BillItem[];
}

// ยอดที่เราจ่ายให้ลูกค้าจริงสำหรับบิลใบหนึ่ง — ยึดใบเสนอราคาที่ออกก่อน ถ้ายังไม่ออกบิล
// ก็ยังไม่มียอดจ่าย จึงตกกลับไปที่ยอดที่ลูกค้ากดขายไว้ (แบบเดียวกับรายการบิลฝั่งลูกค้า)
const paidAmount = (b: Bill) => b.issued_quotation?.total_amount ?? b.total_amount;

interface BillItem {
  id: number;
  type_name: string;
  // gold|silver|... — missing means gold. Gold is weighed in baht, others in grams.
  metal?: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
  // When this line was actually sold in. A "รอออกบิล" bill stays open and later
  // sells are appended to it, so this can be days after the bill's own
  // created_at — that is what the ประวัติ tab has to show.
  created_at?: string;
}

interface IssuedQuotation extends QuotationStoreSnapshot {
  id: number;
  code: string;
  created_at?: string;
  payment_method?: string;
  total_amount: number;
  items?: BillItem[];
  // Detailed per-item lines captured at issue time (items above is consolidated).
  page1_items?: QuotationProps[] | null;
  images?: { id: number; image_url: string; type?: string }[];
  signer_name?: string;
  signer_phone?: string;
}

interface BillDetail {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  created_at: string;
  items?: BillItem[];
  images?: { id: number; image_url: string; type?: string }[];
  issued_quotation?: IssuedQuotation | null;
  // Full store relation (preloaded on /bills/:id) — feeds the receipt header.
  store?: (StoreHeaderSnapshot & { id: number; name: string }) | null;
  branch?: { id: number; name: string } | null;
}

const STATUS_LABEL: Record<number, string> = { 10: "รอออกบิล", 11: "รอตรวจบิล", 12: "สำเร็จ", 13: "ยกเลิก", 14: "เคลียร์แล้ว" };

// สถานะที่ "ออกบิลไปแล้ว" — วันที่ออกใบเสนอราคาคือวันที่ทั้งสามสถานะนี้พูดถึงจริง ๆ
// บิลจึงอยู่ตำแหน่งเดิมตอนเดินจาก รอตรวจบิล ไป สำเร็จ ไป เคลียร์แล้ว
const ISSUED_SORT_STATUSES = [11, 12, 14];

const newestItemDate = (b: Bill) =>
  (b.items ?? []).reduce<string | undefined>(
    (max, it) => (it.created_at && (!max || it.created_at > max) ? it.created_at : max),
    undefined,
  );

// billSortDate สะท้อน listOrder ของ API (bill_repository.go) ให้ตรงกัน — id เป็นแค่ลำดับ
// ที่บิลถูก "เปิด" ครั้งแรก ซึ่งเป็นคำตอบที่ผิดสำหรับทุกแท็บ: บิล รอออกบิล ถูกใช้ซ้ำโดย id
// ไม่ขยับขณะที่ลูกค้าขายเข้ามาเรื่อย ๆ และบิลที่เปิดตั้งแต่เดือนก่อนแต่เพิ่งเคลียร์วันนี้
// ต้องไม่จมอยู่ก้นแท็บ เคลียร์แล้ว ทุกสถานะจึงเรียงตามเหตุการณ์ที่คนอ่านรออยู่
//   รอออกบิล                → รายการล่าสุดที่ลูกค้าส่งเข้ามา
//   รอตรวจบิล/สำเร็จ/เคลียร์แล้ว → วันที่ออกใบเสนอราคา
//   ยกเลิก                  → วันที่ถูกยกเลิก เพราะไม่มีใบเสนอราคาให้ยึด
// แต่ละอันตกกลับไปหาคอลัมน์ที่มีค่าเสมอ บิลที่ไม่มี stamp จะได้ไม่ร่วงไปอยู่ใต้ทุกแถว
const billSortDate = (b: Bill) => {
  if (b.status === 10) return newestItemDate(b) ?? b.created_at;
  if (ISSUED_SORT_STATUSES.includes(b.status))
    return b.issued_quotation?.created_at ?? b.status_changed_at ?? b.created_at;
  return b.status_changed_at ?? b.created_at;
};
const STATUS_COLOR: Record<number, string> = {
  10: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  11: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  13: "bg-red-500/20 text-red-700 border-red-500/30",
  14: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};

// ประวัติ rows for bills that are no longer live: เคลียร์แล้ว (14) and ยกเลิก (13)
// are struck through. Any other status keeps the table's normal black text.
const HISTORY_ROW_TONE: Record<number, string> = {
  13: "text-red-500 line-through",
  14: "text-purple-600 line-through",
};

const HISTORY_STATUS_FILTER: Record<string, number | undefined> = {
  all: undefined,
  pending_issue: 10,
  pending_review: 11,
  completed: 12,
  cancelled: 13,
  cleared: 14,
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

// วันที่อย่างเดียวตอบไม่ได้ว่ารายการไหนมาก่อน เมื่อบิลใบเดิมถูกขายเพิ่มหลายรอบในวันเดียว
// เวลาจึงอยู่บรรทัดล่างของทุกแถวประวัติ ทั้งฝั่งลูกค้าและหลังบ้าน (คอมโพเนนต์เดียวกัน)
const DateCell = ({ at }: { at: string }) => (
  <div className="flex flex-col leading-tight">
    <span>{fmtDate(at)}</span>
    <span className="text-[11px] opacity-60 tabular-nums">{fmtTime(at)} น.</span>
  </div>
);

const fmtMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGram = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

// Categorise an item's type name into a metal bucket for the per-type totals.
type Metal = "gold" | "silver" | "platinum" | "palladium";
const METALS: { key: Metal; label: string }[] = [
  { key: "gold", label: "ทอง" },
  { key: "silver", label: "เงิน" },
  { key: "platinum", label: "แพลทินัม" },
  { key: "palladium", label: "แพลเลเดียม" },
];
function metalOf(typeName: string): Metal | null {
  const n = typeName || "";
  if (/แพลเลเดียม|palladium/i.test(n)) return "palladium";
  if (/แพลตินัม|แพลทินัม|platinum/i.test(n)) return "platinum";
  if (/เงิน|silver/i.test(n)) return "silver";
  if (/ทอง|gold/i.test(n)) return "gold";
  return null;
}

function StatCard({ title, value, unit, highlight, sub }: { title: string; value: string; unit?: string; highlight?: boolean; sub?: string }) {
  return (
    <div className={`flex flex-col border-1 border-black/10 rounded-xl p-2 ${highlight ? "bg-gradient-to-br from-yellow-200/60 to-transparent" : "bg-black/5"}`}>
      <span className="text-[10px] font-bold text-black/50">{title}</span>
      <div className="flex items-baseline gap-x-1">
        <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent break-all">{value}</span>
        {unit && <span className="text-[10px] text-black/40">{unit}</span>}
      </div>
      {sub && <span className="text-[10px] font-bold text-yellow-700/70 break-all">{sub}</span>}
    </div>
  );
}

// selfMode = ลูกค้าดูโปรไฟล์ของตัวเอง: ดึงข้อมูลจาก endpoint ที่ backend scope ตัวเองอัตโนมัติ
// (customers.read เป็นสิทธิ์ของพนักงาน ลูกค้าเข้าไม่ได้) และซ่อนปุ่มแก้ไข
// tab เอกสารเปิดให้ทั้งสองฝั่ง — ลูกค้าจัดการเอกสารของตัวเองผ่าน /customers/me/documents
export const CustomerDetail = ({ selfMode = false }: { selfMode?: boolean } = {}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const { hasPermission, loading: authLoading, user, isCustomer, refreshUser } = useAuth();
  const canRead = selfMode ? isCustomer : hasPermission("customers.read");
  const canUpdate = selfMode ? false : hasPermission("customers.update");
  // ลูกค้าจัดการเอกสารของตัวเองได้เสมอ; ฝั่งพนักงานต้องมีสิทธิ์แก้ไขลูกค้า
  const canManageDocs = selfMode ? true : canUpdate;
  // ตรวจสอบเอกสารสำคัญเป็นสิทธิ์แยก พนักงานก็ทำได้ (migration 000094) — ลูกค้าไม่มีวันได้
  const canApproveDocs = !selfMode && hasPermission("customers.approve_documents");
  // Logs are a back-office audit view: staff only, and only for staff holding
  // logs.read. A customer never sees the trail of their own account here.
  const canReadLogs = !selfMode && hasPermission("logs.read");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  // ?tab=docs ให้ลิงก์ "ยืนยันบัญชีของคุณ" จากหน้าแรกเปิดมาที่แท็บเอกสารได้เลย
  const [tab, setTab] = useState(searchParams.get("tab") === "docs" ? "docs" : "bills");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  // Upload modal — ต้องเลือกประเภทเอกสารก่อนถึงจะอัปโหลดได้
  const uploadDisc = useDisclosure();
  const [docTypes, setDocTypes] = useState<DocumentTypeDto[]>([]);
  const [uploadTypeId, setUploadTypeId] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  // เปลี่ยนเอกสารสำคัญ — ล็อกประเภทไว้ตามเอกสารเดิม ห้ามสลับไปประเภทอื่น
  const [replacing, setReplacing] = useState<CustomerDocument | null>(null);

  // Review actions (พนักงาน)
  const rejectDisc = useDisclosure();
  const [rejectTarget, setRejectTarget] = useState<CustomerDocument | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const deleteDisc = useDisclosure();
  const [docTarget, setDocTarget] = useState<CustomerDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bill preview modal — mirrors the customer "บิลทั้งหมด" (issued) page.
  const detailDisc = useDisclosure();
  const [detailB, setDetailB] = useState<BillDetail | null>(null);
  const [billPage1Items, setBillPage1Items] = useState<QuotationProps[]>([]);
  const previewRef = useRef<PreviewQuoteHandle>(null);
  // The preview is rendered with `hidePrint` (its own ตั้งค่า dropdown is hidden and
  // the footer button below drives printing), so the "print page 2 too" choice lives
  // here instead. Off by default — most reprints only need page 1.
  const [printPage2, setPrintPage2] = useState(false);

  const toQuoItems = (items: BillItem[] | undefined): QuotationProps[] =>
    (items ?? []).map((item) => ({
      typeId: String(item.id),
      typeName: item.type_name,
      // ใบที่ 2 คิดกรัม/ราคาต่อกรัมคนละสูตรตามโลหะ — ต้องส่ง metal ไปด้วยเสมอ
      metal: item.metal || "gold",
      price: item.price,
      plus: item.plus,
      percent: item.percent,
      weight: item.weight,
      perGram: item.per_gram,
      total: item.total,
    }));

  const openBill = async (b: Bill) => {
    setDetailB(null);
    setBillPage1Items([]);
    detailDisc.onOpen();
    try {
      const res = await api.get<BillDetail>(`/bills/${b.id}`);
      setDetailB(res.data as unknown as BillDetail);
    } catch {
      setDetailB(null);
    }
    // Itemise page 1 from the delivery logs so the rows sum to the issued total.
    type LogRow = { id: number; items?: QuotationProps[] };
    api.get(`/bills/${b.id}/delivery-logs`)
      .then((r) => (r.data as unknown as LogRow[]) ?? [])
      .catch(() => [] as LogRow[])
      .then((logs) => {
        const items: QuotationProps[] = [];
        for (const lg of logs) for (const it of lg.items ?? []) items.push(it);
        setBillPage1Items(items);
      });
  };

  // ลูกค้าไม่มีสิทธิ์ customers.* จึงยิงผ่าน /customers/me/documents ที่ backend
  // ผูกกับ user id ในโทเคนให้เอง ส่วนพนักงานยิงตาม id ของลูกค้าที่กำลังดู
  const docsPath = selfMode ? "/customers/me/documents" : `/customers/${customerId}/documents`;

  const fetchDocs = useCallback(async () => {
    if (!selfMode && !customerId) return;
    const dRes = await api.get<CustomerDocument[]>(docsPath);
    setDocs((dRes.data as unknown as CustomerDocument[]) || []);
  }, [customerId, selfMode, docsPath]);

  // สถานะยืนยันตัวตนคำนวณจากเอกสารสำคัญ จึงเปลี่ยนทุกครั้งที่อัปโหลด/ตรวจสอบ —
  // ดึงจากต้นทางใหม่แทนที่จะเดาเอง (ฝั่งลูกค้ามาจาก /auth/me)
  const refreshCustomer = useCallback(async () => {
    if (selfMode) { await refreshUser(); return; }
    if (!customerId) return;
    try {
      const res = await api.get<Customer>(`/customers/${customerId}`);
      setCustomer((res.data as unknown as Customer) || null);
    } catch { /* ignore */ }
  }, [selfMode, customerId, refreshUser]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (selfMode) {
        // ลูกค้าดูตัวเอง: /bills ถูก scope เป็นของลูกค้าที่ล็อกอินอยู่แล้ว
        const [bRes, dRes] = await Promise.all([
          api.get<Bill[]>(`/bills?limit=100`).catch(() => null),
          api.get<CustomerDocument[]>(`/customers/me/documents`).catch(() => null),
        ]);
        // ต้อง map ให้ครบทุกฟิลด์ที่ใบเสนอราคา/การ์ดลูกค้าใช้ — ที่อยู่ เลขผู้เสีย
        // ภาษี และบัญชีรับเงิน พิมพ์ลงใบจริง ถ้าตกไปช่องนั้นจะว่างเปล่า
        setCustomer(
          user
            ? {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              avatar: user.avatar,
              is_active: true,
              store_name: user.store_name,
              address: user.address,
              tax_id: user.tax_id,
              bank: user.bank ?? null,
              bank_account_no: user.bank_account_no,
              bank_account_name: user.bank_account_name,
              verification_status: user.verification_status,
            }
            : null
        );
        setDocs((dRes?.data as unknown as CustomerDocument[]) || []);
        setBills((bRes?.data as unknown as Bill[]) || []);
        return;
      }
      if (!customerId) return;
      const [cRes, dRes, bRes] = await Promise.all([
        api.get<Customer>(`/customers/${customerId}`),
        api.get<CustomerDocument[]>(`/customers/${customerId}/documents`),
        api.get<Bill[]>(`/bills?created_by=${customerId}&limit=100`).catch(() => null),
      ]);
      setCustomer((cRes.data as unknown as Customer) || null);
      setDocs((dRes.data as unknown as CustomerDocument[]) || []);
      setBills((bRes?.data as unknown as Bill[]) || []);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, selfMode, user]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => {
    if (!selfMode && !customerId) { router.push("/customers"); return; }
    if (canRead) fetchAll();
  }, [canRead, customerId, selfMode, fetchAll, router]);

  const handleAvatarUpload = async (file: File) => {
    if (!customerId) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api.upload<Customer>(`/customers/${customerId}/avatar`, fd);
      setCustomer(res.data as unknown as Customer);
    } catch { /* silent */ }
  };

  // ประเภทเอกสารเป็น master data (ลูกค้า → ประเภทเอกสาร) — โหลดเฉพาะที่เปิดใช้งาน
  // มาเป็นตัวเลือก ประเภทที่ถูกปิดจะยังแสดงบนเอกสารเก่าได้ แต่เลือกใหม่ไม่ได้
  useEffect(() => {
    if (!canManageDocs) return;
    api.get<DocumentTypeDto[]>("/document-types")
      .then((r) => setDocTypes(((r.data as unknown as DocumentTypeDto[]) || []).filter((t) => t.is_active)))
      .catch(() => setDocTypes([]));
  }, [canManageDocs]);

  const openUpload = () => {
    setReplacing(null);
    setUploadTypeId("");
    setUploadFiles([]);
    setUploadError("");
    if (docRef.current) docRef.current.value = "";
    uploadDisc.onOpen();
  };

  // เอกสารสำคัญลบไม่ได้ แต่เปลี่ยนได้ — อัปโหลดใหม่ในประเภทเดิม แล้ว backend จะลบ
  // ไฟล์เก่าทิ้งให้เอง และตั้งสถานะกลับไปเป็น "รอตรวจสอบ"
  const openReplace = (d: CustomerDocument) => {
    setReplacing(d);
    setUploadTypeId(d.document_type_id ? String(d.document_type_id) : "");
    setUploadFiles([]);
    setUploadError("");
    if (docRef.current) docRef.current.value = "";
    uploadDisc.onOpen();
  };

  const handleApprove = async (d: CustomerDocument) => {
    if (!customerId) return;
    setReviewing(true);
    try {
      await api.put(`/customers/${customerId}/documents/${d.id}/approve`, {});
      await Promise.all([fetchDocs(), refreshCustomer()]);
    } catch { /* ignore */ } finally {
      setReviewing(false);
    }
  };

  const askReject = (d: CustomerDocument) => {
    setRejectTarget(d);
    setRejectReason("");
    rejectDisc.onOpen();
  };

  const handleReject = async () => {
    if (!rejectTarget || !customerId) return;
    setReviewing(true);
    try {
      await api.put(`/customers/${customerId}/documents/${rejectTarget.id}/reject`, {
        reason: rejectReason.trim(),
      });
      await Promise.all([fetchDocs(), refreshCustomer()]);
      rejectDisc.onClose();
    } catch { /* ignore */ } finally {
      setReviewing(false);
    }
  };

  const handleUploadDocs = async () => {
    if (!uploadTypeId) return setUploadError("กรุณาเลือกประเภทเอกสาร");
    if (uploadFiles.length === 0) return setUploadError("กรุณาเลือกไฟล์");
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      uploadFiles.forEach((f) => fd.append("files", f));
      fd.append("document_type_id", uploadTypeId);
      await api.upload(docsPath, fd);
      await Promise.all([fetchDocs(), refreshCustomer()]);
      uploadDisc.onClose();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (docRef.current) docRef.current.value = "";
    }
  };

  const askDeleteDoc = (d: CustomerDocument) => { setDocTarget(d); deleteDisc.onOpen(); };
  const handleDeleteDoc = async () => {
    if (!docTarget || (!selfMode && !customerId)) return;
    setDeleting(true);
    try {
      await api.delete(`${docsPath}/${docTarget.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== docTarget.id));
      deleteDisc.onClose();
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;
  }
  // แท็บ บิลที่ออก ไม่ได้ส่ง status ไปให้ API เลยได้ id DESC กลับมา ซึ่งเป็นลำดับที่บิลถูก
  // เปิดครั้งแรก ไม่ใช่ลำดับที่มีอะไรเกิดขึ้นล่าสุด เรียงใหม่ฝั่ง client ด้วยกฎเดียวกับ API
  const sortedBills = [...bills].sort((a, b) => {
    const byEvent = billSortDate(b).localeCompare(billSortDate(a));
    return byEvent || b.id - a.id;
  });

  // ประวัติ: ทุกรายการทองที่ลูกค้าส่งเข้ามา รวมจากบิลทุกใบ (ใหม่สุดก่อน)
  //
  // Each row is dated by its OWN line, not by the bill: a bill sits open at
  // รอออกบิล and every later sell is appended to it, so a bill opened on the 29th
  // can hold lines sold on the 31st. Dating them all by the bill is what made the
  // history read as the wrong day. (ลำดับการเรียงดู historyRowDate ข้างล่าง)
  const historyRows = bills
    .flatMap((b) => (b.items ?? []).map((it) => ({ bill: b, it, at: it.created_at || b.created_at })));
  const selectedHistoryStatus = HISTORY_STATUS_FILTER[historyStatus];
  // ใช้คีย์เดียวกับ billSortDate แต่คิดตามสถานะของบิลแต่ละใบ ไม่ใช่แท็บที่เลือกอยู่ แท็บ
  // ทั้งหมด จึงเรียงเหมือนกับที่แต่ละแท็บเรียง เหมือน CASE ฝั่ง API
  //
  // ยกเว้น รอออกบิล ที่ใช้วันที่ของ "แถวนั้น" แทนรายการล่าสุดของบิล เพราะตารางประวัติ
  // แตกเป็นรายบรรทัดและโชว์คอลัมน์วันที่อยู่ ถ้าดันทุกบรรทัดของบิลเดียวกันไปกองที่วันที่
  // ล่าสุด คอลัมน์วันที่ที่คนอ่านเห็นจะเรียงมั่ว — ฝั่ง API ใช้ MAX ก็เพราะเรียงทีละบิล
  // ซึ่งได้ผลเท่ากับบรรทัดบนสุดของบิลนั้นพอดี
  const historyRowDate = (row: (typeof historyRows)[number]) =>
    row.bill.status === 10 ? row.at : billSortDate(row.bill);
  const filteredHistoryRows = (selectedHistoryStatus === undefined
    ? [...historyRows]
    : historyRows.filter(({ bill }) => bill.status === selectedHistoryStatus)
  ).sort((a, b) => {
    const bySelectedDate = historyRowDate(b).localeCompare(historyRowDate(a));
    return bySelectedDate || b.at.localeCompare(a.at);
  });

  // สรุปรายการที่ลูกค้าส่งเข้ามา รวมทุกบิล: ยอดรวม จำนวนบิล น้ำหนักรวม และแยกตามประเภทโลหะ
  const overview = (() => {
    const grams: Record<Metal, number> = { gold: 0, silver: 0, platinum: 0, palladium: 0 };
    const amounts: Record<Metal, number> = { gold: 0, silver: 0, platinum: 0, palladium: 0 };
    let total = 0;
    let totalWeight = 0;
    // Split the sold total by whether the bill is done: สำเร็จ/เคลียร์แล้ว (12/14)
    // vs still in progress รอออกบิล/รอตรวจบิล (10/11). Cancelled (13) is excluded.
    let completedTotal = 0;
    let pendingTotal = 0;
    // ยอดที่จ่ายเหมือนคอลัมน์ในแท็บบิลที่ออก แต่ใบเสนอราคาหนึ่งใบครอบได้หลายบิล
    // (ออกพร้อมกัน) ยอดของใบนั้นจึงนับครั้งเดียว ไม่งั้นสรุปจะบวกซ้ำ
    const countedQuotations = new Set<number>();
    for (const b of bills) {
      const qid = b.issued_quotation?.id ?? b.issued_quotation_id ?? null;
      const dup = qid !== null && countedQuotations.has(qid);
      if (qid !== null) countedQuotations.add(qid);
      const paid = dup ? 0 : paidAmount(b) || 0;
      total += paid;
      if (b.status === 12 || b.status === 14) completedTotal += paid;
      else if (b.status === 10 || b.status === 11) pendingTotal += paid;
      for (const it of b.items ?? []) {
        totalWeight += it.weight || 0;
        const metal = metalOf(it.type_name);
        if (metal) {
          grams[metal] += it.weight || 0;
          amounts[metal] += it.total || 0;
        }
      }
    }
    return { total, completedTotal, pendingTotal, totalWeight, count: bills.length, grams, amounts };
  })();

  // The customer's open "รอออกบิล" bill (status 10), if any — the target when the
  // master issues a quotation for their pending sale.
  const pendingBill = bills.find((b) => b.status === 10);

  // เอกสารสำคัญที่ยังรอตรวจสอบ — คุมทั้งการ์ดแจ้งเตือนด้านบนและจุดแดงบน Tab เอกสาร
  const pendingDocs = docs.filter(isPendingReview);

  const selectedTypeIsHigh = docTypes.some(
    (t) => String(t.id) === uploadTypeId && t.is_high_priority
  );

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <span className="font-bold text-sm">ไม่พบข้อมูลลูกค้า</span>
        <Button variant="light" startContent={<ArrowLeft size={16} />} onPress={() => router.push(selfMode ? "/" : "/customers")}>กลับ</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full md:h-full">
      {/* Header */}
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        {!selfMode && (
          <Button isIconOnly variant="light" onPress={() => router.push("/customers")} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
        )}
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1 truncate">
          {selfMode ? "โปรไฟล์ของฉัน" : "รายละเอียดลูกค้า"}
        </div>
        {/* Issue a quotation for this customer's pending sale — jumps to the quote
            page keyed to their "รอออกบิล" bill, which loads their submitted items. */}
        {!selfMode && hasPermission("bills.issue") && pendingBill && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white rounded-2xl font-bold shadow-md"
            startContent={<Receipt size={14} />}
            size="sm"
            onPress={() => router.push(`/quotation?billId=${pendingBill.id}`)}
          >
            ออกใบเสนอราคา
          </Button>
        )}
        {canUpdate && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl font-bold shadow-md"
            startContent={<Pencil size={14} />}
            size="sm"
            onPress={() => router.push(`/customers/edit?id=${customer.id}`)}
          >
            <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">แก้ไข</span>
          </Button>
        )}
      </div>

      {/* รอตรวจสอบเอกสาร — พนักงานเห็นเป็นงานค้าง ลูกค้าเห็นเป็นสถานะของตัวเอง */}
      {pendingDocs.length > 0 && (
        <div className="flex flex-row items-center gap-x-3 shrink-0 mb-4 px-4 py-3 rounded-2xl border-1 border-yellow-500/40 bg-yellow-500/10 backdrop-blur-xl">
          <ShieldAlert size={20} className="text-yellow-600 shrink-0" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-sm text-yellow-800">
              รอตรวจสอบเอกสาร ({pendingDocs.length})
            </span>
            <span className="text-[11px] text-yellow-700 truncate">
              {selfMode
                ? `${pendingDocs.map((d) => d.document_type?.name).filter(Boolean).join(", ")} — รอพนักงานตรวจสอบ`
                : `${pendingDocs.map((d) => d.document_type?.name).filter(Boolean).join(", ")} — กรุณาตรวจสอบและอนุมัติที่แท็บเอกสาร`}
            </span>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shrink-0"
            onPress={() => setTab("docs")}
          >
            ดูเอกสาร
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row w-full md:flex-1 md:min-h-0 gap-x-5 gap-y-4 md:overflow-hidden">
        {/* Left: card */}
        <div className="flex flex-col gap-y-3 md:w-72 shrink-0 md:overflow-y-auto md:min-h-0 scrollbar-hide">
          <CustomerCard
            name={customer.name}
            email={customer.email}
            avatar={customer.avatar}
            phone={customer.phone}
            storeName={customer.store_name || customer.store?.name || ""}
            address={customer.address}
            taxId={customer.tax_id}
            bankName={customer.bank?.name}
            bankAccountNo={customer.bank_account_no}
            bankAccountName={customer.bank_account_name}
            verificationStatus={customer.verification_status}
            isActive={customer.is_active}
            canEdit={canUpdate}
            onImageUpload={handleAvatarUpload}
          />

          {/* Overview — สรุปรายการที่ลูกค้าส่งเข้ามา รวมทุกบิล */}
          {bills.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-black/50 pl-1">สรุปรายการที่ส่งเข้ามา</span>
              <div className="grid grid-cols-2 gap-2">
                <StatCard title="ออกบิลสำเร็จ" value={fmtMoney(overview.completedTotal)} unit="บาท" highlight />
                <StatCard title="ยังไม่สำเร็จ" value={fmtMoney(overview.pendingTotal)} unit="บาท" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatCard title="จำนวนบิล" value={overview.count.toLocaleString("th-TH")} unit="บิล" />
                <StatCard title="น้ำหนักรวม" value={fmtGram(overview.totalWeight)} unit="กรัม" />
                {METALS.filter((m) => overview.grams[m.key] > 0).map((m) => (
                  <StatCard
                    key={m.key}
                    title={m.label}
                    value={fmtGram(overview.grams[m.key])}
                    unit="กรัม"
                    sub={`${fmtMoney(overview.amounts[m.key])} บาท`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: tabs */}
        <div className="flex flex-col w-full gap-y-2 md:flex-1 md:min-h-0">
          <Tabs
            aria-label="customer tabs"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as string)}
            classNames={{ tabList: "bg-black/5 border-1 border-black/10" }}
          >
            <Tab key="bills" title={`บิลที่ออก (${bills.length})`} />
            <Tab key="history" title={`ประวัติ (${historyRows.length})`} />
            <Tab
              key="docs"
              title={
                <span className="flex items-center gap-x-1.5">
                  เอกสาร ({docs.length})
                  {pendingDocs.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  )}
                </span>
              }
            />
            {canReadLogs ? <Tab key="logs" title="Logs" /> : null}
          </Tabs>

          {tab === "bills" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              {bills.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีบิล</div>
              ) : (
                <>
                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-auto scrollbar-hide">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                        <tr className="text-left text-black/40 text-xs">
                          <th className="px-4 py-2.5 font-bold">เลขที่บิล</th>
                          <th className="px-4 py-2.5 font-bold">วันที่ / เวลา</th>
                          <th className="px-4 py-2.5 font-bold text-center">สถานะ</th>
                          <th className="px-4 py-2.5 font-bold text-right">ยอดที่จ่าย (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBills.map((b) => (
                          <tr
                            key={b.id}
                            onClick={() => openBill(b)}
                            className="border-t border-black/5 hover:bg-white/40 cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-bold text-black/70">{b.code}</td>
                            <td className="px-4 py-2.5 text-black/60"><DateCell at={b.created_at} /></td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[b.status] || ""}`}>
                                {STATUS_LABEL[b.status] || b.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                              {fmtMoney(paidAmount(b))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards — the table holds its four columns apart with
                      min-w-[560px], which on a phone means scrolling sideways to
                      read one bill. A card puts the same four facts in a block
                      that fits the screen. */}
                  <div className="flex md:hidden flex-col gap-y-2 p-3 overflow-auto scrollbar-hide">
                    {sortedBills.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => openBill(b)}
                        className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 cursor-pointer active:bg-white/40"
                      >
                        <div className="flex items-center justify-between gap-x-2">
                          <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate">
                            {b.code}
                          </span>
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[b.status] || ""}`}>
                            {STATUS_LABEL[b.status] || b.status}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-x-2">
                          <div className="text-xs text-black/60">
                            <DateCell at={b.created_at} />
                          </div>
                          {/* The column header has to travel with the number: out
                              of the table there is no header row left to read it
                              against. */}
                          <div className="flex flex-col items-end leading-tight shrink-0">
                            <span className="text-[10px] font-bold text-black/40">ยอดที่จ่าย (บาท)</span>
                            <span className="font-bold text-sm text-yellow-700 tabular-nums">
                              {fmtMoney(paidAmount(b))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : tab === "history" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              {/* ตัวกรองสถานะ — เปิดให้ทั้งพนักงานและลูกค้า ประวัติยาวเท่ากันทั้งสองฝั่ง */}
              <div className="shrink-0 px-3 border-b border-black/5">
                <Tabs
                  aria-label="history status filter"
                  selectedKey={historyStatus}
                  onSelectionChange={(key) => setHistoryStatus(String(key))}
                  color="warning"
                  variant="underlined"
                  classNames={{
                    base: "w-full",
                    tabList: "gap-4 w-full overflow-x-auto flex-nowrap scrollbar-hide",
                  }}
                >
                  <Tab key="all" title="ทั้งหมด" />
                  <Tab key="pending_issue" title="รอออกบิล" />
                  <Tab key="pending_review" title="รอตรวจบิล" />
                  <Tab key="completed" title="สำเร็จ" />
                  <Tab key="cleared" title="เคลียร์แล้ว" />
                  <Tab key="cancelled" title="ยกเลิก" />
                </Tabs>
              </div>
              {filteredHistoryRows.length === 0 ? (
                <div className="flex items-center justify-center py-10 px-4 text-center text-black/40 text-sm">
                  {historyStatus === "all" ? "ยังไม่มีรายการ" : "ไม่มีรายการในสถานะนี้"}
                </div>
              ) : (
                <>
                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-auto scrollbar-hide">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                        <tr className="text-left text-black/40 text-xs">
                          <th className="px-4 py-2.5 font-bold">เลขที่บิล</th>
                          <th className="px-4 py-2.5 font-bold">วันที่ / เวลา</th>
                          <th className="px-4 py-2.5 font-bold">รายการ</th>
                          <th className="px-4 py-2.5 font-bold text-right">น้ำหนัก (กรัม)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistoryRows.map(({ bill: b, it, at }) => {
                          // Settled and cancelled lines are struck through so a long
                          // history reads at a glance: เคลียร์แล้ว ม่วง, ยกเลิก แดง,
                          // everything still in play stays black.
                          const tone = HISTORY_ROW_TONE[b.status] ?? "";
                          return (
                            <tr
                              key={`${b.id}-${it.id}`}
                              onClick={() => openBill(b)}
                              className="border-t border-black/5 hover:bg-white/40 cursor-pointer"
                            >
                              <td className={`px-4 py-2.5 font-bold ${tone || "text-black/70"}`}>{b.code}</td>
                              <td className={`px-4 py-2.5 ${tone || "text-black/60"}`}>
                                <DateCell at={historyRowDate({ bill: b, it, at })} />
                              </td>
                              <td className={`px-4 py-2.5 ${tone || "text-black/70"}`}>{it.type_name}</td>
                              <td className={`px-4 py-2.5 text-right tabular-nums ${tone || "text-black/60"}`}>
                                {it.weight.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards. Same reasoning as the บิลที่ออก tab — and the
                      status, which the table only hints at through the struck-out
                      row tone, gets a chip here where there is room for it. */}
                  <div className="flex md:hidden flex-col gap-y-2 p-3 overflow-auto scrollbar-hide">
                    {filteredHistoryRows.map(({ bill: b, it, at }) => {
                      const tone = HISTORY_ROW_TONE[b.status] ?? "";
                      return (
                        <div
                          key={`${b.id}-${it.id}`}
                          onClick={() => openBill(b)}
                          className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 cursor-pointer active:bg-white/40"
                        >
                          <div className="flex items-center justify-between gap-x-2">
                            <span className={`font-bold text-sm truncate ${tone || "text-black/70"}`}>
                              {b.code}
                            </span>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[b.status] || ""}`}>
                              {STATUS_LABEL[b.status] || b.status}
                            </span>
                          </div>
                          <div className="flex items-end justify-between gap-x-2">
                            <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-bold truncate ${tone || "text-black/70"}`}>
                                {it.type_name}
                              </span>
                              <div className={`text-xs ${tone || "text-black/60"}`}>
                                <DateCell at={historyRowDate({ bill: b, it, at })} />
                              </div>
                            </div>
                            <div className="flex flex-col items-end leading-tight shrink-0">
                              <span className="text-[10px] font-bold text-black/40">น้ำหนัก (กรัม)</span>
                              <span className={`font-bold text-sm tabular-nums ${tone || "text-black/70"}`}>
                                {it.weight.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : tab === "logs" && canReadLogs && customerId ? (
            <CustomerActivityLogs customerId={customerId} />
          ) : (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-black/5 shrink-0">
                <div className="flex items-center gap-x-2 font-bold text-sm text-black/70">
                  <FolderOpen size={16} className="text-[#c09c42]" />
                  เอกสาร ({docs.length})
                  {pendingDocs.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border-1 bg-red-500/15 text-red-700 border-red-500/40">
                      รอตรวจสอบ {pendingDocs.length}
                    </span>
                  )}
                </div>
                {canManageDocs && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                    startContent={<Upload size={14} />}
                    onPress={openUpload}
                  >
                    อัปโหลด
                  </Button>
                )}
              </div>
              <div className="md:overflow-y-auto md:scrollbar-hide p-2">
                <DocumentList
                  docs={docs}
                  onDelete={canManageDocs ? askDeleteDoc : undefined}
                  onReplace={canManageDocs ? openReplace : undefined}
                  onApprove={canApproveDocs ? handleApprove : undefined}
                  onReject={canApproveDocs ? askReject : undefined}
                  canDeleteHighPriority={!selfMode && canUpdate}
                  emptyText="ยังไม่มีเอกสาร (รองรับ รูปภาพ, PDF, DOCX, XLSX)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bill preview modal */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                ใบเสนอราคา {detailB?.code}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[detailB?.status ?? 12] || ""}`}>
                {STATUS_LABEL[detailB?.status ?? 12] || detailB?.status}
              </span>
            </div>
          </ModalHeader>
          <ModalBody className="px-2">
            {!detailB ? (
              <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
            ) : (() => {
              const src = detailB.issued_quotation ?? detailB;
              const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");
              const urlsOf = (type: string) =>
                (src.images ?? []).filter((im) => (im.type || "") === type).map((im) => `${base}${im.image_url}`);
              return (
                <div className="flex flex-col gap-3">
                  {/* Card: รายการที่ส่งเข้ามา */}
                  <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-sm font-bold text-black/60">รายการที่ส่งเข้ามา</span>
                    <div className="border-1 border-black/10 bg-white/60 rounded-xl overflow-hidden">
                      {(detailB.items ?? []).map((it, i) => (
                        <div key={it.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-black/5 text-sm">
                          <span className="text-black/70">{i + 1}. {it.type_name}</span>
                          <span className="text-black/50">น้ำหนัก {it.weight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* ใบเสนอราคาที่ออกจริง */}
                  <div className="min-w-0">
                    <PreviewQuote
                      ref={previewRef}
                      hidePrint
                      documentNo={detailB.code}
                      date={
                        detailB.issued_quotation?.created_at ?? detailB.created_at
                      }
                      page1Items={
                        billPage1Items.length
                          ? billPage1Items
                          : detailB.issued_quotation?.page1_items ?? undefined
                      }
                      items={toQuoItems(src.items)}
                      onPrint={() => window.print()}
                      store={buildStoreHeader(detailB.issued_quotation, detailB.store, detailB.branch?.name)}
                      beforeImages={urlsOf("before_melt")}
                      afterImages={urlsOf("after_melt")}
                      previewImages={urlsOf("")}
                      signatureImage={urlsOf("signature")[0] ?? null}
                      customerName={detailB.issued_quotation?.signer_name || customer?.name}
                      customerPhone={detailB.issued_quotation?.signer_phone || customer?.phone}
                      customerAddress={customer?.address}
                      customerTaxId={customer?.tax_id}
                      paymentMethod={(detailB.issued_quotation?.payment_method || null) as PayMethod}
                      bankName={customer?.bank?.name}
                      bankAccountNo={customer?.bank_account_no}
                      bankAccountName={customer?.bank_account_name}
                      signerName={detailB.issued_quotation?.signer_name}
                    />
                  </div>
                </div>
              );
            })()}
          </ModalBody>
          <ModalFooter className="items-center">
            <Checkbox
              size="sm"
              color="warning"
              className="mr-auto"
              isSelected={printPage2}
              onValueChange={setPrintPage2}
            >
              <span className="text-xs">พิมพ์ใบรับซื้อทองเก่า (ใบที่ 2) ด้วย</span>
            </Checkbox>
            <Button variant="light" onPress={detailDisc.onClose}>ปิด</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              startContent={<Printer size={14} />}
              onPress={() => previewRef.current?.print({ includePage2: printPage2 })}
            >
              พิมพ์
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Upload document — ต้องระบุประเภทเอกสารทุกครั้ง */}
      <Modal isOpen={uploadDisc.isOpen} onClose={uploadDisc.onClose} size="md">
        <ModalContent>
          <ModalHeader className="font-bold">
            {replacing ? `เปลี่ยน${replacing.document_type?.name ?? "เอกสาร"}` : "อัปโหลดเอกสาร"}
          </ModalHeader>
          <ModalBody className="flex flex-col gap-y-3">
            {/* ตอนเปลี่ยนเอกสารสำคัญ ประเภทถูกล็อกไว้ — ไม่งั้นจะกลายเป็นการอัปโหลด
                เอกสารคนละใบแทนที่จะเปลี่ยนใบเดิม */}
            <Select
              label="ประเภทเอกสาร"
              selectedKeys={uploadTypeId ? [uploadTypeId] : []}
              onSelectionChange={(keys) => setUploadTypeId(String(Array.from(keys)[0] ?? ""))}
              isRequired
              isDisabled={!!replacing}
              classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            >
              {docTypes.map((t) => (
                <SelectItem key={String(t.id)}>
                  {t.is_high_priority ? `${t.name} (เอกสารสำคัญ)` : t.name}
                </SelectItem>
              ))}
            </Select>
            {docTypes.length === 0 && (
              <span className="text-[11px] text-amber-700">
                ยังไม่มีประเภทเอกสารที่เปิดใช้งาน — เพิ่มได้ที่หน้าลูกค้า → ประเภทเอกสาร
              </span>
            )}
            {selectedTypeIsHigh && (
              <div className="flex items-start gap-x-2 text-[11px] text-yellow-800 bg-yellow-500/10 border-1 border-yellow-500/30 rounded-xl px-3 py-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5 text-yellow-600" />
                <span>
                  เอกสารสำคัญ — อัปโหลดได้ครั้งละ 1 ไฟล์ ไฟล์เดิมจะถูกแทนที่
                  และต้องรอพนักงานตรวจสอบอีกครั้ง
                </span>
              </div>
            )}

            <input
              ref={docRef}
              type="file"
              accept={DOC_ACCEPT}
              multiple={!selectedTypeIsHigh}
              className="hidden"
              onChange={(e) => {
                setUploadFiles(Array.from(e.target.files ?? []));
                setUploadError("");
              }}
            />
            <Button
              variant="bordered"
              className="border-1 border-black/10 bg-black/5 rounded-2xl font-bold"
              startContent={<FolderOpen size={15} />}
              onPress={() => docRef.current?.click()}
            >
              {uploadFiles.length > 0 ? `เลือกแล้ว ${uploadFiles.length} ไฟล์` : selectedTypeIsHigh ? "เลือกไฟล์ (1 ไฟล์)" : "เลือกไฟล์"}
            </Button>
            {uploadFiles.length > 0 && (
              <div className="flex flex-col gap-y-0.5 max-h-32 overflow-y-auto scrollbar-hide">
                {uploadFiles.map((f) => (
                  <span key={f.name} className="text-[11px] text-black/50 truncate">
                    {f.name} · {fmtSize(f.size)}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[11px] text-black/40">รองรับ รูปภาพ, PDF, DOCX, XLSX</span>
            {uploadError && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{uploadError}</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={uploadDisc.onClose} isDisabled={uploading}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl"
              onPress={handleUploadDocs}
              isLoading={uploading}
            >
              {replacing ? "เปลี่ยนเอกสาร" : "อัปโหลด"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject document — เหตุผลจะถูกส่งไปให้ลูกค้าทางแจ้งเตือน */}
      <Modal isOpen={rejectDisc.isOpen} onClose={rejectDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader className="font-bold text-amber-700">เอกสารไม่ผ่านการตรวจสอบ</ModalHeader>
          <ModalBody className="flex flex-col gap-y-3">
            <p className="text-sm text-black/70">
              {rejectTarget?.document_type?.name} ของลูกค้ารายนี้ไม่ผ่านการตรวจสอบ
              ลูกค้าจะได้รับแจ้งเตือนให้อัปโหลดใหม่
            </p>
            <Input
              label="เหตุผล (ไม่บังคับ)"
              value={rejectReason}
              onValueChange={setRejectReason}
              placeholder="เช่น รูปไม่ชัด, ข้อมูลไม่ตรง"
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={rejectDisc.onClose} isDisabled={reviewing}>ยกเลิก</Button>
            <Button color="warning" className="text-white font-bold" onPress={handleReject} isLoading={reviewing}>
              ยืนยันไม่ผ่าน
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete document confirm */}
      <Modal isOpen={deleteDisc.isOpen} onClose={deleteDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-red-600 flex items-center gap-x-2"><Trash2 size={18} /> ยืนยันการลบเอกสาร</span></ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">ต้องการลบ <span className="font-bold">{docTarget?.file_name}</span> หรือไม่?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteDisc.onClose} isDisabled={deleting}>ยกเลิก</Button>
            <Button color="danger" onPress={handleDeleteDoc} isLoading={deleting}>ลบ</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
