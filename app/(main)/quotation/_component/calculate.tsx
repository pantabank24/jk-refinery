"use client";

import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, Plus, List, Pencil } from "lucide-react";
import { DecimalInput } from "@/components/decimalInput";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CmpSelect, Option } from "@/components/cmpSelect";
import { QuotationProps } from "./quotation";
import { api } from "@/lib/api";
import { Tabs, Tab } from "@heroui/tabs";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { useRealtimeGold } from "@/hooks/use-realtime-gold";
import { PriceModeChip } from "@/components/sales-status-banner";
import {
  GoldPriceSourceToggle,
  resolveGoldSource,
  type GoldPriceSource,
} from "@/components/gold-price-source-toggle";
import {
  OperandType,
  GoldType,
  parseSteps,
  getUsedVars,
  computeItem,
} from "@/lib/gold-calc";

const OPERAND_LABELS: Record<OperandType, string> = {
  number: "กำหนดเอง",
  price: "ราคาทอง",
  percent: "เปอร์เซ็นต์",
  plus: "ราคาบวก",
  weight: "น้ำหนัก",
  service: "ค่าบริการ",
};

// Metal tabs on the create screen. Product types are grouped by their `metal`.
const METALS = [
  { key: "gold", label: "ทอง" },
  { key: "silver", label: "เงิน" },
  { key: "platinum", label: "แพลตินัม" },
  { key: "palladium", label: "แพลเลเดียม" },
] as const;

// Default product type for a metal tab. Gold defaults to "ทองหลอม"; other metals
// just take their (single) type.
const pickType = (
  types: GoldType[],
  metalKey: string,
): GoldType | undefined => {
  const list = types.filter((t) => (t.metal || "gold") === metalKey);
  if (metalKey === "gold")
    return list.find((t) => t.name.includes("หลอม")) ?? list[0];
  return list[0];
};

interface GoldPrice {
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
  change_today: number;
  gold_date: string;
  gold_time: string;
}

interface SilverPrice {
  buy: number;
  sell: number;
  spot: number;
  change_today: number;
  price_date: string;
  price_time: string;
}

// Which silver price feeds the calculation. "custom" = the shop's set price from
// ตั้งค่าขายเงิน (silver_manual_price), "market" = the live feed. Defaults to custom.
type SilverPriceMode = "custom" | "market";

// Shop silver config (from ตั้งค่าขายเงิน). Mirrors billCalculate so bill mode can
// price silver exactly like the customer did: base (feed|manual) + weight tier.
interface SilverTier {
  up_to_kg: number | null; // null = catch-all (largest weights)
  add_per_kg: number;
  blocked: boolean;
}
interface SilverCfg {
  mode: "feed" | "manual";
  manualPrice: number;
  tiers: SilverTier[];
}

// Resolve the tier covering `kg` (first whose upper bound covers it; catch-all last).
// null = exceeds every bound with no catch-all. No tiers = base price, any weight.
const resolveSilverTier = (
  tiers: SilverTier[],
  kg: number,
): SilverTier | null => {
  if (!tiers || tiers.length === 0)
    return { up_to_kg: null, add_per_kg: 0, blocked: false };
  const sorted = [...tiers].sort((a, b) => {
    if (a.up_to_kg == null) return 1;
    if (b.up_to_kg == null) return -1;
    return a.up_to_kg - b.up_to_kg;
  });
  for (const t of sorted) {
    if (t.up_to_kg == null) return t;
    if (kg <= t.up_to_kg) return t;
  }
  return null;
};

