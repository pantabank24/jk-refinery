"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Keyboard, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

interface SystemConfig { key: string; value: string; description: string; }

interface Schedule {
  id: number;
  scope: "weekday" | "range";
  weekday: number | null;
  start_at: string | null; // ISO
  end_at: string | null;    // ISO
  enabled: boolean;
  open_time: string;
  close_time: string;
  note: string;
}

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const STATE_LABEL: Record<"on" | "off", string> = { on: "พิมพ์เองได้", off: "ปุ่ม +/-5" };
const STATE_CELL: Record<"on" | "off", string> = {
  on: "bg-green-200/60 text-green-800",
  off: "bg-amber-200/70 text-amber-800",
};
const STATE_DOT: Record<"on" | "off", string> = { on: "bg-green-500", off: "bg-amber-500" };
const stateOf = (r: Schedule): "on" | "off" => (r.enabled ? "on" : "off");

// "YYYY-MM-DDTHH:MM" (local) for <input type="datetime-local">.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const localToISO = (s: string) => (s ? new Date(s).toISOString() : null);

// Local day key for comparison.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const blankWeekday = (): Schedule => ({
  id: 0, scope: "weekday", weekday: 1, start_at: null, end_at: null,
  enabled: true, open_time: "09:30", close_time: "16:30", note: "",
});
const blankRange = (day: Date): Schedule => {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 0, 0);
  return {
    id: 0, scope: "range", weekday: null,
    start_at: start.toISOString(), end_at: end.toISOString(),
    enabled: true, open_time: "09:30", close_time: "16:30", note: "",
  };
};

