'use client'

import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, Plus, List } from "lucide-react";
import { CmpInput } from "@/components/cmpInput";
import { useState, useEffect } from "react";
import { CmpSelect, Option } from "@/components/cmpSelect";
import { QuotationProps } from "./quotation";
import { api } from "@/lib/api";
import { Tabs, Tab } from "@heroui/tabs";
import { Input } from "@heroui/input";
import {
  OperandType,
  GoldType,
  parseSteps,
  getUsedVars,
  computeItem,
} from "@/lib/gold-calc";

const OPERAND_LABELS: Record<OperandType, string> = {
  number:  "กำหนดเอง",
  price:   "ราคาทอง",
  percent: "เปอร์เซ็นต์",
  plus:    "ราคาบวก",
  weight:  "น้ำหนัก",
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
const pickType = (types: GoldType[], metalKey: string): GoldType | undefined => {
  const list = types.filter((t) => (t.metal || "gold") === metalKey);
  if (metalKey === "gold") return list.find((t) => t.name.includes("หลอม")) ?? list[0];
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

interface Props {
  onAdd: (item: QuotationProps) => void;
  onOpenList?: () => void;
  quotationCount?: number;
  /** When true, locks to gold melt type and hides metal tabs + type dropdown */
  lockMeltType?: boolean;
  /** When set, overrides the auto-filled price with a fixed value (read-only) */
  forcedPrice?: number;
}

export const Calculate = ({ onAdd, onOpenList, quotationCount = 0, lockMeltType, forcedPrice }: Props) => {
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [silverPrice, setSilverPrice] = useState<SilverPrice | null>(null);
  const [metal, setMetal] = useState<string>("gold");

  const [price, setPrice] = useState(forcedPrice ?? 0);
  const [typeId, setTypeId] = useState("");
  const [percent, setPercent] = useState(0);
  const [plus, setPlus] = useState(0);
  const [plusType, setPlusType] = useState(0); // 0=บาท, 1=%
  const [weight, setWeight] = useState(0);

  useEffect(() => {
    api.get<GoldType[]>("/gold-types")
      .then((res) => {
        const types = (res.data as unknown as GoldType[]) || [];
        setGoldTypes(types);
        // Always default to gold melt type (or first gold type); when locked, this
        // also prevents the user from switching away.
        const defGold = pickType(types, "gold") ?? types[0];
        if (defGold) setTypeId(String(defGold.id));
      })
      .catch(() => {});

    api.get<GoldPrice>("/gold-prices/latest")
      .then((res) => setGoldPrice((res.data as unknown as GoldPrice) || null))
      .catch(() => {});

    api.get<SilverPrice>("/metal-prices/latest?symbol=XAG")
      .then((res) => setSilverPrice((res.data as unknown as SilverPrice) || null))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Product types belonging to the active metal tab.
  const metalTypes = goldTypes.filter((t) => (t.metal || "gold") === metal);

  // Resolve the auto-fill price for a product type from its metal's price feed.
  // Returns null for manual sources (platinum/palladium) — the user types it.
  const resolvePrice = (gt: GoldType): number | null => {
    const m = gt.metal || "gold";
    if (m === "gold" && goldPrice) {
      const map: Record<string, number> = {
        bar_buy: goldPrice.bar_buy,
        bar_sell: goldPrice.bar_sell,
        ornament_buy: goldPrice.ornament_buy,
        ornament_sell: goldPrice.ornament_sell,
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
    if (forcedPrice !== undefined) {
      setPrice(forcedPrice);
    } else {
      const p = resolvePrice(gt);
      setPrice(p ?? 0);
    }
    setPercent(0);
    setPlus(gt.default_plus);
    setPlusType(gt.plus_type ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, goldTypes, goldPrice, silverPrice, forcedPrice]);

  const handleMetalChange = (key: string) => {
    setMetal(key);
    const def = pickType(goldTypes, key);
    setTypeId(def ? String(def.id) : "");
  };

  const typeOptions: Option[] = metalTypes.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const selectedGoldType = goldTypes.find((t) => String(t.id) === typeId) ?? null;
  const isManualPrice = (selectedGoldType?.metal || "gold") !== "gold" && (selectedGoldType?.metal || "gold") !== "silver";
  const getTypeName = (id: string) => goldTypes.find((t) => String(t.id) === id)?.name || "ทอง";

  const hasFormula = selectedGoldType ? parseSteps(selectedGoldType.formula_steps).length > 0 : false;
  const usedVars: Set<OperandType> = selectedGoldType && hasFormula
    ? getUsedVars(selectedGoldType)
    : new Set(["percent", "plus"] as OperandType[]);

  // Shared with the edit screen — single source of truth for per-gram/total.
  const { perGram, total } = computeItem({ goldType: selectedGoldType, price, percent, plus, weight, plusType });

  const handleAdd = () => {
    if (weight <= 0) return;
    onAdd({
      typeId,
      typeName: getTypeName(typeId),
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
  const hasFeed = metal === "gold" ? !!goldPrice : metal === "silver" ? !!silverPrice : false;
  const headerBuy = metal === "gold" ? goldPrice?.bar_buy : metal === "silver" ? silverPrice?.buy : undefined;
  const headerSell = metal === "gold" ? goldPrice?.bar_sell : metal === "silver" ? silverPrice?.sell : undefined;
  const headerChange = (metal === "gold" ? goldPrice?.change_today : metal === "silver" ? silverPrice?.change_today : 0) ?? 0;
  const headerDate = metal === "gold"
    ? `${goldPrice?.gold_date ?? ""} ${goldPrice?.gold_time ?? ""}`.trim()
    : metal === "silver"
    ? `${silverPrice?.price_date ?? ""} ${silverPrice?.price_time ?? ""}`.trim()
    : "";

  return (
    <div className=" flex flex-col h-full w-full xl:w-[700px] overflow-hidden">
      <div className="flex flex-col h-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl p-3 gap-y-2 overflow-y-scroll scrollbar-hide">
        <Tabs
          aria-label="โลหะ"
          selectedKey={metal}
          onSelectionChange={(k) => handleMetalChange(String(k))}
          variant="solid"
          radius="full"
          classNames={{ tabList: "bg-black/5 border-1 border-black/10", cursor: "bg-gradient-to-l from-transparent to-yellow-600/50" }}
        >
          {METALS.map((m) => (
            <Tab key={m.key} title={<span className="font-bold text-xs">{m.label}</span>} />
          ))}
        </Tabs>

        {isManualPrice ? (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <span className="text-[10px] font-bold text-black/50">กรอกราคา{metalLabel}ต่อกรัมเองในช่องด้านล่าง</span>
          </div>
        ) : hasFeed ? (
          <div className={`flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl`}>
            <div className=" flex flex-row w-full justify-between">
              <span className=" text-[10px] font-bold text-black/50">
                อัปเดท: {headerDate}
              </span>
              <div className=" flex flex-row items-center gap-x-2">
                {headerChange !== 0 && (
                  <div className={`flex flex-row items-center ${changeColor(headerChange)}`}>
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
                <div className={`flex flex-row items-center ${changeColor(headerChange)}`}>
                  <span className=" text-[10px] font-bold">วันนี้</span>
                  <span className=" text-[10px] font-bold ml-1">{headerChange > 0 ? "+" : ""}{headerChange}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <span className="text-[10px] font-bold text-black/50">ยังไม่มีข้อมูลราคา{metalLabel}</span>
          </div>
        )}

        {!isManualPrice && (
          <div className="w-full grid grid-cols-2 gap-x-2">
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
        )}

        <span className=" font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 mt-5">คำนวณราคา{metalLabel}</span>

        {/* Formula badge */}
        {selectedGoldType && hasFormula && (
          <div className="flex flex-wrap gap-1 px-1">
            {parseSteps(selectedGoldType.formula_steps).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border-1 border-yellow-500/30 bg-yellow-500/10 text-yellow-700 font-bold">
                {i === 0 ? "ราคา" : "ผล"} {s.operator} {s.operand_type === "number" ? s.value.toLocaleString() : (OPERAND_LABELS[s.operand_type] ?? s.operand_type)}
              </span>
            ))}
          </div>
        )}

        <div className=" w-full grid grid-cols-2 gap-2 mb-5">
          <CmpInput
            label={isManualPrice ? `ราคา${metalLabel} (ต่อกรัม)` : "ราคา"}
            placeholder="0"
            value={price === 0 ? "" : price.toString()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (forcedPrice === undefined) setPrice(parseFloat(e.target.value) || 0);
            }}
            isReadOnly={forcedPrice !== undefined}
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
            <CmpInput
              label="เปอร์เซ็นต์"
              placeholder="0"
              value={percent === 0 ? "" : percent.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPercent(parseFloat(e.target.value) || 0)}
            />
          )}
          {usedVars.has("plus") && (
            <Input
              labelPlacement="inside"
              label={<div className="font-bold text-md">ราคาบวก</div>}
              placeholder="0"
              value={plus === 0 ? "" : plus.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlus(parseFloat(e.target.value) || 0)}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
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
          <CmpInput
            label="น้ำหนัก"
            placeholder="0"
            value={weight === 0 ? "" : weight.toString()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeight(parseFloat(e.target.value) || 0)}
          />
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
            <span className="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">รายการ</span>
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
    </div>
  );
}
