"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Avatar } from "@heroui/avatar";
import { CheckCircle, XCircle, FileUp, AlertCircle, Trash2, Store, Pencil, ChevronLeft, ChevronRight, ChevronDown, Zap } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { VerifyBadge } from "@/components/verifyBadge";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { fetchAllPages } from "./paging";
import { PreviewQuote, type PayMethod } from "../../quotation/_component/previewQuote";
import { QuotationProps } from "../../quotation/_component/quotation";
import {
  buildStoreHeader,
  type QuotationStoreSnapshot,
  type StoreHeaderSnapshot,
} from "../../quotation/_component/storeHeader";

// Bills are single-metal (see the API's find-or-append on create), so this list
// renders one metal at a time: /bills = ทอง, /bills/silver = เงิน.
export type BillMetal = "gold" | "silver";

interface BillItem {
  id: number;
  type_id: string;
  type_name: string;
  // gold|silver|platinum|palladium — missing means gold (legacy items). Gold is
  // weighed in baht; other metals in grams, so weight/avg must not be mixed.
  metal?: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
  // When this line item's price was locked (each item is priced/locked
  // individually, so one bill can carry several different locked prices).
  created_at?: string;
}

interface BillData {
  id: number;
  code: string;
  status: number;
  // Which list the bill belongs to. Legacy bills predating the column read gold.
  metal?: string;
  note: string;
  reject_reason: string;
  total_amount: number;
  // Created by the auto-sell engine when the customer's target price was reached,
  // rather than submitted by hand. Everything else about the bill is the same.
  auto_sell?: boolean;
  // Full store relation (preloaded on the /bills/:id detail response) — carries
  // the receipt-header fields, not just id/name.
  store?: StoreHeaderSnapshot & { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  creator?: { id: number; name: string; verification_status?: string; phone?: string; address?: string; tax_id?: string; bank?: { id: number; name: string } | null; bank_account_no?: string; bank_account_name?: string } | null;
  issued_quotation_id?: number | null;
  items?: BillItem[];
  images?: { id: number; image_url: string; type?: string }[];
  // The master-issued quotation (once issued) — its items/photos/signature are the
  // real bill shown to the customer. Also carries the store-header snapshot taken
  // when it was issued.
  issued_quotation?: ({
    created_at?: string;
    payment_method?: string;
    total_amount?: number;
    items?: BillItem[];
    // Detailed per-item lines captured at issue time — used to itemise the
    // printed page 1 (items above is consolidated one-line-per-metal).
    page1_items?: QuotationProps[] | null;
    images?: { id: number; image_url: string; type?: string }[];
    signer_name?: string;
    signer_phone?: string;
  } & QuotationStoreSnapshot) | null;
  created_at: string;
}

// A display row: one bill, or several bills issued together (combined).
interface BillGroup {
  key: string;
  rep: BillData;
  billIds: number[];
  status: number;
  total: number;
  rawTotal: number; // unadjusted total_amount before issued quotation
  // The item lines the totals below were computed from — what the row expands to.
  items: BillItem[];
  weight: number; // gold weight (baht) — kept for the melt/refinery metrics
  // Metal split: gold is weighed in baht, silver (and other metals) in grams, so
  // they are tracked separately and never summed into one figure.
  goldWeight: number;
  silverWeight: number;
  goldAmount: number;
  silverAmount: number;
  count: number;
  // True when ANY bill in the group came from auto-sell: after issuance several
  // bills share a row, and the representative may not be the automatic one.
  autoSell: boolean;
  // Newest item date across the group. A "รอออกบิล" bill accumulates every later
  // sell, so its created_at is only the FIRST one — this is what actually moved.
  lastAt: string;
}

// Missing metal means gold (items created before the metal tag existed).
const isGoldItem = (m?: string) => (m || "gold") === "gold";

// Split a set of items into gold (weighed in baht) vs non-gold (silver etc., in
// grams). Gold and silver weights are different units and must not be summed.
const metalSplit = (items: BillItem[] | undefined) => {
  let goldWeight = 0, silverWeight = 0, goldAmount = 0, silverAmount = 0;
  for (const it of items ?? []) {
    if (isGoldItem(it.metal)) {
      goldWeight += it.weight || 0;
      goldAmount += it.total || 0;
    } else {
      silverWeight += it.weight || 0;
      silverAmount += it.total || 0;
    }
  }
  return { goldWeight, silverWeight, goldAmount, silverAmount };
};

// Newest of the bill's own date and every item's locked-price date.
const latestActivity = (bills: BillData[], items: BillItem[] | undefined) => {
  let latest = "";
  for (const b of bills) if (!latest || b.created_at > latest) latest = b.created_at;
  for (const it of items ?? []) {
    if (it.created_at && it.created_at > latest) latest = it.created_at;
  }
  return latest;
};

// Human-readable weight that keeps gold (บาท) and silver (กรัม) as separate units.
const fmtWeight = (goldWeight: number, silverWeight: number) => {
  const parts: string[] = [];
  if (goldWeight > 0)
    parts.push(`${goldWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท`);
  if (silverWeight > 0)
    parts.push(`${silverWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} กรัม`);
  return parts.length ? parts.join(" + ") : "0";
};

// Per-item weight with its metal's unit.
const itemWeightUnit = (m?: string) => (isGoldItem(m) ? "บาท" : "กรัม");

// Combine bills issued together (sharing one issued quotation) into one group.
// Used by the staff list and the เคลียร์บิล selection modal.
const groupBills = (list: BillData[]): BillGroup[] => {
  const map = new Map<string, BillData[]>();
  for (const b of list) {
    const key = b.issued_quotation_id ? `q${b.issued_quotation_id}` : `b${b.id}`;
    const arr = map.get(key) ?? [];
    arr.push(b);
    map.set(key, arr);
  }
  return Array.from(map.values()).map((group) => {
    // Bills issued together share one quotation — its items are the real
    // (re-assessed) weight; otherwise use what each bill originally submitted.
    const submitted = group.flatMap((x) => x.items ?? []);
    const items = group[0].issued_quotation?.items
      ? group[0].issued_quotation.items
      : submitted;
    const split = metalSplit(items);
    return {
      key: group[0].issued_quotation_id ? `q${group[0].issued_quotation_id}` : `b${group[0].id}`,
      rep: group[0],
      billIds: group.map((x) => x.id),
      status: group[0].status,
      total: group[0].issued_quotation?.total_amount
        ?? group.reduce((s, x) => s + x.total_amount, 0),
      rawTotal: group.reduce((s, x) => s + x.total_amount, 0),
      items,
      weight: split.goldWeight,
      goldWeight: split.goldWeight,
      silverWeight: split.silverWeight,
      goldAmount: split.goldAmount,
      silverAmount: split.silverAmount,
      count: group.length,
      autoSell: group.some((x) => !!x.auto_sell),
      // Always from the submitted items — those are the lines that accumulate.
      lastAt: latestActivity(group, submitted),
    };
  });
};

// Bill statuses are distinct from staff quotation statuses (0/1/2).
const STATUS_LABEL: Record<number, string> = { 10: "รอออกบิล", 11: "รอตรวจบิล", 12: "สำเร็จ", 13: "ยกเลิก", 14: "เคลียร์แล้ว" };
const STATUS_COLOR: Record<number, string> = {
  10: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  11: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  13: "bg-red-500/20 text-red-700 border-red-500/30",
  14: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};

// Marks a bill the auto-sell engine created on its own. Worth calling out on
// every surface: nobody pressed a button for it, so staff reading the list need
// to know why it appeared.
const AutoSellChip = () => (
  <span
    title="ระบบขายให้อัตโนมัติเมื่อราคาถึงเป้าที่ลูกค้าตั้งไว้"
    className="shrink-0 inline-flex items-center gap-x-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border-1 bg-sky-500/15 text-sky-700 border-sky-500/30"
  >
    <Zap size={9} /> ขายอัตโนมัติ
  </span>
);

// Rows per page. The whole-set totals come from /bills/summary, so this only
// governs how much of the list is on screen.
const PAGE_SIZE = 20;

// Overview totals for every bill matching the current filter (GET /bills/summary).
interface BillSummary {
  count: number;
  raw_amount: number;
  weight: number;
  amount: number;
  pending_clear_weight: number;
}

const EMPTY_SUMMARY: BillSummary = {
  count: 0, raw_amount: 0, weight: 0, amount: 0, pending_clear_weight: 0,
};

const CANCEL_REASONS = [
  "ลูกค้าไม่มาติดต่อ",
  "ลูกค้าขอยกเลิก",
  "ราคาไม่ตรงตามที่ตกลง",
  "น้ำหนักไม่ถูกต้อง",
  "ประเภททองไม่ถูกต้อง",
  "อื่นๆ",
];

export function BillsList({ metal }: { metal: BillMetal }) {
  const isGold = metal === "gold";
  // Gold is weighed in baht (priced บาท/บาท); silver in grams (priced บาท/กรัม).
  const weightUnit = isGold ? "บาท" : "กรัม";
  const avgUnit = isGold ? "บาท/บาท" : "บาท/กรัม";
  const metalLabel = isGold ? "ทอง" : "เงิน";

  const router = useRouter();
  const { hasPermission, permissions, isCustomer, loading: authLoading, refreshUnfinishedBills } = useAuth();
  const canRead = hasPermission("bills.read");
  const canIssue = hasPermission("bills.issue");
  const canApprove = hasPermission("bills.approve");
  // Creation is customer-only — use the raw permission (master is auto-granted by
  // hasPermission, but master manages bills rather than creating them).
  const canCreate = permissions.includes("bills.create");

  const [billsOpen, setBillsOpen] = useState(true);
  useEffect(() => {
    // The ปิดรับซื้อ switch is the gold one; silver has its own schedule and the
    // banner below is gold-only.
    if (!isGold) return;
    api.get<{ open: boolean }>("/configs/bills-status")
      .then((res) => setBillsOpen((res.data as unknown as { open: boolean }).open ?? true))
      .catch(() => {});
  }, [isGold]);

  const [bills, setBills] = useState<BillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Totals for the whole filter (server-side) — independent of the page shown.
  const [summary, setSummary] = useState<BillSummary>(EMPTY_SUMMARY);
  // Item lines show by default — the customer opens this list to check what a
  // bill is made of. The set tracks the rows they have since folded away, so
  // "expanded" is the absence of an entry rather than the presence of one.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const isExpanded = (key: string) => !collapsedKeys.has(key);
  const toggleExpand = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const detailDisc = useDisclosure();
  const [detailB, setDetailB] = useState<BillData | null>(null);
  // Bill ids covered by the currently-open detail (a group when bills were issued
  // together). Approve/cancel apply to all of them.
  const [groupBillIds, setGroupBillIds] = useState<number[]>([]);

  // Per-session delivery logs for the open bill.
  const [deliveryLogs, setDeliveryLogs] = useState<{ id: number; weight: number; amount: number; note: string; created_at: string }[]>([]);
  // Itemised lines for the preview's page 1 (from delivery logs) so a reprinted
  // bill lists every item across all delivery rounds, not just the consolidated one.
  const [billPage1Items, setBillPage1Items] = useState<QuotationProps[]>([]);

  const issueDisc = useDisclosure();
  const [issuing, setIssuing] = useState(false);

  const approveDisc = useDisclosure();
  const [approving, setApproving] = useState(false);

  const deleteDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  const cancelDisc = useDisclosure();
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCustom, setCancelCustom] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const clearDisc = useDisclosure();
  const [clearing, setClearing] = useState(false);
  // เคลียร์บิล selection: completed bills are fetched fresh when the modal opens
  // (the list state only holds the active tab) and selected per issue-group.
  const [clearGroups, setClearGroups] = useState<BillGroup[]>([]);
  const [clearLoading, setClearLoading] = useState(false);
  const [selectedClearKeys, setSelectedClearKeys] = useState<Set<string>>(new Set());

