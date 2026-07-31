"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import {
  MessageCircle, Save, CheckCircle2, XCircle, RefreshCw, Unlink,
  Send, Gauge, AlertTriangle, Scale, RotateCcw,
} from "lucide-react";

// One metal = one alert channel, mirroring the เคลียร์บิล pages (/bills = ทอง,
// /bills/silver = เงิน). Bills are single-metal, so a shared threshold could
// never match what either page shows.
type Metal = "gold" | "silver";

const METALS: { key: Metal; label: string; unit: string; accent: string }[] = [
  { key: "gold",   label: "ทอง", unit: "บาท",  accent: "#c09c42" },
  { key: "silver", label: "เงิน", unit: "กรัม", accent: "#8a8f98" },
];

interface BacklogRow {
  metal: Metal;
  enabled: boolean;
  threshold: number;
  count: number;
  weight: number;
  amount: number;
  latched: boolean;
}

// The sell-in meter: metal customers sold to the shop, accumulated across ALL of
// them until it makes a full lot (65 บาท of gold / 1000 กรัม of silver, each
// traded as 1 กิโลกรัม), which is announced once and taken off the meter. One
// meter per metal, same as the backlog above — and unlike the backlog, it only
// ever goes up.
interface SellAccumRow {
  metal: Metal;
  enabled: boolean;
  threshold: number;
  purity: string;
  unit: string;
  accumulated: number;
  remaining: number;
}

interface LineStatus {
  line_notify_enabled: string;
  line_notify_target_id: string;
  line_notify_gold_enabled: string;
  line_notify_silver_enabled: string;
  line_bill_notify_threshold_gold: string;
  line_bill_notify_threshold_silver: string;
  token_set: boolean;
  oa_basic_id: string;
  backlog: BacklogRow[];
  sell_accum: SellAccumRow[];
}

// The sell-in rule as it is being edited. Kept apart from `sell_accum` above so
// the live meter keeps reporting against the SAVED threshold while a new one is
// still being typed.
interface SellAccumForm {
  enabled: boolean;
  threshold: string;
  purity: string;
}

interface QuotaInfo {
  configured: boolean;
  // "limited" = a monthly cap applies; "none" = unlimited plan.
  type?: string;
  limit?: number;
  used?: number;
  remaining?: number;
}

const num = (v: number | undefined) => (v ?? 0).toLocaleString("th-TH");
const dec = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Announcement wording per metal, mirroring the API's metalNoun().
const METAL_NOUN: Record<Metal, string> = { gold: "ทองคำ", silver: "เงิน" };

const emptySellAccumForm = (): Record<Metal, SellAccumForm> => ({
  gold:   { enabled: false, threshold: "65",   purity: "99.99" },
  silver: { enabled: false, threshold: "1000", purity: "99.9" },
});

