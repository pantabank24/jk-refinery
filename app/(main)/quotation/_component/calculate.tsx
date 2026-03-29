'use client'

import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, Plus, List } from "lucide-react";
import { CmpInput } from "@/components/cmpInput";
import { useState, useEffect } from "react";
import { CmpSelect, Option } from "@/components/cmpSelect";
import { QuotationProps } from "./quotation";
import { api } from "@/lib/api";

type OperandType = "number" | "price" | "percent" | "plus" | "weight" | "service";

interface FormulaStep {
  operator: "+" | "-" | "*" | "/";
  operand_type: OperandType;
  value: number;
}

interface GoldType {
  id: number;
  name: string;
  price_source: string;
  default_percent: number;
  default_plus: number;
  formula_steps: string; // JSON-encoded FormulaStep[]
  service_rate: number;  // ค่าตัวคูณกำหนดเองต่อประเภท
  plus_type: number;     // 0=บาท, 1=%
}

interface FormulaVars {
  price: number;
  percent: number;
  plus: number;
  weight: number;
}

const OPERAND_LABELS: Record<OperandType, string> = {
  number:  "กำหนดเอง",
  price:   "ราคาทอง",
  percent: "เปอร์เซ็นต์",
  plus:    "ราคาบวก",
  weight:  "น้ำหนัก",
  service: "ค่าบริการ",
};

