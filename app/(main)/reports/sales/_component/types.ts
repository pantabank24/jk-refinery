export type Metal = "gold" | "silver" | "platinum" | "palladium";

export const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];

export const METAL_LABEL: Record<Metal, string> = {
  gold: "ทอง",
  silver: "เงิน",
  platinum: "แพลตินัม",
  palladium: "แพลเลเดียม",
};

export function isMetal(value: string): value is Metal {
  return (METALS as string[]).includes(value);
}

// Two series colours, validated against this app's card surface (#f2f1ee):
// both clear the lightness band, the chroma floor, adjacent CVD separation and
// 3:1 contrast. Gold is the shop's own accent (the darker step already used by
// the bottom nav — the lighter #c09c42 measures 2.3:1 and would have forced the
// relief rule); blue is the reference palette's first categorical slot.
//
// One measure, one colour, everywhere on the page: money is gold, weight is blue.
export const SERIES_AMOUNT = "#a07f2e";
export const SERIES_WEIGHT = "#2a78d6";

export interface SalesOverview {
  amount: number;
  weight: number;
  doc_count: number;
  item_count: number;
  avg_per_gram: number;
}

export interface SalesPoint {
  bucket: string;
  amount: number;
  weight: number;
  docs: number;
}

export interface SalesBreakdown {
  key: string;
  label: string;
  amount: number;
  weight: number;
  docs: number;
}

export interface SalesReport {
  metal: string;
  overview: SalesOverview;
  series: SalesPoint[];
  by_type: SalesBreakdown[];
  by_employee: SalesBreakdown[];
}

export interface SalesRow {
  quotation_id: number;
  code: string;
  created_at: string;
  customer: string;
  phone: string;
  employee: string;
  branch: string;
  /** bill = ออกจากบิลลูกค้า · walkin = ลูกค้าเดินเข้า */
  source: string;
  weight: number;
  amount: number;
}

export const money = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export const money2 = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const grams = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });
