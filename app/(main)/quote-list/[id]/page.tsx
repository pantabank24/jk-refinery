"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Pencil, Calendar } from "lucide-react";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Tabs, Tab } from "@heroui/tabs";
import { GoldType } from "@/lib/gold-calc";
import { QuotationData, MemberOption, quotationDisplayCode } from "../_component/types";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  sumQuotations,
} from "../_component/constants";
import { QuoteOverview } from "../_component/quoteOverview";
import { QuotationDetailPanel } from "../_component/quotationDetailPanel";

export default function EmployeeQuoteListPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const { selectedStore, selectedBranch } = useStore();
  const { hasPermission, isMaster, loading: authLoading } = useAuth();
  const canRead = hasPermission("quotations.read");
  const canUpdate = hasPermission("quotations.update");
  const canDelete = hasPermission("quotations.delete");

  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(moment().format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [editingDate, setEditingDate] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Desktop shows the preview inline (split pane); mobile opens it in a modal.
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/quotations?limit=300&created_by=${employeeId}`;
      if (selectedStore) url += `&store_id=${selectedStore.id}`;
      if (selectedBranch) url += `&branch_id=${selectedBranch.id}`;
      const res = await api.get<QuotationData[]>(url);
      setQuotations((res.data as unknown as QuotationData[]) || []);
    } catch {
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedStore, selectedBranch]);

  useEffect(() => {
    if (!authLoading && !canRead) {
      router.replace("/");
    }
  }, [authLoading, canRead, router]);

  useEffect(() => {
    if (canRead) fetchQuotations();
  }, [fetchQuotations, canRead]);

  useEffect(() => {
    if (!canRead) return;
    api
      .get<MemberOption[]>("/members?limit=200")
      .then((r) => setMembers((r.data as unknown as MemberOption[]) || []))
      .catch(() => {});
    api
      .get<GoldType[]>("/gold-types")
      .then((r) => setGoldTypes((r.data as unknown as GoldType[]) || []))
      .catch(() => {});
  }, [canRead]);

  const statusFilter: Record<string, number | undefined> = {
    all: undefined,
    pending: 0,
    approved: 1,
    rejected: 2,
  };

  // List shows ALL days — only status tab + search apply here (date range does NOT).
  const listFiltered = useMemo(() => {
    const s = statusFilter[activeTab];
    const q = search.trim().toLowerCase();
    return quotations.filter((item) => {
      if (s !== undefined && item.status !== s) return false;
      if (q && !quotationDisplayCode(item).toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotations, activeTab, search]);

  // Overview summarizes only the selected date range (applied on top of the list set).
  const overviewFiltered = useMemo(() => {
    const from = dateFrom
      ? moment(dateFrom, "YYYY-MM-DD").startOf("day")
      : null;
    const to = dateTo ? moment(dateTo, "YYYY-MM-DD").endOf("day") : null;
    return listFiltered.filter((item) => {
      const d = moment(item.created_at);
      if (from && d.isBefore(from)) return false;
      if (to && d.isAfter(to)) return false;
      return true;
    });
  }, [listFiltered, dateFrom, dateTo]);

  const overviewLabel = useMemo(() => {
    const f = dateFrom
      ? moment(dateFrom, "YYYY-MM-DD").format("DD/MM/YYYY")
      : "";
    const t = dateTo ? moment(dateTo, "YYYY-MM-DD").format("DD/MM/YYYY") : "";
    if (!f && !t) return "สรุปทุกวัน";
    if (f && t && f === t) return `สรุปเฉพาะวันที่ ${f}`;
    if (f && t) return `สรุปวันที่ ${f} - ${t}`;
    return f ? `สรุปตั้งแต่ ${f}` : `สรุปถึง ${t}`;
  }, [dateFrom, dateTo]);

  const employeeName = quotations[0]?.creator?.name ?? "พนักงาน";
  const totals = useMemo(
    () => sumQuotations(overviewFiltered, goldTypes),
    [overviewFiltered, goldTypes],
  );

  // Keep the selection valid as filters change; default to the first result.
  useEffect(() => {
    if (listFiltered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!listFiltered.some((q) => q.id === selectedId))
      setSelectedId(listFiltered[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFiltered]);

  const [selectedQ, setSelectedQ] = useState<QuotationData | null>(null);
  useEffect(() => {
    const base = listFiltered.find((q) => q.id === selectedId) ?? null;
    if (!base) {
      setSelectedQ(null);
      return;
    }
    api
      .get<QuotationData>(`/quotations/${base.id}`)
      .then((r) => setSelectedQ(r.data as unknown as QuotationData))
      .catch(() => setSelectedQ(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectItem = (id: number) => {
    setSelectedId(id);
    // On mobile the preview pane is hidden, so pop it in a modal instead.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setDetailOpen(true);
    }
  };

  const renderDetail = (fillHeight: boolean) => (
    <QuotationDetailPanel
      quotation={selectedQ}
      members={members}
      goldTypes={goldTypes}
      canUpdate={canUpdate}
      isMaster={isMaster}
      canDelete={canDelete}
      emptyHint="ยังไม่มีใบเสนอราคาที่ตรงกับตัวกรอง"
      fillHeight={fillHeight}
      onChanged={(updated) => {
        setSelectedQ(updated);
        fetchQuotations();
      }}
      onDeleted={() => {
        setSelectedQ(null);
        setDetailOpen(false);
        fetchQuotations();
      }}
    />
  );

  if (!authLoading && !canRead) return null;

  // Tabs render 2 จุด (มือถือ = ตรึงใต้ filter / desktop = หลัง Overview) คุมด้วย activeTab ตัวเดียว
  const tabsEl = (
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
  );

  return (
    <div className="flex flex-col md:h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center gap-x-2 shrink-0 px-1">
        <Button
          isIconOnly
          variant="light"
          onPress={() => router.push("/quote-list")}
          className="text-[#c09c42] shrink-0"
        >
          <ArrowLeft size={20} />
        </Button>
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate min-w-0">
          {employeeName}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0">
        <div className="flex-1 [&_[data-slot=input-wrapper]]:h-12 [&_[data-slot=input-wrapper]]:min-h-12">
          <CmpInput
            placeholder="ค้นหาเลขที่"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
          />
        </div>
        {editingDate ? (
          <div className="flex items-center gap-x-2">
            <Input
              type="date"
              label="จากวันที่"
              labelPlacement="inside"
              value={dateFrom}
              onValueChange={setDateFrom}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />
            <Input
              type="date"
              label="ถึงวันที่"
              labelPlacement="inside"
              value={dateTo}
              onValueChange={setDateTo}
              classNames={{
                inputWrapper:
                  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
              }}
            />
            {(dateFrom || dateTo) && (
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                ล้างวันที่
              </Button>
            )}
            <Button
              size="sm"
              color="warning"
              variant="flat"
              onPress={() => setEditingDate(false)}
            >
              เสร็จ
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-x-2 bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl px-3 py-2">
            <Calendar size={15} className="text-[#c09c42] shrink-0" />
            <span className="text-sm font-bold text-black/70 whitespace-nowrap">
              {dateFrom || dateTo
                ? `${dateFrom ? moment(dateFrom).format("DD/MM/YY") : "…"} - ${dateTo ? moment(dateTo).format("DD/MM/YY") : "…"}`
                : "ทุกวันที่"}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="text-[#c09c42]"
              onPress={() => setEditingDate(true)}
            >
              <Pencil size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Tabs (มือถือ) — ตรึงใต้ Filter */}
      <div className="shrink-0 md:hidden">{tabsEl}</div>

      {/* Scroll region — Overview ลงไป (Header + ค้นหา + Filter ตรึงไว้ด้านบน) */}
      <div className="md:flex-1 md:min-h-0 flex flex-col gap-y-3 md:overflow-hidden">
      <div className="shrink-0 flex flex-col gap-y-1">
        {/*<span className="text-xs font-bold text-[#c09c42] px-1">📊 {overviewLabel}</span>*/}
        <QuoteOverview totals={totals} />
      </div>

      {/* Tabs (desktop) — อยู่หลัง Overview เหมือนเดิม */}
      <div className="hidden md:block shrink-0">{tabsEl}</div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size="lg" color="warning" />
        </div>
      ) : (
        <div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3">
          {/* Preview — inline split pane on desktop; mobile uses the modal below */}
          <div className="hidden md:flex flex-col flex-1 md:w-2/3 min-h-0 overflow-y-auto scrollbar-hide border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3">
            {renderDetail(false)}
          </div>

          {/* List — full width on mobile (scrolls with page), right column on desktop */}
          <div className="flex flex-col md:w-1/3 md:min-h-0 md:overflow-y-auto scrollbar-hide gap-y-2 pb-4">
            <div className="flex items-center justify-between px-1 shrink-0">
              {/* <span className="text-xs font-bold text-black/50">
                รายการทั้งหมด (ทุกวัน)
              </span> */}
              {/* <span className="text-xs text-black/40">
                {listFiltered.length} รายการ
              </span> */}
            </div>
            {listFiltered.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                ยังไม่มีใบเสนอราคา
              </div>
            ) : (
              listFiltered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  className={`flex flex-col border-1 rounded-2xl p-3 cursor-pointer hover:shadow-md transition-all gap-y-2 ${item.id === selectedId ? "border-[#c09c42] bg-yellow-500/10" : "border-black/10 bg-black/5"}`}
                >
                  <div className="flex flex-row items-center justify-between">
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {quotationDisplayCode(item)}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <div className="flex flex-row items-center justify-between">
                    <span className="text-sm font-bold text-black/70">
                      {item.member
                        ? `${item.member.fname} ${item.member.lname}`
                        : "ไม่ระบุสมาชิก"}
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm text-yellow-700">
                        {item.total_amount.toLocaleString()} บาท
                      </span>
                      <span className="text-[10px] text-black/40">
                        {moment(item.created_at).format("DD/MM/YY HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>

      {/* Mobile: preview in a full-screen modal (desktop uses the split pane) */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="full"
        scrollBehavior="inside"
        classNames={{ wrapper: "md:hidden", backdrop: "md:hidden" }}
      >
        <ModalContent>
          <ModalBody className="px-2 py-4 flex flex-col overflow-hidden">{renderDetail(true)}</ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