export default function LineNotificationPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("config.read");
  const canUpdate = hasPermission("config.update");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [resetting, setResetting] = useState<Metal | null>(null);
  const [error, setError] = useState("");

  const [status, setStatus] = useState<LineStatus>({
    line_notify_enabled: "false",
    line_notify_target_id: "",
    line_notify_gold_enabled: "false",
    line_notify_silver_enabled: "false",
    line_bill_notify_threshold_gold: "5",
    line_bill_notify_threshold_silver: "5",
    token_set: false,
    oa_basic_id: "",
    backlog: [],
    sell_accum: [],
  });

  const [accumForm, setAccumForm] = useState<Record<Metal, SellAccumForm>>(emptySellAccumForm);

  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState("");

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  const fetchStatus = useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await api.get("/line/status");
      const data = res.data as unknown as LineStatus;
      const rows = data.sell_accum ?? [];
      setStatus({ ...data, backlog: data.backlog ?? [], sell_accum: rows });
      // Seed the edit form from what came back, keeping the defaults for a metal
      // the API didn't report (its migration hasn't run yet).
      setAccumForm((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.metal] = {
            enabled: row.enabled,
            threshold: String(row.threshold ?? 0),
            purity: row.purity || prev[row.metal].purity,
          };
        }
        return next;
      });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [canRead]);

  // Quota lives behind a call to LINE, so it loads separately — a slow or failing
  // LINE API must not hold up the settings themselves.
  const fetchQuota = useCallback(async () => {
    if (!canRead) return;
    setQuotaLoading(true);
    setQuotaError("");
    try {
      const res = await api.get("/line/quota");
      setQuota(res.data as unknown as QuotaInfo);
    } catch (e) {
      setQuotaError(e instanceof Error ? e.message : "โหลดโควตาไม่สำเร็จ");
    } finally {
      setQuotaLoading(false);
    }
  }, [canRead]);

  useEffect(() => { fetchStatus(); fetchQuota(); }, [fetchStatus, fetchQuota]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await api.put("/line/config", {
        enabled: status.line_notify_enabled === "true",
        gold_enabled: status.line_notify_gold_enabled === "true",
        silver_enabled: status.line_notify_silver_enabled === "true",
        gold_threshold: parseInt(status.line_bill_notify_threshold_gold || "0", 10) || 0,
        silver_threshold: parseInt(status.line_bill_notify_threshold_silver || "0", 10) || 0,
        sell_accum: Object.fromEntries(
          METALS.map(({ key }) => [key, {
            enabled: accumForm[key].enabled,
            threshold: parseFloat(accumForm[key].threshold || "0") || 0,
            // Sent as typed: an empty box is the API's error to report, not
            // something to silently paper over with a made-up purity.
            purity: accumForm[key].purity,
          }]),
        ),
      });
      const data = res.data as unknown as { backlog?: BacklogRow[]; sell_accum?: SellAccumRow[] };
      if (data?.backlog) setStatus((p) => ({ ...p, backlog: data.backlog! }));
      if (data?.sell_accum) setStatus((p) => ({ ...p, sell_accum: data.sell_accum! }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (metal: Metal) => {
    setTesting(metal);
    setError("");
    try {
      await api.post(`/line/test?kind=backlog&metal=${metal}`, {});
      await fetchQuota();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อความทดสอบไม่สำเร็จ");
    } finally {
      setTesting(null);
    }
  };

  const handleTestSellAccum = async (metal: Metal) => {
    setTesting(`sell_accum:${metal}`);
    setError("");
    try {
      await api.post(`/line/test?kind=sell_accum&metal=${metal}`, {});
      await fetchQuota();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อความทดสอบไม่สำเร็จ");
    } finally {
      setTesting(null);
    }
  };

  // Zeroing a meter throws away real accumulated metal, so it asks first — and
  // it only ever clears the one metal, never both.
  const handleResetSellAccum = async (metal: Metal, label: string, unit: string) => {
    if (!window.confirm(`ล้างยอดสะสม${label}ให้เป็น 0 ${unit}? น้ำหนักที่สะสมไว้จะไม่ถูกนับในการแจ้งครั้งถัดไป`)) return;
    setResetting(metal);
    setError("");
    try {
      const res = await api.post(`/line/sell-accum/reset?metal=${metal}`, {});
      const data = res.data as unknown as { sell_accum?: SellAccumRow[] };
      if (data?.sell_accum) setStatus((p) => ({ ...p, sell_accum: data.sell_accum! }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ล้างยอดสะสมไม่สำเร็จ");
    } finally {
      setResetting(null);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await api.post("/line/unlink", {});
      await fetchStatus();
    } catch { /* ignore */ } finally {
      setUnlinking(false);
    }
  };

  const isLinked = !!status.line_notify_target_id;
  const masterOn = status.line_notify_enabled === "true";
  const addFriendUrl = status.oa_basic_id
    ? `https://line.me/R/ti/p/@${status.oa_basic_id.replace(/^@/, "")}`
    : null;

  const backlogOf = (metal: Metal) => status.backlog.find((b) => b.metal === metal);

  const usedPct =
    quota?.type === "limited" && (quota.limit ?? 0) > 0
      ? Math.min(100, ((quota.used ?? 0) / (quota.limit ?? 1)) * 100)
      : 0;

  const accumOf = (metal: Metal) => status.sell_accum.find((s) => s.metal === metal);

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col h-full gap-y-4 pt-5 px-1 overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-x-3 shrink-0">
        <MessageCircle size={22} className="text-[#c09c42]" />
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          การแจ้งเตือน LINE
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start max-w-5xl">

          {/* Token status */}
          <div className={`lg:col-span-2 flex items-center gap-x-3 border-1 rounded-2xl p-3 ${status.token_set ? "border-green-200 bg-green-50/60" : "border-red-200 bg-red-50/60"}`}>
            {status.token_set
              ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              : <XCircle size={18} className="text-red-500 shrink-0" />
            }
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${status.token_set ? "text-green-700" : "text-red-600"}`}>
                {status.token_set ? "Channel Access Token พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า Channel Access Token"}
              </span>
              <span className="text-xs text-black/40">
                ตั้งค่าใน .env: <code className="bg-black/5 px-1 rounded">LINE_CHANNEL_ACCESS_TOKEN</code> และ <code className="bg-black/5 px-1 rounded">LINE_CHANNEL_SECRET</code>
              </span>
            </div>
          </div>

          {/* Add friend / scan QR */}
          <div className="flex flex-col self-stretch border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-black/70">เชื่อมต่อ LINE</span>
              <button onClick={fetchStatus} className="text-black/30 hover:text-black/60 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-y-3">
              {isLinked ? (
                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center gap-x-2 bg-green-50 border-1 border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-green-700">เชื่อมต่อแล้ว</span>
                      <span className="text-[11px] text-black/50 truncate font-mono">{status.line_notify_target_id}</span>
                    </div>
                  </div>
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      startContent={<Unlink size={13} />}
                      onPress={handleUnlink}
                      isLoading={unlinking}
                      className="self-start"
                    >
                      ยกเลิกการเชื่อมต่อ
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-y-3">
                  <div className="flex items-center gap-x-2 bg-yellow-50 border-1 border-yellow-200 rounded-xl px-3 py-2">
                    <XCircle size={16} className="text-yellow-600 shrink-0" />
                    <span className="text-xs text-yellow-700 font-bold">ยังไม่ได้เชื่อมต่อ</span>
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <span className="text-xs text-black/50 font-bold">วิธีเชื่อมต่อ</span>
                    <ol className="text-xs text-black/60 list-decimal list-inside space-y-1">
                      <li>กด &quot;เพิ่มเพื่อน&quot; หรือสแกน QR Code ด้านล่าง</li>
                      <li>ระบบจะบันทึก ID ของคุณอัตโนมัติเมื่อ follow</li>
                      <li>กด refresh เพื่อตรวจสอบสถานะ</li>
                    </ol>
                    <span className="text-[10px] text-black/35 mt-1">
                      หรือ invite bot เข้ากลุ่ม — จะรับแจ้งเตือนในกลุ่มแทน
                    </span>
                  </div>

                  {addFriendUrl ? (
                    <div className="flex flex-col items-center gap-y-3 py-2">
                      {/* QR image from LINE official */}
                      <img
                        src={`https://qr-official.line.me/gs/M/${status.oa_basic_id.replace(/^@/, "")}_256.png`}
                        alt="LINE QR Code"
                        className="w-36 h-36 rounded-xl border-1 border-black/10"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <a
                        href={addFriendUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-x-2 bg-[#06C755] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#05b54d] transition-colors"
                      >
                        <MessageCircle size={16} />
                        เพิ่มเพื่อนใน LINE
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-black/40 bg-black/5 rounded-xl p-3">
                      ตั้งค่า <code className="bg-black/10 px-1 rounded">LINE_OA_BASIC_ID</code> ใน .env เพื่อแสดง QR Code
                      <br />เช่น <code className="bg-black/10 px-1 rounded">LINE_OA_BASIC_ID=@shopname</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Message quota dashboard */}
          <div className="flex flex-col self-stretch border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Gauge size={15} className="text-[#c09c42]" />
                <span className="font-bold text-sm text-black/70">โควตาข้อความเดือนนี้</span>
              </div>
              <button onClick={fetchQuota} className="text-black/30 hover:text-black/60 transition-colors" title="รีเฟรช">
                <RefreshCw size={14} className={quotaLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Fills the card so a stretched row leaves no ragged gap */}
            <div className="flex flex-1 flex-col justify-center gap-y-3">
              {quotaLoading && !quota ? (
                <div className="flex items-center justify-center py-4"><Spinner size="sm" color="warning" /></div>
              ) : quotaError ? (
                <span className="text-xs text-red-500">{quotaError}</span>
              ) : !quota?.configured ? (
                <span className="text-xs text-black/40">ตั้งค่า Channel Access Token ก่อน จึงจะดูโควตาได้</span>
              ) : quota.type !== "limited" ? (
                <div className="flex flex-col gap-y-1">
                  <span className="text-sm font-bold text-green-700">ไม่จำกัดจำนวนข้อความ</span>
                  <span className="text-xs text-black/50">ส่งไปแล้วเดือนนี้ {num(quota.used)} ข้อความ</span>
                </div>
              ) : (
                // Kept as one block and centred by the wrapper rather than spread
                // with justify-between: next to an unlinked connect card (QR makes
                // it ~400px) spreading would tear the tiles apart.
                <div className="flex flex-col gap-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "ใช้ไปแล้ว", value: num(quota.used), color: "text-black/80" },
                      { label: "เหลือ", value: num(quota.remaining), color: (quota.remaining ?? 0) > 0 ? "text-green-700" : "text-red-600" },
                      { label: "โควตา/เดือน", value: num(quota.limit), color: "text-black/50" },
                    ].map((tile) => (
                      <div key={tile.label} className="flex flex-col items-center bg-white/70 border-1 border-black/10 rounded-xl py-2.5">
                        <span className={`text-lg font-bold ${tile.color}`}>{tile.value}</span>
                        <span className="text-[10px] text-black/40">{tile.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-[#06C755]"}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-black/40 self-end">ใช้ไป {usedPct.toFixed(1)}%</span>
                  </div>

                  <span className="text-[10px] text-black/35">
                    นับเฉพาะข้อความที่คิดโควตา (push) — ข้อความตอบกลับอัตโนมัติไม่ถูกนับ · รีเซ็ตทุกต้นเดือน
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Master switch — full width: it gates both metal cards below it */}
          <div className="lg:col-span-2 flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <span className="font-bold text-sm text-black/70">ตั้งค่าการแจ้งเตือน</span>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold">เปิดใช้งานการแจ้งเตือน</span>
                <span className="text-xs text-black/40">สวิตช์หลัก — ปิดแล้วจะไม่ส่งแจ้งเตือนทุกแบบ</span>
              </div>
              <Switch
                isSelected={masterOn}
                isDisabled={!canUpdate || !isLinked}
                onValueChange={(v) => setStatus((p) => ({ ...p, line_notify_enabled: v ? "true" : "false" }))}
                color="success"
              />
            </div>
          </div>

          {/* Per-metal toggle + threshold */}
          {METALS.map(({ key, label, unit, accent }) => {
            const enabledKey = key === "gold" ? "line_notify_gold_enabled" : "line_notify_silver_enabled";
            const thresholdKey = key === "gold" ? "line_bill_notify_threshold_gold" : "line_bill_notify_threshold_silver";
            const on = status[enabledKey] === "true";
            const b = backlogOf(key);
            const threshold = parseInt(status[thresholdKey] || "0", 10) || 0;
            const reached = !!b && threshold > 0 && b.count >= threshold;

            return (
              // self-stretch keeps ทอง and เงิน level with each other even though the
              // rest of the grid is top-aligned (a linked/unlinked connect card
              // changes height a lot, and shouldn't drag the quota card with it).
              <div key={key} className="flex flex-col self-stretch border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">แจ้งเตือนบิล{label}ค้างเคลียร์</span>
                      <span className="text-xs text-black/40">นับแยกจาก{label === "ทอง" ? "เงิน" : "ทอง"} ไม่รวมกัน</span>
                    </div>
                  </div>
                  <Switch
                    isSelected={on}
                    isDisabled={!canUpdate || !isLinked || !masterOn}
                    onValueChange={(v) => setStatus((p) => ({ ...p, [enabledKey]: v ? "true" : "false" }))}
                    color="success"
                  />
                </div>

                <Input
                  type="number"
                  label={`เกณฑ์จำนวนบิล${label}ที่รอเคลียร์`}
                  placeholder="5"
                  value={status[thresholdKey]}
                  isDisabled={!canUpdate}
                  onValueChange={(v) => setStatus((p) => ({ ...p, [thresholdKey]: v }))}
                  description="แจ้งครั้งเดียวตอนยอดขึ้นถึงเกณฑ์ (เช่น 19 → 20) จะแจ้งอีกครั้งเมื่อยอดลดต่ำกว่าเกณฑ์แล้วขึ้นมาใหม่ · ใส่ 0 เพื่อปิด"
                  classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10" }}
                />

                {/* Live backlog — the same number the หน้าเคลียร์บิล shows */}
                {b && (
                  <div className="flex flex-col gap-y-1.5 bg-white/60 border-1 border-black/10 rounded-xl px-3 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-black/50">ค้างเคลียร์ตอนนี้</span>
                      <span className="text-sm font-bold" style={{ color: reached ? "#dc2626" : accent }}>
                        {num(b.count)} บิล{threshold > 0 ? ` / เกณฑ์ ${num(threshold)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-black/50">น้ำหนักรวม</span>
                      <span className="text-xs font-bold text-black/70">{dec(b.weight)} {unit}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-black/50">ยอดรวม</span>
                      <span className="text-xs font-bold text-black/70">{dec(b.amount)} บาท</span>
                    </div>
                    {b.latched && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-x-1">
                        <AlertTriangle size={11} /> แจ้งเตือนรอบนี้ไปแล้ว — รอให้ยอดลดต่ำกว่าเกณฑ์ก่อนจะแจ้งอีกครั้ง
                      </span>
                    )}
                  </div>
                )}

                {canUpdate && isLinked && (
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Send size={13} />}
                    onPress={() => handleTest(key)}
                    isLoading={testing === key}
                    className="self-start"
                  >
                    ส่งข้อความทดสอบ ({label})
                  </Button>
                )}
              </div>
            );
          })}

          {/* Sell-in meters — the second alert. Its own heading, because the two
              cards under it answer a different question from the backlog cards
              above ("how much have we bought" vs "how much is left to clear"). */}
          <div className="lg:col-span-2 flex items-center gap-x-2 pt-1">
            <Scale size={15} className="text-[#c09c42]" />
            <div className="flex flex-col">
              <span className="font-bold text-sm text-black/70">แจ้งขายเมื่อยอดที่ลูกค้าขายเข้ามาครบเกณฑ์</span>
              <span className="text-xs text-black/40">
                นับรวมทุกลูกค้าทั้งร้าน · เริ่มนับตอน &quot;ออกบิล&quot; ให้ลูกค้า · ทองกับเงินนับแยกมิเตอร์กัน
              </span>
            </div>
          </div>

          {METALS.map(({ key, label, unit, accent }) => {
            const form = accumForm[key];
            const live = accumOf(key);
            // The meter reports against the SAVED threshold, not what is currently
            // typed in the box — showing 120% because someone lowered a number
            // they haven't saved yet would read as "it already fired".
            const savedThreshold = live?.threshold ?? 0;
            const pct = savedThreshold > 0 ? Math.min(100, ((live?.accumulated ?? 0) / savedThreshold) * 100) : 0;
            const typedThreshold = parseFloat(form.threshold || "0") || 0;
            const unsaved = !!live && typedThreshold !== savedThreshold;
            const purity = (form.purity || "").replace(/%$/, "") || "—";

            const patch = (p: Partial<SellAccumForm>) =>
              setAccumForm((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));

            return (
              <div key={`accum-${key}`} className="flex flex-col self-stretch border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">แจ้งขาย{METAL_NOUN[key]}สะสม</span>
                      <span className="text-xs text-black/40">
                        นับแยกจาก{label === "ทอง" ? "เงิน" : "ทอง"} ไม่รวมกัน
                      </span>
                    </div>
                  </div>
                  <Switch
                    isSelected={form.enabled}
                    isDisabled={!canUpdate || !isLinked || !masterOn}
                    onValueChange={(v) => patch({ enabled: v })}
                    color="success"
                  />
                </div>

                <Input
                  type="number"
                  label={`เกณฑ์น้ำหนัก${label}สะสม (${unit}) ต่อ 1 กิโลกรัม`}
                  placeholder={key === "gold" ? "65" : "1000"}
                  value={form.threshold}
                  isDisabled={!canUpdate}
                  onValueChange={(v) => patch({ threshold: v })}
                  description="ครบเมื่อไหร่แจ้งครั้งหนึ่ง แล้วตัดยอดออก เศษที่เหลือสะสมต่อ · ใส่ 0 เพื่อปิด"
                  classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10" }}
                />

                <Input
                  label="ความบริสุทธิ์ที่ระบุในข้อความ (%)"
                  placeholder={key === "gold" ? "99.99" : "99.9"}
                  value={form.purity}
                  isDisabled={!canUpdate}
                  onValueChange={(v) => patch({ purity: v })}
                  description={`ข้อความจะเขียนว่า แจ้งขาย${METAL_NOUN[key]} XX.XX%`}
                  classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10" }}
                />

                {/* Live meter */}
                {live && (
                  <div className="flex flex-col gap-y-1.5 bg-white/60 border-1 border-black/10 rounded-xl px-3 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-black/50">สะสมตอนนี้</span>
                      <span className="text-sm font-bold" style={{ color: accent }}>
                        {dec(live.accumulated)} {unit}
                        {savedThreshold > 0 ? ` / เกณฑ์ ${dec(savedThreshold)}` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                    {savedThreshold > 0 && (
                      <span className="text-[10px] text-black/40 self-end">
                        อีก {dec(live.remaining)} {unit} จะแจ้งครั้งถัดไป
                      </span>
                    )}
                    {unsaved && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-x-1">
                        <AlertTriangle size={11} /> ยังไม่ได้บันทึกเกณฑ์ใหม่ — ยอดด้านบนยังเทียบกับเกณฑ์เดิม
                      </span>
                    )}
                  </div>
                )}

                {/* Exactly what lands in the chat, so the wording can be checked
                    before it goes to a counterparty. */}
                <div className="flex flex-col gap-y-1 bg-[#06C755]/10 border-1 border-[#06C755]/30 rounded-xl px-3 py-2.5">
                  <span className="text-[10px] text-black/40 font-bold">ตัวอย่างข้อความ</span>
                  <span className="text-xs text-black/70">
                    วีระชัย ชัยนุมาศ วันที่ 31/07/2568 เวลา 14:35 น. แจ้งขาย{METAL_NOUN[key]} {purity}% จำนวน 1 กิโลกรัม
                  </span>
                  <span className="text-[10px] text-black/35">
                    ชื่อคือลูกค้าของบิลที่ทำให้ยอดครบเกณฑ์ · บิลเดียวที่หนักเกินหลายเท่าจะแจ้งรวมเป็น &quot;จำนวน 2 กิโลกรัม&quot; ในข้อความเดียว
                  </span>
                </div>

                {canUpdate && isLinked && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Send size={13} />}
                      onPress={() => handleTestSellAccum(key)}
                      isLoading={testing === `sell_accum:${key}`}
                    >
                      ส่งข้อความทดสอบ
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      startContent={<RotateCcw size={13} />}
                      onPress={() => handleResetSellAccum(key, label, unit)}
                      isLoading={resetting === key}
                    >
                      ล้างยอดสะสม
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Webhook URL hint */}
          <div className="lg:col-span-2 flex flex-col border-1 border-blue-200 bg-blue-50/60 rounded-2xl p-3 gap-y-1">
            <span className="text-xs font-bold text-blue-700">Webhook URL</span>
            <span className="text-xs text-black/50">
              ตั้งค่าใน LINE Developer Console:
            </span>
            <code className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-lg break-all">
              https://yourdomain.com/api/v1/line/webhook
            </code>
            <span className="text-[10px] text-black/40 mt-1">
              ตั้งค่า <code className="bg-black/10 px-1 rounded">APP_PUBLIC_URL</code> ใน .env ของ API
              เพื่อให้การ์ดแจ้งเตือนมีปุ่มเปิดหน้าเคลียร์บิลได้
            </span>
          </div>

          {error && (
            <div className="lg:col-span-2 flex items-center gap-x-2 border-1 border-red-200 bg-red-50/60 rounded-xl px-3 py-2">
              <XCircle size={15} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-600">{error}</span>
            </div>
          )}

          {canUpdate && (
            <div className="lg:col-span-2 flex justify-end">
              <Button
                className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                startContent={<Save size={14} />}
                onPress={handleSave}
                isLoading={saving}
                isDisabled={!isLinked && masterOn}
              >
                {saved ? "บันทึกแล้ว ✓" : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