  const revertDisc = useDisclosure();
  const [reverting, setReverting] = useState(false);

  // Bill to open on arrival (?billId=N). Read from the URL once on mount rather
  // than via useSearchParams, which would force this route into a Suspense
  // boundary at build time.
  const [focusBillId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("billId"),
  );
  const focusedRef = useRef<string | null>(null);

  const statusFilter: Record<string, number | undefined> = {
    all: undefined, pending_issue: 10, pending_review: 11, completed: 12, cancelled: 13, cleared: 14,
  };

  // Customers see each sell individually. Staff/master see bills that were issued
  // together (sharing one issued quotation) combined into a single entry.
  // The customer's finished bills (สำเร็จ/เคลียร์แล้ว) are excluded server-side —
  // filtering them here instead would leave the paged results full of holes.
  const billGroups: BillGroup[] = useMemo(() => {
    if (isCustomer) {
      return bills.map((b) => {
        const items = b.issued_quotation?.items ?? b.items ?? [];
        const split = metalSplit(items);
        return {
          key: `b${b.id}`, rep: b, billIds: [b.id], status: b.status,
          total: b.issued_quotation?.total_amount ?? b.total_amount,
          rawTotal: b.total_amount,
          items,
          weight: split.goldWeight,
          goldWeight: split.goldWeight,
          silverWeight: split.silverWeight,
          goldAmount: split.goldAmount,
          silverAmount: split.silverAmount,
          count: 1,
          autoSell: !!b.auto_sell,
          lastAt: latestActivity([b], b.items),
        };
      });
    }
    return groupBills(bills);
  }, [bills, isCustomer]);

