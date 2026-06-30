"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Tabs, Tab, Select, SelectItem,
  Popover, PopoverTrigger, PopoverContent, DateRangePicker,
} from "@heroui/react";
import { CalendarDate, today, getLocalTimeZone } from "@internationalized/date";
import type { RangeValue } from "@react-types/shared";
import { ArrowLeft, Coins, Pencil, Plus, Filter, Trash2, RotateCcw } from "lucide-react";
import { BoxCard } from "@/components/boxcard";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import { MemberCard } from "../_components/memberCard";

interface MemberUser {
  id: number;
  email: string;
  role?: { id: number; name: string; display_name: string };
}

interface Member {
  id: number;
  code: string;
  image: string;
  fname: string;
  lname: string;
  phone: string;
  credits: number;
  status: number;
  uses_credits?: boolean;
  user?: MemberUser | null;
}

interface CreditTx {
  id: number;
  action: number;
  amount: number;
  balance: number;
  description: string;
  created_at: string;
}

interface CreditResetItem {
  id: number;
  code: string;
  total_amount: number;
  created_at: string;
}

interface CreditResetPreview {
  count: number;
  amount: number;
  items: CreditResetItem[];
}

interface QuotationItem {
  type_name: string;
  weight: number;
  total?: number;
}

interface Quotation {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  created_at: string;
  signer_name?: string; // ชื่อผู้ขายที่ระบุตอนเซ็น = "ชื่อลูกค้า"
  items?: QuotationItem[];
}

// Categorise an item's gold-type name into a metal bucket for the gram totals.
type Metal = "gold" | "silver" | "platinum" | "palladium";
function metalOf(typeName: string): Metal | null {
  const n = typeName || "";
  if (/แพลเลเดียม|palladium/i.test(n)) return "palladium";
  if (/แพลตินัม|แพลทินัม|platinum/i.test(n)) return "platinum";
  if (/เงิน|silver/i.test(n)) return "silver";
  if (/ทอง|gold/i.test(n)) return "gold";
  return null;
}

const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGram = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Compact overview stat card used in the member quotation summary.
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

const quotationStatusMap: Record<string, string> = {
  "0": "รอการอนุมัติ",
  "1": "อนุมัติแล้ว",
  "2": "ยกเลิก",
};

const quotationStatusColor: Record<string, "warning" | "success" | "danger"> = {
  "0": "warning",
  "1": "success",
  "2": "danger",
};

