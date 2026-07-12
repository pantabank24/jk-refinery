"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Tabs, Tab } from "@heroui/tabs";
import { DateRangePicker } from "@heroui/react";
import { CalendarDate, today, getLocalTimeZone } from "@internationalized/date";
import type { RangeValue } from "@react-types/shared";
import { ShieldOff, Printer, CalendarDays, Layers } from "lucide-react";
import { PreviewQuote, PreviewQuoteHandle } from "../../quotation/_component/previewQuote";
import { QuotationProps } from "../../quotation/_component/quotation";
import {
  buildStoreHeader,
  type QuotationStoreSnapshot,
  type StoreHeaderSnapshot,
} from "../../quotation/_component/storeHeader";

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
}

// Missing metal means gold; gold weighs in baht, other metals in grams.
const itemWeightUnit = (m?: string) => ((m || "gold") === "gold" ? "บาท" : "กรัม");

interface IssuedQuotation extends QuotationStoreSnapshot {
  id: number;
  code: string;
  total_amount: number;
  items?: BillItem[];
  // Detailed per-item lines captured at issue time (items above is consolidated).
  page1_items?: QuotationProps[] | null;
  images?: { id: number; image_url: string; type?: string }[];
  signer_name?: string;
  signer_phone?: string;
}

interface BillData {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  created_at: string;
  issued_quotation_id?: number | null;
  items?: BillItem[];
  images?: { id: number; image_url: string; type?: string }[];
  issued_quotation?: IssuedQuotation | null;
  creator?: { id: number; name: string; phone?: string; address?: string; tax_id?: string } | null;
  // Full store relation (preloaded on /bills/:id) — feeds the receipt header.
  store?: (StoreHeaderSnapshot & { id: number; name: string }) | null;
  branch?: { id: number; name: string } | null;
}

// One row per issued quotation (bills issued together are shown combined).
interface QuoGroup {
  key: string;
  rep: BillData;
  billIds: number[];
  code: string;
  total: number;
  count: number;
  created_at: string;
}

// Completed (สำเร็จ) and cleared (เคลียร์แล้ว) bills are shown here.
const STATUS_LABEL: Record<number, string> = { 12: "สำเร็จ", 14: "เคลียร์แล้ว" };
const STATUS_COLOR: Record<number, string> = {
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  14: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};
const ISSUED_STATUSES = [12, 14];