  // Expanding is for the customer's own list: one row = one of their sells, and
  // a รอออกบิล bill keeps accumulating items, so the lines behind the total are
  // what they actually came to check. Staff rows combine several bills and lead
  // to the issue/detail flow instead.
  const canExpand = isCustomer;

  // The table has no colspan (react-aria grid), so an expanded item is a normal
  // row laid out on the same six columns as the bill row above it.
  type BillRow =
    | { key: string; kind: "bill"; g: BillGroup }
    | { key: string; kind: "item"; it: BillItem };

  const tableRows: BillRow[] = useMemo(() => {
    const rows: BillRow[] = [];
    for (const g of billGroups) {
      rows.push({ key: g.key, kind: "bill", g });
      if (!canExpand || collapsedKeys.has(g.key)) continue;
      g.items.forEach((it, i) =>
        rows.push({ key: `${g.key}-i${it.id || i}`, kind: "item", it }),
      );
    }
    return rows;
  }, [billGroups, collapsedKeys, canExpand]);

  // The query behind both the page of rows and the overview totals — they must
  // describe the same set, so it is built once.
  const listQuery = useCallback(() => {
    // No store/branch filter here: customer bills carry no store_id/branch_id
    // (customers aren't tied to a store), so filtering would hide them all.
    let q = `metal=${metal}`;
    const s = statusFilter[activeTab];
    if (s !== undefined) q += `&status=${s}`;
    // สำเร็จ + เคลียร์แล้ว live in the customer's "บิลทั้งหมด" page instead.
    else if (isCustomer) q += `&exclude_status=12,14`;
    if (search) q += `&search=${encodeURIComponent(search)}`;
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search, metal, isCustomer]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BillData[]>(`/bills?${listQuery()}&page=${page}&limit=${PAGE_SIZE}`);
      setBills((res.data as unknown as BillData[]) || []);
      setTotalPages((res as { total_pages?: number }).total_pages || 1);
    } catch {
      setBills([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [listQuery, page]);

  // Totals cover EVERY matching bill, not just this page — otherwise the overview
  // would change every time the user turned a page.
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<BillSummary>(`/bills/summary?${listQuery()}`);
      setSummary((res.data as unknown as BillSummary) || EMPTY_SUMMARY);
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  }, [listQuery]);

  const overview = useMemo(() => ({
    ...summary,
    avgPrice: summary.weight > 0 ? summary.amount / summary.weight : 0,
  }), [summary]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => { if (canRead) fetchBills(); }, [fetchBills, canRead]);
  useEffect(() => { if (canRead) fetchSummary(); }, [fetchSummary, canRead]);

  const openDetail = async (b: BillData, groupIds?: number[]) => {
    setDeliveryLogs([]);
    setBillPage1Items([]);
    try {
      const res = await api.get<BillData>(`/bills/${b.id}`);
      setDetailB(res.data as unknown as BillData);
    } catch {
      setDetailB(b);
    }
    // Delivery logs → itemise the preview's page 1 for every viewer (incl. the
    // customer's รอตรวจบิล review) so it breaks items down line-by-line instead of
    // the consolidated issued-quotation lines. deliveryLogs display stays staff-only.
    const logIds = groupIds && groupIds.length ? groupIds : [b.id];
    type LogRow = { id: number; weight: number; amount: number; note: string; created_at: string; items?: QuotationProps[] };
    Promise.all(
      logIds.map((lid) =>
        api.get(`/bills/${lid}/delivery-logs`)
          .then((res) => ({ lid, logs: (res.data as unknown as LogRow[]) ?? [] }))
          .catch(() => ({ lid, logs: [] as LogRow[] })),
      ),
    ).then((results) => {
      // Display the rep bill's rounds; itemise page 1 from whichever bill carries items.
      setDeliveryLogs(results.find((r) => r.lid === b.id)?.logs ?? results[0]?.logs ?? []);
      const items: QuotationProps[] = [];
      for (const r of results) for (const lg of r.logs) for (const it of lg.items ?? []) items.push(it);
      setBillPage1Items(items);
    });
    detailDisc.onOpen();
  };

