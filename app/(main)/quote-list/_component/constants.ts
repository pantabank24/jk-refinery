import { GoldType } from "@/lib/gold-calc";
import { QuotationData, QuotationItem } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");

// Absolute URLs of a quotation's images filtered by type ("" = legacy/untyped).
export function imgUrls(images: { image_url: string; type?: string }[] | undefined, type: string): string[] {
  return (images ?? []).filter((img) => (img.type || "") === type).map((img) => `${API_BASE}${img.image_url}`);
}

export const STATUS_LABEL: Record<number, string> = { 0: "รอตรวจสอบ", 1: "สำเร็จ", 2: "ยกเลิก" };
export const STATUS_COLOR: Record<number, string> = {
  0: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  1: "bg-green-500/20 text-green-700 border-green-500/30",
  2: "bg-red-500/20 text-red-700 border-red-500/30",
};

export const REJECT_REASONS = [
  "ราคาไม่ตรงตามที่ตกลง",
  "ลูกค้าเปลี่ยนใจ",
  "น้ำหนักไม่ถูกต้อง",
  "ประเภททองไม่ถูกต้อง",
  "เครดิตไม่เพียงพอ",
  "รายการซ้ำ",
  "อื่นๆ",
];

export type Metal = "gold" | "silver" | "platinum" | "palladium";
export const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
export const METAL_LABEL: Record<Metal, string> = {
  gold: "ทอง", silver: "เงิน", platinum: "แพลตินัม", palladium: "แพลเลเดียม",
};

export function metalOf(item: QuotationItem, goldTypes: GoldType[]): Metal {
  const gt = goldTypes.find((t) => String(t.id) === String(item.type_id));
  const metal = gt?.metal || "gold";
  return (METALS as string[]).includes(metal) ? (metal as Metal) : "gold";
}

export interface QuoteTotals {
  amount: number;
  weight: number;
  byMetal: Record<Metal, number>;
}

// Aggregates total amount/weight (overall + per-metal amount) across a set of
// quotations — shared by the page-level overview and the employee detail header.
export function sumQuotations(quotations: QuotationData[], goldTypes: GoldType[]): QuoteTotals {
  const totals: QuoteTotals = {
    amount: 0,
    weight: 0,
    byMetal: { gold: 0, silver: 0, platinum: 0, palladium: 0 },
  };
  for (const q of quotations) {
    totals.amount += q.total_amount;
    for (const item of q.items ?? []) {
      totals.weight += item.weight;
      totals.byMetal[metalOf(item, goldTypes)] += item.total;
    }
  }
  return totals;
}
