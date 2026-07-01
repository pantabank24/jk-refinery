'use client'

import { useState } from "react";
import moment from "moment";
import { CheckCircle, XCircle, Pencil, ChevronDown, AlertCircle, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import { api } from "@/lib/api";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { PreviewQuote } from "../../quotation/_component/previewQuote";
import { GoldType, computeItem } from "@/lib/gold-calc";
import { QuotationProps } from "../../quotation/_component/quotation";
import { QuotationData, QuotationItem, MemberOption } from "./types";
import { imgUrls, STATUS_LABEL, STATUS_COLOR, REJECT_REASONS } from "./constants";

interface Props {
  quotation: QuotationData | null;
  members: MemberOption[];
  goldTypes: GoldType[];
  canUpdate: boolean;
  isMaster: boolean;
  canDelete: boolean;
  // Called with the freshly-refetched quotation after approve/reject/edit succeeds.
  onChanged: (updated: QuotationData) => void;
  onDeleted: () => void;
  emptyHint?: string;
}

export function QuotationDetailPanel({ quotation, members, goldTypes, canUpdate, isMaster, canDelete, onChanged, onDeleted, emptyHint }: Props) {
  // ── Approve ──
  const approveDisc = useDisclosure();
  const [approving, setApproving] = useState(false);

  // ── Delete ──
  const deleteDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  // ── Reject ──
  const rejectDisc = useDisclosure();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [refundOnCancel, setRefundOnCancel] = useState(true);

  // ── Edit ──
  const editDisc = useDisclosure();
  const [editNote, setEditNote] = useState("");
  const [editMemberId, setEditMemberId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editItems, setEditItems] = useState<QuotationItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Asks whether to also reconcile the creator's credits when a master edit
  // changes the total.
  const creditAdjustDisc = useDisclosure();

  const refresh = async () => {
    if (!quotation) return;
    const res = await api.get<QuotationData>(`/quotations/${quotation.id}`);
    onChanged(res.data as unknown as QuotationData);
  };

  const handleDeleteQuotation = async () => {
    if (!quotation) return;
    setDeleting(true);
    try {
      await api.delete(`/quotations/${quotation.id}`);
      deleteDisc.onClose();
      onDeleted();
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  const handleApprove = async () => {
    if (!quotation) return;
    setApproving(true);
    try {
      await api.put(`/quotations/${quotation.id}`, { status: 1 });
      approveDisc.onClose();
      await refresh();
    } catch { /* ignore */ } finally {
      setApproving(false);
    }
  };

  const openReject = () => {
    setRejectReason(REJECT_REASONS[0]);
    setRejectCustom("");
    setRefundOnCancel(true);
    rejectDisc.onOpen();
  };

  const handleReject = async () => {
    if (!quotation) return;
    const reason = rejectReason === "อื่นๆ" ? rejectCustom : rejectReason;
    if (!reason.trim()) return;
    // Only an approved quotation was charged, so a refund only makes sense there.
    const refund = quotation.status === 1 && refundOnCancel;
    setRejecting(true);
    try {
      await api.put(`/quotations/${quotation.id}`, { status: 2, reject_reason: reason, refund_credits: refund });
      rejectDisc.onClose();
      await refresh();
    } catch { /* ignore */ } finally {
      setRejecting(false);
    }
  };

  const openEdit = () => {
    if (!quotation) return;
    setEditNote(quotation.note || "");
    setEditMemberId(quotation.member ? String(quotation.member.id) : "");
    setEditDate(quotation.created_at ? quotation.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditItems(quotation.items ? quotation.items.map((i) => ({ ...i })) : []);
    editDisc.onOpen();
  };

  const updateEditItem = (idx: number, field: keyof QuotationItem, val: string | number) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const numVal = typeof val === "number" ? val : (parseFloat(val) || 0);
        const updated = { ...item, [field]: numVal };
        // Recalculate per_gram/total via the shared gold-calc — same formula as
        // the create screen (respects formula steps, plus_type, weight-in-formula).
        if (["price", "percent", "plus", "plus_type", "weight"].includes(field)) {
          const gt = goldTypes.find((t) => String(t.id) === String(updated.type_id)) ?? null;
          const { perGram, total } = computeItem({
            goldType: gt,
            price: updated.price,
            percent: updated.percent,
            plus: updated.plus,
            weight: updated.weight,
            plusType: updated.plus_type ?? 0,
          });
          updated.per_gram = perGram;
          updated.total = total;
        }
        return updated;
      })
    );
  };

  const editTotal = editItems.reduce((s, i) => s + i.total, 0);

  // A master edit that changes the total prompts whether to reconcile the
  // creator's credits; otherwise save straight away.
  const handleEditSave = () => {
    const changedTotal = !!quotation && editTotal !== quotation.total_amount;
    if (isMaster && changedTotal) {
      creditAdjustDisc.onOpen();
      return;
    }
    void doEditSave(false);
  };

  const doEditSave = async (adjustCredits: boolean) => {
    if (!quotation) return;
    setEditSaving(true);
    try {
      await api.patch(`/quotations/${quotation.id}`, {
        member_id: editMemberId ? Number(editMemberId) : null,
        note: editNote,
        created_at: editDate,
        items: editItems.map((i) => ({
          id: i.id,
          type_id: i.type_id,
          type_name: i.type_name,
          price: i.price,
          percent: i.percent,
          plus: i.plus,
          plus_type: i.plus_type ?? 0,
          weight: i.weight,
          per_gram: i.per_gram,
          total: i.total,
        })),
        adjust_credits: adjustCredits,
      });
      creditAdjustDisc.onClose();
      editDisc.onClose();
      await refresh();
    } catch { /* ignore */ } finally {
      setEditSaving(false);
    }
  };

  if (!quotation) {
    return (
      <div className="flex items-center justify-center h-full py-20 text-black/40 text-sm">
        {emptyHint ?? "เลือกรายการเพื่อดูรายละเอียด"}
      </div>
    );
  }

  // Prefer the store-header snapshot taken at creation time (stays accurate
  // even if the store's info changes later); fall back to the live `store`
  // relation for quotations created before the snapshot existed.
  const storeHeader = quotation.store_name
    ? {
        name: quotation.store_name,
        branch: quotation.store_branch,
        address: quotation.store_address,
        phone: quotation.store_phone,
        tax_id: quotation.store_tax_id,
        tax_name: quotation.store_tax_name,
        website: quotation.store_website,
        logo: quotation.store_logo,
      }
    : quotation.store
      ? { ...quotation.store, branch: quotation.branch?.name }
      : undefined;
  const storeHeaderName = quotation.store_name || quotation.store?.name;

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            {quotation.code}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[quotation.status]}`}>
            {STATUS_LABEL[quotation.status]}
          </span>
        </div>
        <span className="text-xs font-normal text-black/50">
          {moment(quotation.created_at).format("DD/MM/YYYY HH:mm")}
          {quotation.creator && ` · โดย ${quotation.creator.name}`}
          {storeHeaderName && ` · ${storeHeaderName}`}
          {quotation.branch && ` / ${quotation.branch.name}`}
        </span>
      </div>

      {quotation.status === 2 && quotation.reject_reason && (
        <div className="flex items-start gap-x-2 bg-red-50 border-1 border-red-200 rounded-2xl p-3">
          <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-red-600">เหตุผลที่ยกเลิก</span>
            <span className="text-sm text-red-700">{quotation.reject_reason}</span>
          </div>
        </div>
      )}

      <PreviewQuote
        items={(quotation.items ?? []).map((item): QuotationProps => ({
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
        documentNo={quotation.code}
        store={storeHeader}
        customerName={quotation.signer_name || (quotation.member ? `${quotation.member.fname} ${quotation.member.lname}` : "")}
        customerPhone={quotation.signer_phone || quotation.member?.phone}
        date={quotation.created_at}
        beforeImages={imgUrls(quotation.images, "before_melt")}
        afterImages={imgUrls(quotation.images, "after_melt")}
        previewImages={imgUrls(quotation.images, "")}
        signatureImage={imgUrls(quotation.images, "signature")[0] ?? null}
        signerName={quotation.signer_name}
      />

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        {canUpdate && quotation.status === 0 && (
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
              onPress={approveDisc.onOpen}
            >
              อนุมัติ
            </Button>
          </>
        )}
        {/* Master may edit an already approved/cancelled quotation */}
        {isMaster && quotation.status !== 0 && (
          <Button variant="flat" startContent={<Pencil size={14} />} onPress={openEdit}>
            แก้ไข
          </Button>
        )}
        {/* Master may cancel an approved quotation (with optional credit refund) */}
        {isMaster && quotation.status === 1 && (
          <Button color="danger" variant="flat" startContent={<XCircle size={14} />} onPress={openReject}>
            ยกเลิก
          </Button>
        )}
        {/* Permanently delete the quotation (cascade soft-delete) */}
        {canDelete && (
          <Button color="danger" startContent={<Trash2 size={14} />} onPress={deleteDisc.onOpen}>
            ลบ
          </Button>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={deleteDisc.isOpen}
        onClose={deleteDisc.onClose}
        onConfirm={handleDeleteQuotation}
        name={quotation.code}
        related={quotation.items?.length ? `รวมรายการสินค้า ${quotation.items.length} รายการ (เครดิตไม่คืน แต่ยังแสดงในประวัติ)` : undefined}
        loading={deleting}
      />

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
                <span className="font-bold">{quotation.code}</span>
              </div>
              {quotation.member && (
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3 gap-y-1">
                  <span className="text-xs text-black/50">สมาชิก</span>
                  <span className="font-bold">{quotation.member.fname} {quotation.member.lname}</span>
                </div>
              )}
              <div className="flex flex-col border-1 border-green-200 bg-green-50 rounded-2xl p-3 gap-y-1">
                <span className="text-xs text-black/50">ยอดรวม</span>
                <span className="font-bold text-xl text-green-700">
                  {quotation.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
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
            {/* Refund prompt — only an approved quotation was charged */}
            {quotation.status === 1 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-black/70">คืนเครดิตให้ผู้สร้าง</span>
                  <span className="text-xs text-black/40">
                    คืน {quotation.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท ที่หักไปตอนสร้าง
                  </span>
                </div>
                <Switch isSelected={refundOnCancel} onValueChange={setRefundOnCancel} color="success" />
              </div>
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
              แก้ไขใบเสนอราคา — {quotation.code}
            </span>
          </ModalHeader>
          <ModalBody className="gap-y-4">
            {/* Date */}
            <Input
              size="sm"
              type="date"
              label="วันที่ในเอกสาร"
              value={editDate}
              onValueChange={setEditDate}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            />

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
                      endContent={
                        <div className="flex gap-0.5 items-center shrink-0">
                          <button type="button" onClick={() => updateEditItem(idx, "plus_type", 0)}
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-all ${(item.plus_type ?? 0) === 0 ? "bg-yellow-600/70 text-white" : "text-black/40 hover:text-black/70"}`}>฿</button>
                          <button type="button" onClick={() => updateEditItem(idx, "plus_type", 1)}
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-all ${(item.plus_type ?? 0) === 1 ? "bg-yellow-600/70 text-white" : "text-black/40 hover:text-black/70"}`}>%</button>
                        </div>
                      }
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

      {/* Credit reconciliation prompt (master edit changed the total) */}
      <Modal isOpen={creditAdjustDisc.isOpen} onOpenChange={creditAdjustDisc.onOpenChange} size="sm" backdrop="blur">
        <ModalContent>
          {() => {
            const oldTotal = quotation.total_amount;
            const delta = editTotal - oldTotal;
            return (
              <>
                <ModalHeader className="flex items-center gap-2 text-amber-500">
                  <AlertCircle size={20} />
                  <span>ยอดรวมเปลี่ยนแปลง</span>
                </ModalHeader>
                <ModalBody>
                  <div className="flex flex-col gap-y-3">
                    <p className="text-sm text-black/70">
                      ยอดรวมใบเสนอราคาเปลี่ยนไป ต้องการ{delta > 0 ? "หักเครดิตเพิ่ม" : "คืนเครดิต"}ของผู้สร้างตามส่วนต่างด้วยหรือไม่?
                    </p>
                    <div className="flex flex-col gap-y-1 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-black/50">ยอดเดิม</span>
                        <span className="font-bold text-black">{oldTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50">ยอดใหม่</span>
                        <span className="font-bold text-black">{editTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-200 mt-1 pt-1">
                        <span className="text-black/50">{delta > 0 ? "หักเครดิตเพิ่ม" : "คืนเครดิต"}</span>
                        <span className={`font-bold ${delta > 0 ? "text-red-600" : "text-green-600"}`}>
                          {Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                        </span>
                      </div>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="flex-wrap gap-2">
                  <Button variant="flat" onPress={() => doEditSave(false)} isDisabled={editSaving}>
                    ไม่ปรับเครดิต
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold"
                    onPress={() => doEditSave(true)}
                    isLoading={editSaving}
                  >
                    ปรับเครดิตด้วย
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
