"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { bahtText } from "@/lib/thai-baht-text";
import {
  IMG_BASE,
  beDate,
  money,
  qty,
  sumItems,
  type ReceiptItem,
  type ReceiptSettings,
} from "./types";

// The printed form keeps its table a fixed height whether or not the receipt
// fills it, so blank rows are padded in to match the paper.
const MIN_ROWS = 10;

// The sheet is laid out at one fixed width so the columns land where they do on
// paper; a narrow screen scales the whole thing down rather than reflowing it,
// which would stop the preview from showing what actually prints.
const SHEET_WIDTH = 760;

// ...and it is a whole sheet of A4, not a box that stops where the text does. The
// paper form runs the signature line down at the foot of the page, so the sheet
// holds that height and the payment/signature block is pushed to the bottom of it.
// min- rather than a fixed height: a receipt with more lines than the page holds
// should run onto a second page instead of being cut off.
const SHEET_HEIGHT = Math.round((SHEET_WIDTH * 297) / 210);

// A4 minus the 12mm @page margins on each side, shaved by 2mm so rounding in the
// print layout can never tip the sheet onto a second, blank page.
const PRINT_SHEET_HEIGHT = "271mm";

interface Props {
  settings: ReceiptSettings;
  receipt: {
    code: string;
    issued_date: string;
    reference: string;
    customer_name: string;
    customer_address: string;
    customer_tax_id: string;
    pay_cash: boolean;
    pay_cheque: boolean;
    paid_date: string | null;
    items: ReceiptItem[];
  };
  // Hides the print button — used where the document is only a live preview.
  hidePrint?: boolean;
}

const Tick = ({ on }: { on: boolean }) => (
  <span className="inline-block w-[11px] text-center">{on ? "☑" : "☐"}</span>
);

