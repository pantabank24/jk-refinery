"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Coins, Clock, Store, DoorClosed, DoorOpen, Radio, Tag, Plus, Trash2, Scale, Pencil } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

interface SystemConfig { key: string; value: string; description: string; }

interface Tier {
  up_to_kg: number | null; // null = catch-all (largest weights)
  add_per_kg: number;
  blocked: boolean;
}

interface SilverSellStatus {
  enabled: boolean;
  shop_open: boolean;
  is_open: boolean;
  close_time: string;
  now: string;
  price_mode: string;
  manual_price: number;
  tiers: Tier[];
}

type TierMode = "normal" | "add" | "blocked";
const tierMode = (t: Tier): TierMode => (t.blocked ? "blocked" : t.add_per_kg > 0 ? "add" : "normal");
const TIER_LABEL: Record<TierMode, string> = { normal: "ราคาปกติ", add: "บวกราคา", blocked: "ขายไม่ได้" };

// Sort tiers ascending by upper bound; the catch-all (null) goes last.
const sortTiers = (list: Tier[]) =>
  [...list].sort((a, b) => {
    if (a.up_to_kg == null) return 1;
    if (b.up_to_kg == null) return -1;
    return a.up_to_kg - b.up_to_kg;
  });

export default function SilverSellSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("config.update");

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SilverSellStatus | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);

  // Enable-time modal (asks the daily cutoff before turning silver on).
  const enableDisc = useDisclosure();
  const [modalTime, setModalTime] = useState("16:30");
  // Tier add/edit form.
  const [tierForm, setTierForm] = useState<{ index: number; tier: Tier } | null>(null);
  const [delTierIdx, setDelTierIdx] = useState<number | null>(null);

  const fetchAll = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.get<SystemConfig[]>("/configs"),
        api.get<SilverSellStatus>("/configs/silver-sell-status"),
      ]);
      const map: Record<string, string> = {};
      ((cRes.data as unknown as SystemConfig[]) || []).forEach((c) => { map[c.key] = c.value; });
      setCfg(map);
      const st = (sRes.data as unknown as SilverSellStatus) || null;
      setStatus(st);
      setTiers(sortTiers(st?.tiers ?? []));
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  // Persist one key, then refresh the computed status badge.
  const saveKey = async (key: string, value: string) => {
    setCfg((p) => ({ ...p, [key]: value }));
    try {
      await api.put("/configs", { key, value });
      const sRes = await api.get<SilverSellStatus>("/configs/silver-sell-status");
      setStatus((sRes.data as unknown as SilverSellStatus) || null);
    } catch { /* ignore */ }
  };

  const enabled = cfg["silver_sell_enabled"] === "true";
  const shopOpen = cfg["silver_shop_open"] !== "false"; // default open
  const closeTime = cfg["silver_sell_close_time"] || "";
  const priceMode = cfg["silver_price_mode"] === "manual" ? "manual" : "feed";
  const manualPrice = cfg["silver_manual_price"] || "";

  // Turning ON opens the modal to set the cutoff first; turning OFF saves at once.
  const onToggleEnabled = (v: boolean) => {
    if (v) {
      setModalTime(closeTime || "16:30");
      enableDisc.onOpen();
    } else {
      saveKey("silver_sell_enabled", "false");
    }
  };
  const confirmEnable = async () => {
    await saveKey("silver_sell_close_time", modalTime);
    await saveKey("silver_sell_enabled", "true");
    enableDisc.onClose();
  };

  const toggleShop = (open: boolean) => saveKey("silver_shop_open", open ? "true" : "false");

  const saveTiers = async (list: Tier[]) => {
    const sorted = sortTiers(list);
    setTiers(sorted);
    await saveKey("silver_weight_tiers", JSON.stringify(sorted));
  };
  const submitTier = async () => {
    if (!tierForm) return;
    const next = [...tiers];
    if (tierForm.index < 0) next.push(tierForm.tier);
    else next[tierForm.index] = tierForm.tier;
    await saveTiers(next);
    setTierForm(null);
  };
  const confirmDeleteTier = async () => {
    if (delTierIdx == null) return;
    await saveTiers(tiers.filter((_, i) => i !== delTierIdx));
    setDelTierIdx(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;
  }

  const describeTier = (t: Tier, i: number) => {
    const prev = i > 0 ? tiers[i - 1].up_to_kg : 0;
    const from = prev ?? 0;
    const to = t.up_to_kg == null ? "ขึ้นไป" : `${t.up_to_kg} kg`;
    const range = t.up_to_kg == null ? `> ${from} kg` : `${from} – ${t.up_to_kg} kg`;
    const action = t.blocked ? "ขายไม่ได้" : t.add_per_kg > 0 ? `+${t.add_per_kg.toLocaleString()} บาท/kg` : "ราคาปกติ";
    return { range, to, action };
  };

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ตั้งค่าขายเงิน
        </div>
        {enabled && status && (
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full border-1 ${
              status.is_open
                ? "bg-green-500/15 text-green-700 border-green-500/30"
                : "bg-red-500/15 text-red-600 border-red-500/30"
            }`}
          >
            ขณะนี้: {status.is_open ? "เปิดขายเงิน" : "ปิดขายเงิน"} · {status.now}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-y-4 overflow-y-auto pb-6">
        {/* Master toggle */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-1">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-md flex items-center gap-x-2">
                <Coins size={16} className="text-[#c09c42]" /> เปิดขายเงิน (ฝั่งลูกค้า)
              </span>
              <span className="text-xs text-black/50">
                หากปิด ลูกค้าจะไม่เห็นแท็บ &quot;เงิน&quot; ในหน้าขาย (ขายได้เฉพาะทอง)
              </span>
            </div>
            <Switch isDisabled={!canEdit} isSelected={enabled} color="warning" onValueChange={onToggleEnabled} />
          </div>
        </div>

        {enabled && (
          <>
            {/* Daily cutoff (edited via the same modal) */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-2">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-md flex items-center gap-x-2">
                    <Clock size={16} className="text-[#c09c42]" /> ขายเงินได้ถึงเวลา
                  </span>
                  <span className="text-xs text-black/50">
                    {closeTime ? `ลูกค้าขายเงินได้จนถึง ${closeTime} น. ของทุกวัน` : "ไม่จำกัดเวลา (ขายได้ทั้งวัน)"}
                  </span>
                </div>
                {canEdit && (
                  <Button size="sm" variant="flat" className="rounded-2xl font-bold"
                    startContent={<Pencil size={14} />}
                    onPress={() => { setModalTime(closeTime || "16:30"); enableDisc.onOpen(); }}>
                    แก้เวลา
                  </Button>
                )}
              </div>
            </div>

            {/* Price source: feed vs manual */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
              <span className="font-bold text-md flex items-center gap-x-2">
                <Tag size={16} className="text-[#c09c42]" /> ราคารับซื้อเงิน
              </span>
              <div className="flex gap-2">
                <button
                  disabled={!canEdit}
                  onClick={() => saveKey("silver_price_mode", "feed")}
                  className={`flex-1 flex flex-col items-start gap-y-0.5 rounded-2xl border-1 p-3 transition-all ${priceMode === "feed" ? "border-[#c09c42] bg-[#c09c42]/10" : "border-black/10 bg-black/5 hover:bg-black/10"}`}
                >
                  <span className="font-bold text-sm flex items-center gap-x-1"><Radio size={14} className="text-sky-600" /> อิงราคาจากฟีด</span>
                  <span className="text-[11px] text-black/50 text-left">ใช้ราคารับซื้อเงิน (XAG) ที่ดึงมาอัตโนมัติ</span>
                </button>
                <button
                  disabled={!canEdit}
                  onClick={() => saveKey("silver_price_mode", "manual")}
                  className={`flex-1 flex flex-col items-start gap-y-0.5 rounded-2xl border-1 p-3 transition-all ${priceMode === "manual" ? "border-[#c09c42] bg-[#c09c42]/10" : "border-black/10 bg-black/5 hover:bg-black/10"}`}
                >
                  <span className="font-bold text-sm">ตั้งราคาเอง</span>
                  <span className="text-[11px] text-black/50 text-left">กำหนดราคารับซื้อเองแบบตายตัว</span>
                </button>
              </div>
              {priceMode === "manual" && (
                <Input
                  type="number"
                  label="ราคารับซื้อเงิน (บาท/กิโลกรัม)"
                  value={manualPrice}
                  isDisabled={!canEdit}
                  onValueChange={(v) => saveKey("silver_manual_price", v)}
                  endContent={<span className="text-xs font-bold text-black/40">บาท/กก.</span>}
                  classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
                />
              )}
            </div>

            {/* Weight-based pricing tiers */}
            <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-md flex items-center gap-x-2">
                    <Scale size={16} className="text-[#c09c42]" /> กฎราคาตามน้ำหนัก (ต่อรายการ)
                  </span>
                  <span className="text-xs text-black/50">
                    เช่น ≤5kg ราคาปกติ · 5–10kg บวก 1000 บาท/kg · &gt;10kg ขายไม่ได้
                  </span>
                </div>
                {canEdit && (
                  <Button size="sm" variant="flat" className="rounded-2xl font-bold"
                    startContent={<Plus size={14} />}
                    onPress={() => setTierForm({ index: -1, tier: { up_to_kg: 5, add_per_kg: 0, blocked: false } })}>
                    เพิ่มชั้น
                  </Button>
                )}
              </div>

              {tiers.length === 0 ? (
                <span className="text-xs text-black/40">ยังไม่มีกฎ — ขายได้ทุกน้ำหนักที่ราคาปกติ</span>
              ) : (
                <div className="flex flex-col gap-y-2">
                  {tiers.map((t, i) => {
                    const d = describeTier(t, i);
                    return (
                      <div key={i} className={`flex flex-row items-center justify-between gap-x-2 p-3 rounded-2xl border-1 ${t.blocked ? "border-red-200 bg-red-50/60" : t.add_per_kg > 0 ? "border-amber-200 bg-amber-50/60" : "border-black/10 bg-white/50"}`}>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{d.range}</span>
                          <span className={`text-xs font-bold ${t.blocked ? "text-red-600" : t.add_per_kg > 0 ? "text-amber-700" : "text-black/50"}`}>{d.action}</span>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-x-1">
                            <Button size="sm" variant="light" className="rounded-xl" onPress={() => setTierForm({ index: i, tier: { ...t } })}>แก้ไข</Button>
                            <Button size="sm" variant="light" color="danger" isIconOnly className="rounded-xl" onPress={() => setDelTierIdx(i)}>
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Close-shop button */}
            <div className={`flex flex-col border-1 backdrop-blur-xl rounded-3xl p-5 gap-y-3 ${shopOpen ? "border-black/10 bg-black/5" : "border-red-300/50 bg-red-50/60"}`}>
              <div className="flex flex-col">
                <span className="font-bold text-md flex items-center gap-x-2">
                  <Store size={16} className={shopOpen ? "text-[#c09c42]" : "text-red-500"} /> สถานะร้าน (ขายเงิน)
                </span>
                <span className={`text-xs ${shopOpen ? "text-black/50" : "text-red-500 font-bold"}`}>
                  {shopOpen
                    ? "เปิดร้านอยู่ · ลูกค้าซื้อขายเงินได้ตามเวลาที่กำหนด"
                    : "ปิดร้านชั่วคราว · ลูกค้าขายเงินไม่ได้ทันที (ไม่สนใจเวลา)"}
                </span>
              </div>
              {shopOpen ? (
                <Button color="danger" variant="flat" isDisabled={!canEdit}
                  className="rounded-2xl font-bold self-start" startContent={<DoorClosed size={16} />}
                  onPress={() => toggleShop(false)}>
                  ปิดร้าน (หยุดขายเงินทันที)
                </Button>
              ) : (
                <Button isDisabled={!canEdit}
                  className="rounded-2xl font-bold self-start bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white"
                  startContent={<DoorOpen size={16} />} onPress={() => toggleShop(true)}>
                  เปิดร้านอีกครั้ง
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Enable / edit-time modal */}
      <Modal isOpen={enableDisc.isOpen} onClose={enableDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-[#c09c42]">ขายเงินได้ถึงกี่โมง?</span></ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-y-3">
              <p className="text-sm text-black/60">กำหนดเวลาที่ลูกค้าจะขายเงินได้จนถึงในแต่ละวัน (เว้นว่าง = ไม่จำกัดเวลา)</p>
              <Input
                type="time"
                aria-label="ขายเงินได้ถึงเวลา"
                value={modalTime}
                onValueChange={setModalTime}
                classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
              />
              {modalTime && (
                <Button size="sm" variant="light" className="rounded-2xl text-black/50 self-start"
                  onPress={() => setModalTime("")}>
                  ไม่จำกัดเวลา
                </Button>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={enableDisc.onClose}>ยกเลิก</Button>
            <Button className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold" onPress={confirmEnable}>
              เปิดขายเงิน
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Tier add/edit form */}
      {tierForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setTierForm(null)}>
          <div className="w-full sm:max-w-md bg-white rounded-3xl p-5 flex flex-col gap-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <span className="font-bold text-md">{tierForm.index < 0 ? "เพิ่มชั้นราคา" : "แก้ไขชั้นราคา"}</span>

            {/* Upper bound */}
            <div className="flex flex-col gap-y-1.5">
              <Input
                type="number"
                label="น้ำหนักไม่เกิน (กก.)"
                value={tierForm.tier.up_to_kg == null ? "" : String(tierForm.tier.up_to_kg)}
                isDisabled={tierForm.tier.up_to_kg == null}
                onValueChange={(v) => setTierForm({ ...tierForm, tier: { ...tierForm.tier, up_to_kg: v === "" ? null : Number(v) } })}
                endContent={<span className="text-xs font-bold text-black/40">กก.</span>}
                classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
              />
              <label className="flex items-center gap-x-2 text-sm">
                <input type="checkbox" checked={tierForm.tier.up_to_kg == null}
                  onChange={(e) => setTierForm({ ...tierForm, tier: { ...tierForm.tier, up_to_kg: e.target.checked ? null : 5 } })} />
                <span className="text-black/60">เป็นชั้นสุดท้าย (มากกว่าชั้นก่อนหน้าทั้งหมด)</span>
              </label>
            </div>

            {/* Mode */}
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-bold text-black/50">การคิดราคาในชั้นนี้</span>
              <div className="flex gap-2">
                {(["normal", "add", "blocked"] as TierMode[]).map((m) => (
                  <button key={m}
                    onClick={() => setTierForm({
                      ...tierForm,
                      tier: {
                        ...tierForm.tier,
                        blocked: m === "blocked",
                        add_per_kg: m === "add" ? (tierForm.tier.add_per_kg || 1000) : 0,
                      },
                    })}
                    className={`flex-1 text-xs font-bold rounded-xl border-1 py-2 transition-all ${tierMode(tierForm.tier) === m ? "bg-[#c09c42] text-white border-[#c09c42]" : "bg-black/5 border-black/10"}`}>
                    {TIER_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {tierMode(tierForm.tier) === "add" && (
              <Input
                type="number"
                label="บวกราคา (บาท/กก.)"
                value={String(tierForm.tier.add_per_kg)}
                onValueChange={(v) => setTierForm({ ...tierForm, tier: { ...tierForm.tier, add_per_kg: Number(v) || 0 } })}
                endContent={<span className="text-xs font-bold text-black/40">บาท/กก.</span>}
                classNames={{ inputWrapper: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
              />
            )}

            <div className="flex gap-x-2 justify-end mt-1">
              <Button size="sm" variant="light" className="rounded-2xl" onPress={() => setTierForm(null)}>ยกเลิก</Button>
              <Button size="sm" className="rounded-2xl bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold" onPress={submitTier}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={delTierIdx != null}
        onClose={() => setDelTierIdx(null)}
        onConfirm={confirmDeleteTier}
        name="ชั้นราคานี้"
      />
    </div>
  );
}
