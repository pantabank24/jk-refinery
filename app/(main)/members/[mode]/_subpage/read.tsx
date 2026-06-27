"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Tabs, Tab,
} from "@heroui/react";
import { ArrowLeft, Coins, Pencil, Plus } from "lucide-react";
import { BoxCard } from "@/components/boxcard";
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

interface Quotation {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  created_at: string;
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

  // Credit modal
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [creditAction, setCreditAction] = useState<"deposit" | "withdraw">("deposit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState("");

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
      const res = await api.get<Quotation[]>(`/quotations?created_by=${userAccountId}&limit=50`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  if (!member) return null;

  // Members without a user account, or with employee role, are subject to credit management.
  // Owner / branch / master bypass credits on quotations so shouldn't have credits managed.
  const memberUsesCredits = !member.user || member.user?.role?.name === "employee";

  const inputStyle =
    "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

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
      </div>

      <div className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-x-5 gap-y-4">
        {/* Left: Member Info */}
        <div className="flex flex-col gap-y-3 md:w-72 shrink-0">
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
        </div>

        {/* Right: Tabs */}
        <div className="flex flex-col w-full gap-y-2 flex-1 min-h-0">
          <Tabs
            aria-label="member tabs"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as string)}
            classNames={{ tabList: "bg-black/5 border-1 border-black/10" }}
          >
            <Tab key="quote" title="ใบเสนอราคา" />
            {memberUsesCredits && <Tab key="credit" title="ประวัติเครดิต" />}
          </Tabs>

          {tab === "quote" ? (
            <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl p-2 shadow-xl overflow-hidden">
              <Table
                isHeaderSticky
                radius="sm"
                removeWrapper
                classNames={{
                  base: "flex flex-col h-full overflow-y-auto scrollbar-hide",
                }}
              >
                <TableHeader>
                  <TableColumn>เลขที่</TableColumn>
                  <TableColumn>ยอดรวม</TableColumn>
                  <TableColumn>สถานะ</TableColumn>
                  <TableColumn>วันที่</TableColumn>
                </TableHeader>
                <TableBody emptyContent="ยังไม่มีใบเสนอราคา">
                  {quotations.map((q) => (
                    <TableRow key={q.id} className="hover:bg-white/50 cursor-pointer">
                      <TableCell>{q.code}</TableCell>
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
                        {new Date(q.created_at).toLocaleDateString("th-TH")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl p-2 shadow-xl overflow-hidden">
              <div className="flex justify-end mb-2">
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
    </div>
  );
};
