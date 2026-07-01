'use client'

import { useEffect, useMemo, useState, useCallback } from "react";
import { Avatar } from "@heroui/avatar";
import { Download, Users, List as ListIcon } from "lucide-react";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { GoldType } from "@/lib/gold-calc";
import { QuotationData } from "./_component/types";
import { STATUS_LABEL, STATUS_COLOR, METAL_LABEL, sumQuotations, QuoteTotals } from "./_component/constants";
import { QuoteOverview } from "./_component/quoteOverview";
import { QuotationDetailPanel } from "./_component/quotationDetailPanel";

interface MemberOption {
  id: number;
  fname: string;
  lname: string;
  code: string;
}

interface EmployeeGroup {
  id: string;
  name: string;
  count: number;
  totals: QuoteTotals;
}

type EmployeeColKey = "name" | "count" | "weight" | "gold" | "silver" | "platinum" | "palladium" | "amount";

const EMPLOYEE_COLUMNS: { key: EmployeeColKey; label: string }[] = [
  { key: "name", label: "พนักงาน" },
  { key: "count", label: "จำนวนใบ" },
  { key: "weight", label: "น้ำหนักรวม (ก.)" },
  { key: "gold", label: METAL_LABEL.gold },
  { key: "silver", label: METAL_LABEL.silver },
  { key: "platinum", label: METAL_LABEL.platinum },
  { key: "palladium", label: METAL_LABEL.palladium },
  { key: "amount", label: "ยอดรวม" },
];

