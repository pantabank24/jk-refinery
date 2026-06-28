"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Avatar } from "@heroui/avatar";
import { CheckCircle, XCircle, FileUp, AlertCircle } from "lucide-react";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { PreviewQuote } from "../quotation/_component/previewQuote";
import { QuotationProps } from "../quotation/_component/quotation";

interface BillItem {
  id: number;
  type_id: string;
  type_name: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
}

interface BillData {
  id: number;
  code: string;
  status: number;
  note: string;
  reject_reason: string;
  total_amount: number;
  store?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  creator?: { id: number; name: string; phone?: string } | null;
  issued_quotation_id?: number | null;
  items?: BillItem[];
  images?: { id: number; image_url: string; type?: string }[];
  // The master-issued quotation (once issued) — its items/photos/signature are the
  // real bill shown to the customer.
  issued_quotation?: {
    items?: BillItem[];
    images?: { id: number; image_url: string; type?: string }[];
    signer_name?: string;
  } | null;
  created_at: string;
}

// A display row: one bill, or several bills issued together (combined).
interface BillGroup {
  key: string;
  rep: BillData;
  billIds: number[];
  status: number;
  total: number;
  count: number;
}

// Bill statuses are distinct from staff quotation statuses (0/1/2).
const STATUS_LABEL: Record<number, string> = { 10: "รอออกบิล", 11: "รอตรวจบิล", 12: "สำเร็จ", 13: "ยกเลิก" };
const STATUS_COLOR: Record<number, string> = {
  10: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  11: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  13: "bg-red-500/20 text-red-700 border-red-500/30",
};

const CANCEL_REASONS = [
  "ลูกค้าไม่มาติดต่อ",
  "ลูกค้าขอยกเลิก",
  "ราคาไม่ตรงตามที่ตกลง",
  "น้ำหนักไม่ถูกต้อง",
  "ประเภททองไม่ถูกต้อง",
  "อื่นๆ",
];

