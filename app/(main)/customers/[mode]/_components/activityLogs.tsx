"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  LogIn,
  Pencil,
  PackageCheck,
  Plus,
  ShoppingCart,
  Target,
  Trash2,
} from "lucide-react";
import moment from "moment";
import { api } from "@/lib/api";

// ── Shapes returned by /logs/login and /logs/activity ────────────────────────

interface LogUser {
  id?: number;
  name: string;
  email?: string;
}

interface LoginLogRow {
  id: number;
  user_id: number | null;
  user?: LogUser | null;
  email: string;
  ip: string;
  user_agent: string;
  device: string;
  success: boolean;
  fail_reason: string;
  created_at: string;
}

// One priced line as it was at the moment of the action.
interface LogLine {
  type_name: string;
  metal?: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
}

// activity_logs.detail — the structured snapshot the controller attached. Every
// field is optional because the shape varies by `kind`; readers must check.
interface LogDetail {
  kind?: string;
  bill_code?: string;
  bill_id?: number;
  code?: string;
  quotation_id?: number;
  metal?: string;
  gold_round?: string;
  price_mode?: string;
  on_behalf?: boolean;
  total_weight?: number;
  total_amount?: number;
  total_before?: number;
  items?: LogLine[];
  before?: LogLine[];
  after?: LogLine[];
  // partial delivery
  weight?: number;
  amount?: number;
  log_only?: boolean;
  processed_weight?: number;
  processed_amount?: number;
  // auto-sell order
  sell_order_id?: number;
  type_name?: string;
  target_price?: number;
  price_at_create?: number;
  premium?: number;
  spread?: number;
  estimated?: number;
}

interface ActivityLogRow {
  id: number;
  user_id: number | null;
  user?: LogUser | null;
  target_user_id: number | null;
  target_user?: LogUser | null;
  method: string;
  path: string;
  description: string;
  ref_code: string;
  detail?: LogDetail | null;
  status_code: number;
  ip: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}

// ── Units ───────────────────────────────────────────────────────────────────
// Gold trades by บาททอง and silver is priced per kilogram; only platinum and
// palladium are weighed and priced in grams. Getting this wrong makes a log row
// look like it proves the wrong number, which is the opposite of the point.

const isGold = (metal?: string) => (metal || "gold") === "gold";
const weightUnit = (metal?: string) => (isGold(metal) ? "บาททอง" : "กรัม");
const priceUnit = (metal?: string) =>
  isGold(metal) ? "บาท/บาททอง" : metal === "silver" ? "บาท/กก." : "บาท/กรัม";

const money = (n?: number) =>
  (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = (n?: number) => (n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 4 });

const PRICE_MODE_LABEL: Record<string, string> = {
  realtime: "ราคาเรียลไทม์",
  association: "ราคาสมาคม",
  closed: "ปิดทำการ",
};

// ── Timeline model ──────────────────────────────────────────────────────────

type Category = "login" | "sell" | "document";

interface TimelineItem {
  key: string;
  at: string;
  category: Category;
  login?: LoginLogRow;
  activity?: ActivityLogRow;
}

const SELL_KINDS = new Set(["sell", "sell_order"]);

const categoryOf = (row: ActivityLogRow): Category =>
  SELL_KINDS.has(row.detail?.kind ?? "") ? "sell" : "document";

const FILTERS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "login", label: "เข้าสู่ระบบ" },
  { key: "sell", label: "การกดขาย" },
  { key: "document", label: "บิล / ใบเสนอราคา" },
];

// actionIcon picks the glyph from the action's kind, falling back to the HTTP
// method for rows logged before a kind existed (or shown in raw mode).
function actionIcon(row: ActivityLogRow) {
  switch (row.detail?.kind) {
    case "sell":
      return <ShoppingCart size={14} />;
    case "sell_order":
      return <Target size={14} />;
    case "issue_quotation":
      return <FileText size={14} />;
    case "edit_bill":
    case "edit_quotation":
      return <Pencil size={14} />;
    case "delete_bill":
    case "delete_quotation":
    case "remove_item":
      return <Trash2 size={14} />;
    case "partial_deliver":
      return <PackageCheck size={14} />;
  }
  switch (row.method) {
    case "POST":
      return <Plus size={14} />;
    case "PATCH":
    case "PUT":
      return <Pencil size={14} />;
    case "DELETE":
      return <Trash2 size={14} />;
    default:
      return <Eye size={14} />;
  }
}

// A failed request still gets logged; it must not read as something that happened.
const isFailed = (row: ActivityLogRow) => row.status_code >= 400;

// ── Detail rendering ────────────────────────────────────────────────────────

