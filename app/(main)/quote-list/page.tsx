'use client'

import { useEffect, useState, useCallback } from "react";
import { Avatar } from "@heroui/avatar";
import { Download, CheckCircle, XCircle, Pencil, ChevronDown } from "lucide-react";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { PreviewQuote } from "../quotation/_component/previewQuote";
import { QuotationProps } from "../quotation/_component/quotation";

interface QuotationItem {
  id: number;
  type_name: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
}

interface QuotationData {
  id: number;
  code: string;
  status: number;
  note: string;
  reject_reason: string;
  total_amount: number;
  member?: { id: number; fname: string; lname: string; phone: string; code: string } | null;
  store?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  creator?: { id: number; name: string } | null;
  items?: QuotationItem[];
  images?: { id: number; image_url: string }[];
  created_at: string;
}

interface MemberOption {
  id: number;
  fname: string;
  lname: string;
  code: string;
}

const STATUS_LABEL: Record<number, string> = { 0: "รอตรวจสอบ", 1: "สำเร็จ", 2: "ยกเลิก" };
const STATUS_COLOR: Record<number, string> = {
  0: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  1: "bg-green-500/20 text-green-700 border-green-500/30",
  2: "bg-red-500/20 text-red-700 border-red-500/30",
};

const REJECT_REASONS = [
  "ราคาไม่ตรงตามที่ตกลง",
  "ลูกค้าเปลี่ยนใจ",
  "น้ำหนักไม่ถูกต้อง",
  "ประเภททองไม่ถูกต้อง",
  "เครดิตไม่เพียงพอ",
  "รายการซ้ำ",
  "อื่นๆ",
];