export const MemberDetail = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("id");
  const { hasPermission } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<CreditTx[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("quote");

  // Quotation list filters (applied client-side over the fetched list).
  // Defaults to today only — empty range (qRange=null) means "every date".
  const [qSearch, setQSearch] = useState("");
  const [qStatus, setQStatus] = useState("all");
  const [qRange, setQRange] = useState<RangeValue<CalendarDate> | null>(() => {
    const t = today(getLocalTimeZone());
    return { start: t, end: t };
  });

  // Credit modal
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const delDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteMember = async () => {
    if (!memberId) return;
    setDeleting(true);
    try {
      await api.delete(`/members/${memberId}`);
      router.push("/members");
    } catch { delDisc.onClose(); } finally { setDeleting(false); }
  };
  const [creditAction, setCreditAction] = useState<"deposit" | "withdraw">("deposit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState("");

  // Reset-credit modal — refunds approved-but-not-yet-refunded quotations in bulk.
  const resetDisc = useDisclosure();
  const [resetPreview, setResetPreview] = useState<CreditResetPreview | null>(null);
  const [resetPreviewLoading, setResetPreviewLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const fetchMember = async () => {
    if (!memberId) return;
    const res = await api.get<Member>(`/members/${memberId}`);
    setMember(res.data as unknown as Member);
  };

  const handleImageUpload = async (file: File) => {
    if (!memberId) return;
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await api.upload<Member>(`/members/${memberId}/image`, fd);
      setMember(res.data as unknown as Member);
    } catch {
      // silent — could show a toast here
    }
  };

  const fetchTransactions = async () => {
    if (!memberId) return;
    try {
      const res = await api.get<CreditTx[]>(`/members/${memberId}/transactions?limit=50`);
      setTransactions((res.data as unknown as CreditTx[]) || []);
    } catch {
      setTransactions([]);
    }
  };

  const fetchQuotations = async (userAccountId?: number) => {
    if (!userAccountId) { setQuotations([]); return; }
    try {
      const res = await api.get<Quotation[]>(`/quotations?created_by=${userAccountId}&limit=100`);
      setQuotations((res.data as unknown as Quotation[]) || []);
    } catch {
      setQuotations([]);
    }
  };

  useEffect(() => {
    if (!memberId) {
      router.push("/members");
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<Member>(`/members/${memberId}`);
        const m = res.data as unknown as Member;
        setMember(m);
        // fetch transactions + quotations in parallel after we have member data
        await Promise.all([
          fetchTransactions(),
          fetchQuotations(m.user?.id),
        ]);
      } catch {
        router.push("/members");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId]);

  const handleAddCredit = async () => {
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      return setCreditError("กรุณาระบุจำนวนที่ถูกต้อง");
    }
    setCreditError("");
    setCreditLoading(true);
    try {
      await api.post(`/members/${memberId}/credit`, {
        action: creditAction === "deposit" ? 0 : 1,
        amount: parseFloat(creditAmount),
        description: creditDesc,
      });
      setCreditAmount("");
      setCreditDesc("");
      // refresh member credits + transactions
      const [mRes] = await Promise.all([
        api.get<Member>(`/members/${memberId}`),
        fetchTransactions(),
      ]);
      setMember(mRes.data as unknown as Member);
      onOpenChange();
    } catch (err: unknown) {
      setCreditError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setCreditLoading(false);
    }
  };

  const openResetPreview = async () => {
    if (!memberId) return;
    setResetError("");
    setResetPreview(null);
    resetDisc.onOpen();
    setResetPreviewLoading(true);
    try {
      const res = await api.get<CreditResetPreview>(`/quotations/credit-reset/${memberId}/preview`);
      setResetPreview(res.data as unknown as CreditResetPreview);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setResetPreviewLoading(false);
    }
  };

  const handleResetCredit = async () => {
    if (!memberId) return;
    setResetError("");
    setResetLoading(true);
    try {
      await api.post(`/quotations/credit-reset/${memberId}`, {});
      const [mRes] = await Promise.all([
        api.get<Member>(`/members/${memberId}`),
        fetchTransactions(),
      ]);
      setMember(mRes.data as unknown as Member);
      resetDisc.onClose();
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setResetLoading(false);
    }
  };

  // Apply filters client-side + compute overview totals.
  const { filteredQuotations, overview } = useMemo(() => {
    const from = qRange ? new Date(`${qRange.start.toString()}T00:00:00`) : null;
    const to = qRange ? new Date(`${qRange.end.toString()}T23:59:59`) : null;
    const term = qSearch.trim().toLowerCase();

    const list = quotations.filter((q) => {
      if (qStatus !== "all" && String(q.status) !== qStatus) return false;
      const created = new Date(q.created_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (term) {
        const name = (q.signer_name || "").toLowerCase();
        if (!q.code.toLowerCase().includes(term) && !name.includes(term)) return false;
      }
      return true;
    });

    const grams: Record<Metal, number> = { gold: 0, silver: 0, platinum: 0, palladium: 0 };
    const amounts: Record<Metal, number> = { gold: 0, silver: 0, platinum: 0, palladium: 0 };
    let total = 0;
    let creditUsed = 0;
    for (const q of list) {
      total += q.total_amount;
      if (q.status === 1) creditUsed += q.total_amount; // approved → credit deducted
      for (const it of q.items ?? []) {
        const metal = metalOf(it.type_name);
        if (metal) {
          grams[metal] += it.weight || 0;
          amounts[metal] += it.total || 0;
        }
      }
    }
    return { filteredQuotations: list, overview: { count: list.length, total, creditUsed, grams, amounts } };
  }, [quotations, qSearch, qStatus, qRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  if (!member) return null;

  // Whether this member is part of the credit system. Computed by the API from
  // the credits.use permission (walk-in customers, or roles holding credits.use).
  const memberUsesCredits = member.uses_credits ?? !member.user;

  const inputStyle =
    "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  // Number of active filters (status/date) — shown on the filter button.
  const filterCount = (qStatus !== "all" ? 1 : 0) + (qRange ? 1 : 0);

  const todayStr = today(getLocalTimeZone()).toString();
  const isTodayOnly = !!qRange && qRange.start.toString() === todayStr && qRange.end.toString() === todayStr;
  const fmtDateLabel = (d: CalendarDate) =>
    new Date(d.toString()).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  const rangeLabel = qRange
    ? (qRange.start.toString() === qRange.end.toString()
        ? (isTodayOnly ? "วันนี้" : fmtDateLabel(qRange.start))
        : `${fmtDateLabel(qRange.start)} - ${fmtDateLabel(qRange.end)}`)
    : "ทุกวันที่";

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button
          isIconOnly
          variant="light"
          onPress={() => router.back()}
          className="text-[#c09c42]"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1">
          ข้อมูลสมาชิก
        </div>
        {hasPermission("members.update") && memberId && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl font-bold shadow-md"
            startContent={<Pencil size={14} />}
            size="sm"
            onPress={() => router.push(`/members/edit?id=${memberId}`)}
          >
            <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              แก้ไข
            </span>
          </Button>
        )}
        {hasPermission("members.delete") && memberId && (
          <Button isIconOnly size="sm" variant="light" color="danger" onPress={delDisc.onOpen}>
            <Trash2 size={18} />
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-x-5 gap-y-4 overflow-y-auto md:overflow-hidden scrollbar-hide">
        {/* Left: Member Info */}
        <div className="flex flex-col gap-y-3 md:w-72 shrink-0 md:overflow-y-auto md:min-h-0 scrollbar-hide">
          <MemberCard
            id={member.id}
            code={member.code}
            image={member.image}
            fname={member.fname}
            lname={member.lname}
            phone={member.phone}
            status={member.status}
            user={member.user}
            canEdit={hasPermission("members.update")}
            onImageUpload={handleImageUpload}
          />

          {memberUsesCredits && (
            <BoxCard
              flex
              color="bg-gradient-to-tl from-transparent to-yellow-200"
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              title="เครดิตคงเหลือ"
              unit="บาท"
              icon={<Coins size={36} className="text-yellow-600" />}
              value={member.credits.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
          )}

          {/* Overview — quotation summary (reflects the current filters) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-black/50 pl-1">สรุปใบเสนอราคา</span>
            <StatCard title="ยอดรวม" value={fmtMoney(overview.total)} unit="บาท" highlight />
            <div className="grid grid-cols-2 gap-2">
              <StatCard title="จำนวนใบ" value={overview.count.toLocaleString()} unit="ใบ" />
              <StatCard title="ใช้เครดิตไป" value={fmtMoney(overview.creditUsed)} unit="บาท" />
              <StatCard title="ทอง" value={fmtGram(overview.grams.gold)} unit="กรัม" sub={`${fmtMoney(overview.amounts.gold)} บาท`} />
              <StatCard title="เงิน" value={fmtGram(overview.grams.silver)} unit="กรัม" sub={`${fmtMoney(overview.amounts.silver)} บาท`} />
              <StatCard title="แพลทินัม" value={fmtGram(overview.grams.platinum)} unit="กรัม" sub={`${fmtMoney(overview.amounts.platinum)} บาท`} />
              <StatCard title="แพลเลเดียม" value={fmtGram(overview.grams.palladium)} unit="กรัม" sub={`${fmtMoney(overview.amounts.palladium)} บาท`} />
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="flex flex-col w-full gap-y-2 md:flex-1 md:min-h-0">
          <div className="flex items-center justify-between gap-2">
            <Tabs
              aria-label="member tabs"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k as string)}
              classNames={{ tabList: "bg-black/5 border-1 border-black/10" }}
            >
              <Tab key="quote" title="ใบเสนอราคา" />
              {memberUsesCredits && <Tab key="credit" title="ประวัติเครดิต" />}
            </Tabs>
            {hasPermission("credits.update") && memberUsesCredits && member.user && (
              <Button
                variant="flat"
                className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-xl font-bold shrink-0"
                startContent={<RotateCcw size={15} />}
                size="sm"
                onPress={openResetPreview}
              >
                รีเซ็ตเครดิต
              </Button>
            )}
          </div>

          {tab === "quote" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 gap-2">
                {/* Search + filter dropdown */}
                <div className="flex flex-row gap-2">
                  <Input
                    size="sm"
                    placeholder="ค้นหาเลขที่ / ชื่อลูกค้า"
                    value={qSearch}
                    onValueChange={setQSearch}
                    classNames={{ inputWrapper: inputStyle, base: "flex-1" }}
                  />
                  <Popover placement="bottom-end">
                    <PopoverTrigger>
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Filter size={15} />}
                        className={`shrink-0 border-1 border-black/10 ${filterCount > 0 ? "bg-yellow-200/60" : "bg-black/5"}`}
                      >
                        ตัวกรอง{filterCount > 0 ? ` (${filterCount})` : ""}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3">
                      <div className="flex flex-col gap-2 w-full">
                        <Select
                          size="sm"
                          label="สถานะ"
                          selectedKeys={[qStatus]}
                          onChange={(e) => setQStatus(e.target.value || "all")}
                          classNames={{ trigger: inputStyle }}
                        >
                          <SelectItem key="all">ทุกสถานะ</SelectItem>
                          <SelectItem key="0">รอการอนุมัติ</SelectItem>
                          <SelectItem key="1">อนุมัติแล้ว</SelectItem>
                          <SelectItem key="2">ยกเลิก</SelectItem>
                        </Select>
                        <DateRangePicker
                          size="sm"
                          label="ช่วงวันที่"
                          labelPlacement="outside"
                          value={qRange}
                          onChange={setQRange}
                          classNames={{ inputWrapper: inputStyle }}
                        />
                        {filterCount > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-black/40">กำลังกรอง: {rangeLabel}</span>
                            <Button
                              size="sm" variant="light" color="danger"
                              onPress={() => { setQStatus("all"); setQRange(null); }}
                            >
                              ล้างตัวกรอง
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

              {/* Table */}
              <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl p-2 shadow-xl md:overflow-hidden">
                <Table
                  isHeaderSticky
                  radius="sm"
                  removeWrapper
                  classNames={{ base: "flex flex-col md:h-full overflow-x-auto md:overflow-y-auto scrollbar-hide", table: "min-w-[560px]" }}
                >
                  <TableHeader>
                    <TableColumn>เลขที่</TableColumn>
                    <TableColumn>ชื่อลูกค้า</TableColumn>
                    <TableColumn>ยอดรวม</TableColumn>
                    <TableColumn>สถานะ</TableColumn>
                    <TableColumn>วันที่/เวลา</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={isTodayOnly ? "ไม่มีรายการในวันนี้ กดปุ่ม ตัวกรอง เพื่อดูวันอื่น" : "ไม่พบใบเสนอราคา"}>
                    {filteredQuotations.map((q) => (
                      <TableRow key={q.id} className="hover:bg-white/50 cursor-pointer">
                        <TableCell>{q.code}</TableCell>
                        <TableCell>
                          {q.signer_name ? (
                            <span
                              className="block max-w-[160px] truncate"
                              title={q.signer_name}
                            >
                              {q.signer_name}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-[#c09c42]">
                            {q.total_amount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={quotationStatusColor[String(q.status)] || "default"}
                            size="sm"
                            variant="dot"
                          >
                            {quotationStatusMap[String(q.status)] || String(q.status)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          {new Date(q.created_at).toLocaleString("th-TH", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl p-2 shadow-xl md:overflow-hidden">
              <div className="flex justify-end gap-2 mb-2">
                {hasPermission("credits.update") && memberUsesCredits && (
                  <Button
                    className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-xl font-bold shadow-md"
                    startContent={<Plus size={15} />}
                    size="sm"
                    onPress={onOpen}
                  >
                    <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      จัดการเครดิต
                    </span>
                  </Button>
                )}
              </div>
              <Table
                isHeaderSticky
                radius="sm"
                removeWrapper
                classNames={{
                  base: "flex flex-col h-full overflow-y-auto scrollbar-hide",
                }}
              >
                <TableHeader>
                  <TableColumn>วันที่</TableColumn>
                  <TableColumn>ประเภท</TableColumn>
                  <TableColumn>จำนวน</TableColumn>
                  <TableColumn>คงเหลือ</TableColumn>
                  <TableColumn>หมายเหตุ</TableColumn>
                </TableHeader>
                <TableBody emptyContent="ยังไม่มีรายการ">
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {new Date(tx.created_at).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={tx.action === 0 ? "success" : "danger"}
                          size="sm"
                          variant="flat"
                        >
                          {tx.action === 0 ? "เพิ่มเครดิต" : "หักเครดิต"}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            tx.action === 0
                              ? "text-green-600 font-bold"
                              : "text-red-500 font-bold"
                          }
                        >
                          {tx.action === 0 ? "+" : "-"}
                          {tx.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>{tx.balance.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="text-xs text-black/50">{tx.description}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Credit Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent font-bold">
                  จัดการเครดิต
                </span>
              </ModalHeader>
              <ModalBody>
                <Tabs
                  selectedKey={creditAction}
                  onSelectionChange={(k) => {
                    setCreditAction(k as "deposit" | "withdraw");
                    setCreditError("");
                  }}
                  classNames={{ tabList: "bg-black/5 border-1 border-black/10" }}
                >
                  <Tab key="deposit" title="เพิ่มเครดิต" />
                  <Tab key="withdraw" title="หักเครดิต" />
                </Tabs>
                <Input
                  label="จำนวน (บาท)"
                  placeholder="0"
                  type="number"
                  min="0"
                  value={creditAmount}
                  onValueChange={setCreditAmount}
                  classNames={{ inputWrapper: inputStyle }}
                />
                <Input
                  label="หมายเหตุ"
                  placeholder="ระบุเหตุผล (ไม่บังคับ)"
                  value={creditDesc}
                  onValueChange={setCreditDesc}
                  classNames={{ inputWrapper: inputStyle }}
                />
                {creditError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    {creditError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  color="danger"
                  onPress={onClose}
                  isDisabled={creditLoading}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={handleAddCredit}
                  isLoading={creditLoading}
                >
                  บันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Reset Credit Modal — bulk-refunds approved-but-not-yet-refunded quotations */}
      <Modal isOpen={resetDisc.isOpen} onOpenChange={resetDisc.onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent font-bold">
                  รีเซ็ตเครดิต
                </span>
              </ModalHeader>
              <ModalBody>
                {resetPreviewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="md" color="warning" />
                  </div>
                ) : resetPreview && resetPreview.count > 0 ? (
                  <div className="flex flex-col gap-y-3">
                    <p className="text-sm text-black/60">
                      คืนเครดิตเท่ากับยอดใบเสนอราคาที่อนุมัติแล้วแต่ยังไม่เคยคืนเครดิต ทั้งหมด {resetPreview.count} ใบ
                    </p>
                    <div className="flex flex-col border-1 border-amber-200 bg-amber-50 rounded-2xl p-3 gap-y-1">
                      <span className="text-xs text-black/50">ยอดที่จะได้คืน</span>
                      <span className="font-bold text-xl text-green-600">
                        +{resetPreview.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="flex flex-col gap-y-1 max-h-48 overflow-y-auto border-1 border-black/10 rounded-2xl p-2">
                      {resetPreview.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs px-2 py-1">
                          <span className="text-black/60">{it.code}</span>
                          <span className="font-bold text-black/70">
                            {it.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-black/40 text-center py-4">ไม่มีรายการที่ต้องคืนเครดิต</p>
                )}
                {resetError && (
                  <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    {resetError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={resetLoading}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                  onPress={handleResetCredit}
                  isLoading={resetLoading}
                  isDisabled={resetPreviewLoading || !resetPreview || resetPreview.count === 0}
                >
                  ยืนยันรีเซ็ตเครดิต
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDeleteMember}
        name={member ? `${member.fname} ${member.lname}`.trim() : undefined}
        related="ประวัติใบเสนอราคา/เครดิตจะยังคงอยู่ในระบบ"
        loading={deleting}
      />
    </div>
  );
};