export default function CustomerSellSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("config.update");

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Schedule[]>([]);
  const [form, setForm] = useState<Schedule | null>(null);
  // First day of the displayed calendar month.
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const fetchAll = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.get<SystemConfig[]>("/configs"),
        api.get<Schedule[]>("/custom-weight-schedules"),
      ]);
      const map: Record<string, string> = {};
      ((cRes.data as unknown as SystemConfig[]) || []).forEach((c) => { map[c.key] = c.value; });
      setCfg(map);
      setRules((sRes.data as unknown as Schedule[]) || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const setC = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));
  const masterOn = cfg["custom_weight_enabled"] === "true";

  const weekdayRules = rules.filter((r) => r.scope === "weekday");
  const rangeRules = rules.filter((r) => r.scope === "range");

  // Toggling saves immediately — no separate save button for this page.
  const toggleMaster = async (v: boolean) => {
    setC("custom_weight_enabled", v ? "true" : "false");
    try {
      await api.put("/configs", { key: "custom_weight_enabled", value: v ? "true" : "false" });
    } catch { /* ignore */ }
  };

  const saveRule = async () => {
    if (!form) return;
    await api.put("/custom-weight-schedules", {
      id: form.id || undefined,
      scope: form.scope,
      weekday: form.scope === "weekday" ? form.weekday : undefined,
      start_at: form.scope === "range" ? form.start_at : undefined,
      end_at: form.scope === "range" ? form.end_at : undefined,
      enabled: form.enabled,
      open_time: form.open_time,
      close_time: form.close_time,
      note: form.note,
    });
    setForm(null);
    fetchAll();
  };

  const [delId, setDelId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDeleteRule = async () => {
    if (delId == null) return;
    setDeleting(true);
    try {
      await api.delete(`/custom-weight-schedules/${delId}`);
      setDelId(null);
      fetchAll();
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  // The range rule covering a given calendar day (latest start wins).
  const rangeForDay = (day: Date): Schedule | null => {
    const ds = new Date(day); ds.setHours(0, 0, 0, 0);
    const de = new Date(day); de.setHours(23, 59, 59, 999);
    const matches = rangeRules.filter((r) =>
      r.start_at && r.end_at && new Date(r.start_at) <= de && new Date(r.end_at) >= ds
    );
    if (matches.length === 0) return null;
    return matches.sort((a, b) => new Date(b.start_at!).getTime() - new Date(a.start_at!).getTime())[0];
  };
  const weekdayForDay = (day: Date): Schedule | null =>
    weekdayRules.find((r) => r.weekday === day.getDay()) ?? null;

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;
  }

  // 6x7 calendar grid starting on the Sunday on/before the 1st.
  const gridStart = new Date(calMonth);
  gridStart.setDate(1 - calMonth.getDay());
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
  });
  const today = new Date();

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ตั้งค่าลูกค้าขาย
        </div>
      </div>

      <div className="flex flex-col gap-y-4 overflow-y-auto pb-6">
        {/* Master toggle */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-1">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-md flex items-center gap-x-2">
                <Keyboard size={16} className="text-[#c09c42]" /> อนุญาตให้ลูกค้าพิมพ์น้ำหนักเอง
              </span>
              <span className="text-xs text-black/50">หากปิด ลูกค้าต้องกดปุ่ม +/- ทีละ 5 เท่านั้นเสมอ</span>
            </div>
            <Switch isDisabled={!canEdit} isSelected={masterOn} color="warning"
              onValueChange={toggleMaster} />
          </div>
        </div>

        {masterOn && (
          <>
            {/* Weekday rules (recurring) */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
              <div className="flex flex-row items-center justify-between">
                <span className="font-bold text-md">กฎรายสัปดาห์</span>
                {canEdit && (
                  <Button size="sm" variant="flat" className="rounded-2xl font-bold"
                    startContent={<Plus size={14} />} onPress={() => setForm(blankWeekday())}>เพิ่มวัน</Button>
                )}
              </div>
              {weekdayRules.length === 0 && <span className="text-xs text-black/40">ยังไม่มี — ทุกวันใช้ปุ่ม +/-5 ตามปกติ</span>}
              <div className="flex flex-wrap gap-2">
                {weekdayRules.sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0)).map((r) => (
                  <button key={r.id} onClick={() => canEdit && setForm(r)}
                    className={`flex items-center gap-x-2 px-3 py-2 rounded-2xl border-1 border-black/10 ${STATE_CELL[stateOf(r)]}`}>
                    <span className="font-bold text-sm">ทุกวัน{WEEKDAYS[r.weekday ?? 0]}</span>
                    <span className="text-[11px] opacity-80">{r.enabled ? `${r.open_time}-${r.close_time}` : "ปิด"}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar — ranges */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
              <div className="flex flex-row items-center justify-between">
                <span className="font-bold text-md flex items-center gap-x-2">
                  <CalendarDays size={16} className="text-[#c09c42]" /> ตารางเวลาล่วงหน้า (ช่วงวันเวลา)
                </span>
                <div className="flex items-center gap-x-1">
                  <Button isIconOnly size="sm" variant="light" className="rounded-xl"
                    onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
                    <ChevronLeft size={18} />
                  </Button>
                  <span className="font-bold text-sm w-36 text-center">{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear() + 543}</span>
                  <Button isIconOnly size="sm" variant="light" className="rounded-xl"
                    onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-black/50">
                {(["on", "off"] as const).map((m) => (
                  <span key={m} className="flex items-center gap-x-1"><span className={`w-3 h-3 rounded-full ${STATE_DOT[m]}`} /> {STATE_LABEL[m]}</span>
                ))}
                <span className="text-black/30">· คลิกวันเพื่อเพิ่ม/แก้กฎช่วงนั้น</span>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className={`text-center text-xs font-bold py-1 ${i === 0 ? "text-red-500" : "text-black/50"}`}>{w}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  const inMonth = d.getMonth() === calMonth.getMonth();
                  const range = rangeForDay(d);
                  const wd = weekdayForDay(d);
                  const isToday = dayKey(d) === dayKey(today);
                  const cellState = range ? stateOf(range) : null;
                  return (
                    <button
                      key={i}
                      disabled={!canEdit}
                      onClick={() => setForm(range ?? blankRange(d))}
                      className={`relative h-16 rounded-xl border-1 p-1 text-left transition-colors
                        ${inMonth ? "border-black/10" : "border-transparent opacity-40"}
                        ${cellState ? STATE_CELL[cellState] : "bg-white/40 hover:bg-black/5"}
                        ${isToday ? "ring-2 ring-[#c09c42]" : ""}`}
                    >
                      <span className="text-xs font-bold">{d.getDate()}</span>
                      {/* weekday-rule marker (only when no range overrides) */}
                      {!range && wd && (
                        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${STATE_DOT[stateOf(wd)]}`} />
                      )}
                      {range?.note && <span className="block text-[9px] leading-tight mt-0.5 line-clamp-2">{range.note}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Range list */}
              {rangeRules.length > 0 && (
                <div className="flex flex-col gap-y-2 mt-1">
                  {rangeRules.sort((a, b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime()).map((r) => (
                    <div key={r.id} className="flex flex-row items-center justify-between gap-x-2 p-3 rounded-2xl bg-white/50 border-1 border-black/10">
                      <div className="flex items-center gap-x-2">
                        <span className={`w-3 h-3 rounded-full ${STATE_DOT[stateOf(r)]}`} />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">
                            {toLocalInput(r.start_at).replace("T", " ")} → {toLocalInput(r.end_at).replace("T", " ")}
                          </span>
                          <span className="text-xs text-black/50">{STATE_LABEL[stateOf(r)]}{r.enabled ? ` · ${r.open_time}-${r.close_time}` : ""}{r.note ? ` · ${r.note}` : ""}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-x-1">
                          <Button size="sm" variant="light" className="rounded-xl" onPress={() => setForm(r)}>แก้ไข</Button>
                          <Button size="sm" variant="light" color="danger" isIconOnly className="rounded-xl" onPress={() => setDelId(r.id)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add/edit form (modal-ish overlay) */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setForm(null)}>
          <div className="w-full sm:max-w-md bg-white rounded-3xl p-5 flex flex-col gap-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <span className="font-bold text-md">
              {form.id ? "แก้ไขกฎ" : form.scope === "weekday" ? "เพิ่มกฎรายสัปดาห์" : "เพิ่มกฎช่วงวันเวลา"}
            </span>

            {form.scope === "weekday" ? (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w, i) => (
                  <button key={i} onClick={() => setForm({ ...form, weekday: i })}
                    className={`w-10 h-10 text-xs font-bold rounded-xl border-1 ${form.weekday === i ? "bg-[#c09c42] text-white border-[#c09c42]" : "bg-black/5 border-black/10"}`}>
                    {w}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <Input type="datetime-local" label="เริ่ม (วันเวลา)" value={toLocalInput(form.start_at)}
                  onValueChange={(v) => setForm({ ...form, start_at: localToISO(v) })}
                  classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }} />
                <Input type="datetime-local" label="สิ้นสุด (วันเวลา)" value={toLocalInput(form.end_at)}
                  onValueChange={(v) => setForm({ ...form, end_at: localToISO(v) })}
                  classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }} />
              </div>
            )}

            <div className="flex flex-row items-center justify-between">
              <span className="font-bold text-sm">อนุญาตพิมพ์น้ำหนักเองในช่วงนี้</span>
              <Switch isSelected={form.enabled} color="warning" onValueChange={(v) => setForm({ ...form, enabled: v })} />
            </div>

            {form.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <Input type="time" label="เริ่มเวลา" value={form.open_time}
                  onValueChange={(v) => setForm({ ...form, open_time: v })}
                  classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }} />
                <Input type="time" label="สิ้นสุดเวลา" value={form.close_time}
                  onValueChange={(v) => setForm({ ...form, close_time: v })}
                  classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }} />
              </div>
            )}

            <Input label="หมายเหตุ (ไม่บังคับ)" value={form.note}
              onValueChange={(v) => setForm({ ...form, note: v })}
              classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }} />

            <div className="flex gap-x-2 justify-end mt-1">
              <Button size="sm" variant="light" className="rounded-2xl" onPress={() => setForm(null)}>ยกเลิก</Button>
              <Button size="sm" className="rounded-2xl bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold" onPress={saveRule}>บันทึกกฎ</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={delId != null}
        onClose={() => setDelId(null)}
        onConfirm={confirmDeleteRule}
        name="กฎนี้"
        loading={deleting}
      />
    </div>
  );
}
