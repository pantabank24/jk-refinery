"use client";

import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, Plus, Keyboard, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { GoldType, computeItem } from "@/lib/gold-calc";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { useCustomWeightStatus } from "@/hooks/use-custom-weight-status";
import { useRealtimeGold } from "@/hooks/use-realtime-gold";
import { PriceModeChip } from "@/components/sales-status-banner";
import {
  GoldPriceSourceToggle,
  resolveGoldSource,
  type GoldPriceSource,
} from "@/components/gold-price-source-toggle";
import { DecimalInput } from "@/components/decimalInput";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";

interface GoldPrice {
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
  change_today: number;
  gold_date: string;
  gold_time: string;
}

// Silver (and other metals) price feed — served by /metal-prices/latest?symbol=XAG.
interface SilverPrice {
  buy: number;
  sell: number;
  spot: number;
  change_today: number;
  price_date: string;
  price_time: string;
}

interface Props {
  onAdd: (item: QuotationProps) => void;
  // Staff selling on behalf of a customer: always allow typing the weight or
  // stepping by 1, regardless of the customer +/-5 schedule.
  staffMode?: boolean;
  // Which metals may be sold right now. Gold defaults on; silver is gated by the
  // silver-sell schedule on the customer page (staff page leaves both on).
  allowGold?: boolean;
  allowSilver?: boolean;
  // Fluid drops the fixed 700px column and the calculator's own scrollbar, so it
  // fits whatever it is placed in (the sell dialog on the issue screen) instead
  // of overflowing it. Full-page callers leave it off.
  fluid?: boolean;
}

// Metal tabs offered on the customer sell screen. Gold keeps its baht-weight
// stepper flow; silver is priced per gram with a customer-entered purity %.
const ALL_METALS = [
  { key: "gold", label: "ทอง" },
  { key: "silver", label: "เงิน" },
] as const;

// Gold weight is in baht (gold weight unit), stepped up/down and cannot be typed:
// 5, 10, 15, ... baht.
const WEIGHT_STEP = 5;
const WEIGHT_MIN = 5;
const WEIGHT_MAX = 1000;

// Silver weight is in grams (typed freely by the customer).
const SILVER_WEIGHT_MAX = 100000;
// Silver cannot be sold below 1 kilogram (1000 grams).
const SILVER_WEIGHT_MIN = 1000;

// Bills only deal with gold bars 96.5% — match the gold type by name rather than
// hardcoding an id (ids vary across environments / reseeds).
const isGoldBar = (t: GoldType) => /แท่ง/.test(t.name) && /96\.5/.test(t.name);
const isSilverType = (t: GoldType) => (t.metal || "gold") === "silver";

// A weight-based silver pricing rule (configured by admin). up_to_kg=null is the
// catch-all for the largest weights.
interface SilverTier {
  up_to_kg: number | null;
  add_per_kg: number;
  blocked: boolean;
}

