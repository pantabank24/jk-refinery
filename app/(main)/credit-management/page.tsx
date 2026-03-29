"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { CmpInput } from "@/components/cmpInput";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Tabs, Tab } from "@heroui/tabs";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { ArrowUp, ArrowDown, FileText, Plus, ChevronDown, ShieldOff } from "lucide-react";
import moment from "moment";

interface CreditTransaction {
  id: number;
  member_id: number;
  member?: { id: number; fname: string; lname: string; code: string; phone: string } | null;
  action: number;
  amount: number;
  balance: number;
  description: string;
  creator?: { id: number; name: string } | null;
  created_at: string;
}

interface MemberOption {
  id: number;
  fname: string;
  lname: string;
  code: string;
}

const SOURCE_TABS = [
  { key: "all",      label: "ทั้งหมด" },
  { key: "deposit",  label: "เติมเครดิต" },
  { key: "withdraw", label: "ลดเครดิต" },
  { key: "quotation",label: "จากใบเสนอราคา" },
];

function TxIcon({ tx }: { tx: CreditTransaction }) {
  if (tx.action === 0) return <ArrowUp size={14} className="text-green-600" />;
  if (tx.description?.includes("ใบเสนอราคา")) return <FileText size={14} className="text-yellow-600" />;
  return <ArrowDown size={14} className="text-red-500" />;
}

function TxBadge({ tx }: { tx: CreditTransaction }) {
  if (tx.action === 0)
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">เติมเครดิต</span>;
  if (tx.description?.includes("ใบเสนอราคา"))
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">จากใบเสนอราคา</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">ลดเครดิต</span>;
}

export default function CreditManagementPage() {
  const { selectedStore, selectedBranch } = useStore();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("credits.read");
  const canUpdate = hasPermission("credits.update");

  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);

  // ── Add credit modal ──
  const addDisc = useDisclosure();
  const [addMemberId, setAddMemberId] = useState("");
  const [addAction, setAddAction] = useState("0");
  const [addAmount, setAddAmount] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/members/credit-transactions/all?limit=50`;
      if (selectedStore) url += `&store_id=${selectedStore.id}`;
      if (selectedBranch) url += `&branch_id=${selectedBranch.id}`;
      if (source !== "all") url += `&source=${source}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get<CreditTransaction[]>(url);
      setTransactions((res.data as unknown as CreditTransaction[]) || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, selectedBranch, source, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    api.get<MemberOption[]>("/members?limit=200")
      .then((r) => setMembers((r.data as unknown as MemberOption[]) || []))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setAddMemberId("");
    setAddAction("0");
    setAddAmount("");
    setAddDesc("");
    setAddError("");
    addDisc.onOpen();
  };

  const handleAddCredit = async () => {
    if (!addMemberId || !addAmount || Number(addAmount) <= 0) {
      setAddError("กรุณาระบุสมาชิกและจำนวนเงิน");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      await api.post(`/members/${addMemberId}/credit`, {
        action: Number(addAction),
        amount: Number(addAmount),
        description: addDesc,
      });
      addDisc.onClose();
      fetchTransactions();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAddSaving(false);
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

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          จัดการเครดิต
        </span>
        {canUpdate && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
            startContent={<Plus size={16} />}
            onPress={openAdd}
          >
            เติม/ลดเครดิต
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0">
        <CmpInput
          placeholder="ค้นหาชื่อสมาชิก, รหัส, หมายเหตุ"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="shrink-0">
        <Tabs
          selectedKey={source}
          onSelectionChange={(k) => setSource(String(k))}
          color="warning"
          variant="underlined"
          classNames={{ tabList: "gap-4" }}
        >
          {SOURCE_TABS.map((t) => <Tab key={t.key} title={t.label} />)}
        </Tabs>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" color="warning" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">
            ยังไม่มีรายการเครดิต
          </div>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-2"
              >
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      tx.action === 0 ? "bg-green-100" : tx.description?.includes("ใบเสนอราคา") ? "bg-yellow-100" : "bg-red-100"
                    }`}>
                      <TxIcon tx={tx} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-black/80">
                        {tx.member ? `${tx.member.fname} ${tx.member.lname}` : `สมาชิก #${tx.member_id}`}
                      </span>
                      {tx.member && (
                        <span className="text-[10px] text-black/40">{tx.member.code} · โทร {tx.member.phone}</span>
                      )}
                    </div>
                  </div>
                  <TxBadge tx={tx} />
                </div>

                {/* Amount row */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex flex-col">
                    <span className="text-xs text-black/50">
                      {tx.description || "—"}
                    </span>
                    <span className="text-[10px] text-black/30">
                      {moment(tx.created_at).format("DD/MM/YY HH:mm")}
                      {tx.creator && ` · โดย ${tx.creator.name}`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-bold text-base ${tx.action === 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.action === 0 ? "+" : "-"}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-black/40">
                      คงเหลือ {tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════
           ADD CREDIT MODAL
         ════════════════════════════════ */}
      <Modal isOpen={addDisc.isOpen} onClose={addDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              เติม / ลดเครดิต
            </span>
          </ModalHeader>
          <ModalBody className="gap-y-3">
            {/* Member select */}
            <Select
              label="สมาชิก"
              placeholder="เลือกสมาชิก"
              selectedKeys={addMemberId ? new Set([addMemberId]) : new Set()}
              onSelectionChange={(keys) => setAddMemberId(keys.currentKey as string ?? "")}
              classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              endContent={<ChevronDown size={14} />}
            >
              {members.map((m) => (
                <SelectItem key={String(m.id)}>
                  {m.fname} {m.lname} ({m.code})
                </SelectItem>
              ))}
            </Select>

            {/* Action */}
            <Select
              label="ประเภท"
              selectedKeys={new Set([addAction])}
              onSelectionChange={(keys) => setAddAction(keys.currentKey as string ?? "0")}
              classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              endContent={<ChevronDown size={14} />}
            >
              <SelectItem key="0">เติมเครดิต</SelectItem>
              <SelectItem key="1">ลดเครดิต</SelectItem>
            </Select>

            {/* Amount */}
            <Input
              label="จำนวน (บาท)"
              type="number"
              min={0}
              value={addAmount}
              onValueChange={setAddAmount}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            />

            {/* Description */}
            <Textarea
              label="หมายเหตุ (ไม่บังคับ)"
              placeholder="เช่น ชำระค่าบริการ, คืนเครดิต..."
              value={addDesc}
              onValueChange={setAddDesc}
              minRows={2}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
            />

            {addError && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                {addError}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={addDisc.onClose} isDisabled={addSaving}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              isLoading={addSaving}
              onPress={handleAddCredit}
            >
              ยืนยัน
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
