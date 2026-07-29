import { QuotationProps } from "./quotation";

// Collapse keyed lines into one line per METAL — gold first, then each other
// metal in the order it appears. The line's price is the weighted-average rate
// of the group, so the consolidated line still totals the same money.
//
// This is the shape a bill-issued quotation SAVES its items in (page 2 and the
// total read from it), while the itemised lines live on in page1_items. Both the
// issue screen and the edit dialog consolidate through here so the two can never
// disagree about the arithmetic.
export function consolidateByMetal(items: QuotationProps[]): QuotationProps[] {
  const lines: QuotationProps[] = [];
  const byMetal = new Map<string, QuotationProps[]>();
  for (const item of items) {
    const m = item.metal || "gold";
    const group = byMetal.get(m);
    if (group) group.push(item);
    else byMetal.set(m, [item]);
  }
  // Gold first so the document leads with the main line.
  const metalKeys: string[] = [];
  byMetal.forEach((_, k) => metalKeys.push(k));
  const metals = ["gold", ...metalKeys.filter((m) => m !== "gold")];
  for (const m of metals) {
    const group = byMetal.get(m);
    if (!group) continue;
    const w = group.reduce((s, i) => s + (i.weight || 0), 0);
    const t = group.reduce((s, i) => s + i.total, 0);
    const first = group[0];
    const avg = w > 0 ? t / w : first.price;
    lines.push({
      ...first,
      price: Math.round(avg * 100) / 100,
      weight: w,
      perGram: w > 0 ? t / w : first.perGram,
      total: t,
    });
  }
  return lines;
}
