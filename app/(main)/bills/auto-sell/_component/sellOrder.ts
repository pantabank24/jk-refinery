// Shared between the auto-sell form page and the orders list page, so the two
// can never disagree about what a status means or how a figure is formatted.

export interface SellOrder {
  id: number;
  weight: number;
  target_price: number;
  status: "active" | "filling" | "filled" | "cancelled";
  price_at_create: number;
  spread_at_create: number;
  // The price actually captured — can sit above target_price when the market
  // jumped between the engine's checks.
  filled_price: number | null;
  filled_at: string | null;
  bill_id: number | null;
  bill?: { id: number; code: string; total_amount: number } | null;
  cancel_reason: string;
  note: string;
  created_at: string;
}

export const STATUS_LABEL: Record<SellOrder["status"], string> = {
  active: "รอราคา",
  filling: "กำลังขาย",
  filled: "ขายแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export const STATUS_STYLE: Record<SellOrder["status"], string> = {
  active: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  filling: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  filled: "bg-green-500/15 text-green-700 border-green-500/30",
  cancelled: "bg-black/5 text-black/40 border-black/10",
};

// An order still counted against the caps: waiting, or already being turned into
// a bill by the engine.
export const isWaiting = (o: SellOrder) =>
  o.status === "active" || o.status === "filling";

export const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const plain = (n: number) => n.toLocaleString();

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