function renderEmployeeCell(g: EmployeeGroup, key: EmployeeColKey) {
  switch (key) {
    case "name": return <span className="font-bold">{g.name}</span>;
    case "count": return g.count;
    case "weight": return g.totals.weight.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case "gold": return g.totals.byMetal.gold.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case "silver": return g.totals.byMetal.silver.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case "platinum": return g.totals.byMetal.platinum.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case "palladium": return g.totals.byMetal.palladium.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case "amount": return <span className="font-bold text-yellow-700">{g.totals.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>;
  }
}

export default function QuoteList() {
  const router = useRouter();
  const { selectedStore, selectedBranch } = useStore();
  const { hasPermission, isMaster, loading: authLoading } = useAuth();
  const canRead = hasPermission("quotations.read");
  const canUpdate = hasPermission("quotations.update");
  const canDelete = hasPermission("quotations.delete");

  const [view, setView] = useState<"employee" | "list">("employee");
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  // Gold types are needed to recompute per-gram/total on edit, and to map an
  // item's type_id to its metal category (gold/silver/platinum/palladium).
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);

  // ── Detail modal (list view only — employee view drills into a new page) ──
  const [detailQ, setDetailQ] = useState<QuotationData | null>(null);

  const statusFilter: Record<string, number | undefined> = {
    all: undefined, pending: 0, approved: 1, rejected: 2,
  };

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/quotations?limit=300";
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

  useEffect(() => {
    if (!authLoading && !canRead) {
      router.replace("/");
    }
  }, [authLoading, canRead, router]);

  useEffect(() => { if (canRead) fetchQuotations(); }, [fetchQuotations, canRead]);

  useEffect(() => {
    if (!canRead) return;
    api.get<MemberOption[]>("/members?limit=200")
      .then((r) => setMembers((r.data as unknown as MemberOption[]) || []))
      .catch(() => {});
    api.get<GoldType[]>("/gold-types")
      .then((r) => setGoldTypes((r.data as unknown as GoldType[]) || []))
      .catch(() => {});
  }, [canRead]);

  // Date range is not supported server-side, so it's applied on the already
  // fetched (store/branch/status/search-filtered) set.
  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return quotations;
    const from = dateFrom ? moment(dateFrom, "YYYY-MM-DD").startOf("day") : null;
    const to = dateTo ? moment(dateTo, "YYYY-MM-DD").endOf("day") : null;
    return quotations.filter((q) => {
      const d = moment(q.created_at);
      if (from && d.isBefore(from)) return false;
      if (to && d.isAfter(to)) return false;
      return true;
    });
  }, [quotations, dateFrom, dateTo]);

  const overviewTotals = useMemo(() => sumQuotations(filtered, goldTypes), [filtered, goldTypes]);

  const employeeGroups = useMemo(() => {
    const map = new Map<string, QuotationData[]>();
    for (const q of filtered) {
      const key = q.creator ? String(q.creator.id) : "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return Array.from(map.entries())
      .map(([id, qs]) => ({
        id,
        name: qs[0].creator?.name ?? "ไม่ระบุพนักงาน",
        count: qs.length,
        totals: sumQuotations(qs, goldTypes),
      }))
      .sort((a, b) => b.totals.amount - a.totals.amount);
  }, [filtered, goldTypes]);

  // ── Open detail (list view) ──
  const openDetail = async (q: QuotationData) => {
    try {
      const res = await api.get<QuotationData>(`/quotations/${q.id}`);
      setDetailQ((res.data as unknown as QuotationData));
    } catch {
      setDetailQ(q);
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

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          รายการใบเสนอราคา
        </span>
        <div className="flex border-1 border-black/10 rounded-full p-0.5 bg-black/5">
          <button
            onClick={() => setView("employee")}
            className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${view === "employee" ? "bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white" : "text-black/50"}`}
          >
            <Users size={13} /> มุมมองพนักงาน
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${view === "list" ? "bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white" : "text-black/50"}`}
          >
            <ListIcon size={13} /> มุมมองรายการ
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0">
        <div className="flex-1">
          <CmpInput placeholder="ค้นหาเลขที่" value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-x-2">
          <Input type="date" label="จากวันที่" labelPlacement="inside" value={dateFrom}
            onValueChange={setDateFrom}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <Input type="date" label="ถึงวันที่" labelPlacement="inside" value={dateTo}
            onValueChange={setDateTo}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          {(dateFrom || dateTo) && (
            <Button size="sm" variant="light" onPress={() => { setDateFrom(""); setDateTo(""); }}>ล้างวันที่</Button>
          )}
        </div>
      </div>

      {/* Overview */}
      <QuoteOverview totals={overviewTotals} />

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีใบเสนอราคา</div>
        ) : view === "employee" ? (
          <Table
            isHeaderSticky
            radius="sm"
            removeWrapper
            classNames={{
              base: "flex flex-col flex-1 min-h-0 overflow-y-scroll scrollbar-hide border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
            }}
          >
            <TableHeader columns={EMPLOYEE_COLUMNS}>
              {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
            </TableHeader>
            <TableBody items={employeeGroups} emptyContent="ไม่พบข้อมูล">
              {(g) => (
                <TableRow
                  key={g.id}
                  className={g.id !== "none" ? "hover:bg-white rounded-2xl cursor-pointer" : "opacity-60"}
                  onClick={() => { if (g.id !== "none") router.push(`/quote-list/${g.id}`); }}
                >
                  {(columnKey) => <TableCell>{renderEmployeeCell(g, columnKey as EmployeeColKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {filtered.map((item) => (
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
                    <Avatar name={item.member ? `${item.member.fname} ${item.member.lname}` : "ไม่ระบุ"} size="sm" />
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

      {/* Detail modal — list view only */}
      <Modal isOpen={!!detailQ} onClose={() => setDetailQ(null)} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalBody className="px-2 py-4">
            <QuotationDetailPanel
              quotation={detailQ}
              members={members}
              goldTypes={goldTypes}
              canUpdate={canUpdate}
              isMaster={isMaster}
              canDelete={canDelete}
              onChanged={(updated) => { setDetailQ(updated); fetchQuotations(); }}
              onDeleted={() => { setDetailQ(null); fetchQuotations(); }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