// รูปแบบวัน–เวลาไทยแบบสั้นสำหรับข้อความ "ราคานี้ถูกตั้งเมื่อ..."
function thaiDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} เวลา ${time} น.`;
}

interface Props {
  onAdd: (item: QuotationProps) => void;
  onOpenList?: () => void;
  quotationCount?: number;
  /** When true, locks the GOLD tab to the melt type and hides its type dropdown.
   *  Other metal tabs stay usable (price editable) — non-gold items are paid in
   *  full on the quotation and never enter the bill debt/credit cycle. */
  lockMeltType?: boolean;
  /** When set, overrides the auto-filled price with a fixed value (read-only).
   *  Applies to melted GOLD only; other metals keep their own price source. */
  forcedPrice?: number;
}

export const Calculate = ({
  onAdd,
  onOpenList,
  quotationCount = 0,
  lockMeltType,
  forcedPrice,
}: Props) => {
  const router = useRouter();
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  // ราคาตลาด (live feed) vs ราคากำหนดเอง (shop's silver_manual_price, baht/kg — same
  // unit as the feed's "รับซื้อ", both ÷1000 in the type formula).
  const [silverMarket, setSilverMarket] = useState<SilverPrice | null>(null);
  const [silverCfg, setSilverCfg] = useState<SilverCfg>({
    mode: "feed",
    manualPrice: 0,
    tiers: [],
  });
  const [silverManualSetAt, setSilverManualSetAt] = useState<string | undefined>(
    undefined,
  );
  // Default to the shop's set price per requirement (walk-in toggle only).
  const [silverMode, setSilverMode] = useState<SilverPriceMode>("custom");
  const [metal, setMetal] = useState<string>("gold");

  // Bill mode (master issuing a customer's melted metal): price silver exactly like
  // the customer did — shop config (feed|manual) + weight tiers, no market/custom toggle.
  const billMode = !!lockMeltType;
  // Whether a shop price is actually configured (>0) — else falls back to feed.
  const hasCustomSilver = silverCfg.manualPrice > 0;
  // The silver BASE price (buy/sell/spot). In bill mode it follows silver_price_mode;
  // for walk-in quotes the market/custom toggle picks it. For a single manual value
  // all three sources equal it, so resolvePrice + the header work for any price_source.
  // Memoised so the reference stays stable — an auto-fill effect depends on it, and a
  // fresh object each render would re-fire it and wipe the user's percent/plus.
  const silverPrice: SilverPrice | null = useMemo(() => {
    const manualObj = (p: number): SilverPrice => ({
      buy: p,
      sell: p,
      spot: p,
      change_today: 0,
      price_date: "",
      price_time: "",
    });
    if (billMode) {
      return silverCfg.mode === "manual" && silverCfg.manualPrice > 0
        ? manualObj(silverCfg.manualPrice)
        : silverMarket;
    }
    return silverMode === "custom" && hasCustomSilver
      ? manualObj(silverCfg.manualPrice)
      : silverMarket;
  }, [
    billMode,
    silverCfg.mode,
    silverCfg.manualPrice,
    silverMode,
    hasCustomSilver,
    silverMarket,
  ]);

  const [price, setPrice] = useState(forcedPrice ?? 0);
  const [typeId, setTypeId] = useState("");
  const [percent, setPercent] = useState(0);
  const [plus, setPlus] = useState(0);
  const [plusType, setPlusType] = useState(0); // 0=บาท, 1=%
  const [weight, setWeight] = useState(0);

  // Real-time pricing: when the shop is outside association hours and real-time
  // mode is on, gold prices stream live. Only applies to the gold tab.
  const { status: salesStatus } = useSalesStatus();
  // The shop's schedule picks the default feed; the user can override it per
  // quotation (null = still following the schedule).
  const [goldSource, setGoldSource] = useState<GoldPriceSource | null>(null);
  const effGoldSource = resolveGoldSource(goldSource, salesStatus);
  const realtimeActive = effGoldSource === "realtime" && metal === "gold";
  // อัปเดตทุก 10 วินาที — ตอนออกใบเสนอราคาไม่ต้องรัวเท่าหน้าดูราคาสด
  const { data: rt, dir: rtDir } = useRealtimeGold(!!realtimeActive, 10000);
  // The forced (blended-avg) price only applies to melted GOLD. Silver / platinum
  // / palladium are a different product, so their price stays editable.
  const priceForced = forcedPrice !== undefined && metal === "gold";

  // Effective gold feed: real-time overrides the association price when active.
  const effGold: GoldPrice | null =
    realtimeActive && rt && rt.bar_buy != null
      ? {
          bar_buy: rt.bar_buy,
          bar_sell: rt.bar_sell ?? rt.bar_buy,
          ornament_buy: rt.bar_buy,
          ornament_sell: rt.bar_sell ?? rt.bar_buy,
          change_today: rt.change ?? 0,
          gold_date: "",
          gold_time: "",
        }
      : goldPrice;

  useEffect(() => {
    api
      .get<GoldType[]>("/gold-types")
      .then((res) => {
        const types = (res.data as unknown as GoldType[]) || [];
        setGoldTypes(types);
        // Always default to gold melt type (or first gold type); when locked, this
        // also prevents the user from switching away.
        const defGold = pickType(types, "gold") ?? types[0];
        if (defGold) setTypeId(String(defGold.id));
      })
      .catch(() => {});

    api
      .get<GoldPrice>("/gold-prices/latest")
      .then((res) => setGoldPrice((res.data as unknown as GoldPrice) || null))
      .catch(() => {});

    // ราคาตลาด — live silver feed.
    api
      .get<SilverPrice>("/metal-prices/latest?symbol=XAG")
      .then((res) =>
        setSilverMarket((res.data as unknown as SilverPrice) || null),
      )
      .catch(() => {});
    // Shop silver config: price mode (feed|manual), the set price + when it was set,
    // and the weight tiers (bill mode applies them like the customer's sale).
    api
      .get("/configs/silver-sell-status")
      .then((res) => {
        const d =
          (res.data as unknown as {
            price_mode?: string;
            manual_price?: number;
            manual_price_set_at?: string | null;
            tiers?: SilverTier[];
          }) || {};
        setSilverCfg({
          mode: d.price_mode === "manual" ? "manual" : "feed",
          manualPrice: d.manual_price ?? 0,
          tiers: d.tiers ?? [],
        });
        setSilverManualSetAt(d.manual_price_set_at ?? undefined);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Product types belonging to the active metal tab.
  const metalTypes = goldTypes.filter((t) => (t.metal || "gold") === metal);

  // Resolve the auto-fill price for a product type from its metal's price feed.
  // Returns null for manual sources (platinum/palladium) — the user types it.
  const resolvePrice = (gt: GoldType): number | null => {
    const m = gt.metal || "gold";
    if (m === "gold" && effGold) {
      const map: Record<string, number> = {
        bar_buy: effGold.bar_buy,
        bar_sell: effGold.bar_sell,
        ornament_buy: effGold.ornament_buy,
        ornament_sell: effGold.ornament_sell,
      };
      return map[gt.price_source] ?? 0;
    }
    if (m === "silver" && silverPrice) {
      const map: Record<string, number> = {
        buy: silverPrice.buy,
        sell: silverPrice.sell,
        spot: silverPrice.spot,
      };
      return map[gt.price_source] ?? 0;
    }
    return null; // manual (platinum/palladium)
  };

  // When type or feed prices change: auto-fill price from price_source (or clear
  // for manual metals) and pre-fill percent/plus from the type's defaults.
  // forcedPrice overrides auto-fill when provided.
  useEffect(() => {
    if (!typeId || goldTypes.length === 0) return;
    const gt = goldTypes.find((t) => String(t.id) === typeId);
    if (!gt) return;
    if (priceForced) {
      setPrice(forcedPrice ?? 0);
    } else {
      const p = resolvePrice(gt);
      setPrice(p ?? 0);
    }
    setPercent(0);
    setPlus(gt.default_plus);
    setPlusType(gt.plus_type ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, goldTypes, goldPrice, silverPrice, forcedPrice, metal]);

  // Real-time tick / price-source switch: live-update ONLY the base price (leave
  // percent/plus/weight untouched so the user's inputs survive each refresh and
  // each toggle between the association and real-time feeds).
  useEffect(() => {
    if (priceForced) return;
    const gt = goldTypes.find((t) => String(t.id) === typeId);
    if (!gt) return;
    const p = resolvePrice(gt);
    if (p != null) setPrice(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, realtimeActive, typeId, goldTypes, forcedPrice]);

  const handleMetalChange = (key: string) => {
    setMetal(key);
    const def = pickType(goldTypes, key);
    setTypeId(def ? String(def.id) : "");
  };

  const typeOptions: Option[] = metalTypes.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const selectedGoldType =
    goldTypes.find((t) => String(t.id) === typeId) ?? null;
  const isManualPrice =
    (selectedGoldType?.metal || "gold") !== "gold" &&
    (selectedGoldType?.metal || "gold") !== "silver";
  const getTypeName = (id: string) =>
    goldTypes.find((t) => String(t.id) === id)?.name || "ทอง";

  const hasFormula = selectedGoldType
    ? parseSteps(selectedGoldType.formula_steps).length > 0
    : false;
  const usedVars: Set<OperandType> =
    selectedGoldType && hasFormula
      ? getUsedVars(selectedGoldType)
      : new Set(["percent", "plus"] as OperandType[]);

  const isSilver = (selectedGoldType?.metal || "gold") === "silver";
  // Bill mode prices silver like the customer's sale: base + weight-tier surcharge.
  // Weight is grams; tiers key by kg. Never blocks here (issuing must go through even
  // over a "ขายไม่ได้" tier) — a blocked tier just contributes no surcharge.
  const silverTier =
    billMode && isSilver
      ? resolveSilverTier(silverCfg.tiers, weight / 1000)
      : null;
  const silverAddPerKg =
    silverTier && !silverTier.blocked ? silverTier.add_per_kg : 0;
  // Surcharge stacks onto the base only for the calculation; the shown/stored price
  // stays the base (e.g. 60,000), matching billCalculate.
  const silverEffPrice = price + silverAddPerKg;

  // Shared with the edit screen — single source of truth for per-gram/total.
  const { perGram, total } = computeItem({
    goldType: selectedGoldType,
    price: isSilver ? silverEffPrice : price,
    percent,
    plus,
    weight,
    plusType,
  });

  const handleAdd = () => {
    if (weight <= 0) return;
    onAdd({
      typeId,
      typeName: getTypeName(typeId),
      metal: selectedGoldType?.metal || "gold",
      price,
      plus,
      plus_type: plusType,
      percent,
      weight,
      perGram,
      total,
    });
    setWeight(0);
  };

  const changeColor = (v: number) =>
    v > 0 ? "text-green-800" : v < 0 ? "text-red-600" : "text-black/40";

  // Metal-aware price header values.
  const metalLabel = METALS.find((m) => m.key === metal)?.label ?? "";
  const hasFeed =
    metal === "gold" ? !!effGold : metal === "silver" ? !!silverPrice : false;
  const headerBuy =
    metal === "gold"
      ? effGold?.bar_buy
      : metal === "silver"
        ? silverPrice?.buy
        : undefined;
  const headerSell =
    metal === "gold"
      ? effGold?.bar_sell
      : metal === "silver"
        ? silverPrice?.sell
        : undefined;
  const headerChange =
    (metal === "gold"
      ? effGold?.change_today
      : metal === "silver"
        ? silverPrice?.change_today
        : 0) ?? 0;
  // Only claim "เรียลไทม์" once a live price has actually arrived — until then
  // effGold is still the association price.
  const realtimeLive = realtimeActive && !!rt && rt.bar_buy != null;
  const headerDate = realtimeLive
    ? `เรียลไทม์ ${salesStatus?.now ?? ""}`.trim()
    : metal === "gold"
      ? `${goldPrice?.gold_date ?? ""} ${goldPrice?.gold_time ?? ""}`.trim()
      : metal === "silver"
        ? `${silverPrice?.price_date ?? ""} ${silverPrice?.price_time ?? ""}`.trim()
        : "";

  // Flash the header price cards green/red on each real-time change.
  const flashClass = realtimeActive
    ? rtDir === "up"
      ? "rt-flash-up"
      : rtDir === "down"
        ? "rt-flash-down"
        : ""
    : "";

  return (
    <div className=" flex flex-col  w-full xl:w-[700px]  pb-5">
      <div className="flex flex-col border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl p-3 gap-y-2 ">
        <div className=" w-full flex justify-center">
          <Tabs
            aria-label="โลหะ"
            selectedKey={metal}
            onSelectionChange={(k) => handleMetalChange(String(k))}
            variant="solid"
            radius="full"
            classNames={{
              tabList: "bg-black/5 border-1 border-black/10",
              cursor: "bg-gradient-to-l from-transparent to-yellow-600/50",
            }}
          >
            {METALS.map((m) => (
              <Tab
                key={m.key}
                title={<span className="font-bold text-xs">{m.label}</span>}
              />
            ))}
          </Tabs>
        </div>

        {/* Silver weight-tier surcharge notice (bill mode uses the customer's formula) */}
        {metal === "silver" && billMode && silverAddPerKg > 0 && (
          <div className="flex items-center gap-x-1 w-full border-1 border-amber-200 bg-amber-50 rounded-3xl px-3 py-2">
            <span className="text-[11px] font-bold text-amber-700">
              น้ำหนักช่วงนี้ บวกราคา {silverAddPerKg.toLocaleString()} บาท/กก.
              (รวมในยอดแล้ว · ราคารับซื้อที่แสดงเป็นราคาฐาน)
            </span>
          </div>
        )}

        {/* Silver: choose which price to apply — market feed vs admin-set custom.
            Hidden in bill mode, which follows the shop config like the customer. */}
        {metal === "silver" && !billMode && (
          <div className="flex flex-col gap-y-1.5 w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSilverMode("custom")}
                className={`text-xs font-bold px-3 py-1.5 rounded-2xl border-1 transition-colors ${silverMode === "custom" ? "bg-yellow-600/70 text-white border-yellow-600/40" : "bg-white/40 text-black/60 border-black/10"}`}
              >
                ราคากำหนดเอง
              </button>
              <button
                type="button"
                onClick={() => setSilverMode("market")}
                className={`text-xs font-bold px-3 py-1.5 rounded-2xl border-1 transition-colors ${silverMode === "market" ? "bg-yellow-600/70 text-white border-yellow-600/40" : "bg-white/40 text-black/60 border-black/10"}`}
              >
                ราคาตลาด
              </button>
            </div>

            {silverMode === "custom" && (
              <div className="flex items-center justify-between gap-x-2 pl-1">
                <span className="text-[10px] font-bold text-black/50">
                  {hasCustomSilver
                    ? `ราคานี้ถูกตั้งเมื่อ ${thaiDateTime(silverManualSetAt)}`
                    : "ยังไม่ได้ตั้งราคากำหนดเอง — ใช้ราคาตลาดแทน"}
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/settings/silver-sell")}
                  className="shrink-0 flex items-center gap-x-1 text-[10px] font-bold text-[#c09c42] hover:text-yellow-700"
                >
                  <Pencil size={11} /> คลิกเพื่อเปลี่ยน
                </button>
              </div>
            )}
          </div>
        )}

        {isManualPrice ? (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <span className="text-[10px] font-bold text-black/50">
              กรอกราคา{metalLabel}ต่อกรัมเองในช่องด้านล่าง
            </span>
          </div>
        ) : hasFeed ? (
          <div
            className={`flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl`}
          >
            <div className=" flex flex-row w-full justify-between">
              <span className=" text-[10px] font-bold text-black/50">
                อัปเดท: {headerDate}
              </span>
              <div className=" flex flex-row items-center gap-x-2">
                {headerChange !== 0 && (
                  <div
                    className={`flex flex-row items-center ${changeColor(headerChange)}`}
                  >
                    {headerChange > 0 ? (
                      <ArrowUp size={10} className="font-bold" />
                    ) : headerChange < 0 ? (
                      <ArrowDown size={10} className="font-bold" />
                    ) : (
                      <Minus size={10} />
                    )}
                    <span className="text-[10px] font-bold ml-0.5">
                      {Math.abs(headerChange)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex flex-row items-center ${changeColor(headerChange)}`}
                >
                  <span className=" text-[10px] font-bold">วันนี้</span>
                  <span className=" text-[10px] font-bold ml-1">
                    {headerChange > 0 ? "+" : ""}
                    {headerChange}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <span className="text-[10px] font-bold text-black/50">
              ยังไม่มีข้อมูลราคา{metalLabel}
            </span>
          </div>
        )}

        {!isManualPrice && (
          <div
            key={realtimeActive ? rt?.version : undefined}
            className={`w-full grid grid-cols-2 gap-x-2 ${flashClass}`}
          >
            <BoxCard
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
              title="ราคารับซื้อ (บาท)"
              value={headerBuy !== undefined ? headerBuy.toLocaleString() : "-"}
            />
            <BoxCard
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
              title="ราคาขาย (บาท)"
              value={
                headerSell !== undefined ? headerSell.toLocaleString() : "-"
              }
            />
          </div>
        )}

        <span className=" font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 flex flex-row justify-between">
          <div className=" truncate">คำนวณราคา{metalLabel}</div>
          {/* Gold: the price-source toggle stands in for the mode chip (it says
              which price is in use AND lets it be switched for this document).
              A forced price (bill mode) ignores the feed, so the chip is kept. */}
          {metal === "gold" && !priceForced ? (
            <GoldPriceSourceToggle
              value={effGoldSource}
              onChange={setGoldSource}
              status={salesStatus}
              waitingRealtime={realtimeActive && (!rt || rt.bar_buy == null)}
            />
          ) : (
            salesStatus && <PriceModeChip status={salesStatus} />
          )}
        </span>

        {/* Formula badge */}
        {selectedGoldType && hasFormula && (
          <div className="flex flex-row gap-1 px-1">
            {parseSteps(selectedGoldType.formula_steps).map((s, i) => (
              <span
                key={i}
                className="text-[10px] whitespace-nowrap px-2 py-0.5 rounded-full border-1 border-yellow-500/30 bg-yellow-500/10 text-yellow-700 font-bold"
              >
                {i === 0 ? "ราคา" : "ผล"} {s.operator}{" "}
                {s.operand_type === "number"
                  ? s.value.toLocaleString()
                  : (OPERAND_LABELS[s.operand_type] ?? s.operand_type)}
              </span>
            ))}
          </div>
        )}

        <div className=" w-full grid grid-cols-2 gap-2 mb-5">
          <DecimalInput
            label={isManualPrice ? `ราคา${metalLabel} (ต่อกรัม)` : "ราคา"}
            value={price}
            onChange={(n) => {
              if (!priceForced) setPrice(n);
            }}
            isReadOnly={priceForced}
            maxDecimals={2}
          />
          {/* Type selector hidden when locked to melt type or when metal has only one type */}
          {!lockMeltType && metalTypes.length > 1 && (
            <CmpSelect
              data={typeOptions}
              label="ประเภท"
              placeholder="เลือก"
              value={typeId}
              onChange={setTypeId}
            />
          )}
          {/* Show each variable input only when the formula uses it */}
          {usedVars.has("percent") && (
            <DecimalInput
              label="เปอร์เซ็นต์"
              value={percent}
              onChange={setPercent}
            />
          )}
          {usedVars.has("plus") && (
            <DecimalInput
              label="ราคาบวก"
              value={plus}
              onChange={setPlus}
              endContent={
                <div className="flex gap-0.5 items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlusType(0)}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-all ${plusType === 0 ? "bg-yellow-600/70 text-white" : "text-black/40 hover:text-black/70"}`}
                  >
                    ฿
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlusType(1)}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-all ${plusType === 1 ? "bg-yellow-600/70 text-white" : "text-black/40 hover:text-black/70"}`}
                  >
                    %
                  </button>
                </div>
              }
            />
          )}
          <DecimalInput label="น้ำหนัก" value={weight} onChange={setWeight} />
        </div>

        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          color="bg-gradient-to-l from-transparent to-yellow-600/50"
          flex
          title="ราคาประเมิน"
          subtitle="ราคาต่อกรัม × น้ำหนัก"
          value={total.toLocaleString()}
        />

        <div className="flex h-full w-full items-end justify-between">
          {/* Mobile: รายการ button — hidden on desktop */}
          <button
            type="button"
            onClick={onOpenList}
            className="lg:hidden flex items-center gap-x-2 bg-gradient-to-br from-[#c09c42]/30 to-transparent border-1 border-black/10 rounded-2xl h-14 px-4 font-bold text-sm relative"
          >
            <List size={18} className="text-[#c09c42]" />
            <span className="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              รายการ
            </span>
            {quotationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {quotationCount}
              </span>
            )}
          </button>

          <div
            onClick={handleAdd}
            className="cursor-pointer bg-gradient-to-br from-blue-600/50 to-transparent border-1 border-black/10 rounded-full w-14 h-14 flex items-center justify-center hover:from-blue-600/70 transition-all"
          >
            <Plus size={20} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .rt-flash-up {
          animation: rtUp 0.6s ease-out;
        }
        .rt-flash-down {
          animation: rtDown 0.6s ease-out;
        }
        @keyframes rtUp {
          0% {
            background-color: rgba(22, 163, 74, 0.18);
            border-radius: 1rem;
          }
          100% {
            background-color: transparent;
          }
        }
        @keyframes rtDown {
          0% {
            background-color: rgba(220, 38, 38, 0.18);
            border-radius: 1rem;
          }
          100% {
            background-color: transparent;
          }
        }
      `}</style>
    </div>
  );
};