export default function QuoteList() {
  const { selectedStore, selectedBranch } = useStore();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission("quotations.update");

  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);

  // ── Detail modal ──
  const detailDisc = useDisclosure();
  const [detailQ, setDetailQ] = useState<QuotationData | null>(null);

  // ── Approve modal ──
  const approveDisc = useDisclosure();
  const [approving, setApproving] = useState(false);

  // ── Reject modal ──
  const rejectDisc = useDisclosure();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // ── Edit modal ──
  const editDisc = useDisclosure();
  const [editNote, setEditNote] = useState("");
  const [editMemberId, setEditMemberId] = useState("");
  const [editItems, setEditItems] = useState<QuotationItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const statusFilter: Record<string, number | undefined> = {
    all: undefined, pending: 0, approved: 1, rejected: 2,
  };

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/quotations?limit=50";
      if (selectedStore) url += `&store_id=${selectedStore.id}`;
      if (selectedBranch) url += `&branch_id=${selectedBranch.id}`;
      const s = statusFilter[activeTab];
      if (s !== undefined) url += `&status=${s}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get<QuotationData[]>(url);
      setQuotations((res.data as unknown as QuotationData[]) || []);
    } catch {
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, selectedBranch, activeTab, search]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  useEffect(() => {
    api.get<MemberOption[]>("/members?limit=200")
      .then((r) => setMembers((r.data as unknown as MemberOption[]) || []))
      .catch(() => {});
  }, []);

  // ── Open detail ──
  const openDetail = async (q: QuotationData) => {
    try {
      const res = await api.get<QuotationData>(`/quotations/${q.id}`);
      setDetailQ((res.data as unknown as QuotationData));
    } catch {
      setDetailQ(q);
    }
    detailDisc.onOpen();
  };

  // ── Approve ──
  const openApprove = () => { approveDisc.onOpen(); };

  const handleApprove = async () => {
    if (!detailQ) return;
    setApproving(true);
    try {
      await api.put(`/quotations/${detailQ.id}`, { status: 1 });
      approveDisc.onClose();
      detailDisc.onClose();
      fetchQuotations();
    } catch { /* ignore */ } finally {
      setApproving(false);
    }
  };

  // ── Reject ──
  const openReject = () => {
    setRejectReason(REJECT_REASONS[0]);
    setRejectCustom("");
    rejectDisc.onOpen();
  };

  const handleReject = async () => {
    if (!detailQ) return;
    const reason = rejectReason === "อื่นๆ" ? rejectCustom : rejectReason;
    if (!reason.trim()) return;
    setRejecting(true);
    try {
      await api.put(`/quotations/${detailQ.id}`, { status: 2, reject_reason: reason });
      rejectDisc.onClose();
      detailDisc.onClose();
      fetchQuotations();
    } catch { /* ignore */ } finally {
      setRejecting(false);
    }
  };

  // ── Edit ──
  const openEdit = () => {
    if (!detailQ) return;
    setEditNote(detailQ.note || "");
    setEditMemberId(detailQ.member ? String(detailQ.member.id) : "");
    setEditItems(detailQ.items ? detailQ.items.map((i) => ({ ...i })) : []);
    editDisc.onOpen();
  };

  const updateEditItem = (idx: number, field: keyof QuotationItem, val: string) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: parseFloat(val) || 0 };
        // Recalculate per_gram and total when price/percent/plus/weight change
        if (["price", "percent", "plus", "weight"].includes(field)) {
          updated.per_gram = updated.price * (updated.percent / 100) + updated.plus;
          updated.total = updated.per_gram * updated.weight;
        }
        return updated;
      })
    );
  };

  const handleEditSave = async () => {
    if (!detailQ) return;
    setEditSaving(true);
    try {
      await api.patch(`/quotations/${detailQ.id}`, {
        member_id: editMemberId ? Number(editMemberId) : null,
        note: editNote,
        items: editItems.map((i) => ({
          type_id: String(i.id),
          type_name: i.type_name,
          price: i.price,
          percent: i.percent,
          plus: i.plus,
          weight: i.weight,
          per_gram: i.per_gram,
          total: i.total,
        })),
      });
      editDisc.onClose();
      // Refresh detail
      const res = await api.get<QuotationData>(`/quotations/${detailQ.id}`);
      setDetailQ((res.data as unknown as QuotationData));
      fetchQuotations();
    } catch { /* ignore */ } finally {
      setEditSaving(false);
    }
  };

  const handleExport = async (id: number, code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("jk_token");
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
      const resp = await fetch(`${API}/quotations/${id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `quotation_${code}.csv`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const editTotal = editItems.reduce((s, i) => s + i.total, 0);

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          รายการใบเสนอราคา
        </span>
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
          <Tab key="pending" title="รอตรวจสอบ" />
          <Tab key="approved" title="สำเร็จ" />
          <Tab key="rejected" title="ยกเลิก" />
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : quotations.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีใบเสนอราคา</div>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {quotations.map((item) => (
              <div
                key={item.id}
                onClick={() => openDetail(item)}
                className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 cursor-pointer hover:shadow-md transition-all gap-y-2"
              >
                <div className="flex flex-row items-center justify-between">
                  <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {item.code}
                  </span>
                  <div className="flex items-center gap-x-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <Button isIconOnly size="sm" variant="light" className="text-[#c09c42]"
                      onPress={(e) => handleExport(item.id, item.code, e as unknown as React.MouseEvent)}>
                      <Download size={13} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-x-2">
                    <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="sm" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-black/70">
                        {item.member ? `${item.member.fname} ${item.member.lname}` : "ไม่ระบุสมาชิก"}
                      </span>
                      {item.member && <span className="text-[10px] text-black/40">โทร {item.member.phone}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-sm text-yellow-700">
                      {item.total_amount.toLocaleString()} บาท
                    </span>
                    <span className="text-[10px] text-black/40">
                      {moment(item.created_at).format("DD/MM/YY HH:mm")}
                      {item.creator && ` · ${item.creator.name}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════
           DETAIL MODAL
         ════════════════════════════════ */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                {detailQ?.code}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[detailQ?.status ?? 0]}`}>
                {STATUS_LABEL[detailQ?.status ?? 0]}
              </span>
            </div>
            <span className="text-xs font-normal text-black/50">
              {detailQ && moment(detailQ.created_at).format("DD/MM/YYYY HH:mm")}
              {detailQ?.creator && ` · โดย ${detailQ.creator.name}`}
              {detailQ?.store && ` · ${detailQ.store.name}`}
              {detailQ?.branch && ` / ${detailQ.branch.name}`}
            </span>
          </ModalHeader>

          <ModalBody className="px-2">
            {detailQ?.status === 2 && detailQ.reject_reason && (
              <div className="flex items-start gap-x-2 bg-red-50 border-1 border-red-200 rounded-2xl p-3 mb-2">
                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-600">เหตุผลที่ยกเลิก</span>
                  <span className="text-sm text-red-700">{detailQ.reject_reason}</span>
                </div>
              </div>
            )}
            {detailQ && (
              <PreviewQuote
                items={(detailQ.items ?? []).map((item): QuotationProps => ({
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
                previewImages={(detailQ.images ?? []).map((img) => {
                  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");
                  return `${base}${img.image_url}`;
                })}
              />
            )}
          </ModalBody>

          <ModalFooter className="flex-wrap gap-2">
            <Button variant="light" onPress={detailDisc.onClose}>ปิด</Button>
            {canUpdate && detailQ?.status === 0 && (
              <>
                <Button variant="flat" startContent={<Pencil size={14} />} onPress={openEdit}>
                  แก้ไข
                </Button>
                <Button color="danger" variant="flat" startContent={<XCircle size={14} />} onPress={openReject}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold"
                  startContent={<CheckCircle size={14} />}
                  onPress={openApprove}
                >
                  อนุมัติ
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ════════════════════════════════
           APPROVE CONFIRM MODAL
         ════════════════════════════════ */}
      <Modal isOpen={approveDisc.isOpen} onClose={approveDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-green-700">ยืนยันการอนุมัติ</span>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-y-3">
              <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-1">
                <span className="text-xs text-black/50">เลขที่ใบเสนอราคา</span>
                <span className="font-bold">{detailQ?.code}</span>
              </div>
              {detailQ?.member && (
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-1">
                  <span className="text-xs text-black/50">สมาชิก</span>
                  <span className="font-bold">{detailQ.member.fname} {detailQ.member.lname}</span>
                </div>
              )}
              <div className="flex flex-col border-1 border-green-200 bg-green-50 rounded-2xl p-3 gap-y-1">
                <span className="text-xs text-black/50">ยอดรวม</span>
                <span className="font-bold text-xl text-green-700">
                  {detailQ?.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
              <p className="text-sm text-black/60 text-center">
                การอนุมัติจะหักเครดิตจากสมาชิก — ไม่สามารถย้อนกลับได้
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={approveDisc.onClose} isDisabled={approving}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-green-600 to-green-500 text-white font-bold"
              isLoading={approving}
              onPress={handleApprove}
            >
              ยืนยันอนุมัติ
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ════════════════════════════════
           REJECT MODAL
         ════════════════════════════════ */}
      <Modal isOpen={rejectDisc.isOpen} onClose={rejectDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-red-600">ระบุเหตุผลการยกเลิก</span>
          </ModalHeader>
          <ModalBody className="gap-y-3">
            <Select
              label="เหตุผล"
              selectedKeys={new Set([rejectReason])}
              onSelectionChange={(keys) => setRejectReason(keys.currentKey as string ?? REJECT_REASONS[0])}
              classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              endContent={<ChevronDown size={14} />}
            >
              {REJECT_REASONS.map((r) => (
                <SelectItem key={r}>{r}</SelectItem>
              ))}
            </Select>
            {rejectReason === "อื่นๆ" && (
              <Textarea
                label="ระบุเหตุผลเพิ่มเติม"
                placeholder="กรอกเหตุผล..."
                value={rejectCustom}
                onValueChange={setRejectCustom}
                minRows={3}
                classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={rejectDisc.onClose} isDisabled={rejecting}>ยกเลิก</Button>
            <Button
              color="danger"
              isLoading={rejecting}
              onPress={handleReject}
              isDisabled={rejectReason === "อื่นๆ" && !rejectCustom.trim()}
            >
              ยืนยันยกเลิก
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ════════════════════════════════
           EDIT MODAL
         ════════════════════════════════ */}
      <Modal isOpen={editDisc.isOpen} onClose={editDisc.onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              แก้ไขใบเสนอราคา — {detailQ?.code}
            </span>
          </ModalHeader>
          <ModalBody className="gap-y-4">
            {/* Member */}
            <Select
              label="สมาชิก (ไม่บังคับ)"
              selectedKeys={editMemberId ? new Set([editMemberId]) : new Set()}
              onSelectionChange={(keys) => setEditMemberId(keys.currentKey as string ?? "")}
              classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            >
              {members.map((m) => (
                <SelectItem key={String(m.id)}>{m.fname} {m.lname} ({m.code})</SelectItem>
              ))}
            </Select>

            {/* Items */}
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-bold text-black/70">รายการ</span>
              {editItems.map((item, idx) => (
                <div key={item.id} className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-2">
                  <span className="font-bold text-sm text-yellow-700">{item.type_name}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Input size="sm" label="ราคาทอง" type="number"
                      value={item.price === 0 ? "" : item.price.toString()}
                      onValueChange={(v) => updateEditItem(idx, "price", v)}
                      classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    <Input size="sm" label="เปอร์เซ็นต์" type="number"
                      value={item.percent === 0 ? "" : item.percent.toString()}
                      onValueChange={(v) => updateEditItem(idx, "percent", v)}
                      classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    <Input size="sm" label="ราคาบวก" type="number"
                      value={item.plus === 0 ? "" : item.plus.toString()}
                      onValueChange={(v) => updateEditItem(idx, "plus", v)}
                      classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    <Input size="sm" label="น้ำหนัก" type="number"
                      value={item.weight === 0 ? "" : item.weight.toString()}
                      onValueChange={(v) => updateEditItem(idx, "weight", v)}
                      classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                  </div>
                  <div className="flex justify-between text-xs text-black/50 px-1">
                    <span>ราคา/กรัม: <strong>{item.per_gram.toFixed(2)}</strong></span>
                    <span>รวม: <strong className="text-yellow-700">{item.total.toLocaleString()}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <Textarea
              label="หมายเหตุ"
              value={editNote}
              onValueChange={setEditNote}
              minRows={2}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            />

            {/* Total preview */}
            <div className="flex items-center justify-between bg-black/5 border-1 border-black/10 rounded-2xl px-4 py-3">
              <span className="text-sm text-black/60">ยอดรวมใหม่</span>
              <span className="font-bold text-xl text-yellow-700">
                {editTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
              </span>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={editDisc.onClose} isDisabled={editSaving}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              isLoading={editSaving}
              onPress={handleEditSave}
            >
              บันทึก
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
