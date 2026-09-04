"use client";

import { SkeletonBlock, SkeletonLines, SkeletonList, SkeletonPage, SkeletonStats } from "@/components/skeleton";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import moment from "moment";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  RotateCcw,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { StoreBranchSelector } from "@/components/store-branch-selector";
import { GoldType } from "@/lib/gold-calc";
import { ColumnChart } from "./_component/columnChart";
import { BreakdownBars } from "./_component/breakdownBars";
import { CountUp, ReportMotionStyles, riseIn, useReducedMotion } from "./_component/motion";
import {
  METALS,
  METAL_LABEL,
  SERIES_AMOUNT,
  SERIES_WEIGHT,
  grams,
  isMetal,
  money,
  money2,
  type Metal,
  type SalesReport,
  type SalesRow,
} from "./_component/types";

const PAGE_SIZE = 25;

// HeroUI's default "flat" input paints bg-default-100 — a light grey that sits
// almost exactly on this card's bg-black/5 tint, so the fields dissolved into the
// panel. A white surface with a real border makes each control read as something
// you can type in.
const FIELD = {
  inputWrapper:
    "bg-white/80 border-1 border-black/10 rounded-xl shadow-none data-[hover=true]:bg-white group-data-[focus=true]:border-[#c09c42]/60",
};
const SELECT_FIELD = {
  trigger:
    "bg-white/80 border-1 border-black/10 rounded-xl shadow-none data-[hover=true]:bg-white data-[focus=true]:border-[#c09c42]/60",
};

interface UserOption {
  id: number;
  name: string;
  role?: { name: string } | null;
}

// Date presets — the four ranges a shop actually asks for. Anything else is the
// two date inputs beside them.
const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "today", label: "วันนี้", range: () => [d(moment()), d(moment())] },
  { key: "7d", label: "7 วัน", range: () => [d(moment().subtract(6, "days")), d(moment())] },
  {
    key: "month",
    label: "เดือนนี้",
    range: () => [d(moment().startOf("month")), d(moment())],
  },
  {
    key: "lastMonth",
    label: "เดือนที่แล้ว",
    range: () => [
      d(moment().subtract(1, "month").startOf("month")),
      d(moment().subtract(1, "month").endOf("month")),
    ],
  },
];

function d(m: moment.Moment) {
  return m.format("YYYY-MM-DD");
}

function SalesReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, loading: authLoading, isMaster, isOwner } = useAuth();
  const { selectedStore, selectedBranch } = useStore();
  const canRead = hasPermission("quotations.read");
  // The employee filter needs the staff list, which is owner/master only. An
  // employee's report is locked to their own documents server-side anyway, so
  // there is nothing for them to choose between.
  const canPickEmployee = hasPermission("users.read");
  const canSelectStoreBranch = isMaster || isOwner;

  const metalParam = searchParams.get("metal") ?? "gold";
  const metal: Metal = isMetal(metalParam) ? metalParam : "gold";

  const [dateFrom, setDateFrom] = useState(() => d(moment().startOf("month")));
  const [dateTo, setDateTo] = useState(() => d(moment()));
  const [preset, setPreset] = useState("month");
  const [createdBy, setCreatedBy] = useState("");
  const [typeId, setTypeId] = useState("");
  const [customer, setCustomer] = useState("");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<"day" | "month">("day");
  // Collapsed on open: the charts are what the page is for, and the presets plus
  // the range summary in the header cover the common case without expanding.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const reduced = useReducedMotion();

  const [report, setReport] = useState<SalesReport | null>(null);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(true);
  // Only the very first load gets a spinner. Every later refetch dims what is
  // already on screen instead of tearing it down — a skeleton on each keystroke
  // in the search box makes the page jump under the reader.
  const [everLoaded, setEverLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  // One query string for the report, its rows and its export — they must never
  // be able to describe different sets.
  const query = useMemo(() => {
    const p = new URLSearchParams({ metal, bucket });
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (createdBy) p.set("created_by", createdBy);
    if (typeId) p.set("type_id", typeId);
    if (customer) p.set("customer", customer);
    if (search) p.set("search", search);
    if (selectedStore) p.set("store_id", String(selectedStore.id));
    if (selectedBranch) p.set("branch_id", String(selectedBranch.id));
    return p.toString();
  }, [
    metal, bucket, dateFrom, dateTo, createdBy, typeId, customer, search,
    selectedStore, selectedBranch,
  ]);

  useEffect(() => {
    if (!canRead) return;
    setLoading(true);
    api
      .get<SalesReport>(`/reports/sales?${query}`)
      .then((r) => setReport((r.data as unknown as SalesReport) || null))
      .catch(() => setReport(null))
      .finally(() => {
        setLoading(false);
        setEverLoaded(true);
      });
  }, [canRead, query]);

  // Any filter change starts from page 1 — page 4 of the old set is rarely a
  // page of the new one.
  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!canRead) return;
    setRowsLoading(true);
    api
      .get<SalesRow[]>(`/reports/sales/rows?${query}&page=${page}&limit=${PAGE_SIZE}`)
      .then((r) => {
        setRows((r.data as unknown as SalesRow[]) || []);
        setTotalPages((r as { total_pages?: number }).total_pages || 1);
        setTotalRows((r as { total_rows?: number }).total_rows || 0);
      })
      .catch(() => {
        setRows([]);
        setTotalPages(1);
        setTotalRows(0);
      })
      .finally(() => setRowsLoading(false));
  }, [canRead, query, page]);

  useEffect(() => {
    if (!canRead) return;
    api
      .get<GoldType[]>("/gold-types")
      .then((r) => setGoldTypes((r.data as unknown as GoldType[]) || []))
      .catch(() => {});
  }, [canRead]);

  useEffect(() => {
    if (!canPickEmployee) return;
    api
      .get<UserOption[]>("/users?limit=200")
      .then((r) => setUsers((r.data as unknown as UserOption[]) || []))
      .catch(() => {});
  }, [canPickEmployee]);

  const applyPreset = (key: string) => {
    const found = PRESETS.find((p) => p.key === key);
    if (!found) return;
    const [from, to] = found.range();
    setPreset(key);
    setDateFrom(from);
    setDateTo(to);
  };

  // How many filters are narrowing the report beyond the plain date range —
  // shown on the collapsed header so a forgotten filter can never quietly
  // explain a number that looks wrong.
  const activeCount =
    (createdBy ? 1 : 0) + (typeId ? 1 : 0) + (customer ? 1 : 0) + (search ? 1 : 0);

  const resetFilters = () => {
    applyPreset("month");
    setCreatedBy("");
    setTypeId("");
    setCustomer("");
    setSearch("");
    setBucket("day");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("jk_token");
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
      const resp = await fetch(`${base}/reports/sales/export?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `รายงานยอดขาย${METAL_LABEL[metal]}_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      /* the button simply does nothing rather than breaking the page */
    } finally {
      setExporting(false);
    }
  };

  // Gold types of THIS metal only — the ทอง report has no business offering เงิน
  // 99.9 as a filter.
  const typeOptions = goldTypes.filter((t) => (t.metal || "gold") === metal);

  // The API returns only buckets that had sales. Plotting those alone puts 31/08
  // right beside 02/09 as if they were consecutive, which reads as unbroken
  // trade — so the quiet days are filled back in at zero and the x-axis becomes
  // a real calendar again.
  const series = useMemo(() => {
    const found = new Map((report?.series ?? []).map((p) => [p.bucket, p]));
    if (!dateFrom || !dateTo) return report?.series ?? [];
    const step = bucket === "month" ? "month" : "day";
    const fmt = bucket === "month" ? "YYYY-MM" : "YYYY-MM-DD";
    const start = moment(dateFrom, "YYYY-MM-DD").startOf(step);
    const end = moment(dateTo, "YYYY-MM-DD").startOf(step);
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return report?.series ?? [];
    }
    // A very long range would put more bars on screen than there are pixels;
    // past that, only the buckets that actually traded are worth drawing.
    if (end.diff(start, step) > 400) return report?.series ?? [];
    const out = [];
    for (const cur = start.clone(); !cur.isAfter(end); cur.add(1, step)) {
      const key = cur.format(fmt);
      out.push(found.get(key) ?? { bucket: key, amount: 0, weight: 0, docs: 0 });
    }
    return out;
  }, [report, dateFrom, dateTo, bucket]);

  const labelOf = (b: string) =>
    bucket === "month" ? moment(b, "YYYY-MM").format("MM/YY") : moment(b).format("DD/MM");
  const amountData = series.map((p) => ({ label: labelOf(p.bucket), value: p.amount }));
  const weightData = series.map((p) => ({ label: labelOf(p.bucket), value: p.weight }));

  const overview = report?.overview;

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col gap-y-3 pb-6">
      <ReportMotionStyles />
      <div className="flex flex-row items-center justify-between gap-x-3 pt-5">
        <div className="flex min-w-0 flex-col">
          <span className="truncate bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text pl-2 text-2xl font-bold text-transparent">
            รายงานยอดขาย
          </span>
          <span className="pl-2 text-xs text-black/40">
            นับเฉพาะเอกสารที่ปิดจบแล้ว — บิลลูกค้าที่เคลียร์แล้ว และใบเดินเข้าที่ออกแล้ว
          </span>
        </div>
        <Button
          size="sm"
          isLoading={exporting}
          startContent={!exporting && <Download size={15} />}
          onPress={handleExport}
          className="shrink-0 border-1 border-black/10 bg-gradient-to-bl from-transparent to-yellow-600/50 font-bold"
        >
          ส่งออก Excel
        </Button>
      </div>

      <Tabs
        size="sm"
        aria-label="เลือกโลหะที่จะดูรายงาน"
        selectedKey={metal}
        // The panel below re-runs its entrance on every metal switch (the charts
        // key their grow animation on the series colour), so the tab strip itself
        // stays still and lets the data do the moving.
        onSelectionChange={(key) => router.replace(`/reports/sales?metal=${String(key)}`)}
        classNames={{ tabList: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
      >
        {METALS.map((m) => (
          <Tab key={m} title={METAL_LABEL[m]} />
        ))}
      </Tabs>

      {/* One filter row above everything it scopes. Collapsed by default so the
          charts start higher up the page; the header keeps the active range and
          an active-filter count visible, so nothing is ever hidden silently. */}
      <div className="flex flex-col gap-y-2 rounded-2xl border-1 border-black/10 bg-black/5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`rounded-full border-1 px-3 py-1 text-xs font-bold transition-colors ${
                preset === p.key
                  ? "border-[#c09c42] bg-[#c09c42] text-white"
                  : "border-black/10 bg-white/70 text-black/60 hover:border-[#c09c42]/40"
              }`}
            >
              {p.label}
            </button>
          ))}

          <span className="ml-1 text-[11px] text-black/45">
            {dateFrom ? moment(dateFrom).format("DD/MM/YY") : "…"} –{" "}
            {dateTo ? moment(dateTo).format("DD/MM/YY") : "…"}
          </span>

          <div className="ml-auto flex items-center gap-x-1">
            {activeCount > 0 && (
              <Button
                size="sm"
                variant="light"
                startContent={<RotateCcw size={13} />}
                onPress={resetFilters}
                className="text-xs font-bold text-black/50"
              >
                ล้างตัวกรอง
              </Button>
            )}
            <Button
              size="sm"
              variant="flat"
              aria-expanded={filtersOpen}
              endContent={
                filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              }
              onPress={() => setFiltersOpen((v) => !v)}
              className="rounded-xl border-1 border-black/10 bg-white/70 text-xs font-bold text-black/60"
            >
              ตัวกรอง
              {activeCount > 0 && (
                <span className="ml-1 rounded-full bg-[#c09c42] px-1.5 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Expanding animates the panel's height (grid-rows 0fr → 1fr) rather than
            unmounting the fields, so the charts below slide instead of jumping. */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: filtersOpen ? "1fr" : "0fr" }}
          aria-hidden={!filtersOpen}
        >
          {/* Collapsed, the fields stay mounted (that is what makes the height
              animate) but must leave the tab order — otherwise keyboard focus
              disappears into a panel nobody can see. `inert` does exactly that
              and, unlike visibility:hidden, does not fight the transition. */}
          <div
            className="overflow-hidden"
            {...(filtersOpen
              ? {}
              : // React 18 reads inert as a boolean attribute and rejects "" as
                // false; the cast is only because its DOM typings predate it.
                ({ inert: true } as unknown as React.HTMLAttributes<HTMLDivElement>))}
          >
            <div className="flex flex-col gap-y-2 pt-1">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                size="sm"
                type="date"
                label="จากวันที่"
                value={dateFrom}
                onValueChange={(v) => {
                  setDateFrom(v);
                  setPreset("");
                }}
                classNames={FIELD}
              />
              <Input
                size="sm"
                type="date"
                label="ถึงวันที่"
                value={dateTo}
                onValueChange={(v) => {
                  setDateTo(v);
                  setPreset("");
                }}
                classNames={FIELD}
              />
              {canPickEmployee && (
                <Select
                  size="sm"
                  label="พนักงานผู้ออก"
                  selectedKeys={createdBy ? [createdBy] : []}
                  onSelectionChange={(keys) =>
                    setCreatedBy(String(Array.from(keys as Set<string>)[0] ?? ""))
                  }
                  classNames={SELECT_FIELD}
                >
                  {users.map((u) => (
                    <SelectItem key={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </Select>
              )}
              <Select
                size="sm"
                label="ประเภท"
                selectedKeys={typeId ? [typeId] : []}
                onSelectionChange={(keys) =>
                  setTypeId(String(Array.from(keys as Set<string>)[0] ?? ""))
                }
                classNames={SELECT_FIELD}
              >
                {typeOptions.map((t) => (
                  <SelectItem key={String(t.id)}>{t.name}</SelectItem>
                ))}
              </Select>
              <Input
                size="sm"
                label="ลูกค้า / ผู้เซ็น"
                value={customer}
                onValueChange={setCustomer}
                classNames={FIELD}
              />
              <Input
                size="sm"
                label="ค้นหาเลขที่เอกสาร"
                startContent={<Search size={14} className="text-black/30" />}
                value={search}
                onValueChange={setSearch}
                classNames={FIELD}
              />
            </div>

            {canSelectStoreBranch && (
              <div className="flex flex-col gap-y-1">
                <span className="text-[10px] font-bold text-black/40">ร้าน / สาขา</span>
                <StoreBranchSelector />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {loading && !everLoaded ? (
        <div className="flex flex-col gap-y-3">
          <SkeletonStats />
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <SkeletonBlock className="h-[236px] rounded-2xl" />
            <SkeletonBlock className="h-[236px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <SkeletonBlock className="h-24 rounded-2xl" />
            <SkeletonBlock className="h-24 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div
          className={`flex flex-col gap-y-3 transition-opacity ${loading ? "opacity-50" : ""}`}
        >
          {/* Overview — the headline numbers are figures, not charts. */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatTile index={0} label="ยอดรวม (บาท)" value={overview?.amount ?? 0} format={money2} accent />
            <StatTile index={1} label="น้ำหนักรวม (กรัม)" value={overview?.weight ?? 0} format={grams} />
            <StatTile index={2} label="จำนวนเอกสาร" value={overview?.doc_count ?? 0} format={money} />
            <StatTile
              index={3}
              label="ราคาเฉลี่ยต่อกรัม"
              value={overview?.avg_per_gram ?? 0}
              format={money2}
            />
          </div>

          <div className="flex items-center justify-end gap-x-1.5">
            <span className="text-[10px] font-bold text-black/40">แสดงกราฟราย</span>
            {(["day", "month"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucket(b)}
                className={`rounded-full border-1 px-3 py-0.5 text-[11px] font-bold transition-colors ${
                  bucket === b
                    ? "border-[#c09c42] bg-[#c09c42] text-white"
                    : "border-black/10 bg-white/60 text-black/60"
                }`}
              >
                {b === "day" ? "วัน" : "เดือน"}
              </button>
            ))}
          </div>

          {/* Two charts, never one with two y-axes: บาท and กรัม share no scale. */}
          <div className="rp-rise grid grid-cols-1 gap-2 xl:grid-cols-2" style={riseIn(4, 55, 260)}>
            <ColumnChart
              title={`ยอดขาย${METAL_LABEL[metal]}`}
              unit="บาท"
              data={amountData}
              color={SERIES_AMOUNT}
              format={money}
            />
            <ColumnChart
              title={`น้ำหนัก${METAL_LABEL[metal]}`}
              unit="กรัม"
              data={weightData}
              color={SERIES_WEIGHT}
              format={grams}
            />
          </div>

          <div className="rp-rise grid grid-cols-1 gap-2 xl:grid-cols-2" style={riseIn(5, 55, 300)}>
            <BreakdownBars
              title="แยกตามประเภท"
              rows={report?.by_type ?? []}
              color={SERIES_AMOUNT}
              unitLabel="ประเภท"
            />
            <BreakdownBars
              title="แยกตามพนักงาน"
              rows={report?.by_employee ?? []}
              color={SERIES_AMOUNT}
              unitLabel="คน"
            />
          </div>
        </div>
      )}

      {/* The table view: every number above is reachable here without hovering. */}
      <div className="flex flex-col gap-y-2">
        <span className="pl-1 text-sm font-bold text-black/70">
          เอกสารทั้งหมด{" "}
          <span className="text-xs font-normal text-black/40">
            ({totalRows.toLocaleString()} ใบ)
          </span>
        </span>

        {rowsLoading && !everLoaded ? (
          <SkeletonLines count={3} className="py-2" />
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-black/40">
            ไม่มีเอกสารในช่วงที่เลือก
          </div>
        ) : (
          <div
            className={`rp-rise transition-opacity ${rowsLoading ? "opacity-50" : ""}`}
            style={riseIn(6, 55, 340)}
          >
            <div className="hidden md:block">
              <Table
                aria-label="ตารางเอกสารที่ปิดจบแล้ว"
                radius="sm"
                removeWrapper
                classNames={{
                  base: "flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
                }}
              >
                <TableHeader>
                  <TableColumn>เลขที่เอกสาร</TableColumn>
                  <TableColumn>วันที่</TableColumn>
                  <TableColumn>ลูกค้า</TableColumn>
                  <TableColumn>พนักงาน</TableColumn>
                  <TableColumn>สาขา</TableColumn>
                  <TableColumn>ที่มา</TableColumn>
                  <TableColumn>น้ำหนัก (ก.)</TableColumn>
                  <TableColumn>ยอดรวม</TableColumn>
                </TableHeader>
                <TableBody items={rows} emptyContent="ไม่พบข้อมูล">
                  {(row) => (
                    <TableRow key={row.quotation_id}>
                      <TableCell>
                        <span className="text-sm font-bold text-black/70">{row.code}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/60">
                          {moment(row.created_at).format("DD/MM/YYYY HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-black/70">{row.customer || "—"}</span>
                          {row.phone && (
                            <span className="text-[10px] text-black/40">{row.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/60">{row.employee || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/60">{row.branch || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <SourceChip source={row.source} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-black/70">
                          {grams(row.weight)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-bold text-yellow-700">
                          {money2(row.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-y-2 md:hidden">
              {rows.map((row, i) => (
                <div
                  key={row.quotation_id}
                  className={`flex flex-col gap-y-2 rounded-2xl border-1 border-black/10 bg-black/5 p-3 backdrop-blur-xl ${reduced ? "" : "rp-rise"}`}
                  style={reduced ? undefined : riseIn(i, 35, 280)}
                >
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <span className="truncate text-sm font-bold text-black/70">
                      {row.code}
                    </span>
                    <SourceChip source={row.source} />
                  </div>
                  <div className="flex flex-row items-end justify-between gap-x-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-black/70">
                        {row.customer || "—"}
                      </span>
                      <span className="truncate text-[10px] text-black/40">
                        {moment(row.created_at).format("DD/MM/YYYY HH:mm")}
                        {row.employee ? ` · ${row.employee}` : ""}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-bold text-yellow-700">
                        {money2(row.amount)}
                      </span>
                      <span className="text-[10px] text-black/40">
                        {grams(row.weight)} ก.
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-row items-center justify-center gap-x-3 pt-1">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="หน้าก่อนหน้า"
              isDisabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-black/60">
              {page} / {totalPages}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="หน้าถัดไป"
              isDisabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  format,
  accent,
  index,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  accent?: boolean;
  index: number;
}) {
  return (
    <div
      className="rp-rise flex flex-col gap-y-1 rounded-2xl border-1 border-black/10 bg-black/5 p-3 backdrop-blur-xl"
      style={riseIn(index, 55, 220)}
    >
      <span className="text-xs text-black/50">{label}</span>
      <span
        className={`text-lg font-bold ${accent ? "text-yellow-700" : "text-black/75"}`}
      >
        <CountUp value={value} format={format} />
      </span>
    </div>
  );
}

// Where the document came from. Text + colour, never colour alone.
function SourceChip({ source }: { source: string }) {
  const isBill = source === "bill";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border-1 px-2 py-0.5 text-[10px] font-bold ${
        isBill
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700"
          : "border-black/10 bg-black/5 text-black/50"
      }`}
    >
      {isBill ? "บิลลูกค้า" : "เดินเข้า"}
    </span>
  );
}

// useSearchParams needs a Suspense boundary for the static shell.
export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <SalesReportPage />
    </Suspense>
  );
}