// A4 receipt, laid out to match the paper form it is typed from. Printing clones
// the node to <body> so it prints in normal flow instead of being clipped inside
// whatever card or modal it is sitting in (same approach as the quotation preview).
export function ReceiptDocument({ settings, receipt, hidePrint }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Measured against the space the preview actually gets, not the window: on wide
  // screens the sheet sits beside a 520px entry form, and on the list it does not.
  const shellRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // A transform does not affect layout, so the placeholder around the sheet has to
  // carry the scaled height or everything below it would sit under the overhang.
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    const shell = shellRef.current;
    const sheet = sheetRef.current;
    if (!shell || !sheet) return;

    const measure = () => {
      // offsetHeight is the untransformed height, so this stays stable as the
      // scale changes and the observer does not feed itself.
      const natural = sheet.offsetHeight;
      const next = Math.min(1, shell.clientWidth / SHEET_WIDTH);
      const height = natural * next;
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
      setScaledHeight((prev) =>
        prev !== undefined && Math.abs(prev - height) < 0.5 ? prev : height,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  const handlePrint = () => {
    const el = rootRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add("receipt-print-clone");
    clone.style.display = "none"; // print CSS forces it visible
    document.body.appendChild(clone);

    const doPrint = () => {
      // window.print() is non-blocking on mobile, so the clone is removed on
      // afterprint rather than synchronously — otherwise the page prints blank.
      const cleanup = () => {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
      setTimeout(cleanup, 3000);
    };

    // cloneNode makes fresh <img> elements that may not have decoded yet; printing
    // before they do lays the page out without knowing the logo's size.
    const pending = Array.from(clone.querySelectorAll("img")).filter(
      (i) => !i.complete,
    );
    if (pending.length === 0) {
      doPrint();
      return;
    }
    let remaining = pending.length;
    const settled = () => {
      remaining -= 1;
      if (remaining === 0) doPrint();
    };
    pending.forEach((img) => {
      img.addEventListener("load", settled, { once: true });
      img.addEventListener("error", settled, { once: true });
    });
  };

  const rows: (ReceiptItem | null)[] = [...receipt.items];
  while (rows.length < MIN_ROWS) rows.push(null);

  const total = sumItems(receipt.items);
  const addressLines = (s: string) =>
    s.split("\n").filter((l) => l.trim() !== "");

  const printStyles = `
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      html, body {
        margin: 0 !important; padding: 0 !important; background: #fff !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
      /* Only the clone prints; everything else leaves the layout so the document
         starts at the top of the sheet. */
      body > *:not(.receipt-print-clone) { display: none !important; }
      .receipt-print-clone { display: block !important; }
      .receipt-print-clone .no-print { display: none !important; }
      /* The clone prints at full size — the on-screen fit-to-width scaling and the
         placeholder holding its height are both undone here. */
      .receipt-print-clone .receipt-scale-shell {
        width: 100% !important; height: auto !important; margin: 0 !important;
      }
      .receipt-print-clone .receipt-sheet {
        transform: none !important;
        width: 100% !important; max-width: none !important;
        /* Fills the printable area so the signature block lands at the foot of the
           physical page, the way it does on the paper form. */
        min-height: ${PRINT_SHEET_HEIGHT} !important;
        box-shadow: none !important; border-radius: 0 !important; padding: 0 !important;
      }
      .receipt-print-clone table { page-break-inside: auto; }
      .receipt-print-clone tr { page-break-inside: avoid; }
    }
  `;

  const cell = "border border-black px-1.5 py-[3px] align-top";

  return (
    <div ref={rootRef} className="flex flex-col items-center w-full">
      <style>{printStyles}</style>

      {!hidePrint && (
        <button
          type="button"
          onClick={handlePrint}
          className="no-print self-end mb-2 flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-full px-3 py-1.5 transition-colors"
        >
          <Printer size={14} /> พิมพ์
        </button>
      )}

      <div ref={shellRef} className="w-full overflow-hidden">
        {/* Holds the space the scaled sheet occupies and keeps it centred once the
            preview is wide enough that no scaling is needed. */}
        <div
          className="receipt-scale-shell"
          style={{
            width: SHEET_WIDTH * scale,
            height: scaledHeight,
            margin: "0 auto",
          }}
        >
          <div
            ref={sheetRef}
            style={{
              width: SHEET_WIDTH,
              minHeight: SHEET_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="receipt-sheet flex flex-col bg-white shadow-lg rounded-lg max-w-none p-[36px] text-[11px] leading-[1.55] text-black"
          >
            {/* ── Company header ── */}
            <div className="flex items-start gap-x-6 mb-4">
              <div className="w-[120px] h-[120px] shrink-0 flex items-center justify-center">
                {settings.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMG_BASE}${settings.logo_url}`}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="flex flex-col pt-1">
                <span className="font-bold">{settings.company_name}</span>
                {addressLines(settings.company_address).map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
                {settings.company_tax_id && (
                  <span>
                    เลขประจำตัวผู้เสียภาษีอากร {settings.company_tax_id}
                  </span>
                )}
                {settings.company_phone && (
                  <span>โทร {settings.company_phone}</span>
                )}
              </div>
            </div>

            <div className="text-center font-bold mb-1">
              {settings.doc_title}
            </div>

            {/* ── Customer + document info. Two stacked tables share one border so
                 they read as the single box on the paper form. ── */}
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[51%]" />
                <col className="w-[13%]" />
                <col className="w-[28%]" />
              </colgroup>
              <tbody>
                <tr>
                  <td className={cell} rowSpan={4}>
                    ลูกค้า
                  </td>
                  <td className={cell} rowSpan={4}>
                    <div className="flex flex-col">
                      <span>{receipt.customer_name}</span>
                      {addressLines(receipt.customer_address).map((line, i) => (
                        <span key={i}>{line}</span>
                      ))}
                      {receipt.customer_tax_id && (
                        <span>
                          เลขประจำตัวผู้เสียภาษีอากร {receipt.customer_tax_id}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={cell}>เลขที่</td>
                  <td className={`${cell} text-right`}>{receipt.code}</td>
                </tr>
                <tr>
                  <td className={cell}>วันที่</td>
                  <td className={`${cell} text-right`}>
                    {beDate(receipt.issued_date)}
                  </td>
                </tr>
                <tr>
                  <td className={cell}>ผู้ขาย</td>
                  <td className={`${cell} text-right`}>
                    {settings.seller_name}
                  </td>
                </tr>
                <tr>
                  <td className={cell}>อ้างอิง</td>
                  <td className={`${cell} text-right`}>{receipt.reference}</td>
                </tr>
              </tbody>
            </table>

            {/* ── Items ── */}
            {/* -mt-px laps this table's top border over the info box's bottom one — two
                 border-collapse tables sitting flush would otherwise draw 2px there. */}
            <table className="w-full border-collapse table-fixed -mt-px">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[27%]" />
                <col className="w-[17%]" />
                <col className="w-[20%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead>
                <tr className="text-center">
                  <td className={cell}>ลำดับ</td>
                  <td className={cell}>รายละเอียด</td>
                  <td className={cell}>จำนวน</td>
                  <td className={cell}>ราคาต่อหน่วย</td>
                  <td className={cell}>รวม</td>
                </tr>
              </thead>
              <tbody>
                {rows.map((it, i) => (
                  <tr key={i} className="h-[22px]">
                    <td className={`${cell} text-center`}>{it ? i + 1 : ""}</td>
                    <td className={`${cell} text-center`}>
                      {it?.description ?? ""}
                    </td>
                    <td className={`${cell} text-center`}>
                      {it
                        ? `${qty(it.quantity)}${it.unit ? ` ${it.unit}` : ""}`
                        : ""}
                    </td>
                    <td className={`${cell} text-right`}>
                      {it ? money(it.unit_price) : ""}
                    </td>
                    <td className={`${cell} text-right`}>
                      {it ? money(it.amount) : ""}
                    </td>
                  </tr>
                ))}
                {/* One cell across the first four columns, so the only rule inside
                  this row is the one before รวม. Splitting it further would leave
                  column lines that stop dead at the total row. The label is pinned
                  left and the written-out amount centres across the whole span —
                  the words are the standard guard against the printed figure being
                  altered, so they belong beside it, not on a line of their own. */}
                <tr className="h-[24px]">
                  <td className={`${cell} relative text-center`} colSpan={4}>
                    <span className="absolute left-1.5">รวมเป็นเงิน</span>
                    {total > 0 ? bahtText(total) : ""}
                  </td>
                  <td className={`${cell} text-right`}>{money(total)}</td>
                </tr>
              </tbody>
            </table>

            {/* ── Payment + signatures, held at the foot of the page ── */}
            <div className="mt-auto pt-10">
              <div className="flex flex-col gap-y-[3px]">
                <span>รับชำระโดย</span>
                <div className="flex items-center">
                  <span className="w-[110px]">
                    <Tick on={receipt.pay_cash} /> เงินสด
                  </span>
                  <span>
                    <Tick on={receipt.pay_cheque} /> เช็ค
                  </span>
                </div>
                <div className="flex">
                  <span className="w-[110px]">ธนาคาร</span>
                  <span className="w-[170px]">{settings.bank_name}</span>
                  <span className="w-[60px]">เลขที่</span>
                  <span className="w-[140px]">{settings.bank_account_no}</span>
                  <span className="w-[50px]">วันที่</span>
                  <span>{beDate(receipt.paid_date, false)}</span>
                </div>
                <div className="flex">
                  <span className="w-[110px]">ชื่อบัญชี</span>
                  <span>{settings.account_name}</span>
                </div>
                <div className="flex">
                  <span className="w-[110px]">จำนวน</span>
                  <span className="w-[170px] text-right pr-6">
                    {money(total)}
                  </span>
                  <span>บาท</span>
                </div>
              </div>

              {/* ── Signatures ── */}
              <div className="mt-14 flex justify-between px-6">
                <div className="flex flex-col items-center gap-y-6">
                  <span>ผู้จ่ายเงิน</span>
                  <span>............................</span>
                </div>
                <div className="flex flex-col items-center gap-y-6">
                  <span>ผู้รับเงิน</span>
                  <span>............................</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