function parseSteps(raw: string): FormulaStep[] {
  try {
    const steps = JSON.parse(raw || "[]");
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

function getUsedVars(gt: GoldType): Set<OperandType> {
  return new Set(parseSteps(gt.formula_steps).map((s) => s.operand_type));
}

function applyFormula(vars: FormulaVars, gt: GoldType): number {
  const steps = parseSteps(gt.formula_steps);
  if (steps.length > 0) {
    return steps.reduce((result, s) => {
      let operand: number;
      switch (s.operand_type) {
        case "price":   operand = vars.price;        break;
        case "percent": operand = vars.percent;      break;
        case "plus":    operand = vars.plus;         break;
        case "weight":  operand = vars.weight;       break;
        case "service": operand = gt.service_rate;   break;
        default:        operand = s.value;
      }
      switch (s.operator) {
        case "+": return result + operand;
        case "-": return result - operand;
        case "*": return result * operand;
        case "/": return operand !== 0 ? result / operand : result;
        default: return result;
      }
    }, vars.price);
  }
  // legacy fallback
  return vars.price * (gt.default_percent / 100) + gt.default_plus;
}

interface GoldPrice {
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
  change_today: number;
  gold_date: string;
  gold_time: string;
}

interface Props {
  onAdd: (item: QuotationProps) => void;
  onOpenList?: () => void;
  quotationCount?: number;
}

export const Calculate = ({ onAdd, onOpenList, quotationCount = 0 }: Props) => {
  const [goldTypes, setGoldTypes] = useState<GoldType[]>([]);
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);

  const [price, setPrice] = useState(0);
  const [typeId, setTypeId] = useState("");
  const [percent, setPercent] = useState(0);
  const [plus, setPlus] = useState(0);
  const [weight, setWeight] = useState(0);

  useEffect(() => {
    api.get<GoldType[]>("/gold-types")
      .then((res) => {
        const types = (res.data as unknown as GoldType[]) || [];
        setGoldTypes(types);
        if (types.length > 0) setTypeId(String(types[0].id));
      })
      .catch(() => {});

    api.get<GoldPrice>("/gold-prices/latest")
      .then((res) => setGoldPrice((res.data as unknown as GoldPrice) || null))
      .catch(() => {});
  }, []);

  // When type or gold price changes: auto-fill price from price_source,
  // and auto-fill percent/plus from the gold type's defaults (legacy mode)
  useEffect(() => {
    if (!typeId || goldTypes.length === 0) return;
    const gt = goldTypes.find((t) => String(t.id) === typeId);
    if (!gt) return;

    if (goldPrice) {
      const sourceMap: Record<string, number> = {
        bar_buy: goldPrice.bar_buy,
        bar_sell: goldPrice.bar_sell,
        ornament_buy: goldPrice.ornament_buy,
        ornament_sell: goldPrice.ornament_sell,
      };
      setPrice(sourceMap[gt.price_source] ?? 0);
    }

    // Pre-fill default percent/plus whenever gold type changes
    setPercent(gt.default_percent);
    setPlus(gt.default_plus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, goldTypes, goldPrice]);

  const typeOptions: Option[] = goldTypes.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const selectedGoldType = goldTypes.find((t) => String(t.id) === typeId) ?? null;
  const getTypeName = (id: string) => goldTypes.find((t) => String(t.id) === id)?.name || "ทอง";

  const hasFormula = selectedGoldType ? parseSteps(selectedGoldType.formula_steps).length > 0 : false;
  const usedVars: Set<OperandType> = selectedGoldType && hasFormula
    ? getUsedVars(selectedGoldType)
    : new Set(["percent", "plus"] as OperandType[]);

  // If plus_type === 1 (%), convert percent-plus to บาท before passing to formula
  const plusBaht = selectedGoldType?.plus_type === 1 ? price * (plus / 100) : plus;

  const vars: FormulaVars = { price, percent, plus: plusBaht, weight };

  // Calculate perGram:
  // - Has formula  → apply formula steps
  // - No formula   → use UI inputs directly (price, percent%, plus)
  const perGram = selectedGoldType && hasFormula
    ? applyFormula(vars, selectedGoldType)
    : price * (percent / 100) + plusBaht;

  // If formula includes 'weight' the output is already a total, not per-gram
  const total = usedVars.has("weight") ? perGram : perGram * weight;

  const handleAdd = () => {
    if (weight <= 0) return;
    onAdd({
      typeId,
      typeName: getTypeName(typeId),
      price,
      plus,
      percent,
      weight,
      perGram,
      total,
    });
    setWeight(0);
  };

  const changeColor = (v: number) =>
    v > 0 ? "text-green-800" : v < 0 ? "text-red-600" : "text-black/40";

  return (
    <div className=" flex flex-col h-full w-full xl:w-[700px] overflow-hidden">
      <div className="flex flex-col h-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl p-3 gap-y-2 overflow-y-scroll scrollbar-hide">
        {goldPrice ? (
          <div className={`flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl`}>
            <div className=" flex flex-row w-full justify-between">
              <span className=" text-[10px] font-bold text-black/50">
                อัปเดท: {goldPrice.gold_date} {goldPrice.gold_time}
              </span>
              <div className=" flex flex-row items-center gap-x-2">
                {goldPrice.change_today !== 0 && (
                  <div className={`flex flex-row items-center ${changeColor(goldPrice.change_today)}`}>
                    {goldPrice.change_today > 0 ? (
                      <ArrowUp size={10} className="font-bold" />
                    ) : goldPrice.change_today < 0 ? (
                      <ArrowDown size={10} className="font-bold" />
                    ) : (
                      <Minus size={10} />
                    )}
                    <span className="text-[10px] font-bold ml-0.5">
                      {Math.abs(goldPrice.change_today)}
                    </span>
                  </div>
                )}
                <div className={`flex flex-row items-center ${changeColor(goldPrice.change_today)}`}>
                  <span className=" text-[10px] font-bold">วันนี้</span>
                  <span className=" text-[10px] font-bold ml-1">{goldPrice.change_today > 0 ? "+" : ""}{goldPrice.change_today}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <span className="text-[10px] font-bold text-black/50">ยังไม่มีข้อมูลราคาทอง</span>
          </div>
        )}

        <div className="w-full grid grid-cols-2 gap-x-2">
          <BoxCard
            textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
            flex
            title="ราคารับซื้อ (บาท)"
            value={goldPrice ? goldPrice.bar_buy.toLocaleString() : "-"}
          />
          <BoxCard
            textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
            flex
            title="ราคาขาย (บาท)"
            value={goldPrice ? goldPrice.bar_sell.toLocaleString() : "-"}
          />
        </div>

        <span className=" font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 mt-5">คำนวณราคาทอง</span>

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
            label="ราคาทอง"
            placeholder="0"
            value={price === 0 ? "" : price.toString()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(parseFloat(e.target.value) || 0)}
          />
          <CmpSelect
            data={typeOptions}
            label="ประเภท"
            placeholder="เลือก"
            value={typeId}
            onChange={setTypeId}
          />
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
            <CmpInput
              label={selectedGoldType?.plus_type === 1 ? "ราคาบวก (%)" : "ราคาบวก (บาท)"}
              placeholder="0"
              value={plus === 0 ? "" : plus.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlus(parseFloat(e.target.value) || 0)}
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