export default function IssuedBillsPage() {
  const router = useRouter();
  const { isCustomer, loading: authLoading } = useAuth();

  const [bills, setBills] = useState<BillData[]>([]);
  const [loading, setLoading] = useState(true);
  // "completed" → สำเร็จ (12), "cleared" → เคลียร์แล้ว (14).
  const [activeTab, setActiveTab] = useState<string>("completed");
  // ดูทั้งหมด vs กรองช่วงวันที่ (ค่าเริ่มต้น = วันนี้)
  const [showAll, setShowAll] = useState(false);
  const [range, setRange] = useState<RangeValue<CalendarDate> | null>(() => {
    const t = today(getLocalTimeZone());
    return { start: t, end: t };
  });

  const detailDisc = useDisclosure();
  const [detailB, setDetailB] = useState<BillData | null>(null);
  const previewRef = useRef<PreviewQuoteHandle>(null);
  // Itemised original items across all bills in the open group — feeds the
  // preview's page 1 so it breaks the customer's items down line-by-line instead
  // of the consolidated issued-quotation lines (page 2 keeps the consolidation).
  const [billPage1Items, setBillPage1Items] = useState<QuotationProps[]>([]);

  const toQuoItems = (items: BillItem[] | undefined): QuotationProps[] =>
    (items ?? []).map((item) => ({
      typeId: String(item.id),
      typeName: item.type_name,
      metal: item.metal || "gold",
      price: item.price,
      plus: item.plus,
      percent: item.percent,
      weight: item.weight,
      perGram: item.per_gram,
      total: item.total,
    }));

  // Combine bills that were issued together (same quotation) into one entry,
  // shown as the issued ใบเสนอราคา — limited to the active tab's status.
  const groups: QuoGroup[] = useMemo(() => {
    const tabStatus = activeTab === "cleared" ? 14 : 12;
    // กรองช่วงวันที่ (ข้ามเมื่อ "ดูทั้งหมด" หรือไม่ได้เลือกช่วง)
    const useDate = !showAll && !!range;
    const from = useDate ? new Date(`${range!.start.toString()}T00:00:00`) : null;
    const to = useDate ? new Date(`${range!.end.toString()}T23:59:59`) : null;
    const map = new Map<string, BillData[]>();
    for (const b of bills.filter((b) => {
      if (b.status !== tabStatus) return false;
      if (from || to) {
        const created = new Date(b.created_at);
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      return true;
    })) {
      const key = b.issued_quotation_id ? `q${b.issued_quotation_id}` : `b${b.id}`;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return Array.from(map.values()).map((list) => {
      const rep = list[0];
      return {
        key: rep.issued_quotation_id ? `q${rep.issued_quotation_id}` : `b${rep.id}`,
        rep,
        billIds: list.map((x) => x.id),
        code: rep.issued_quotation?.code ?? rep.code,
        total: rep.issued_quotation?.total_amount ?? list.reduce((s, x) => s + x.total_amount, 0),
        count: list.length,
        created_at: rep.created_at,
      };
    });
  }, [bills, activeTab, showAll, range]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BillData[]>("/bills?limit=100");
      const list = (res.data as unknown as BillData[]) || [];
      setBills(list.filter((b) => ISSUED_STATUSES.includes(b.status)));
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isCustomer) router.replace("/");
  }, [authLoading, isCustomer, router]);

  useEffect(() => {
    if (isCustomer) fetchBills();
  }, [fetchBills, isCustomer]);

  const openDetail = async (g: QuoGroup) => {
    setBillPage1Items([]);
    try {
      const res = await api.get<BillData>(`/bills/${g.rep.id}`);
      setDetailB(res.data as unknown as BillData);
    } catch {
      setDetailB(g.rep);
    }
    // Itemise page 1 from the delivery logs (same as the staff bills page) so every
    // item across all delivery rounds is listed and the rows sum to the issued total.
    type LogRow = { id: number; weight: number; amount: number; note: string; created_at: string; items?: QuotationProps[] };
    Promise.all(
      g.billIds.map((lid) =>
        api.get(`/bills/${lid}/delivery-logs`)
          .then((r) => (r.data as unknown as LogRow[]) ?? [])
          .catch(() => [] as LogRow[]),
      ),
    ).then((results) => {
      const items: QuotationProps[] = [];
      for (const logs of results) for (const lg of logs) for (const it of lg.items ?? []) items.push(it);
      setBillPage1Items(items);
    });
    detailDisc.onOpen();
  };

  if (!authLoading && !isCustomer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-y-3">
      <div className="flex flex-row items-center justify-between shrink-0 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          บิลทั้งหมด
        </span>
      </div>

      <div className="shrink-0">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(String(k))}
          color="warning"
          variant="underlined"
          classNames={{ tabList: "gap-4" }}
        >
          <Tab key="completed" title="สำเร็จแล้ว" />
          <Tab key="cleared" title="เคลียร์บิลแล้ว" />
        </Tabs>
      </div>

      {/* ตัวกรอง: ดูทั้งหมด หรือ กรองช่วงวันที่ (เริ่มต้นวันนี้) */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-1">
        <div className="flex rounded-2xl border-1 border-black/10 bg-black/5 p-0.5">
          <Button
            size="sm"
            variant="light"
            className={`rounded-xl font-bold ${!showAll ? "bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white shadow-sm" : "text-black/50"}`}
            startContent={<CalendarDays size={14} />}
            onPress={() => setShowAll(false)}
          >
            ช่วงวันที่
          </Button>
          <Button
            size="sm"
            variant="light"
            className={`rounded-xl font-bold ${showAll ? "bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white shadow-sm" : "text-black/50"}`}
            startContent={<Layers size={14} />}
            onPress={() => setShowAll(true)}
          >
            ทั้งหมด
          </Button>
        </div>
        {!showAll && (
          <DateRangePicker
            aria-label="ช่วงวันที่"
            size="sm"
            value={range}
            onChange={setRange}
            visibleMonths={1}
            className="max-w-[17rem]"
            classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">
            {!showAll && range
              ? "ไม่พบบิลในช่วงวันที่ที่เลือก"
              : activeTab === "cleared" ? "ยังไม่มีบิลที่เคลียร์แล้ว" : "ยังไม่มีบิลที่สำเร็จ"}
          </div>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {groups.map((g) => (
              <div
                key={g.key}
                onClick={() => openDetail(g)}
                className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 cursor-pointer hover:shadow-md transition-all gap-y-2"
              >
                <div className="flex flex-row items-center justify-between">
                  <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    ใบเสนอราคา {g.code}
                    {g.count > 1 && <span className="ml-1 text-[10px] font-bold text-blue-600">รวม {g.count} บิล</span>}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[g.rep.status]}`}>
                    {STATUS_LABEL[g.rep.status]}
                  </span>
                </div>
                <div className="flex flex-row items-center justify-between">
                  <span className="text-[11px] text-black/40">{moment(g.created_at).format("DD/MM/YY HH:mm")}</span>
                  <span className="font-bold text-sm text-yellow-700">{g.total.toLocaleString()} บาท</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PREVIEW MODAL */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                ใบเสนอราคา {detailB?.issued_quotation?.code ?? detailB?.code}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[detailB?.status ?? 12]}`}>
                {STATUS_LABEL[detailB?.status ?? 12]}
              </span>
            </div>
          </ModalHeader>
          <ModalBody className="px-2">
            {detailB && (() => {
              const src = detailB.issued_quotation ?? detailB;
              const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");
              const urlsOf = (type: string) =>
                (src.images ?? []).filter((im) => (im.type || "") === type).map((im) => `${base}${im.image_url}`);
              return (
                <div className="flex flex-col gap-3">
                  {/* Card: รายการที่ลูกค้าส่งเข้ามา (อ้างอิง · หลอมแล้ว) */}
                  <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-sm font-bold text-black/60">รายการที่ส่งเข้ามา</span>
                    <div className="border-1 border-black/10 bg-white/60 rounded-xl overflow-hidden">
                      {(detailB.items ?? []).map((it, i) => (
                        <div key={it.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-black/5 text-sm">
                          <span className="text-black/70">{i + 1}. {it.type_name}</span>
                          <span className="text-black/50">น้ำหนัก {it.weight} {itemWeightUnit(it.metal)}</span>
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
                      customerName={detailB.issued_quotation?.signer_name || detailB.creator?.name}
                      customerPhone={detailB.issued_quotation?.signer_phone || detailB.creator?.phone}
                      customerAddress={detailB.creator?.address}
                      customerTaxId={detailB.creator?.tax_id}
                      signerName={detailB.issued_quotation?.signer_name}
                    />
                  </div>
                </div>
              );
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={detailDisc.onClose}>ปิด</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              startContent={<Printer size={14} />}
              onPress={() => previewRef.current?.print()}
            >
              พิมพ์
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