export default function BillsList() {
  const router = useRouter();
  const { selectedStore, selectedBranch } = useStore();
  const { hasPermission, permissions, isCustomer, loading: authLoading, refreshUnfinishedBills } = useAuth();
  const canRead = hasPermission("bills.read");
  const canIssue = hasPermission("bills.issue");
  const canApprove = hasPermission("bills.approve");
  // Creation is customer-only — use the raw permission (master is auto-granted by
  // hasPermission, but master manages bills rather than creating them).
  const canCreate = permissions.includes("bills.create");

  const [bills, setBills] = useState<BillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const detailDisc = useDisclosure();
  const [detailB, setDetailB] = useState<BillData | null>(null);
  // Bill ids covered by the currently-open detail (a group when bills were issued
  // together). Approve/cancel apply to all of them.
  const [groupBillIds, setGroupBillIds] = useState<number[]>([]);

  const issueDisc = useDisclosure();
  const [issuing, setIssuing] = useState(false);

  const approveDisc = useDisclosure();
  const [approving, setApproving] = useState(false);

  const cancelDisc = useDisclosure();
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCustom, setCancelCustom] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const statusFilter: Record<string, number | undefined> = {
    all: undefined, pending_issue: 10, pending_review: 11, completed: 12, cancelled: 13,
  };

  // Customers see each sell individually. Staff/master see bills that were issued
  // together (sharing one issued quotation) combined into a single entry.
  const billGroups: BillGroup[] = useMemo(() => {
    if (isCustomer) {
      // Customer "รายการขาย" shows only not-yet-completed sells; completed bills
      // live in "บิลทั้งหมด".
      return bills
        .filter((b) => b.status !== 12)
        .map((b) => ({ key: `b${b.id}`, rep: b, billIds: [b.id], status: b.status, total: b.total_amount, count: 1 }));
    }
    const map = new Map<string, BillData[]>();
    for (const b of bills) {
      const key = b.issued_quotation_id ? `q${b.issued_quotation_id}` : `b${b.id}`;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return Array.from(map.values()).map((list) => ({
      key: list[0].issued_quotation_id ? `q${list[0].issued_quotation_id}` : `b${list[0].id}`,
      rep: list[0],
      billIds: list.map((x) => x.id),
      status: list[0].status,
      total: list.reduce((s, x) => s + x.total_amount, 0),
      count: list.length,
    }));
  }, [bills, isCustomer]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/bills?limit=50";
      if (selectedStore) url += `&store_id=${selectedStore.id}`;
      if (selectedBranch) url += `&branch_id=${selectedBranch.id}`;
      const s = statusFilter[activeTab];
      if (s !== undefined) url += `&status=${s}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get<BillData[]>(url);
      setBills((res.data as unknown as BillData[]) || []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, selectedBranch, activeTab, search]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => { if (canRead) fetchBills(); }, [fetchBills, canRead]);

  const openDetail = async (b: BillData) => {
    try {
      const res = await api.get<BillData>(`/bills/${b.id}`);
      setDetailB(res.data as unknown as BillData);
    } catch {
      setDetailB(b);
    }
    detailDisc.onOpen();
  };

  // Issuer (master): a รอออกบิล bill jumps to the quotation page to issue it
  // (create a linked quotation). Otherwise open the detail for the whole group.
  const handleRowClick = (g: BillGroup) => {
    if (canIssue && g.status === 10) {
      router.push(`/quotation?billId=${g.rep.id}`);
      return;
    }
    setGroupBillIds(g.billIds);
    openDetail(g.rep);
  };

  const afterAction = async () => {
    detailDisc.onClose();
    await fetchBills();
    await refreshUnfinishedBills();
  };

  const handleIssue = async () => {
    if (!detailB) return;
    setIssuing(true);
    try {
      await api.post(`/bills/${detailB.id}/issue`, {});
      issueDisc.onClose();
      await afterAction();
    } catch { /* ignore */ } finally {
      setIssuing(false);
    }
  };

  // Approve every bill in the open group (bills issued together close together).
  const targetBillIds = () => (groupBillIds.length ? groupBillIds : detailB ? [detailB.id] : []);

  const handleApprove = async () => {
    if (!detailB) return;
    setApproving(true);
    try {
      for (const id of targetBillIds()) await api.post(`/bills/${id}/approve`, {});
      approveDisc.onClose();
      await afterAction();
    } catch { /* ignore */ } finally {
      setApproving(false);
    }
  };

  const openCancel = () => {
    setCancelReason(CANCEL_REASONS[0]);
    setCancelCustom("");
    cancelDisc.onOpen();
  };

  const handleCancel = async () => {
    if (!detailB) return;
    const reason = cancelReason === "อื่นๆ" ? cancelCustom : cancelReason;
    if (!reason.trim()) return;
    setCancelling(true);
    try {
      for (const id of targetBillIds()) await api.post(`/bills/${id}/cancel`, { reject_reason: reason });
      cancelDisc.onClose();
      await afterAction();
    } catch { /* ignore */ } finally {
      setCancelling(false);
    }
  };

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          รายการขาย
        </span>
        {canCreate && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
            onPress={() => router.push("/bills/create")}
          >
            + ขาย
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-row items-center gap-x-2 shrink-0">
        <div className="flex-1">
          <CmpInput placeholder="ค้นหาเลขที่" value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(String(k))}
          color="warning"
          variant="underlined"
          classNames={{ tabList: "gap-4" }}
        >
          <Tab key="all" title="ทั้งหมด" />
          <Tab key="pending_issue" title="รอออกบิล" />
          <Tab key="pending_review" title="รอตรวจบิล" />
          {/* Completed bills live in "บิลทั้งหมด" for customers */}
          {!isCustomer ? <Tab key="completed" title="สำเร็จ" /> : null}
          <Tab key="cancelled" title="ยกเลิก" />
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : billGroups.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีรายการขาย</div>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {billGroups.map((g) => (
              <div
                key={g.key}
                onClick={() => handleRowClick(g)}
                className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 transition-all gap-y-2 cursor-pointer hover:shadow-md"
              >
                <div className="flex flex-row items-center justify-between">
                  <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {g.rep.code}
                    {g.count > 1 && (
                      <span className="ml-1 text-[10px] font-bold text-blue-600">รวม {g.count} บิล</span>
                    )}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[g.status]}`}>
                    {STATUS_LABEL[g.status]}
                  </span>
                </div>

                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-x-2">
                    <Avatar size="sm" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-black/70">
                        {g.rep.creator ? g.rep.creator.name : "ไม่ระบุลูกค้า"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-sm text-yellow-700">
                      {g.total.toLocaleString()} บาท
                    </span>
                    <span className="text-[10px] text-black/40">
                      {moment(g.rep.created_at).format("DD/MM/YY HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                {detailB?.code}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[detailB?.status ?? 10]}`}>
                {STATUS_LABEL[detailB?.status ?? 10]}
              </span>
            </div>
            <span className="text-xs font-normal text-black/50">
              {detailB && moment(detailB.created_at).format("DD/MM/YYYY HH:mm")}
              {detailB?.creator && ` · โดย ${detailB.creator.name}`}
              {detailB?.store && ` · ${detailB.store.name}`}
              {detailB?.branch && ` / ${detailB.branch.name}`}
            </span>
          </ModalHeader>

          <ModalBody className="px-2">
            {detailB?.status === 13 && detailB.reject_reason && (
              <div className="flex items-start gap-x-2 bg-red-50 border-1 border-red-200 rounded-2xl p-3 mb-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-600">เหตุผลที่ยกเลิก</span>
                  <span className="text-sm text-red-700">{detailB.reject_reason}</span>
                </div>
              </div>
            )}
            {/* Customer's รายการขาย: just the items they sold — unless the bill has
                been issued (รอตรวจบิล), where we show the quotation review instead. */}
            {detailB && isCustomer && !(detailB.status === 11 && detailB.issued_quotation) && (
              <div className="flex flex-col gap-y-2">
                <span className="text-sm font-bold text-black/60">รายการที่ขาย</span>
                <div className="border-1 border-black/10 rounded-2xl overflow-hidden">
                  {(detailB.items ?? []).map((it, i) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-black/5">
                      <span className="text-sm">{i + 1}. {it.type_name}</span>
                      <div className="flex gap-x-4 text-sm">
                        <span className="text-black/50">{it.weight} บาท</span>
                        <span className="font-bold text-yellow-700">{it.total.toLocaleString()} บาท</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-3 pt-1">
                  <span className="text-sm font-bold">รวม</span>
                  <span className="text-sm font-bold text-yellow-700">{detailB.total_amount.toLocaleString()} บาท</span>
                </div>
              </div>
            )}
            {detailB && (!isCustomer || (detailB.status === 11 && detailB.issued_quotation)) && (() => {
              const issued = detailB.issued_quotation;
              const src = issued ?? detailB;
              const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");
              const urlsOf = (type: string) =>
                (src.images ?? []).filter((im) => (im.type || "") === type).map((im) => `${base}${im.image_url}`);
              const preview = (
                <PreviewQuote
                  hidePrint={isCustomer}
                  items={(src.items ?? []).map((item): QuotationProps => ({
                    typeId: String(item.id),
                    typeName: item.type_name,
                    price: item.price,
                    plus: item.plus,
                    percent: item.percent,
                    weight: item.weight,
                    perGram: item.per_gram,
                    total: item.total,
                  }))}
                  onPrint={() => window.print()}
                  beforeImages={urlsOf("before_melt")}
                  afterImages={urlsOf("after_melt")}
                  previewImages={urlsOf("")}
                  signatureImage={urlsOf("signature")[0] ?? null}
                  signerName={detailB.issued_quotation?.signer_name}
                />
              );
              // Once issued, show the customer's submitted items as a card above the real bill.
              if (!issued) return preview;
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                    <span className="text-sm font-bold text-black/60">รายการที่ลูกค้าส่งมา</span>
                    <div className="border-1 border-black/10 bg-white/60 rounded-xl overflow-hidden">
                      {(detailB.items ?? []).map((it, i) => (
                        <div key={it.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-black/5 text-sm">
                          <span className="text-black/70">{i + 1}. {it.type_name}</span>
                          <span className="text-black/50">น้ำหนัก {it.weight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">{preview}</div>
                </div>
              );
            })()}
          </ModalBody>

          <ModalFooter className="flex-wrap gap-2">
            <Button variant="light" onPress={detailDisc.onClose}>ปิด</Button>
            {/* Master issues the bill: รอออกบิล → รอตรวจบิล */}
            {canIssue && detailB?.status === 10 && (
              <Button
                className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                startContent={<FileUp size={14} />}
                onPress={issueDisc.onOpen}
              >
                ออกบิล
              </Button>
            )}
            {/* Storefront cancel while waiting (status 10 or 11) */}
            {canApprove && (detailB?.status === 10 || detailB?.status === 11) && (
              <Button color="danger" variant="flat" startContent={<XCircle size={14} />} onPress={openCancel}>
                ยกเลิก
              </Button>
            )}
            {/* Storefront approve: รอตรวจบิล → สำเร็จ */}
            {canApprove && detailB?.status === 11 && (
              <Button
                className="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold"
                startContent={<CheckCircle size={14} />}
                onPress={approveDisc.onOpen}
              >
                อนุมัติปิดบิล
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ISSUE CONFIRM */}
      <Modal isOpen={issueDisc.isOpen} onClose={issueDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-[#c09c42]">ยืนยันการออกบิล</span></ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">
              ออกบิล <span className="font-bold">{detailB?.code}</span> ให้ลูกค้า? สถานะจะเปลี่ยนเป็น &quot;รอตรวจบิล&quot; และลูกค้าจะเห็นบิลนี้
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={issueDisc.onClose} isDisabled={issuing}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              onPress={handleIssue}
              isLoading={issuing}
            >
              ยืนยันออกบิล
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* APPROVE CONFIRM */}
      <Modal isOpen={approveDisc.isOpen} onClose={approveDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-green-700">ยืนยันการปิดบิล</span></ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-y-3">
              <div className="flex flex-col border-1 border-green-200 bg-green-50 rounded-2xl p-3 gap-y-1">
                <span className="text-xs text-black/50">ยอดรวม</span>
                <span className="font-bold text-xl text-green-700">
                  {detailB?.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
              <p className="text-sm text-black/60 text-center">ยืนยันว่าลูกค้าตกลงและปิดบิลนี้ — ไม่สามารถย้อนกลับได้</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={approveDisc.onClose} isDisabled={approving}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold"
              onPress={handleApprove}
              isLoading={approving}
            >
              ยืนยันปิดบิล
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* CANCEL */}
      <Modal isOpen={cancelDisc.isOpen} onClose={cancelDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={20} />
              <span className="font-bold">ยกเลิกบิล</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-y-3">
              <Select
                label="เหตุผลในการยกเลิก"
                selectedKeys={[cancelReason]}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r}>{r}</SelectItem>
                ))}
              </Select>
              {cancelReason === "อื่นๆ" && (
                <Input
                  label="ระบุเหตุผล"
                  value={cancelCustom}
                  onChange={(e) => setCancelCustom(e.target.value)}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={cancelDisc.onClose} isDisabled={cancelling}>ปิด</Button>
            <Button color="danger" onPress={handleCancel} isLoading={cancelling}>
              ยืนยันยกเลิก
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
