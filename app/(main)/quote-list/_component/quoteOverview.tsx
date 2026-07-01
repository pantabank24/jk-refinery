import { METALS, METAL_LABEL, QuoteTotals } from "./constants";

const METAL_COLOR: Record<string, string> = {
  gold: "text-yellow-700",
  silver: "text-slate-500",
  platinum: "text-sky-700",
  palladium: "text-violet-700",
};

export function QuoteOverview({ totals }: { totals: QuoteTotals }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
      <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
        <span className="text-xs text-black/50">ยอดรวม</span>
        <span className="font-bold text-lg text-yellow-700">{totals.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      {METALS.map((m) => (
        <div key={m} className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-1">
          <span className="text-xs text-black/50">{METAL_LABEL[m]}</span>
          <span className={`font-bold text-lg ${METAL_COLOR[m]}`}>{totals.byMetal[m].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
}