  // Deep link (?billId=N, e.g. from หน้าแรก → กิจกรรมล่าสุด): open that bill's
  // detail on arrival. Runs once — reopening it on every render would trap the
  // user in the modal. openDetail fetches the bill itself, so it works even when
  // the row sits on another page of the list.
  useEffect(() => {
    if (!canRead || loading || !focusBillId || focusedRef.current === focusBillId) return;
    focusedRef.current = focusBillId;
    const id = Number(focusBillId);
    if (!id) return;
    const g = billGroups.find((x) => x.billIds.includes(id));
    setGroupBillIds(g?.billIds ?? [id]);
    openDetail(g?.rep ?? ({ id } as BillData), g?.billIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBillId, canRead, loading, billGroups]);

  // Issuer (master): a รอออกบิล bill jumps to the quotation page to issue it
  // (create a linked quotation). Otherwise open the detail for the whole group.
  const handleRowClick = (g: BillGroup) => {
    if (canIssue && g.status === 10) {
      router.push(`/quotation?billId=${g.rep.id}`);
      return;
    }
    setGroupBillIds(g.billIds);
    openDetail(g.rep, g.billIds);
  };

  const afterAction = async () => {
    detailDisc.onClose();
    await Promise.all([fetchBills(), fetchSummary()]);
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

  // Fetch the completed (สำเร็จ) bills fresh so the modal is correct regardless
  // of the active tab, then default to everything selected.
  const openClearModal = async () => {
    clearDisc.onOpen();
    setClearLoading(true);
    try {
      // Same as fetchBills — no store/branch filter (customer bills carry neither),
      // but this page's metal only: gold and silver are cleared separately.
      // Every page, not just the first — เคลียร์บิล must offer the whole backlog.
      const groups = groupBills(await fetchAllPages<BillData>(`/bills?status=12&metal=${metal}`));
      setClearGroups(groups);
      setSelectedClearKeys(new Set(groups.map((g) => g.key)));
    } catch {
      setClearGroups([]);
      setSelectedClearKeys(new Set());
    } finally {
      setClearLoading(false);
    }
  };

  const toggleClearKey = (key: string) => {
    setSelectedClearKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Clearing settles each selected bill's debt/credit ledger entry (backend), so
  // the customer's ยอดค้าง/เกิน and average restart from the remaining bills.
  const handleClearBills = async () => {
    const billIds = clearGroups.filter((g) => selectedClearKeys.has(g.key)).flatMap((g) => g.billIds);
    if (billIds.length === 0) return;
    setClearing(true);
    try {
      await api.post("/bills/clear", { bill_ids: billIds });
      clearDisc.onClose();
      await Promise.all([fetchBills(), fetchSummary()]);
      await refreshUnfinishedBills();
    } catch { /* ignore */ } finally {
      setClearing(false);
    }
  };

  // Reopen the quotation page to fix the quote the master issued. Nothing is
  // deleted here — the bill stays "รอตรวจบิล" and the old quote stays in the list.
  // The previously-issued items + the bill group are stashed so the quotation page
  // can pre-fill them; the old issuance is reversed only when the master saves the
  // corrected quote (see doSave there). Abandoning the edit changes nothing.
  const handleRevert = () => {
    if (!detailB) return;
    setReverting(true);
    // Pre-fill with the ITEMISED lines the master originally keyed in (delivery
    // logs first, then the quotation's page1_items) — same order the preview uses.
    // issued_quotation.items is stored consolidated one-line-per-metal, so falling
    // back to it would collapse every keyed line into one.
    const itemised: QuotationProps[] =
      billPage1Items.length
        ? billPage1Items
        : detailB.issued_quotation?.page1_items ?? [];
    const src = detailB.issued_quotation?.items ?? detailB.items ?? [];
    const editItems: QuotationProps[] = itemised.length
      ? itemised
      : src.map((it) => ({
          typeId: it.type_id,
          typeName: it.type_name,
          metal: it.metal || "gold",
          price: it.price,
          plus: it.plus,
          percent: it.percent,
          weight: it.weight,
          perGram: it.per_gram,
          total: it.total,
        }));
    const ids = groupBillIds.length ? groupBillIds : [detailB.id];
    // Tagged with the bill this stash belongs to — the quotation page ignores a
    // stash written for a different bill (see its editIssued branch).
    sessionStorage.setItem("editBillFor", String(detailB.id));
    sessionStorage.setItem("editBillItems", JSON.stringify(editItems));
    sessionStorage.setItem("editBillIds", JSON.stringify(ids));
    revertDisc.onClose();
    detailDisc.onClose();
    router.push(`/quotation?billId=${detailB.id}&editIssued=1`);
  };

  const handleDeleteBill = async () => {
    if (!detailB) return;
    setDeleting(true);
    try {
      await api.delete(`/bills/${detailB.id}`);
      deleteDisc.onClose();
      detailDisc.onClose();
      await afterAction();
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  if (!authLoading && !canRead) return null;

  // The 5th overview card — staff only, and only when something is waiting to be
  // cleared. It also decides the desktop column count.
  const showPendingClear = !isCustomer && overview.pending_clear_weight > 0;

  // A pending bill keeps accumulating later sells, so its created_at is only the
  // first one. Show what last moved, with the original date underneath.
  const dateCell = (g: BillGroup, compact = false) => {
    const last = g.lastAt || g.rep.created_at;
    const accumulated = moment(last).diff(moment(g.rep.created_at), "minutes") >= 1;
    return (
      <div className="flex flex-col items-end md:items-start">
        <span className={compact ? "text-[10px] text-black/40" : "text-xs text-black/50"}>
          {moment(last).format("DD/MM/YY HH:mm")}
        </span>
        {accumulated && (
          <span className="text-[10px] text-black/30">
            สร้าง {moment(g.rep.created_at).format("DD/MM/YY HH:mm")}
          </span>
        )}
      </div>
    );
  };

  // Tabs + ปุ่มเคลียร์บิล — render 2 จุด (มือถือ = ตรึงใต้ filter / desktop = หลัง Overview)
  const tabsRow = (
    <div className="flex items-center">
      <div className="flex-1 min-w-0">
        <Tabs
          selectedKey={activeTab}
          // Reset to page 1 in the same update — page 4 of the old tab is rarely
          // a page of the new one, and fetching it first would flash wrong rows.
          onSelectionChange={(k) => { setActiveTab(String(k)); setPage(1); }}
          color="warning"
          variant="underlined"
          classNames={{
            base: "w-full",
            tabList: "gap-4 w-full overflow-x-auto flex-nowrap scrollbar-hide",
          }}
        >
          <Tab key="all" title="ทั้งหมด" />
          <Tab key="pending_issue" title="รอออกบิล" />
          <Tab key="pending_review" title="รอตรวจบิล" />
          {!isCustomer ? <Tab key="completed" title="สำเร็จ" /> : null}
          {!isCustomer ? <Tab key="cleared" title="เคลียร์แล้ว" /> : null}
          <Tab key="cancelled" title="ยกเลิก" />
        </Tabs>
      </div>
      {canApprove && (
        <Button
          size="sm"
          className="shrink-0 bg-purple-600 text-white font-bold text-xs ml-2"
          onPress={openClearModal}
        >
          เคลียร์บิล
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* Header */}
      <div className="flex flex-row items-center justify-between shrink-0 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          รายการขาย{metalLabel}
        </span>
        {canCreate && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold disabled:opacity-40"
            isDisabled={isGold && !billsOpen}
            onPress={() => router.push("/bills/create")}
          >
            + ขาย
          </Button>
        )}
      </div>

      {/* Closed banner — gold only (silver runs on its own schedule) */}
      {isGold && !billsOpen && (
        <div className="flex items-center gap-x-3 border-1 border-red-300/60 bg-red-50/80 rounded-2xl px-4 py-3 shrink-0">
          <Store size={18} className="text-red-500 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-sm text-red-700">ปิดรับซื้อชั่วคราว</span>
            <span className="text-xs text-red-500">ขณะนี้ยังไม่เปิดรับซื้อทอง กรุณาติดต่อเจ้าหน้าที่</span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-row items-center gap-x-2 shrink-0">
        <div className="flex-1">
          <CmpInput placeholder="ค้นหาเลขที่" value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Tabs (มือถือ) — ตรึงใต้ Filter */}
      <div className="shrink-0 md:hidden">{tabsRow}</div>

      {/* Scroll region — มือถือ: Overview→list เลื่อนพร้อมกัน / desktop: Overview,Tabs ตรึง ให้ content scroll เอง */}
      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden scrollbar-hide flex flex-col gap-y-3">

      {/* Overview — totals for EVERY bill matching the filter, not just this page.
          Two columns on mobile; on desktop every card sits on one row (5 wide when
          รอเคลียร์ shows). */}
      <div className={`grid grid-cols-2 gap-2 shrink-0 ${showPendingClear ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
          <span className="text-xs text-black/50">ยอดขายรวม</span>
          <span className={`font-bold text-lg ${isGold ? "text-yellow-700" : "text-slate-600"}`}>
            {overview.raw_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท
          </span>
        </div>
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
          <span className="text-xs text-black/50">จำนวนบิล</span>
          <span className="font-bold text-lg">{overview.count.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
          <span className="text-xs text-black/50">น้ำหนักรวม</span>
          <span className="font-bold text-lg">
            {overview.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} {weightUnit}
          </span>
        </div>
        <div className={`flex flex-col border-1 backdrop-blur-xl rounded-2xl p-3 gap-y-1 ${isGold ? "border-yellow-300/60 bg-yellow-50/60" : "border-slate-300/60 bg-slate-50/60"}`}>
          <span className="text-xs text-black/50">ราคาเฉลี่ย</span>
          <span className={`font-bold text-lg ${isGold ? "text-yellow-700" : "text-slate-600"}`}>
            {overview.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {avgUnit}
          </span>
        </div>

        {showPendingClear && (
          <div className="col-span-2 md:col-span-1 flex flex-col border-1 border-purple-300/60 bg-purple-50/60 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
            <span className="text-xs text-black/50">น้ำหนักรวม (รอเคลียร์)</span>
            <span className="font-bold text-lg text-purple-700">
              {overview.pending_clear_weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} {weightUnit}
            </span>
          </div>
        )}
      </div>

      {/* Tabs (desktop) — อยู่หลัง Overview เหมือนเดิม */}
      <div className="hidden md:block shrink-0">{tabsRow}</div>

      {/* List — desktop: scroll ในตัวเอง (Overview ตรึง) / มือถือ: natural, เลื่อนไปกับ wrapper */}
      <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : billGroups.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีรายการขาย{metalLabel}</div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table
                isHeaderSticky
                radius="sm"
                removeWrapper
                classNames={{
                  base: "flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
                }}
              >
                <TableHeader>
                  <TableColumn>เลขที่</TableColumn>
                  <TableColumn>ลูกค้า</TableColumn>
                  <TableColumn>ยอดเต็ม (บาท)</TableColumn>
                  <TableColumn>ยอดจ่าย (บาท)</TableColumn>
                  <TableColumn>สถานะ</TableColumn>
                  <TableColumn>วันที่</TableColumn>
                </TableHeader>
                <TableBody items={tableRows} emptyContent="ไม่พบข้อมูล">
                  {(row) => row.kind === "item" ? (
                    // Item line of the row above — same columns, dimmed and indented.
                    <TableRow key={row.key} className="bg-black/[0.03]">
                      <TableCell>
                        <div className="flex items-center gap-x-1.5 pl-5 min-w-0">
                          <span className="text-black/25 shrink-0">↳</span>
                          <span className="text-xs font-bold text-black/60 truncate">{row.it.type_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/45">
                          น้ำหนัก{" "}
                          <span className="font-bold text-black/70">
                            {(row.it.weight || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>{" "}
                          {itemWeightUnit(row.it.metal)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-yellow-700/80">
                          {(row.it.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/45">
                          ราคา {(row.it.price || 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-black/20">—</span></TableCell>
                      <TableCell>
                        <span className="text-xs text-black/40">
                          {row.it.created_at ? moment(row.it.created_at).format("DD/MM/YY HH:mm") : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={row.key}
                      className="cursor-pointer hover:bg-white/60 rounded-xl"
                      onClick={() => handleRowClick(row.g)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-x-1.5">
                          {canExpand && row.g.items.length > 0 && (
                            <button
                              type="button"
                              aria-label="รายการย่อย"
                              // Stops the row's open-detail click — the chevron only unfolds.
                              onClick={(e) => { e.stopPropagation(); toggleExpand(row.g.key); }}
                              className="shrink-0 flex items-center text-[10px] font-bold text-[#8a6f22] hover:opacity-70"
                            >
                              {isExpanded(row.g.key) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              {row.g.items.length}
                            </button>
                          )}
                          <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                            {row.g.rep.code}
                            {row.g.count > 1 && <span className="ml-1 text-[10px] font-bold text-blue-600">รวม {row.g.count} บิล</span>}
                          </span>
                          {row.g.autoSell && <AutoSellChip />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-x-2">
                          <Avatar size="sm" name={row.g.rep.creator?.name} />
                          <span className="text-sm font-bold text-black/70 flex items-center gap-x-1">
                            {row.g.rep.creator?.name ?? "ไม่ระบุลูกค้า"}
                            {row.g.rep.creator && <VerifyBadge status={row.g.rep.creator.verification_status} size={14} />}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-yellow-700">{row.g.rawTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </TableCell>
                      <TableCell>
                        {row.g.total !== row.g.rawTotal
                          ? <span className="font-bold text-black/70">{row.g.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          : <span className="text-black/25">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[row.g.status]}`}>
                          {STATUS_LABEL[row.g.status]}
                        </span>
                      </TableCell>
                      <TableCell>{dateCell(row.g)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: cards */}
            <div className="flex flex-col gap-y-2 pb-4 md:hidden">
              {billGroups.map((g) => (
                <div
                  key={g.key}
                  onClick={() => handleRowClick(g)}
                  className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 transition-all gap-y-2 cursor-pointer hover:shadow-md"
                >
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <div className="flex items-center gap-x-1.5 min-w-0">
                      <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate">
                        {g.rep.code}
                        {g.count > 1 && (
                          <span className="ml-1 text-[10px] font-bold text-blue-600">รวม {g.count} บิล</span>
                        )}
                      </span>
                      {g.autoSell && <AutoSellChip />}
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[g.status]}`}>
                      {STATUS_LABEL[g.status]}
                    </span>
                  </div>
                  <div className="flex flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-x-2">
                      <Avatar size="sm" name={g.rep.creator ? g.rep.creator.name : undefined} />
                      <span className="text-sm font-bold text-black/70 flex items-center gap-x-1">
                        {g.rep.creator ? g.rep.creator.name : "ไม่ระบุลูกค้า"}
                        {g.rep.creator && <VerifyBadge status={g.rep.creator.verification_status} size={14} />}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm text-yellow-700">
                        {g.rawTotal.toLocaleString()} บาท
                      </span>
                      {g.total !== g.rawTotal && (
                        <span className="text-[10px] font-bold text-black/50">
                          จ่าย {g.total.toLocaleString()} บาท
                        </span>
                      )}
                      {dateCell(g, true)}
                    </div>
                  </div>

                  {/* รายการย่อย — the item lines the total is made of */}
                  {canExpand && g.items.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(g.key); }}
                        className="self-start flex items-center gap-x-0.5 text-[10px] font-bold text-[#8a6f22]"
                      >
                        {isExpanded(g.key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        รายการย่อย {g.items.length} รายการ
                      </button>
                      {isExpanded(g.key) && (
                        <div
                          // Tapping a line shouldn't open the bill's detail modal.
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col gap-y-1.5 border-t border-black/10 pt-2"
                        >
                          {g.items.map((it, i) => (
                            <div key={it.id || i} className="flex flex-row items-start justify-between gap-x-2">
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-black/70 truncate">{it.type_name}</span>
                                <span className="text-[10px] text-black/40">
                                  {(it.weight || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {itemWeightUnit(it.metal)}
                                  {` · ราคา ${(it.price || 0).toLocaleString()}`}
                                  {it.created_at ? ` · ${moment(it.created_at).format("DD/MM/YY HH:mm")}` : ""}
                                </span>
                              </div>
                              <span className="shrink-0 text-xs font-bold text-yellow-700/80">
                                {(it.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination — sits outside the list's scroll area so it stays reachable */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-row items-center justify-center gap-x-3 shrink-0 pt-1 pb-4 md:pb-0">
          <Button isIconOnly size="sm" variant="light" isDisabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-black/60">
            {page} / {totalPages}
            <span className="text-xs text-black/35 ml-2">ทั้งหมด {overview.count.toLocaleString()} รายการ</span>
          </span>
          <Button isIconOnly size="sm" variant="light" isDisabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
      </div>

      {/* DETAIL MODAL */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-x-2">
              <span className="font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex items-center gap-x-1.5">
                {detailB?.code}
                {detailB?.auto_sell && <AutoSellChip />}
              </span>
              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[detailB?.status ?? 10]}`}>
                {STATUS_LABEL[detailB?.status ?? 10]}
              </span>
            </div>
            <span className="text-xs font-normal text-black/50 inline-flex items-center gap-x-1 flex-wrap">
              {detailB && moment(detailB.created_at).format("DD/MM/YYYY HH:mm")}
              {detailB?.creator && (
                <>
                  <span>· โดย {detailB.creator.name}</span>
                  <VerifyBadge status={detailB.creator.verification_status} size={12} />
                </>
              )}
              {detailB?.store && ` · ${detailB.store.name}`}
              {detailB?.branch && ` / ${detailB.branch.name}`}
            </span>
          </ModalHeader>

          <ModalBody className="px-2">
            {/* Delivery logs + diff — staff/master view only */}
            {!isCustomer && (deliveryLogs.length > 0 || detailB?.issued_quotation) && (() => {
              const issuedTotal = detailB?.issued_quotation?.total_amount ?? 0;
              const lockedTotal = detailB?.total_amount ?? 0;
              return (
                <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3 mb-2">
                  <span className="text-xs font-bold text-black/60">การส่งหลอม</span>

                  {/* Per-session partial delivery logs */}
                  {deliveryLogs.length > 0 && (
                    <div className="flex flex-col gap-y-1">
                      {deliveryLogs.map((log, i) => (
                        <div key={log.id} className="flex items-center justify-between bg-white/60 border border-black/10 rounded-xl px-3 py-1.5 text-xs">
                          <div className="flex items-center gap-x-2">
                            <span className="text-black/40 font-bold w-4">{i + 1}</span>
                            <span className="text-black/60">{moment(log.created_at).format("DD/MM/YY HH:mm")}</span>
                          </div>
                          <div className="flex items-center gap-x-3">
                            <span className="text-black/50">{log.weight.toLocaleString(undefined, { maximumFractionDigits: 4 })} {weightUnit}</span>
                            <span className="font-bold text-yellow-700">{log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Final issuance row */}
                  {detailB?.issued_quotation && (
                    <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-1.5 text-xs">
                      <span className="font-bold text-yellow-700">ออกบิลแล้ว (รวมทั้งหมด)</span>
                      <span className="font-bold text-yellow-700">{issuedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                    </div>
                  )}

                  {/* Customer's original sell total */}
                  <div className="flex items-center justify-between bg-white/60 border border-black/10 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-black/50 font-bold">ยอดที่ลูกค้าส่งขาย</span>
                    <span className="font-bold text-black/70">{lockedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                  </div>

                </div>
              );
            })()}
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
                    <div key={it.id} className="flex flex-col px-3 py-2 border-b last:border-b-0 border-black/5 gap-y-0.5">
                      <span className="text-sm font-bold text-black/70">{i + 1}. {it.type_name}</span>
                      <div className="flex items-center gap-x-3 text-xs text-black/50">
                        <span>น้ำหนัก {it.weight} {itemWeightUnit(it.metal)}</span>
                        <span>ราคา {it.price.toLocaleString()}</span>
                        <span className="font-bold text-yellow-700 ml-auto">{it.total.toLocaleString()} บาท</span>
                      </div>
                      {it.created_at && (
                        <span className="text-[10px] text-black/40">ล็อกราคา {moment(it.created_at).format("DD/MM/YY HH:mm")}</span>
                      )}
                    </div>
                  ))}
                </div>
                {(() => {
                  const items = detailB.items ?? [];
                  const split = metalSplit(items);
                  const sumT = items.reduce((s, it) => s + it.total, 0);
                  const w = isGold ? split.goldWeight : split.silverWeight;
                  const a = isGold ? split.goldAmount : split.silverAmount;
                  const avg = w > 0 ? a / w : 0;
                  return (
                    <div className="grid grid-cols-3 gap-1.5 px-1 pt-1">
                      <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                        <span className="text-[10px] font-bold text-black/40">น้ำหนักรวม</span>
                        <span className="text-xs font-bold text-black/70">{fmtWeight(split.goldWeight, split.silverWeight)}</span>
                      </div>
                      <div className="flex flex-col border-1 border-yellow-300 bg-yellow-50 rounded-xl p-1.5">
                        <span className="text-[10px] font-bold text-black/40">ราคาเฉลี่ย</span>
                        <span className="text-xs font-bold text-yellow-700">{avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                        <span className="text-[10px] font-bold text-black/40">ยอดรวม</span>
                        <span className="text-xs font-bold text-yellow-700">{sumT.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                      </div>
                    </div>
                  );
                })()}
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
                  documentNo={detailB.code}
                  date={
                    detailB.issued_quotation?.created_at ?? detailB.created_at
                  }
                  page1Items={
                    billPage1Items.length
                      ? billPage1Items
                      : detailB.issued_quotation?.page1_items ?? undefined
                  }
                  items={(src.items ?? []).map((item): QuotationProps => ({
                    typeId: String(item.id),
                    typeName: item.type_name,
                    metal: item.metal || "gold",
                    price: item.price,
                    plus: item.plus,
                    percent: item.percent,
                    weight: item.weight,
                    perGram: item.per_gram,
                    total: item.total,
                  }))}
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
                  paymentMethod={(detailB.issued_quotation?.payment_method || null) as PayMethod}
                  bankName={detailB.creator?.bank?.name}
                  bankAccountNo={detailB.creator?.bank_account_no}
                  bankAccountName={detailB.creator?.bank_account_name}
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
                        <div key={it.id} className="flex flex-col px-3 py-2 border-b last:border-b-0 border-black/5 gap-y-0.5">
                          <span className="text-sm font-bold text-black/70">{i + 1}. {it.type_name}</span>
                          <div className="flex items-center gap-x-3 text-xs text-black/50">
                            <span>น้ำหนัก {it.weight} {itemWeightUnit(it.metal)}</span>
                            <span>ราคา {it.price.toLocaleString()}</span>
                            <span className="font-bold text-yellow-700 ml-auto">{it.total.toLocaleString()} บาท</span>
                          </div>
                          {it.created_at && (
                            <span className="text-[10px] text-black/40">ล็อกราคา {moment(it.created_at).format("DD/MM/YY HH:mm")}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Weighted average summary */}
                    {(() => {
                      const items = detailB.items ?? [];
                      const split = metalSplit(items);
                      const sumT = items.reduce((s, it) => s + it.total, 0);
                      const w = isGold ? split.goldWeight : split.silverWeight;
                      const a = isGold ? split.goldAmount : split.silverAmount;
                      const avg = w > 0 ? a / w : 0;
                      return items.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <div className="flex flex-col border-1 border-black/10 bg-white/60 rounded-xl p-1.5">
                            <span className="text-[10px] font-bold text-black/40">น้ำหนักรวม</span>
                            <span className="text-xs font-bold text-black/70">{fmtWeight(split.goldWeight, split.silverWeight)}</span>
                          </div>
                          <div className="flex flex-col border-1 border-yellow-300 bg-yellow-50 rounded-xl p-1.5">
                            <span className="text-[10px] font-bold text-black/40">ราคาเฉลี่ย</span>
                            <span className="text-xs font-bold text-yellow-700">{avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex flex-col border-1 border-black/10 bg-white/60 rounded-xl p-1.5">
                            <span className="text-[10px] font-bold text-black/40">ยอดรวม</span>
                            <span className="text-xs font-bold text-black/70">{sumT.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
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
            {/* Storefront pulls an issued bill back to fix the quote */}
            {canApprove && detailB?.status === 11 && (
              <Button color="warning" variant="flat" startContent={<Pencil size={14} />} onPress={revertDisc.onOpen}>
                แก้ไขบิล
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
            {/* Permanently delete the bill (cascade soft-delete; drops debt) */}
            {canApprove && detailB && (
              <Button color="danger" startContent={<Trash2 size={14} />} onPress={deleteDisc.onOpen}>
                ลบ
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        isOpen={deleteDisc.isOpen}
        onClose={deleteDisc.onClose}
        onConfirm={handleDeleteBill}
        name={detailB?.code}
        related="รายการสินค้า ประวัติการส่ง และยอดหนี้/เครดิตของบิลนี้จะถูกลบออกจากการคำนวณ"
        loading={deleting}
      />

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
                <span className="text-xs text-black/50">ยอดจริง (ใบเสนอราคา)</span>
                <span className="font-bold text-xl text-green-700">
                  {(detailB?.issued_quotation?.total_amount ?? detailB?.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
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

      {/* REVERT CONFIRM */}
      <Modal isOpen={revertDisc.isOpen} onClose={revertDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-yellow-700">แก้ไขบิลที่ออกไปแล้ว</span></ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">
              จะเปิดหน้าออกใบเสนอราคาของบิล <span className="font-bold">{detailB?.code}</span> พร้อมรายการเดิมให้แก้ไข
              ใบเสนอราคาเดิมยังอยู่จนกว่าจะกด <span className="font-bold text-yellow-700">บันทึก</span> ใบใหม่
              เมื่อบันทึกแล้วระบบจะแทนที่ใบเดิมและคำนวณยอดใหม่ให้อัตโนมัติ
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={revertDisc.onClose} isDisabled={reverting}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              startContent={<Pencil size={14} />}
              onPress={handleRevert}
              isLoading={reverting}
            >
              แก้ไขใบเสนอราคา
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* CLEAR BILLS — select which completed bills to settle */}
      <Modal isOpen={clearDisc.isOpen} onClose={clearDisc.onClose} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="font-bold text-purple-700">เคลียร์บิล{metalLabel}</span>
            <span className="text-xs font-normal text-black/50">
              บิลที่เลือกจะเปลี่ยนเป็น &quot;เคลียร์แล้ว&quot; และยอดค้าง/เกินกับค่าเฉลี่ยของบิลนั้นจะถูกปิด — ที่เหลือคิดจากบิลที่ยังไม่เคลียร์เท่านั้น
            </span>
          </ModalHeader>
          <ModalBody>
            {clearLoading ? (
              <div className="flex items-center justify-center py-8"><Spinner size="lg" color="secondary" /></div>
            ) : clearGroups.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-black/40 text-sm">ไม่มีบิลสำเร็จที่รอเคลียร์</div>
            ) : (() => {
              // Group the selectable entries by customer for display.
              const byCustomer = new Map<string, BillGroup[]>();
              for (const g of clearGroups) {
                const name = g.rep.creator?.name ?? "ไม่ระบุลูกค้า";
                const arr = byCustomer.get(name) ?? [];
                arr.push(g);
                byCustomer.set(name, arr);
              }
              const selected = clearGroups.filter((g) => selectedClearKeys.has(g.key));
              const selBills = selected.reduce((s, g) => s + g.count, 0);
              const selWeight = selected.reduce((s, g) => s + (isGold ? g.goldWeight : g.silverWeight), 0);
              const selTotal = selected.reduce((s, g) => s + g.total, 0);
              const allSelected = selectedClearKeys.size === clearGroups.length;
              return (
                <div className="flex flex-col gap-y-3">
                  <Checkbox
                    size="sm"
                    color="secondary"
                    isSelected={allSelected}
                    isIndeterminate={!allSelected && selectedClearKeys.size > 0}
                    onValueChange={(v) =>
                      setSelectedClearKeys(v ? new Set(clearGroups.map((g) => g.key)) : new Set())
                    }
                  >
                    <span className="text-sm font-bold text-black/70">เลือกทั้งหมด ({clearGroups.length} รายการ)</span>
                  </Checkbox>

                  <div className="flex flex-col gap-y-2">
                    {Array.from(byCustomer.entries()).map(([name, groups]) => (
                      <div key={name} className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-2 gap-y-1.5">
                        <div className="flex items-center gap-x-2 px-1">
                          <Avatar size="sm" name={name} className="w-5 h-5 text-[10px]" />
                          <span className="text-xs font-bold text-black/60">{name}</span>
                          {groups[0]?.rep.creator && (
                            <VerifyBadge status={groups[0].rep.creator.verification_status} size={12} />
                          )}
                        </div>
                        {groups.map((g) => (
                          <div key={g.key} className="flex items-center justify-between bg-white/70 border border-black/10 rounded-xl px-2.5 py-1.5">
                            <Checkbox
                              size="sm"
                              color="secondary"
                              isSelected={selectedClearKeys.has(g.key)}
                              onValueChange={() => toggleClearKey(g.key)}
                            >
                              <span className="text-sm font-bold bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                                {g.rep.code}
                                {g.count > 1 && <span className="ml-1 text-[10px] font-bold text-blue-600">รวม {g.count} บิล</span>}
                              </span>
                            </Checkbox>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-bold text-yellow-700">
                                {g.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                              </span>
                              <span className="text-[10px] text-black/40">
                                {fmtWeight(g.goldWeight, g.silverWeight)} · {moment(g.rep.created_at).format("DD/MM/YY")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Selection summary */}
                  <div className="grid grid-cols-3 gap-1.5 border-1 border-purple-200 bg-purple-50 rounded-xl p-2.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-black/50">ที่เลือก</span>
                      <span className="text-sm font-bold text-purple-700">{selected.length} รายการ ({selBills} บิล)</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-black/50">น้ำหนักรวม</span>
                      <span className="text-sm font-bold text-purple-700">
                        {selWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} {weightUnit}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-black/50">ยอดรวม</span>
                      <span className="text-sm font-bold text-purple-700">{selTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={clearDisc.onClose} isDisabled={clearing}>ยกเลิก</Button>
            <Button
              className="bg-purple-600 text-white font-bold"
              onPress={handleClearBills}
              isLoading={clearing}
              isDisabled={clearLoading || selectedClearKeys.size === 0}
            >
              ยืนยันเคลียร์บิล
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