// Resolve the tier for a sale of `kg` kilograms: the first tier whose upper bound
// covers it (catch-all last). null = exceeds every bound with no catch-all → not
// sellable. No tiers at all = sell any weight at base price.
const resolveSilverTier = (tiers: SilverTier[], kg: number): SilverTier | null => {
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

export const BillCalculate = ({
  onAdd,
  staffMode = false,
  allowGold = true,
  allowSilver = true,
  fluid = false,
}: Props) => {
  // Tabs limited to the metals allowed right now (gold first).
  const metals = ALL_METALS.filter((m) =>
    m.key === "gold" ? allowGold : allowSilver,
  );
  const [metal, setMetal] = useState<string>(allowGold ? "gold" : "silver");
  const [goldBar, setGoldBar] = useState<GoldType | null>(null);
  const [silverType, setSilverType] = useState<GoldType | null>(null);
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [silverPrice, setSilverPrice] = useState<SilverPrice | null>(null);
  // Silver pricing config (admin): base price source + weight tiers.
  const [silverCfg, setSilverCfg] = useState<{
    mode: string;
    manualPrice: number;
    tiers: SilverTier[];
  }>({ mode: "feed", manualPrice: 0, tiers: [] });
  const [price, setPrice] = useState(0);
  // Staff (sell-on-behalf) may override the gold buy price by hand; once they do,
  // stop the feed auto-fill from clobbering it until they switch metal/reset.
  const [priceTouched, setPriceTouched] = useState(false);
  // Same idea for silver, but it overrides the base buy price (the weight-tier
  // surcharge still stacks on top).
  const [silverPriceTouched, setSilverPriceTouched] = useState(false);
  const [silverManualBase, setSilverManualBase] = useState(0);
  // Weight holds baht (gold) or grams (silver); reset on metal switch.
  const [weight, setWeight] = useState(staffMode ? 1 : WEIGHT_MIN);
  // Set once the weight stops being the untouched default, so the async
  // custom-weight status can't overwrite a weight the customer picked.
  const [weightTouched, setWeightTouched] = useState(false);
  // Silver purity % entered by the customer (prefilled from the type default).
  const [percent, setPercent] = useState(0);

  const isSilver = allowSilver && metal === "silver";
  const activeType = isSilver ? silverType : goldBar;

  // Real-time pricing when outside association hours and the mode is on. Gold only.
  const { status: salesStatus } = useSalesStatus();
  // Whether the customer may type the weight directly right now (scheduled by master).
  const { status: customWeightStatus } = useCustomWeightStatus();
  // Staff always get the free-entry stepper (type / +-1); customers only get it
  // when the master's schedule allows it right now. (Gold only — silver is always typed.)
  const canTypeWeight = staffMode || !!customWeightStatus?.allowed;
  // Free entry steps by 1, so start at 1 baht; the +/-5 stepper starts at its floor.
  const goldDefaultWeight = canTypeWeight ? 1 : WEIGHT_MIN;
  // customWeightStatus resolves after mount, so the default can flip 5 -> 1 (or
  // back) once it lands — but never over a weight the customer already set.
  useEffect(() => {
    if (!weightTouched && !isSilver) setWeight(goldDefaultWeight);
  }, [goldDefaultWeight, weightTouched, isSilver]);
  // Staff may pick the feed by hand (null = follow the shop's schedule); the
  // customer screen has no toggle and always follows the schedule.
  const [goldSource, setGoldSource] = useState<GoldPriceSource | null>(null);
  const effGoldSource = resolveGoldSource(
    staffMode ? goldSource : null,
    salesStatus,
  );
  const realtimeActive = !isSilver && effGoldSource === "realtime";
  const { data: rt, dir: rtDir } = useRealtimeGold(!!realtimeActive);

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
        setGoldBar(types.find(isGoldBar) ?? null);
        setSilverType(types.find(isSilverType) ?? null);
      })
      .catch(() => {});

    api
      .get<GoldPrice>("/gold-prices/latest")
      .then((res) => setGoldPrice((res.data as unknown as GoldPrice) || null))
      .catch(() => {});

    api
      .get<SilverPrice>("/metal-prices/latest?symbol=XAG")
      .then((res) =>
        setSilverPrice((res.data as unknown as SilverPrice) || null),
      )
      .catch(() => {});

    api
      .get("/configs/silver-sell-status")
      .then((res) => {
        const d =
          (res.data as unknown as {
            price_mode?: string;
            manual_price?: number;
            tiers?: SilverTier[];
          }) || {};
        setSilverCfg({
          mode: d.price_mode === "manual" ? "manual" : "feed",
          manualPrice: d.manual_price ?? 0,
          tiers: d.tiers ?? [],
        });
      })
      .catch(() => {});
  }, []);

  // Auto-fill price from the active type's price source whenever the feed changes
  // (association load, or each real-time tick via effGold).
  useEffect(() => {
    // Silver price is derived (base + weight tier), not stored in `price`.
    if (isSilver) return;
    // Don't overwrite a staff-entered manual buy price.
    if (priceTouched) return;
    if (!goldBar || !effGold) return;
    const sourceMap: Record<string, number> = {
      bar_buy: effGold.bar_buy,
      bar_sell: effGold.bar_sell,
      ornament_buy: effGold.ornament_buy,
      ornament_sell: effGold.ornament_sell,
    };
    setPrice(sourceMap[goldBar.price_source] ?? effGold.bar_buy ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metal, goldBar, silverType, goldPrice, silverPrice, rt, realtimeActive, priceTouched]);

  // Prefill the silver purity from the type's default (e.g. 99.9%) on switch.
  useEffect(() => {
    if (isSilver && silverType) setPercent(silverType.default_percent || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSilver, silverType]);

  // Keep the selected metal within what's allowed (e.g. silver closes mid-session).
  useEffect(() => {
    if (metal === "silver" && !allowSilver) setMetal("gold");
    else if (metal === "gold" && !allowGold && allowSilver) setMetal("silver");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowGold, allowSilver]);

  // Silver base buy price: admin-set (manual) or the fetched feed price. Same
  // unit as the buy price (baht/kg) — the type formula divides by 1000.
  const silverFeedBase =
    silverType && silverPrice
      ? (
          {
            buy: silverPrice.buy,
            sell: silverPrice.sell,
            spot: silverPrice.spot,
          } as Record<string, number>
        )[silverType.price_source] ?? silverPrice.buy
      : 0;
  const silverAutoBase =
    silverCfg.mode === "manual" ? silverCfg.manualPrice : silverFeedBase;
  // Staff manual override wins over the admin/feed base until reset.
  const silverBase = silverPriceTouched ? silverManualBase : silverAutoBase;

  // Weight tier for this single sale (kg). Surcharge is added to the buy price
  // per kg BEFORE the ÷1000 × % formula; a blocked/uncovered weight can't sell.
  const weightKg = weight / 1000;
  const silverTier = resolveSilverTier(silverCfg.tiers, weightKg);
  const silverBlocked = isSilver && (silverTier === null || silverTier.blocked);
  // Silver must be at least 1 kg — below that, the sale can't be submitted.
  const silverBelowMin = isSilver && weight > 0 && weight < SILVER_WEIGHT_MIN;
  const silverAddPerKg =
    silverTier && !silverTier.blocked ? silverTier.add_per_kg : 0;
  const silverEffPrice = silverBase + silverAddPerKg;

  // Gold-bar price is quoted per baht-weight, so total = price × weight(บาท).
  // Silver is priced per gram via the type's formula (ราคา ÷ 1000 × %) × น้ำหนัก.
  const goldPerGram = computeItem({
    goldType: goldBar,
    price,
    percent: 0,
    plus: 0,
    weight: 1,
  }).perGram;
  const silverCalc = computeItem({
    goldType: silverType,
    price: silverEffPrice,
    percent,
    plus: 0,
    weight,
  });
  const perGram = isSilver ? silverCalc.perGram : goldPerGram;
  const total = isSilver ? (silverBlocked ? 0 : silverCalc.total) : price * weight;
  // Price shown on the type card: the BASE buy price (e.g. 60,000). The weight-tier
  // surcharge is real but shown separately (the amber notice + staff breakdown) and
  // baked into the total — it must not inflate the displayed รับซื้อ figure.
  const displayPrice = isSilver ? silverBase : price;

  const handleMetalChange = (key: string) => {
    setMetal(key);
    setWeight(key === "silver" ? 0 : goldDefaultWeight);
    setWeightTouched(false);
    // Back to feed price on metal switch.
    setPriceTouched(false);
    setSilverPriceTouched(false);
  };

  const stepWeight = (dir: 1 | -1) => {
    setWeightTouched(true);
    setWeight((w) => {
      const next = w + dir * WEIGHT_STEP;
      if (next < WEIGHT_MIN) return WEIGHT_MIN;
      if (next > WEIGHT_MAX) return WEIGHT_MAX;
      return next;
    });
  };

  const handleWeightInput = (v: string) => {
    setWeightTouched(true);
    const clean = v.replace(/[^0-9]/g, "");
    const n = parseInt(clean, 10);
    if (Number.isNaN(n)) return setWeight(0);
    setWeight(Math.min(WEIGHT_MAX, Math.max(0, n)));
  };
  const adjustWeight = (delta: number) => {
    setWeightTouched(true);
    setWeight((w) => Math.min(WEIGHT_MAX, Math.max(0, w + delta)));
  };

  const canSubmit =
    !!activeType && weight > 0 && !silverBlocked && !silverBelowMin;
  const handleAdd = () => {
    if (!canSubmit) return;
    onAdd({
      typeId: String(activeType!.id),
      typeName: activeType!.name,
      metal: activeType!.metal || "gold",
      // Store the BASE buy price for display (e.g. 60,000). The weight-tier surcharge
      // is already baked into perGram/total, so the amount stays correct without the
      // displayed รับซื้อ price showing the inflated 61,000.
      price: isSilver ? silverBase : price,
      plus: 0,
      percent: isSilver ? percent : 0,
      weight,
      perGram,
      total,
    });
    setWeight(isSilver ? 0 : goldDefaultWeight);
    setWeightTouched(false);
  };

  const changeColor = (v: number) =>
    v > 0 ? "text-green-800" : v < 0 ? "text-red-600" : "text-black/40";

  // Metal-aware header/price values.
  const metalLabel = isSilver ? "เงินแท่ง" : "ทองคำแท่ง";
  const hasFeed = isSilver ? silverBase > 0 || !!silverPrice : !!effGold;
  // Silver header shows the effective buy price (admin/feed base); gold uses feed.
  const headerBuy = isSilver ? silverBase : effGold?.bar_buy;
  const headerSell = isSilver ? silverPrice?.sell : effGold?.bar_sell;
  const headerChange =
    (isSilver ? silverPrice?.change_today : effGold?.change_today) ?? 0;
  // Only claim "เรียลไทม์" once a live price has actually arrived — until then
  // effGold is still the association price.
  const realtimeLive = realtimeActive && !!rt && rt.bar_buy != null;
  const headerDate = realtimeLive
    ? `เรียลไทม์ ${salesStatus?.now ?? ""}`.trim()
    : isSilver
      ? `${silverPrice?.price_date ?? ""} ${silverPrice?.price_time ?? ""}`.trim()
      : `${effGold?.gold_date ?? ""} ${effGold?.gold_time ?? ""}`.trim();

  return (
    <div
      className={`flex flex-col w-full min-w-0 ${fluid ? "" : "xl:w-[700px] mb-5"}`}
    >
      <div
        className={`flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl p-3 gap-y-2 ${
          fluid ? "" : "md:h-full md:overflow-y-scroll md:scrollbar-hide"
        }`}
      >
        {metals.length > 1 && (
          <div className="w-full flex justify-center">
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
              {metals.map((m) => (
                <Tab
                  key={m.key}
                  title={<span className="font-bold text-xs">{m.label}</span>}
                />
              ))}
            </Tabs>
          </div>
        )}

        {hasFeed ? (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <div className="flex flex-row w-full justify-between">
              <span className="text-[10px] font-bold text-black/50">
                อัปเดท: {headerDate}
              </span>
              <div className="flex flex-row items-center gap-x-2">
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
                  <span className="text-[10px] font-bold">วันนี้</span>
                  <span className="text-[10px] font-bold ml-1">
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
              {isSilver ? "ยังไม่มีข้อมูลราคาเงิน" : "ยังไม่มีข้อมูลราคาทอง"}
            </span>
          </div>
        )}

        <div
          key={realtimeActive ? rt?.version : undefined}
          className={`w-full grid grid-cols-2 gap-x-2 ${realtimeActive && rtDir === "up" ? "rt-flash-up" : realtimeActive && rtDir === "down" ? "rt-flash-down" : ""}`}
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
            value={headerSell !== undefined ? headerSell.toLocaleString() : "-"}
          />
        </div>

        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 flex flex-row justify-between">
          ขาย{metalLabel}
          {/* Gold tab only (silver has its own schedule). Staff (ขายแทนลูกค้า) get
              the price-source toggle in place of the chip — it names the price in
              use and switches it for this sale; customers just get the chip. */}
          {!isSilver &&
            (staffMode ? (
              <GoldPriceSourceToggle
                value={effGoldSource}
                onChange={(v) => {
                  setGoldSource(v);
                  // Take the newly-picked feed's price (drops a manual override).
                  setPriceTouched(false);
                }}
                status={salesStatus}
                waitingRealtime={realtimeActive && (!rt || rt.bar_buy == null)}
              />
            ) : (
              salesStatus && <PriceModeChip status={salesStatus} />
            ))}
        </span>

        {/* Locked product type */}
        <div className="flex flex-col px-1 gap-y-1">
          <span className="text-xs font-bold text-black/50 pl-1">ประเภท</span>
          <div className="flex items-center justify-between border-1 border-yellow-500/30 bg-yellow-500/10 rounded-2xl px-4 py-3">
            <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {activeType
                ? activeType.name
                : isSilver
                  ? "ไม่พบประเภทเงินแท่ง"
                  : "ไม่พบประเภททองคำแท่ง 96.5%"}
            </span>
            <span className="text-[11px] font-bold text-black/50">
              ราคา {displayPrice.toLocaleString()} {isSilver ? "บาท/กก." : "บาท"}
            </span>
          </div>
        </div>

        {/* Staff manual buy-price override (gold only) */}
        {staffMode && !isSilver && (
          <div className="flex flex-col px-1 gap-y-1 mt-2">
            <span className="text-xs font-bold text-black/50 pl-1 flex items-center justify-between">
              <span className="flex items-center gap-x-1">
                <Keyboard size={12} className="text-green-600" /> ราคารับซื้อ
                (บาท) · แก้ไขเองได้
              </span>
              {priceTouched && (
                <button
                  type="button"
                  onClick={() => setPriceTouched(false)}
                  className="text-[11px] font-bold text-yellow-700 hover:underline"
                >
                  คืนราคาตลาด
                </button>
              )}
            </span>
            <DecimalInput
              label="ราคารับซื้อ"
              value={price}
              onChange={(n) => {
                setPrice(n);
                setPriceTouched(true);
              }}
              maxDecimals={2}
              endContent={
                <span className="text-xs font-bold text-black/40">บาท</span>
              }
            />
          </div>
        )}

        {/* Silver weight-tier surcharge / block notice */}
        {isSilver && silverBlocked && (
          <div className="mx-1 flex flex-col border-1 border-red-300 bg-red-50 rounded-2xl px-4 py-2">
            <span className="text-sm font-bold text-red-600">
              น้ำหนักนี้ขายไม่ได้
            </span>
            <span className="text-[11px] text-red-500">
              เกินน้ำหนักที่ร้านรับซื้อ กรุณาลดน้ำหนักหรือติดต่อเจ้าหน้าที่
            </span>
          </div>
        )}
        {isSilver && !silverBlocked && silverAddPerKg > 0 && (
          <div className="mx-1 flex items-center gap-x-1 border-1 border-amber-200 bg-amber-50 rounded-2xl px-4 py-2">
            <span className="text-[11px] font-bold text-amber-700">
              น้ำหนักช่วงนี้ บวกราคา {silverAddPerKg.toLocaleString()} บาท/กก.
              (รวมในราคาแล้ว)
            </span>
          </div>
        )}

        {/* Staff manual buy-price override (silver base) */}
        {staffMode && isSilver && (
          <div className="flex flex-col px-1 gap-y-1 mt-2">
            <span className="text-xs font-bold text-black/50 pl-1 flex items-center justify-between">
              <span className="flex items-center gap-x-1">
                <Keyboard size={12} className="text-green-600" /> ราคารับซื้อ
                (บาท/กก.) · แก้ไขเองได้
              </span>
              {silverPriceTouched && (
                <button
                  type="button"
                  onClick={() => setSilverPriceTouched(false)}
                  className="text-[11px] font-bold text-yellow-700 hover:underline"
                >
                  คืนราคาตลาด
                </button>
              )}
            </span>
            <DecimalInput
              label="ราคารับซื้อ"
              value={silverBase}
              onChange={(n) => {
                setSilverManualBase(n);
                setSilverPriceTouched(true);
              }}
              maxDecimals={2}
              endContent={
                <span className="text-xs font-bold text-black/40">บาท/กก.</span>
              }
            />
            {silverAddPerKg > 0 && (
              <span className="text-[11px] text-black/40 pl-1">
                รวมส่วนบวกตามน้ำหนัก {silverAddPerKg.toLocaleString()} บาท/กก. =
                ราคาสุทธิ {silverEffPrice.toLocaleString()} บาท/กก.
              </span>
            )}
          </div>
        )}

        {/* Silver purity (%) — customer-entered, prefilled from the type default */}
        {isSilver && (
          <div className="flex flex-col px-1 gap-y-1 mt-2">
            <span className="text-xs font-bold text-black/50 pl-1">
              เปอร์เซ็นต์ความบริสุทธิ์ (%)
            </span>
            <DecimalInput
              label="เปอร์เซ็นต์"
              value={percent}
              onChange={setPercent}
              maxDecimals={2}
            />
          </div>
        )}

        {isSilver ? (
          /* Silver weight — enter grams OR kilograms; the two convert live. */
          <div className="flex flex-col px-1 gap-y-1 mt-2">
            <span className="text-xs font-bold text-black/50 pl-1 flex items-center gap-x-1">
              <Keyboard size={12} className="text-green-600" /> น้ำหนัก ·
              พิมพ์เป็นกรัมหรือกิโลกรัมก็ได้ (แปลงให้อัตโนมัติ)
            </span>
            <div className="grid grid-cols-2 gap-x-2">
              <DecimalInput
                label="กรัม"
                value={weight}
                onChange={(n) =>
                  setWeight(Math.min(SILVER_WEIGHT_MAX, Math.max(0, n)))
                }
                maxDecimals={2}
                endContent={
                  <span className="text-xs font-bold text-black/40">ก.</span>
                }
              />
              <DecimalInput
                label="กิโลกรัม"
                value={weight / 1000}
                onChange={(n) =>
                  setWeight(Math.min(SILVER_WEIGHT_MAX, Math.max(0, n * 1000)))
                }
                maxDecimals={3}
                endContent={
                  <span className="text-xs font-bold text-black/40">กก.</span>
                }
              />
            </div>
            {silverBelowMin && (
              <span className="text-[11px] font-bold text-red-500 pl-1">
                น้ำหนักขั้นต่ำ 1 กิโลกรัม (1,000 กรัม)
              </span>
            )}
          </div>
        ) : (
          /* Gold weight (baht) — typed when scheduled, stepped by 5 otherwise */
          <div className="flex flex-col px-1 gap-y-1 mt-2">
            <span className="text-xs font-bold text-black/50 pl-1 flex items-center gap-x-1">
              {canTypeWeight ? (
                <>
                  <Keyboard size={12} className="text-green-600" /> น้ำหนัก (บาท)
                  · {staffMode ? "พิมพ์เอง / ปรับทีละ 1" : "พิมพ์เองได้ตอนนี้"}
                </>
              ) : (
                `น้ำหนัก (บาท) · ปรับทีละ ${WEIGHT_STEP}`
              )}
            </span>
            {canTypeWeight ? (
              <div className="flex items-center gap-x-2">
                <button
                  type="button"
                  onClick={() => adjustWeight(-1)}
                  disabled={weight <= 0}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-red-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-red-600/60 transition-all"
                >
                  <Minus size={22} className="text-red-700" />
                </button>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={weight === 0 ? "" : String(weight)}
                  onValueChange={handleWeightInput}
                  onKeyDown={(e) => {
                    if ([".", ",", "e", "E", "+", "-"].includes(e.key))
                      e.preventDefault();
                  }}
                  endContent={
                    <span className="text-xs font-bold text-black/40">บาท</span>
                  }
                  classNames={{
                    base: "flex-1",
                    inputWrapper:
                      "bg-black/5 border-1 border-green-500/30 rounded-2xl py-3",
                    input:
                      "text-center font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent",
                  }}
                />
                <button
                  type="button"
                  onClick={() => adjustWeight(1)}
                  disabled={weight >= WEIGHT_MAX}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-green-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-green-600/60 transition-all"
                >
                  <Plus size={22} className="text-green-700" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-x-3">
                <button
                  type="button"
                  onClick={() => stepWeight(-1)}
                  disabled={weight <= WEIGHT_MIN}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-red-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-red-600/60 transition-all"
                >
                  <Minus size={22} className="text-red-700" />
                </button>
                <div className="flex-1 flex flex-col items-center justify-center border-1 border-black/10 bg-black/5 rounded-2xl py-3 select-none">
                  <span className="font-bold text-3xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {weight}
                  </span>
                  <span className="text-[10px] font-bold text-black/40">บาท</span>
                </div>
                <button
                  type="button"
                  onClick={() => stepWeight(1)}
                  disabled={weight >= WEIGHT_MAX}
                  className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-green-600/40 to-transparent border-1 border-black/10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-green-600/60 transition-all"
                >
                  <Plus size={22} className="text-green-700" />
                </button>
              </div>
            )}
          </div>
        )}

        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          color="bg-gradient-to-l from-transparent to-yellow-600/50"
          flex
          title="ราคาประเมิน"
          subtitle={
            isSilver
              ? "ราคาต่อกรัม × น้ำหนัก (กรัม)"
              : "ราคาต่อบาท × น้ำหนัก (บาท)"
          }
          value={total.toLocaleString()}
        />

        <div className=" w-full flex flex-row justify-end">
          <div
            onClick={handleAdd}
            aria-disabled={!canSubmit}
            className={` max-xl:hidden bg-gradient-to-br from-blue-600/50 to-transparent border-1 border-black/10 rounded-full text-blue-950 font-bold gap-x-2 px-4 h-14 flex items-center justify-center transition-all backdrop-blur-lg ${canSubmit ? "cursor-pointer hover:from-blue-600/70" : "opacity-40 cursor-not-allowed"}`}
          >
            <Send size={20} />
            ส่งขาย
          </div>
        </div>
      </div>

      <div
        onClick={handleAdd}
        aria-disabled={!canSubmit}
        className={` xl:hidden fixed bottom-[calc(1.25rem+var(--bottom-nav-h,0px))] right-5 bg-gradient-to-br from-blue-600/50 to-transparent border-1 border-black/10 rounded-full text-blue-950 font-bold gap-x-2 px-4 h-14 flex items-center justify-center transition-all backdrop-blur-lg ${canSubmit ? "cursor-pointer hover:from-blue-600/70" : "opacity-40 cursor-not-allowed"}`}
      >
        <Send size={20} />
        ส่งขาย
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