function LineTable({ title, lines }: { title?: string; lines?: LogLine[] }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {title && <span className="text-[10px] font-bold text-black/50">{title}</span>}
      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto border-1 border-black/10 bg-white/60 rounded-lg">
        <table className="w-full text-[11px] min-w-[440px]">
          <thead className="bg-black/5">
            <tr className="text-left text-black/40">
              <th className="px-2 py-1 font-bold">รายการ</th>
              <th className="px-2 py-1 font-bold text-right">ราคาที่กด</th>
              <th className="px-2 py-1 font-bold text-right">%</th>
              <th className="px-2 py-1 font-bold text-right">บวก</th>
              <th className="px-2 py-1 font-bold text-right">น้ำหนัก</th>
              <th className="px-2 py-1 font-bold text-right">ยอด (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="px-2 py-1 text-black/70">{line.type_name || "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums font-bold text-black/80">
                  {money(line.price)}
                  <span className="text-[9px] text-black/35 ml-1">{priceUnit(line.metal)}</span>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-black/50">{plain(line.percent)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-black/50">{plain(line.plus)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-black/70">
                  {plain(line.weight)}
                  <span className="text-[9px] text-black/35 ml-1">{weightUnit(line.metal)}</span>
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-bold text-black/80">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards. Six columns need 440px, so on a phone the table scrolls
          sideways inside a timeline entry that is already scrolling — two nested
          scrollers over eleven-pixel text. One card per line instead, with the
          headline figures on top and the workings underneath as Facts, the same
          label/value pairs the rest of a log entry uses. */}
      <div className="flex md:hidden flex-col gap-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="flex flex-col gap-y-1.5 border-1 border-black/10 bg-white/60 rounded-lg p-2">
            <div className="flex items-baseline justify-between gap-x-2">
              <span className="text-[11px] font-bold text-black/70 truncate">{line.type_name || "—"}</span>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-black/80">
                {money(line.total)}
                <span className="text-[9px] text-black/35 ml-1">บาท</span>
              </span>
            </div>
            <Facts
              items={[
                ["ราคาที่กด", `${money(line.price)} ${priceUnit(line.metal)}`],
                ["%", plain(line.percent)],
                ["บวก", plain(line.plus)],
                ["น้ำหนัก", `${plain(line.weight)} ${weightUnit(line.metal)}`],
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Facts({ items }: { items: [string, string][] }) {
  const shown = items.filter(([, v]) => v !== "" && v !== undefined);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {shown.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className="text-[9px] text-black/40">{label}</span>
          <span className="text-[11px] font-bold text-black/70">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DetailBody({ detail }: { detail: LogDetail }) {
  switch (detail.kind) {
    case "sell":
      return (
        <div className="flex flex-col gap-2">
          <Facts
            items={[
              ["บิล", detail.bill_code ?? "—"],
              ["รอบราคา", detail.gold_round || "—"],
              ["โหมดราคา", PRICE_MODE_LABEL[detail.price_mode ?? ""] ?? detail.price_mode ?? "—"],
              ["ผู้กด", detail.on_behalf ? "พนักงานกดแทน" : "ลูกค้ากดเอง"],
              ["น้ำหนักรวม", `${plain(detail.total_weight)} ${weightUnit(detail.metal)}`],
              ["ยอดรวม", `${money(detail.total_amount)} บาท`],
            ]}
          />
          <LineTable lines={detail.items} />
        </div>
      );

    case "sell_order":
      return (
        <Facts
          items={[
            ["คำสั่งขาย", `#${detail.sell_order_id ?? "—"}`],
            ["ประเภท", detail.type_name || "—"],
            ["น้ำหนัก", `${plain(detail.weight)} ${weightUnit(detail.metal)}`],
            ["ราคาเป้าหมาย", `${money(detail.target_price)} บาท`],
            ["ราคาตอนตั้ง", `${money(detail.price_at_create)} บาท`],
            ["premium / spread", `${money(detail.premium)} / ${money(detail.spread)}`],
            ["ยอดโดยประมาณ", `${money(detail.estimated)} บาท`],
          ]}
        />
      );

    case "remove_item":
      return (
        <div className="flex flex-col gap-2">
          <Facts items={[["บิล", detail.bill_code ?? "—"]]} />
          <LineTable title="รายการที่ถูกลบ" lines={detail.items} />
        </div>
      );

    case "delete_bill":
    case "delete_quotation":
      return (
        <div className="flex flex-col gap-2">
          <Facts
            items={[
              ["เอกสาร", detail.bill_code ?? detail.code ?? "—"],
              ["ยอดรวม", `${money(detail.total_amount)} บาท`],
            ]}
          />
          <LineTable title="รายการที่ถูกลบไปพร้อมเอกสาร" lines={detail.items} />
        </div>
      );

    case "issue_quotation":
      return (
        <div className="flex flex-col gap-2">
          <Facts
            items={[
              ["ใบเสนอราคา", detail.code ?? "—"],
              ["ยอดรวม", `${money(detail.total_amount)} บาท`],
            ]}
          />
          <LineTable lines={detail.items} />
        </div>
      );

    // Edits are the rows that settle an argument, so both sides are shown even
    // when only one line moved — the reader compares, not the code.
    case "edit_bill":
    case "edit_quotation":
      return (
        <div className="flex flex-col gap-2">
          <Facts
            items={[
              ["เอกสาร", detail.bill_code ?? detail.code ?? "—"],
              ...(detail.kind === "edit_quotation"
                ? ([
                    ["ยอดก่อนแก้", `${money(detail.total_before)} บาท`],
                    ["ยอดหลังแก้", `${money(detail.total_amount)} บาท`],
                  ] as [string, string][])
                : []),
            ]}
          />
          <LineTable title="ก่อนแก้ไข" lines={detail.before} />
          <LineTable title="หลังแก้ไข" lines={detail.after} />
        </div>
      );

    case "partial_deliver":
      return (
        <Facts
          items={[
            ["บิล", detail.bill_code ?? "—"],
            ["น้ำหนักรอบนี้", plain(detail.weight)],
            ["ยอดรอบนี้", `${money(detail.amount)} บาท`],
            ["สะสมแล้ว", `${plain(detail.processed_weight)} / ${money(detail.processed_amount)} บาท`],
            ["บันทึกอย่างเดียว", detail.log_only ? "ใช่ (ไม่บวกยอดสะสม)" : "ไม่"],
          ]}
        />
      );

    default:
      // Unknown kind — show the raw payload rather than hiding evidence.
      return (
        <pre className="text-[10px] text-black/60 whitespace-pre-wrap break-all">
          {JSON.stringify(detail, null, 2)}
        </pre>
      );
  }
}

// ── Rows ────────────────────────────────────────────────────────────────────

function LoginRow({ log }: { log: LoginLogRow }) {
  return (
    <div className="flex flex-row items-start justify-between gap-x-3 border-1 border-black/10 bg-white/30 rounded-xl px-3 py-2">
      <div className="flex flex-row items-start gap-x-2 min-w-0">
        <span
          className={`shrink-0 mt-0.5 rounded-lg p-1 ${
            log.success ? "bg-green-500/15 text-green-700" : "bg-red-500/15 text-red-600"
          }`}
        >
          <LogIn size={14} />
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-black/80">
            {log.success ? "เข้าสู่ระบบ" : "เข้าสู่ระบบไม่สำเร็จ"}
          </span>
          {!log.success && log.fail_reason && (
            <span className="text-[10px] text-red-500">{log.fail_reason}</span>
          )}
          <span className="text-[10px] text-black/45 truncate">
            {[log.device, log.ip && `IP: ${log.ip}`].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-black/50 shrink-0 tabular-nums">
        {moment(log.created_at).format("DD/MM/YY HH:mm:ss")}
      </span>
    </div>
  );
}

function ActivityRow({ log, customerId }: { log: ActivityLogRow; customerId: number }) {
  const [open, setOpen] = useState(false);
  const detail = log.detail ?? null;
  const failed = isFailed(log);
  // Who pressed the button. The customer's own clicks and the staff actions on
  // their bills sit in the same list, so the two must never blur together.
  const byCustomer = log.user_id === customerId;
  const actor = byCustomer ? "ลูกค้า" : log.user?.name || "พนักงาน";

  return (
    <div
      className={`flex flex-col border-1 rounded-xl px-3 py-2 gap-y-2 ${
        failed ? "border-red-300/50 bg-red-50/40" : "border-black/10 bg-white/30"
      }`}
    >
      <div className="flex flex-row items-start justify-between gap-x-3">
        <div className="flex flex-row items-start gap-x-2 min-w-0">
          <span
            className={`shrink-0 mt-0.5 rounded-lg p-1 ${
              byCustomer ? "bg-[#c09c42]/20 text-[#8a6f22]" : "bg-black/10 text-black/60"
            }`}
          >
            {actionIcon(log)}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-black/80">
              <span className="font-bold">{actor}</span>{" "}
              {log.description || `${log.method} ${log.path}`}
            </span>
            <span className="text-[10px] text-black/45 truncate">
              {[
                log.ref_code,
                log.ip && `IP: ${log.ip}`,
                failed && `ไม่สำเร็จ (${log.status_code})`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-y-1">
          <span className="text-[11px] text-black/50 tabular-nums">
            {moment(log.created_at).format("DD/MM/YY HH:mm:ss")}
          </span>
          {detail && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-x-0.5 text-[10px] font-bold text-[#8a6f22]"
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              รายละเอียด
            </button>
          )}
        </div>
      </div>

      {open && detail && (
        <div className="border-t border-black/10 pt-2">
          <DetailBody detail={detail} />
        </div>
      )}
    </div>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────

const PAGE = 30;

export function CustomerActivityLogs({ customerId }: { customerId: string }) {
  const numericId = Number(customerId);

  const [limit, setLimit] = useState(PAGE);
  const [showRaw, setShowRaw] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");

  const [logins, setLogins] = useState<LoginLogRow[]>([]);
  const [activities, setActivities] = useState<ActivityLogRow[]>([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [activityTotal, setActivityTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      // Two sources, one story: the login table answers "เมื่อไหร่" and the
      // activity table answers "ทำอะไร". They are merged client-side because
      // they page independently — hence the shared, growing window rather than
      // page numbers, which could not line up between the two.
      const activityUrl =
        `/logs/activity?customer_id=${customerId}&limit=${limit}` +
        (showRaw ? "" : "&described=true");
      try {
        const [loginRes, actRes] = await Promise.all([
          api.get<LoginLogRow[]>(`/logs/login?user_id=${customerId}&limit=${limit}`),
          api.get<ActivityLogRow[]>(activityUrl),
        ]);
        if (cancelled) return;
        setLogins((loginRes.data as unknown as LoginLogRow[]) || []);
        setLoginTotal((loginRes as { total_rows?: number }).total_rows || 0);
        setActivities((actRes.data as unknown as ActivityLogRow[]) || []);
        setActivityTotal((actRes as { total_rows?: number }).total_rows || 0);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "โหลด Logs ไม่สำเร็จ");
        setLogins([]);
        setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [customerId, limit, showRaw]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...logins.map((l) => ({
        key: `login-${l.id}`,
        at: l.created_at,
        category: "login" as Category,
        login: l,
      })),
      ...activities.map((a) => ({
        key: `act-${a.id}`,
        at: a.created_at,
        category: categoryOf(a),
        activity: a,
      })),
    ];
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [logins, activities]);

  const shown = filter === "all" ? timeline : timeline.filter((i) => i.category === filter);

  // Only offer "โหลดเพิ่ม" while a source still has rows beyond the window.
  const hasMore = loginTotal > logins.length || activityTotal > activities.length;

  return (
    <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
      {/* Controls */}
      <div className="flex flex-col gap-y-2 px-3 py-2.5 bg-black/5 shrink-0">
        <div className="flex flex-row items-center justify-between gap-x-3 flex-wrap gap-y-2">
          <div className="flex flex-row gap-x-1.5 flex-wrap gap-y-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border-1 transition-all ${
                  filter === f.key
                    ? "bg-gradient-to-br from-[#c09c42]/40 to-transparent border-[#c09c42]/50"
                    : "border-black/10 bg-black/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Switch size="sm" color="warning" isSelected={showRaw} onValueChange={setShowRaw}>
            <span className="text-[11px] text-black/60">แสดงทุกคำขอ</span>
          </Switch>
        </div>
        <span className="text-[10px] text-black/40">
          {showRaw
            ? "รวมการเปิดดูหน้าจอทุกครั้ง (ข้อมูลดิบ)"
            : "แสดงเฉพาะการกระทำที่มีผลกับบิล — เปิด “แสดงทุกคำขอ” เพื่อดูข้อมูลดิบทั้งหมด"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size="lg" color="warning" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-red-500 text-sm">{error}</div>
      ) : shown.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-black/40 text-sm">
          ยังไม่มีประวัติการใช้งาน
        </div>
      ) : (
        <div className="flex flex-col gap-y-2 p-2 md:overflow-y-auto md:scrollbar-hide">
          {shown.map((item) =>
            item.login ? (
              <LoginRow key={item.key} log={item.login} />
            ) : (
              <ActivityRow key={item.key} log={item.activity!} customerId={numericId} />
            )
          )}

          <div className="flex flex-col items-center gap-y-1 pt-1 pb-1">
            <span className="text-[10px] text-black/40">
              แสดง {shown.length} รายการ · เข้าสู่ระบบทั้งหมด {loginTotal} · การกระทำทั้งหมด{" "}
              {activityTotal}
            </span>
            {hasMore && (
              <Button size="sm" variant="light" onPress={() => setLimit((l) => l + PAGE)}>
                <span className="text-xs font-bold text-[#8a6f22]">โหลดเพิ่ม</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
