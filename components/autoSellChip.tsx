import { Zap } from "lucide-react";

// Marks a line the auto-sell engine sold on its own when the customer's target
// price was reached. A fill accumulates into the customer's open "รอออกบิล" bill
// exactly like a manual sell, so one bill can hold both kinds of line — which is
// why this belongs on the line rather than on the bill.
//
// `compact` drops the label for the tight rows inside an expanded bill, where the
// icon alone is enough and the type name needs the width.
export const AutoSellChip = ({ compact = false }: { compact?: boolean }) => (
  <span
    title="ระบบขายให้อัตโนมัติเมื่อราคาถึงเป้าที่ลูกค้าตั้งไว้"
    className={`shrink-0 inline-flex items-center gap-x-0.5 text-[10px] font-bold rounded-full border-1 bg-sky-500/15 text-sky-700 border-sky-500/30 ${compact ? "px-1 py-0.5" : "px-1.5 py-0.5"}`}
  >
    <Zap size={9} />
    {!compact && "ขายอัตโนมัติ"}
  </span>
);
