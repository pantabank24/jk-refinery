'use client'

import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, Plus, List } from "lucide-react";
import { useState, useEffect } from "react";
import { QuotationProps } from "../../quotation/_component/quotation";
import { api } from "@/lib/api";
import { GoldType, computeItem } from "@/lib/gold-calc";

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
  billCount?: number;
}

// Weight is in baht (gold weight unit), stepped up/down and cannot be typed:
// 5, 10, 15, ... baht.
const WEIGHT_STEP = 5;
const WEIGHT_MIN = 5;
const WEIGHT_MAX = 1000;

// Bills only deal with gold bars 96.5% — match the gold type by name rather than
// hardcoding an id (ids vary across environments / reseeds).
const isGoldBar = (t: GoldType) => /แท่ง/.test(t.name) && /96\.5/.test(t.name);

export const BillCalculate = ({ onAdd, onOpenList, billCount = 0 }: Props) => {
  const [goldBar, setGoldBar] = useState<GoldType | null>(null);
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [price, setPrice] = useState(0);
  const [weight, setWeight] = useState(WEIGHT_MIN);

  useEffect(() => {
    api.get<GoldType[]>("/gold-types")
      .then((res) => {
        const types = (res.data as unknown as GoldType[]) || [];
        setGoldBar(types.find(isGoldBar) ?? null);
      })
      .catch(() => { });

    api.get<GoldPrice>("/gold-prices/latest")
      .then((res) => setGoldPrice((res.data as unknown as GoldPrice) || null))
      .catch(() => { });
  }, []);

  // Auto-fill price from the gold bar's price source whenever data loads.
  useEffect(() => {
    if (!goldBar || !goldPrice) return;
    const sourceMap: Record<string, number> = {
      bar_buy: goldPrice.bar_buy,
      bar_sell: goldPrice.bar_sell,
      ornament_buy: goldPrice.ornament_buy,
      ornament_sell: goldPrice.ornament_sell,
    };
    setPrice(sourceMap[goldBar.price_source] ?? goldPrice.bar_buy ?? 0);
  }, [goldBar, goldPrice]);

  // Gold-bar price is quoted per baht-weight, so total = price × weight(บาท).
  // perGram is the per-gram figure (informational, weight-independent).
  const perGram = computeItem({ goldType: goldBar, price, percent: 0, plus: 0, weight: 1 }).perGram;
  const total = price * weight;

  const stepWeight = (dir: 1 | -1) => {
    setWeight((w) => {
      const next = w + dir * WEIGHT_STEP;
      if (next < WEIGHT_MIN) return WEIGHT_MIN;
      if (next > WEIGHT_MAX) return WEIGHT_MAX;
      return next;
    });
  };

  const handleAdd = () => {
    if (!goldBar || weight <= 0) return;
    onAdd({
      typeId: String(goldBar.id),
      typeName: goldBar.name,
      price,
      plus: 0,
      percent: 0,
      weight,
      perGram,
      total,
    });
    setWeight(WEIGHT_MIN);
  };

  const changeColor = (v: number) =>
    v > 0 ? "text-green-800" : v < 0 ? "text-red-600" : "text-black/40";

  return (
    <div className="flex flex-col h-full w-full xl:w-[700px] overflow-hidden">
      <div className="flex flex-col h-full border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl p-3 gap-y-2 overflow-y-scroll scrollbar-hide">
        {goldPrice ? (
          <div className="flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl">
            <div className="flex flex-row w-full justify-between">
              <span className="text-[10px] font-bold text-black/50">
                อัปเดท: {goldPrice.gold_date} {goldPrice.gold_time}
              </span>
              <div className="flex flex-row items-center gap-x-2">
                {goldPrice.change_today !== 0 && (
                  <div className={`flex flex-row items-center ${changeColor(goldPrice.change_today)}`}>
                    {goldPrice.change_today > 0 ? (
                      <ArrowUp size={10} className="font-bold" />
                    ) : goldPrice.change_today < 0 ? (
                      <ArrowDown size={10} className="font-bold" />
                    ) : (
                      <Minus size={10} />
                    )}
                    <span className="text-[10px] font-bold ml-0.5">{Math.abs(goldPrice.change_today)}</span>
                  </div>
                )}
                <div className={`flex flex-row items-center ${changeColor(goldPrice.change_today)}`}>
                  <span className="text-[10px] font-bold">วันนี้</span>
                  <span className="text-[10px] font-bold ml-1">{goldPrice.change_today > 0 ? "+" : ""}{goldPrice.change_today}</span>
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

        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 mt-5">
          ขายทองคำแท่ง
        </span>

        {/* Locked gold type */}
        <div className="flex flex-col px-1 gap-y-1">
          <span className="text-xs font-bold text-black/50 pl-1">ประเภท</span>
          <div className="flex items-center justify-between border-1 border-yellow-500/30 bg-yellow-500/10 rounded-2xl px-4 py-3">
            <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {goldBar ? goldBar.name : "ไม่พบประเภททองคำแท่ง 96.5%"}
            </span>
            <span className="text-[11px] font-bold text-black/50">
              ราคา {price.toLocaleString()} บาท
            </span>
          </div>
        </div>

        {/* Weight stepper (baht) — read-only value */}
        <div className="flex flex-col px-1 gap-y-1 mt-2">
          <span className="text-xs font-bold text-black/50 pl-1">น้ำหนัก (บาท) · ปรับทีละ {WEIGHT_STEP}</span>
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
        </div>

        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          color="bg-gradient-to-l from-transparent to-yellow-600/50"
          flex
          title="ราคาประเมิน"
          subtitle="ราคาต่อบาท × น้ำหนัก (บาท)"
          value={total.toLocaleString()}
        />

        <div className="flex h-full w-full items-end justify-between mt-2">
          {/* Mobile: รายการ button — hidden on desktop */}
          <button
            type="button"
            onClick={onOpenList}
            className="lg:hidden flex items-center gap-x-2 bg-gradient-to-br from-[#c09c42]/30 to-transparent border-1 border-black/10 rounded-2xl h-14 px-4 font-bold text-sm relative"
          >
            <List size={18} className="text-[#c09c42]" />
            <span className="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">รายการ</span>
            {billCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {billCount}
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
