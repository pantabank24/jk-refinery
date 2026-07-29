"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { ArrowLeft, Pencil, ShieldOff, Upload, FolderOpen, Trash2, Printer, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { CustomerCard } from "../_components/customerCard";
import { DocumentList, DOC_ACCEPT, type CustomerDocument } from "../_components/documentList";
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
  store_name?: string | null;
  store?: { id: number; name: string } | null;
}

interface Bill {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  gold_round?: string;
  created_at: string;
  items?: BillItem[];
}

interface BillItem {
  id: number;
  type_name: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
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

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

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
// (customers.read เป็นสิทธิ์ของพนักงาน ลูกค้าเข้าไม่ได้) และซ่อน tab เอกสาร/ปุ่มแก้ไข
export const CustomerDetail = ({ selfMode = false }: { selfMode?: boolean } = {}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const { hasPermission, loading: authLoading, user, isCustomer } = useAuth();
  const canRead = selfMode ? isCustomer : hasPermission("customers.read");
  const canUpdate = selfMode ? false : hasPermission("customers.update");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bills");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const docRef = useRef<HTMLInputElement>(null);

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

  const fetchDocs = useCallback(async () => {
    if (!customerId) return;
    const dRes = await api.get<CustomerDocument[]>(`/customers/${customerId}/documents`);
    setDocs((dRes.data as unknown as CustomerDocument[]) || []);
  }, [customerId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (selfMode) {
        // ลูกค้าดูตัวเอง: /bills ถูก scope เป็นของลูกค้าที่ล็อกอินอยู่แล้ว
        const bRes = await api.get<Bill[]>(`/bills?limit=100`).catch(() => null);
        setCustomer(
          user
            ? { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, is_active: true }
            : null
        );
        setDocs([]);
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

  const handleUploadDocs = async (files: FileList | null) => {
    if (!files || files.length === 0 || !customerId) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      await api.upload(`/customers/${customerId}/documents`, fd);
      await fetchDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (docRef.current) docRef.current.value = "";
    }
  };

  const askDeleteDoc = (d: CustomerDocument) => { setDocTarget(d); deleteDisc.onOpen(); };
  const handleDeleteDoc = async () => {
    if (!docTarget || !customerId) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${customerId}/documents/${docTarget.id}`);
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
  // ประวัติ: ทุกรายการทองที่ลูกค้าส่งเข้ามาตอนสร้างบิล รวมจากบิลทุกใบ (ใหม่สุดก่อน)
  const historyRows = bills.flatMap((b) => (b.items ?? []).map((it) => ({ bill: b, it })));

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
    for (const b of bills) {
      total += b.total_amount || 0;
      if (b.status === 12 || b.status === 14) completedTotal += b.total_amount || 0;
      else if (b.status === 10 || b.status === 11) pendingTotal += b.total_amount || 0;
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

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <span className="font-bold text-sm">ไม่พบข้อมูลลูกค้า</span>
        <Button variant="light" startContent={<ArrowLeft size={16} />} onPress={() => router.push(selfMode ? "/" : "/customers")}>กลับ</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        {!selfMode && (
          <Button isIconOnly variant="light" onPress={() => router.push("/customers")} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
        )}
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1">
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

      <div className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-x-5 gap-y-4 overflow-y-auto md:overflow-hidden scrollbar-hide">
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
            {!selfMode ? <Tab key="docs" title={`เอกสาร (${docs.length})`} /> : null}
          </Tabs>

          {tab === "bills" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              {bills.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีบิล</div>
              ) : (
                <div className="overflow-auto scrollbar-hide">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                      <tr className="text-left text-black/40 text-xs">
                        <th className="px-4 py-2.5 font-bold">เลขที่บิล</th>
                        <th className="px-4 py-2.5 font-bold">วันที่</th>
                        <th className="px-4 py-2.5 font-bold text-center">สถานะ</th>
                        <th className="px-4 py-2.5 font-bold text-right">ยอดรวม (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => openBill(b)}
                          className="border-t border-black/5 hover:bg-white/40 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-bold text-black/70">{b.code}</td>
                          <td className="px-4 py-2.5 text-black/60">{fmtDate(b.created_at)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[b.status] || ""}`}>
                              {STATUS_LABEL[b.status] || b.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                            {b.total_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : tab === "history" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              {historyRows.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีรายการ</div>
              ) : (
                <div className="overflow-auto scrollbar-hide">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                      <tr className="text-left text-black/40 text-xs">
                        <th className="px-4 py-2.5 font-bold">เลขที่บิล</th>
                        <th className="px-4 py-2.5 font-bold">วันที่</th>
                        <th className="px-4 py-2.5 font-bold">รายการ</th>
                        <th className="px-4 py-2.5 font-bold text-right">น้ำหนัก (กรัม)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map(({ bill: b, it }) => {
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
                            <td className={`px-4 py-2.5 ${tone || "text-black/60"}`}>{fmtDate(b.created_at)}</td>
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
              )}
            </div>
          ) : (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-black/5 shrink-0">
                <div className="flex items-center gap-x-2 font-bold text-sm text-black/70">
                  <FolderOpen size={16} className="text-[#c09c42]" />
                  เอกสาร ({docs.length})
                </div>
                {canUpdate && (
                  <>
                    <input ref={docRef} type="file" accept={DOC_ACCEPT} multiple className="hidden" onChange={(e) => handleUploadDocs(e.target.files)} />
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                      startContent={<Upload size={14} />}
                      isLoading={uploading}
                      onPress={() => docRef.current?.click()}
                    >
                      อัปโหลด
                    </Button>
                  </>
                )}
              </div>
              {error && (
                <div className="mx-4 mt-3 text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>
              )}
              <div className="overflow-y-auto scrollbar-hide p-2">
                <DocumentList
                  docs={docs}
                  onDelete={canUpdate ? askDeleteDoc : undefined}
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
                ใบเสนอราคา {detailB?.issued_quotation?.code ?? detailB?.code}
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
                      documentNo={detailB.issued_quotation?.code ?? detailB.code}
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
