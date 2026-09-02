import React from "react";
import { QuotationProps } from "./quotation";
import AutoResizeTextarea from "@/components/autoresizetextarea";
import { Checkbox } from "@heroui/checkbox";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Select, SelectItem } from "@heroui/select";
import { Printer, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { bahtText } from "@/lib/thai-baht-text";

const ROUNDING_OPTIONS = ["ไม่ปัด", "ปัดลง", "ปัดขึ้น", "ปัดปกติ"];

interface GoldRefPrices {
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
}

// Receipt header — pulled from the store (created at store setup), not entered here.
export interface StoreHeader {
  name?: string;
  branch?: string;
  address?: string;
  phone?: string;
  tax_id?: string;
  tax_name?: string;
  website?: string;
  logo?: string;
}

const IMG_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
function shortThaiDate(d?: string | Date): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear() + 543}`;
}

// หัวเอกสาร (แบบทางการ) — ใช้ร่วมกันทั้งใบที่ 1 และใบที่ 2 เพื่อให้หน้าตาตรงกันเสมอ
function StoreHeaderBlock({ store }: { store?: StoreHeader }) {
  if (!store || !(store.name || store.address || store.tax_id)) return null;
  return (
    <div className="text-center">
      {store.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${IMG_BASE}${store.logo}`}
          alt="logo"
          className="h-8 mx-auto mb-1 object-contain"
        />
      )}
      {store.name && (
        <h1 className="text-[13px] font-bold leading-tight">
          {store.name}
          {/* สาขาขึ้นบรรทัดใหม่ ไม่มีวงเล็บครอบ — ขนาด/น้ำหนักตัวอักษรเท่าชื่อร้าน */}
          <span className="block">{store.branch || "สำนักงานใหญ่"}</span>
        </h1>
      )}
      {store.address && (
        <p className="text-[9px] leading-snug">{store.address}</p>
      )}
      {store.phone && (
        <p className="text-[9px] font-bold bg-yellow-300 inline-block px-3 mt-0.5">
          โทร {store.phone}
        </p>
      )}
      {store.tax_id && (
        <p className="text-[9px] mt-0.5">
          เลขประจำตัวผู้เสียภาษีอากร (Tax ID) {store.tax_id}
        </p>
      )}
    </div>
  );
}

// ราคาอ้างอิงประจำวัน (ทองคำแท่งซื้อเข้า/ขายออก + ทองรูปพรรณรับซื้อคืนต่อบาท/ต่อกรัม
// + ราคาตัดล็อกของเอกสารใบนี้) — ใช้ร่วมกันทั้งใบที่ 1 และใบที่ 2 เพื่อให้ตัวเลขตรงกันเสมอ
function GoldPriceBlock({
  goldPrices,
  lockPrice,
  showGoldRefs,
  lockUnit,
}: {
  goldPrices: GoldRefPrices | null;
  lockPrice: number | null;
  // ใบที่ไม่มีทองอยู่เลย (เช่น ใบขายเงินล้วน) ไม่ต้องพิมพ์ราคาทองอ้างอิงของวันนั้น —
  // มันไม่เกี่ยวกับเงินที่จ่ายในใบ และอ่านแล้วชวนเข้าใจผิดว่าคิดราคาจากทอง
  showGoldRefs: boolean;
  // หน่วยของราคาตัดล็อก — ทองคิดต่อบาททอง เงินคิดต่อกิโลกรัม
  lockUnit: string;
}) {
  const fmt = (v: number) => v.toLocaleString();
  // รับซื้อคืนต่อกรัม = (ราคาทองคำแท่งซื้อเข้า หัก 2%) ÷ 15.244 (กรัม/บาททอง)
  const ornamentPerGram = goldPrices
    ? ((goldPrices.bar_buy - goldPrices.bar_buy * 0.02) / 15.244).toLocaleString(
      undefined,
      { maximumFractionDigits: 2 },
    )
    : "-";
  const rows: [string, string, string][] = [];
  if (showGoldRefs) {
    rows.push(
      ["ราคาทองคำแท่งซื้อเข้าบาทละ", goldPrices ? fmt(goldPrices.bar_buy) : "-", "บาท"],
      ["ราคาทองคำแท่งขายออกบาทละ", goldPrices ? fmt(goldPrices.bar_sell) : "-", "บาท"],
      ["ราคาทองรูปพรรณรับซื้อคืนต่อบาท", goldPrices ? fmt(goldPrices.ornament_buy) : "-", "บาท"],
      ["ราคาทองรูปพรรณรับซื้อคืนต่อกรัม", ornamentPerGram, "บาท"],
    );
  }
  rows.push([
    "ราคาตัดล็อก",
    lockPrice !== null
      ? lockPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "-",
    lockUnit,
  ]);
  return (
    <div className="flex flex-col gap-y-0.5">
      {rows.map(([label, value, unit]) => (
        <div key={label} className="flex gap-x-2">
          <span>{label}</span>
          <span className="font-semibold">{value}</span>
          <span>{unit}</span>
        </div>
      ))}
    </div>
  );
}

// ส่วนหัวเหนือตาราง — ชื่อเอกสาร + เลขที่/วันที่ + ข้อมูลลูกค้า ใช้ร่วมกันทั้งสองใบ
// เพื่อให้ข้อมูลลูกค้าตรงกันเสมอ. สองใบต่างกันที่ `bare`:
//   bare       (ใบที่ 1) = ใบข้อมูลสินค้า/ประเมินราคา — ไม่มีหัวกระดาษร้าน ไม่มีราคาทอง
//                          อ้างอิง ไม่มี "ต้นฉบับ" เหลือแค่ชื่อเอกสาร + เลขที่/วันที่ + ลูกค้า
//   ไม่ bare   (ใบที่ 2) = ใบรับซื้อทองเก่า/ใบสำคัญจ่ายแบบทางการ — มีครบทุกอย่าง
function DocumentTopSection({
  bare,
  store,
  title,
  goldPrices = null,
  lockPrice = null,
  showGoldRefs = true,
  lockUnit = "บาท",
  documentNo,
  date,
  customerName,
  customerPhone,
  customerAddress,
  customerTaxId,
}: {
  bare?: boolean;
  store?: StoreHeader;
  title: string;
  goldPrices?: GoldRefPrices | null;
  lockPrice?: number | null;
  showGoldRefs?: boolean;
  lockUnit?: string;
  documentNo?: string;
  date?: string | Date;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxId?: string;
}) {
  return (
    <>
      {!bare && <StoreHeaderBlock store={store} />}

      {bare ? (
        <h2 className="text-[14px] font-bold text-center">{title}</h2>
      ) : (
        <div className="flex justify-between items-start mt-2">
          <span className="w-10 text-[9px]">&nbsp;</span>
          <h2 className="text-[14px] font-bold text-center flex-1">{title}</h2>
          <span className="w-10 text-[9px] font-bold text-right">ต้นฉบับ</span>
        </div>
      )}

      {/* ไม่มีราคาทองอ้างอิงบนใบ bare — เลขที่/วันที่ จึงชิดขวาอยู่ลำพัง */}
      <div
        className={`flex text-[9px] mt-3 ${bare ? "justify-end" : "justify-between"}`}
      >
        {!bare && (
          <GoldPriceBlock
            goldPrices={goldPrices}
            lockPrice={lockPrice}
            showGoldRefs={showGoldRefs}
            lockUnit={lockUnit}
          />
        )}
        <div className="flex flex-col gap-y-0.5 text-right">
          <span>เลขที่ {documentNo ?? ""}</span>
          <span>วันที่ {shortThaiDate(date)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-y-1.5 text-[9px] mt-3">
        <div>ชื่อลูกค้า : {customerName ?? ""}</div>
        <div className="flex items-center">
          <span className="shrink-0">เบอร์โทร :</span>
          <span className="flex-1 border-b border-dotted border-gray-400 ml-1 px-1">
            {customerPhone || " "}
          </span>
        </div>
        <div className="flex items-center">
          <span className="shrink-0">ที่อยู่ :</span>
          <span className="flex-1 border-b border-dotted border-gray-400 ml-1 px-1">
            {customerAddress || " "}
          </span>
        </div>
        <div className="flex items-center">
          <span className="shrink-0">เลขประจำตัวผู้เสียภาษี :</span>
          <span className="flex-1 border-b border-dotted border-gray-400 ml-1 px-1">
            {customerTaxId || " "}
          </span>
        </div>
      </div>
    </>
  );
}

interface Props {
  items: QuotationProps[];
  // Page 1 (detailed quote) itemises these instead of `items` when provided —
  // e.g. a bill whose issued quotation consolidated the customer's items into one.
  // Page 2 (official receipt) always uses `items`.
  page1Items?: QuotationProps[];
  onPrint?: () => void;
  hidePrint?: boolean; // ซ่อนปุ่มพิมพ์ (เช่น ฝั่งลูกค้า)
  store?: StoreHeader; // หัวใบเสร็จ จากข้อมูลร้าน
  // ชื่อเอกสารของใบที่ 1 (default: ข้อมูลสินค้า / ใบประเมินราคา).
  // ใบที่ 2 เป็นเอกสารทางการ ชื่อจึงตายตัวเป็น "ใบรับซื้อทองเก่า / ใบสำคัญจ่าย" เสมอ
  title?: string;
  documentNo?: string; // เลขที่เอกสาร (quotation.code) — แสดงในหน้าใบรับซื้อทองเก่าทางการ
  customerName?: string;
  customerPhone?: string; // เบอร์โทรลูกค้า — แสดงต่อท้ายชื่อลูกค้าบนหัวเอกสารทั้งสองใบ
  customerAddress?: string; // ที่อยู่ลูกค้า (ผู้ขาย)
  customerTaxId?: string; // เลขประจำตัวผู้เสียภาษีของลูกค้า
  date?: string | Date; // วันที่บนเอกสาร (default: วันนี้)
  // รูปประกอบ — ยังไม่ได้วาดลงเอกสารตอนนี้: ใบที่ 1 ตัดส่วนท้าย (รวมแถบรูป) ออกเหลือ
  // แค่ช่องเซ็นชื่อ ส่วนใบที่ 2 เป็นแบบทางการที่ไม่เคยมีรูปอยู่แล้ว. คงรับไว้เพราะทุกหน้า
  // ที่เรียกยังส่งมา และเป็นจุดเดียวที่จะเสียบรูปกลับเข้าเอกสารได้ถ้าต้องการอีก
  previewImages?: string[];
  beforeImages?: string[]; // รูปก่อนหลอม
  afterImages?: string[]; // รูปบนตราชั่ง (หลังหลอม)
  signatureImage?: string | null; // ลายเซ็น (data-URL หรือ URL)
  signerName?: string;
  // บัญชีธนาคารของลูกค้า — เติมลงช่อง "ชำระโดย เช็ค/บัตร/เงินโอน" เมื่อผู้ใช้ติ๊กเลือก
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  // ชำระโดย ที่บันทึกไว้กับใบเสนอราคา ("" | cash | transfer)
  paymentMethod?: PayMethod;
  // ไม่ส่ง = อ่านอย่างเดียว (ติ๊กไม่ได้) เพราะไม่มีใครรับไปบันทึกต่อ
  onPaymentMethodChange?: (m: PayMethod) => void;
}

export type PayMethod = "cash" | "transfer" | null;

export interface PreviewQuoteHandle {
  /** includePage2 overrides the in-component "พิมพ์ใบที่ 2" tick — for callers that
   *  pass `hidePrint` (so the ตั้งค่า dropdown holding that tick isn't rendered) and
   *  drive printing from their own button. Omit to use whatever the tick says. */
  print: (opts?: { includePage2?: boolean }) => void;
}

export const PreviewQuote = React.forwardRef<PreviewQuoteHandle, Props>(
  (
    {
      items,
      page1Items,
      onPrint,
      hidePrint,
      store,
      title,
      documentNo,
      customerName,
      customerPhone,
      customerAddress,
      customerTaxId,
      date,
      previewImages,
      beforeImages,
      afterImages,
      signatureImage,
      signerName,
      bankName,
      bankAccountNo,
      bankAccountName,
      paymentMethod,
      onPaymentMethodChange,
    },
    ref,
  ) => {
    const [scale, setScale] = React.useState(1);

    // ชำระโดย — เงินสด หรือ เช็ค/บัตร/เงินโอน (เลือกได้อย่างใดอย่างหนึ่ง).
    // เมื่อเลือกเงินโอน ช่องธนาคาร/เลขที่/ลงวันที่/จำนวนเงิน จะเติมจากบัญชีลูกค้าให้อัตโนมัติ
    // ค่าเริ่มต้นมาจากที่บันทึกไว้กับใบ — ใบที่เปิดดูภายหลังจึงยังติ๊กค้างไว้เหมือนตอนออกใบ
    const [payMethod, setPayMethod] = React.useState<PayMethod>(
      paymentMethod ?? null,
    );
    React.useEffect(() => {
      setPayMethod(paymentMethod ?? null);
    }, [paymentMethod]);

    // อ่านอย่างเดียวเมื่อไม่มีใครรับค่าไปบันทึก — กันไม่ให้ติ๊กแล้วหายตอนปิดหน้า
    const payReadOnly = !onPaymentMethodChange;
    const choosePayMethod = (m: PayMethod) => {
      if (payReadOnly) return;
      setPayMethod(m);
      onPaymentMethodChange?.(m);
    };

    const isCash = payMethod === "cash";
    const isTransfer = payMethod === "transfer";
    // ธนาคาร + ชื่อบัญชี รวมเป็นบรรทัดเดียว (ช่องบนใบมีช่องเดียว)
    const bankLine = [bankName, bankAccountName].filter(Boolean).join(" · ");

    // Reference gold prices (ราคาทองคำแท่ง/ทองรูปพรรณ ของวันนี้) for the formal
    // ใบรับซื้อทองเก่า page — same /gold-prices/latest endpoint the item-entry
    // screen already uses, just re-fetched here so this component is self-contained.
    const [goldPrices, setGoldPrices] = React.useState<GoldRefPrices | null>(
      null,
    );
    React.useEffect(() => {
      api
        .get<GoldRefPrices>("/gold-prices/latest")
        .then((res) => setGoldPrices(res.data ?? null))
        .catch(() => setGoldPrices(null));
    }, []);

    const [roundSelected, setRoundSelected] = React.useState("ไม่ปัด");
    const [showSeq, setShowSeq] = React.useState(true);
    const [showList, setShowList] = React.useState(true);
    const [showPlus, setShowPlus] = React.useState(true);
    const [showPercent, setShowPercent] = React.useState(true);
    const [showgram, setShowGram] = React.useState(true);
    const [showQty, setShowQty] = React.useState(true);
    const [showRemark, setShowRemark] = React.useState(false);
    const [namePref, setNamePref] = React.useState(" ");
    // Whether to also print page 2 (the formal ใบรับซื้อทองเก่า / ใบสำคัญจ่าย).
    // Defaults off — most reprints only need page 1. Page 2 still shows on screen.
    const [printPage2, setPrintPage2] = React.useState(false);

    React.useEffect(() => {
      const handleResize = () => {
        const contentWidth = 560; // A5 portrait width in pixels (approx 148mm)
        const screenWidth = window.innerWidth;
        if (screenWidth < contentWidth) {
          setScale((screenWidth - 40) / contentWidth); // -40 for padding
        } else {
          setScale(1);
        }
      };

      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Print by cloning the document to the <body> root so it prints in normal
    // flow (paginating onto page 2+) instead of being clipped inside the modal.
    const rootRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = (opts?: { includePage2?: boolean }) => {
      const el = rootRef.current;
      if (!el) {
        onPrint?.();
        return;
      }
      const clone = el.cloneNode(true) as HTMLElement;
      clone.classList.add("print-clone");
      // Drop page 2 from the printout unless explicitly enabled (page 1 only by
      // default). A caller-supplied flag wins over the ตั้งค่า tick, since callers
      // that hide that dropdown own the choice themselves.
      const wantPage2 = opts?.includePage2 ?? printPage2;
      if (!wantPage2) {
        const pages = clone.querySelectorAll(".print-page");
        if (pages.length > 1) pages[1].remove();
      }
      clone.style.display = "none"; // hidden on screen; print CSS forces it visible
      document.body.appendChild(clone);

      const doPrint = () => {
        // Remove the clone only after printing finishes. On mobile window.print()
        // is non-blocking and returns immediately, so removing synchronously would
        // delete the content before the browser snapshots it → blank page.
        const cleanup = () => {
          if (clone.parentNode) clone.parentNode.removeChild(clone);
          window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup);
        window.print();
        // Fallback: some mobile browsers never fire afterprint.
        setTimeout(cleanup, 3000);
      };

      // cloneNode() creates brand-new <img> elements — even though the
      // originals were already loaded on screen, the clones may not have
      // finished decoding yet. Calling window.print() before they're
      // ready makes the browser lay out the page without knowing the
      // images' real size, which is what was producing the broken
      // print-preview layout whenever photos were attached. Wait for
      // every cloned image to finish loading first.
      const pendingImages = Array.from(clone.querySelectorAll("img")).filter(
        (img) => !img.complete,
      );
      if (pendingImages.length === 0) {
        doPrint();
      } else {
        let remaining = pendingImages.length;
        const onImageSettled = () => {
          remaining -= 1;
          if (remaining === 0) doPrint();
        };
        pendingImages.forEach((img) => {
          img.addEventListener("load", onImageSettled, { once: true });
          img.addEventListener("error", onImageSettled, { once: true });
        });
      }
    };

    // Let a parent trigger printing (e.g. a button outside this component) while
    // still routing through handlePrint's clone-to-body logic.
    React.useImperativeHandle(ref, () => ({ print: handlePrint }));

    const handleRounding = (val: number) => {
      switch (roundSelected) {
        case "ปัดลง":
          return Math.floor(val).toLocaleString();
          break;
        case "ปัดขึ้น":
          return Math.ceil(val).toLocaleString();
          break;
        case "ปัดปกติ":
          return Math.round(val).toLocaleString();
          break;
        case "ไม่ปัด":
          return val.toLocaleString();
        default:
          val.toLocaleString();
          break;
      }
    };

    // Page 1 uses page1Items (the customer's original itemisation) when given.
    const p1 = page1Items ?? items;

    // Missing metal means gold (lines saved before the metal tag existed).
    const isGoldLine = (i: QuotationProps) => (i.metal || "gold") === "gold";
    // ใบนี้มีทองอยู่ไหม — ตัดสินว่าจะพิมพ์ราคาทองอ้างอิง และจะแปลงหน่วยของใบที่ 2 แบบไหน
    const docHasGold = items.some(isGoldLine) || p1.some(isGoldLine);
    // หน่วยของราคาตัดล็อกบนหัวใบที่ 2: ทองคิดต่อบาททอง, เงินคิดต่อกิโลกรัม, โลหะอื่น
    // (แพลตินัม/แพลเลเดียม) คีย์ราคาต่อกรัมมาตั้งแต่ต้น
    const lockUnit = docHasGold
      ? "บาท"
      : (p1.length > 0 ? p1 : items).some((i) => (i.metal || "") === "silver")
        ? "บาท/กก."
        : "บาท/กรัม";

    // Page 2 (official ใบรับซื้อทองเก่า) always shows the CONSOLIDATED view: one line
    // per metal (all gold collapses into a single line). We derive it here so page 2
    // stays merged regardless of whether the caller passed itemised or already-
    // consolidated `items` — page 1 is the itemised sheet, page 2 the summarised one.
    const page2Items: QuotationProps[] = (() => {
      if (items.length === 0) return items;
      const byMetal = new Map<string, QuotationProps[]>();
      for (const it of items) {
        const m = it.metal || "gold";
        const g = byMetal.get(m);
        if (g) g.push(it);
        else byMetal.set(m, [it]);
      }
      // Gold first, then any other metals in first-seen order.
      const order = [
        "gold",
        ...Array.from(byMetal.keys()).filter((m) => m !== "gold"),
      ];
      const lines: QuotationProps[] = [];
      for (const m of order) {
        const g = byMetal.get(m);
        if (!g) continue;
        const w = g.reduce((s, i) => s + (i.weight || 0), 0);
        const t = g.reduce((s, i) => s + (i.total || 0), 0);
        const first = g[0];
        lines.push({
          ...first,
          price: w > 0 ? Math.round((t / w) * 100) / 100 : first.price,
          weight: w,
          perGram: w > 0 ? t / w : first.perGram,
          total: t,
        });
      }
      return lines;
    })();

    // ราคาตัดล็อก — ราคาที่เอกสารใบนี้ล็อกไว้ คือค่าเดียวกับคอลัมน์ "ราคา" ในตาราง
    // (โหมดบิลคือ forcedPrice ที่ถูกล็อกจากรอบนั้น). ปกติทุกรายการใช้ราคาเดียวกันจึง
    // แสดงตัวเลขนั้นตรง ๆ; ถ้าเป็นใบที่คีย์หลายราคา (เช่น walk-in หลายชนิด) จะถัวเฉลี่ย
    // ถ่วงน้ำหนักให้เป็นตัวแทนใบเดียว. เงิน/โลหะอื่นชั่งคนละหน่วยกับทอง จึงคิดเฉพาะส่วน
    // ทอง เว้นแต่ใบนั้นไม่มีทองเลย (ใบขายเงินล้วน) ค่อยใช้ทั้งใบแทน — หน่วยที่พิมพ์กำกับ
    // ไว้แล้วด้วย lockUnit ข้างบน
    const lockPrice: number | null = (() => {
      // ต้องอ่านจาก p1 (บรรทัดที่ยังไม่ยุบรวม = คอลัมน์ "ราคา" บนใบที่ 1) เท่านั้น
      // เพราะ consolidateByMetal เขียนทับ price ด้วยอัตราต่อกรัม (Σtotal/Σweight)
      // ใบที่ยุบรวมแล้วจึงไม่เหลือราคาทองอยู่ — อ่านจาก items จะได้ต่อกรัมมาแทน
      const src = p1.length > 0 ? p1 : items;
      const gold = src.filter(isGoldLine);
      const pool = (gold.length > 0 ? gold : src).filter((i) => i.price > 0);
      if (pool.length === 0) return null;
      const distinct = Array.from(new Set(pool.map((i) => i.price)));
      if (distinct.length === 1) return distinct[0];
      const w = pool.reduce((s, i) => s + (i.weight || 0), 0);
      if (w <= 0) {
        return pool.reduce((s, i) => s + i.price, 0) / pool.length;
      }
      return pool.reduce((s, i) => s + i.price * (i.weight || 0), 0) / w;
    })();

    const calculateTotalWeight = (arr: QuotationProps[] = items) => {
      return arr.reduce((sum, item) => sum + (item.weight || 0), 0);
    };

    // ===== ใบที่ 2 คิดเป็นกรัม =====
    // ทองซื้อขายกันเป็นบาททอง แต่ใบรับซื้อทองเก่าเป็นเอกสารทางการที่ต้องระบุเป็นกรัม
    // จึงแปลงหน่วยตอนแสดงผล (ไม่ได้แก้ค่าที่เก็บไว้ — น้ำหนักจริงในระบบยังเป็นบาททอง):
    //   ราคา/กรัม   = (ราคาตัดล็อก หัก 2%) ÷ 15.244 กรัมต่อบาททอง
    //   จำนวน (กรัม) = จำนวนเงิน ÷ ราคา/กรัม
    // ผลคือ จำนวน × ราคา/กรัม = จำนวนเงิน เสมอ ใบจึงอ่านแล้วคิดเลขตามได้ลงตัว
    //
    // ใช้ได้กับ "ทอง" เท่านั้น — โลหะอื่นชั่งเป็นกรัมมาตั้งแต่ต้น (เงินคีย์ราคาเป็น บาท/กก.
    // แล้วหาร 1,000 ในสูตรของประเภทสินค้า) เอาสูตรนี้ไปทับจะเพี้ยนทั้งใบ จึงกันไว้ด้วย
    // docHasGold และแยกทางคิดของแต่ละบรรทัดข้างล่าง
    const page2PerGram: number | null =
      docHasGold && lockPrice !== null && lockPrice > 0
        ? Math.round((lockPrice - lockPrice * 0.02) / 15.244)
        : null;
    // จำนวนกรัมที่พิมพ์ต่อบรรทัด — ทองแปลงจากยอดเงินด้วยราคา/กรัมข้างบน (บรรทัดจึงคูณกัน
    // ได้จำนวนเงินพอดี) ส่วนโลหะอื่นใช้น้ำหนักกรัมจริงที่ชั่งมา
    // null = ใบเก่าที่ไม่มีราคาตัดล็อกให้แปลง ตกกลับไปพิมพ์ค่าที่เก็บมาดิบ ๆ
    const lineGrams = (it: QuotationProps): number | null =>
      isGoldLine(it)
        ? page2PerGram && page2PerGram > 0
          ? (it.total || 0) / page2PerGram
          : null
        : it.weight || 0;
    // ราคา/กรัม ที่พิมพ์ — โลหะอื่นคิดย้อนจากยอดเงิน (ยอด ÷ น้ำหนักกรัม) ไม่ใช้ perGram ที่
    // เก็บไว้ ซึ่งถูกปัดเป็นจำนวนเต็มตอนออกใบ: บนใบทางการทุกบรรทัดต้องคูณกันแล้วลงตัว
    const linePerGram = (it: QuotationProps): number =>
      isGoldLine(it)
        ? (page2PerGram ?? it.perGram)
        : (it.weight || 0) > 0
          ? (it.total || 0) / it.weight
          : it.perGram;
    const fmtGrams = (g: number) =>
      g.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const fmtPerGram = (it: QuotationProps) =>
      isGoldLine(it)
        ? linePerGram(it).toLocaleString()
        : linePerGram(it).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          });
    // รวมกรัมของทั้งใบ = ผลบวกของคอลัมน์ที่พิมพ์จริง (ทองที่แปลงแล้ว + กรัมของโลหะอื่น)
    // ถ้ามีบรรทัดที่แปลงไม่ได้ ให้ทั้งช่องตกกลับไปใช้น้ำหนักรวมที่เก็บไว้แทน
    const page2TotalGrams: number | null = page2Items.reduce<number | null>(
      (sum, it) => {
        const g = lineGrams(it);
        return sum === null || g === null ? null : sum + g;
      },
      0,
    );

    const calculateGrandTotal = (arr: QuotationProps[] = items) => {
      return arr.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    // Groups items by gold type for the compact summary table next to the totals box.
    const groupByType = (arr: QuotationProps[] = items) => {
      const map = new Map<
        string,
        { typeName: string; weight: number; total: number }
      >();
      arr.forEach((item) => {
        const existing = map.get(item.typeName);
        if (existing) {
          existing.weight += item.weight || 0;
          existing.total += item.total || 0;
        } else {
          map.set(item.typeName, {
            typeName: item.typeName,
            weight: item.weight || 0,
            total: item.total || 0,
          });
        }
      });
      return Array.from(map.values());
    };

    const printStyles = `
    @media print {
      @page { size: A5 portrait; margin: 5mm; }
      html, body {
        margin: 0 !important; padding: 0 !important; background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Only the cloned document (appended to <body>) prints; everything else is
         removed from layout so the doc starts at the page top and paginates onto
         additional pages instead of being clipped. */
      body > *:not(.print-clone):not(.terms-print-clone) { display: none !important; }
      .print-clone { display: block !important; }
      .print-clone .no-print, .print-clone button { display: none !important; }
      /* Neutralise the on-screen scaling/framing inside the clone. */
      .print-clone #scaling-wrapper {
        transform: none !important; width: 100% !important; min-width: 0 !important;
        margin: 0 !important; overflow: visible !important;
      }
      .print-clone .bg-gray-100 { background: #fff !important; padding: 0 !important; }
      /* Each page is its own physical sheet — strip the on-screen card framing
         (shadow/rounded corners/padding) and force the first one to break onto
         its own page so the second starts fresh. */
      .print-clone .print-page {
        width: 100% !important; max-width: none !important; box-shadow: none !important;
        border-radius: 0 !important; padding: 0 !important; background: #fff !important;
      }
      .print-clone .print-page:not(:last-child) { page-break-after: always; break-after: page; }
      table { font-size: 9px; page-break-inside: auto; }
      .items-table { width: 100%; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      img { page-break-inside: avoid; }
    }
  `;

    return (
      <div
        ref={rootRef}
        className="flex flex-col items-center w-full print-container"
      >
        <style>{printStyles}</style>
        {!hidePrint && (
          <div className="no-print self-end mb-2 flex items-center gap-x-3">
            <Dropdown
              closeOnSelect={false}
              classNames={{
                content:
                  "p-0 min-w-[270px] border-1 border-black/10 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl",
              }}
            >
              <DropdownTrigger>
                <button
                  type="button"
                  className="flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-full px-3 py-1.5 transition-colors"
                >
                  <SlidersHorizontal size={14} /> ตั้งค่า
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="ตั้งค่าใบเสนอราคา"
                shouldFocusWrap={false}
                className="p-3 gap-3"
                itemClasses={{
                  base: "p-0 rounded-none data-[hover=true]:bg-transparent",
                }}
              >
                <DropdownItem
                  key="rounding"
                  isReadOnly
                  className="cursor-default"
                >
                  <Select
                    label="การปัดราคา"
                    size="sm"
                    selectedKeys={new Set([roundSelected])}
                    onSelectionChange={(keys) =>
                      setRoundSelected((keys.currentKey as string) ?? "ไม่ปัด")
                    }
                    classNames={{
                      trigger:
                        "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                    }}
                  >
                    {ROUNDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt}>{opt}</SelectItem>
                    ))}
                  </Select>
                </DropdownItem>
                <DropdownItem
                  key="columns"
                  isReadOnly
                  className="cursor-default"
                >
                  <div className="flex flex-col gap-y-1.5">
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-wide pl-1">
                      แสดงคอลัมน์
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-1 border-black/10 bg-black/5 rounded-2xl p-2.5">
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showSeq}
                        onValueChange={setShowSeq}
                      >
                        ลำดับ
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showList}
                        onValueChange={setShowList}
                      >
                        รายการ
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showPlus}
                        onValueChange={setShowPlus}
                      >
                        ราคาบวก
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showPercent}
                        onValueChange={setShowPercent}
                      >
                        % ซื้อ
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showgram}
                        onValueChange={setShowGram}
                      >
                        น้ำหนัก
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showQty}
                        onValueChange={setShowQty}
                      >
                        ต่อกรัม
                      </Checkbox>
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={showRemark}
                        onValueChange={setShowRemark}
                      >
                        หมายเหตุ
                      </Checkbox>
                    </div>
                  </div>
                </DropdownItem>
                <DropdownItem key="pages" isReadOnly className="cursor-default">
                  <div className="flex flex-col gap-y-1.5">
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-wide pl-1">
                      การพิมพ์
                    </span>
                    <div className="border-1 border-black/10 bg-black/5 rounded-2xl p-2.5">
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={printPage2}
                        onValueChange={setPrintPage2}
                      >
                        พิมพ์ใบรับซื้อทองเก่า (ใบที่ 2)
                      </Checkbox>
                    </div>
                  </div>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <button
              type="button"
              onClick={() => handlePrint()}
              className="flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700"
            >
              <Printer size={14} /> พิมพ์
            </button>
          </div>
        )}
        <div className="w-full overflow-x-hidden flex justify-center bg-gray-100 p-2 rounded-lg border border-gray-300 print:border-none print:p-0 print:bg-white">
          <div
            id="scaling-wrapper"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              width: "560px", // A5 portrait width
              minWidth: "560px",
              marginBottom: `-${(1 - scale) * 142}%`, // Adjusted margin based on approx A5 ratio (1.414)
            }}
            className="relative"
          >
            {/* Two physically separate sheets — stacked with a visible gap on
                        screen so it's obvious they're different pages of paper, not one
                        long document. The gap collapses to 0 when printing, since the
                        forced page-break (see printStyles) handles pagination instead. */}
            <div className="flex flex-col gap-y-6 print:gap-y-0">
              {/* ============ Page 1: ข้อมูลสินค้า / ใบประเมินราคา ============ */}
              <div
                className="print-page bg-white shadow-lg rounded-lg p-[20px] min-h-auto text-[10px]" // Explicit sizing to match A5 Print (210mm height, 20px padding)
              >
                {/* ส่วนหัวเหนือตาราง — แบบ bare: ไม่มีหัวกระดาษร้าน/ราคาทองอ้างอิง
                    เหลือแค่ชื่อเอกสาร เลขที่/วันที่ และข้อมูลลูกค้า */}
                <DocumentTopSection
                  bare
                  title={title ?? "ข้อมูลสินค้า / ใบประเมินราคา"}
                  documentNo={documentNo}
                  date={date}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  customerAddress={customerAddress}
                  customerTaxId={customerTaxId}
                />

                {/* Table */}
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="items-table w-full border-collapse border border-gray-400">
                    <thead>
                      <tr className="bg-gray-100">
                        {showSeq && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            ลำดับ
                          </th>
                        )}
                        {showList && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            รายการ
                          </th>
                        )}
                        <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                          ราคา{namePref}
                        </th>
                        {showPlus && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            ราคาบวก
                          </th>
                        )}
                        {showPercent && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            % ซื้อ
                          </th>
                        )}
                        {showgram && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            น้ำหนัก
                          </th>
                        )}
                        {showQty && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                            ต่อกรัม
                          </th>
                        )}
                        <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold">
                          จำนวนเงิน
                        </th>
                        {showRemark && (
                          <th className="border border-gray-400 px-2 py-2 text-center text-[8px] font-semibold w-10">
                            หมายเหตุ
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {p1.map((item, index) => (
                        <tr key={index + 1} className="hover:bg-gray-50">
                          {showSeq && (
                            <td className="border border-gray-400 px-2 text-center text-[8px]">
                              {index + 1}
                            </td>
                          )}
                          {showList && (
                            <td className="border border-gray-400 px-2 text-center text-[8px]">
                              {item.typeName.replace(
                                "ทองหลอม",
                                "ทองรูปพรรณเก่า",
                              )}
                            </td>
                          )}
                          <td className="border border-gray-400 px-2 text-center text-[8px]">
                            {handleRounding(item.price)}
                          </td>
                          {showPlus && (
                            <td className="border border-gray-400 px-2  text-center text-[8px]">
                              {handleRounding(
                                item.plus_type === 1
                                  ? item.price * (item.plus / 100)
                                  : item.plus,
                              )}
                            </td>
                          )}
                          {showPercent && (
                            <td className="border border-gray-400 px-2  text-center text-[8px]">
                              {item.percent < 90
                                ? handleRounding(item.percent)
                                : item.percent}
                            </td>
                          )}
                          {showgram && (
                            <td className="border border-gray-400 px-2  text-center text-[8px]">
                              {item.weight.toLocaleString()}
                            </td>
                          )}
                          {showQty && (
                            <td className="border border-gray-400 px-2  text-center text-[8px]">
                              {handleRounding(item.perGram)}
                            </td>
                          )}
                          <td className="border border-gray-400 px-2 text-center text-[8px]">
                            {item.total.toLocaleString()}
                          </td>
                          {showRemark && (
                            <td className="border border-gray-400 px-2 text-center text-[8px]">
                              <AutoResizeTextarea />
                            </td>
                          )}
                        </tr>
                      ))}
                      {/* Pad with blank rows so the table always shows at least 5 lines */}
                      {Array.from({ length: Math.max(0, 5 - p1.length) }).map(
                        (_, i) => (
                          <tr key={`empty-${i}`}>
                            {showSeq && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            {showList && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            <td className="border border-gray-400 px-2 text-center text-[8px]">
                              &nbsp;
                            </td>
                            {showPlus && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            {showPercent && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            {showgram && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            {showQty && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                            <td className="border border-gray-400 px-2 text-center text-[8px]">
                              &nbsp;
                            </td>
                            {showRemark && (
                              <td className="border border-gray-400 px-2 text-center text-[8px]">
                                &nbsp;
                              </td>
                            )}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4">
                  <div className="flex justify-between items-start gap-4">
                    {/* Compact summary by gold type, alongside the totals box */}
                    <table className="border-collapse border border-gray-400 text-[8px] h-fit max-w-[280px]">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-400 px-2 py-1 text-center font-semibold">
                            รายการ
                          </th>
                          <th className="border border-gray-400 px-2 py-1 text-center font-semibold">
                            น้ำหนัก
                          </th>
                          <th className="border border-gray-400 px-2 py-1 text-center font-semibold">
                            ราคา
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupByType().map((g) => (
                          <tr key={g.typeName}>
                            <td className="border border-gray-400 px-2 py-1 text-center">
                              {g.typeName}
                            </td>
                            <td className="border border-gray-400 px-2 py-1 text-center">
                              {g.weight.toLocaleString()}
                            </td>
                            <td className="border border-gray-400 px-2 py-1 text-center">
                              {g.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="w-52">
                      <div className="border border-gray-400 text-[8px]">
                        <div className="flex justify-between p-1 border-b border-gray-400">
                          <span className="font-semibold">น้ำหนักรวม</span>
                          <span className="font-semibold">
                            {calculateTotalWeight().toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between p-1 border-b border-gray-400">
                          <span className="font-semibold">รวมเป็นเงิน</span>
                          <span className="font-semibold">
                            {calculateGrandTotal().toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between p-1">
                          <span className="font-semibold">อื่น ๆ</span>
                          <span className="font-semibold"></span>
                        </div>
                        <div className="flex justify-between p-1 border-t border-gray-400">
                          <span className="font-bold">จำนวนรวมทั้งสิ้น</span>
                          <span className="font-bold">
                            {calculateGrandTotal().toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ใบที่ 1 เป็นใบข้อมูลสินค้า/ประเมินราคา — ไม่มีช่องชำระเงิน
                      ข้อความรับรอง หรือรูปประกอบ เหลือไว้แค่ช่องเซ็นชื่อ
                      (ทั้งหมดนั้นยังอยู่ครบบนใบที่ 2 ซึ่งเป็นเอกสารทางการ) */}
                  <div className=" flex flex-col text-[8px] gap-y-2 mt-3">
                    <div className=" flex flex-row justify-end mt-8">
                      <div className=" flex flex-col w-80 gap-y-12">
                        {/* Seller / signature line — embeds the actual signature when present */}
                        <div className="flex flex-row justify-end items-end gap-x-1">
                          <span>ลงชื่อ</span>
                          {signatureImage ? (
                            <div className="flex flex-col items-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={signatureImage}
                                alt="ลายเซ็น"
                                // Cap the WIDTH, not just the height: the pad
                                // exports the ink cropped, so a signature
                                // written across a fullscreen canvas is very
                                // wide and would push "เจ้าของสินค้า" off the
                                // 320px column. max-h/max-w together keep the
                                // aspect ratio and let the box shrink so the
                                // signature still sits on its line.
                                className="max-h-12 max-w-[120px] object-contain"
                              />
                              <span className="border-t border-gray-500 px-2 text-[8px] leading-tight">
                                {signerName ? `( ${signerName} )` : ""}
                              </span>
                            </div>
                          ) : (
                            <span>
                              ...........................................................................
                            </span>
                          )}
                          <span>เจ้าของสินค้า</span>
                        </div>
                        <div className=" flex flex-row justify-end">
                          ลงชื่อ
                          ..................................................................
                          ผู้ประเมินราคาสินค้า
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============ Page 2: ใบรับซื้อทองเก่า / ใบสำคัญจ่าย (แบบทางการ) ============ */}
              <div className="print-page bg-white shadow-lg rounded-lg p-[20px] text-[9px]">
                <DocumentTopSection
                  store={store}
                  title="ใบรับซื้อทองเก่า / ใบสำคัญจ่าย"
                  goldPrices={goldPrices}
                  lockPrice={lockPrice}
                  showGoldRefs={docHasGold}
                  lockUnit={lockUnit}
                  documentNo={documentNo}
                  date={date}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  customerAddress={customerAddress}
                  customerTaxId={customerTaxId}
                />

                <table className="w-full border-collapse border border-gray-400 mt-3">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-1.5 text-center text-[9px] font-semibold">
                        ลำดับ
                      </th>
                      <th className="border border-gray-400 px-2 py-1.5 text-center text-[9px] font-semibold">
                        รายการสินค้า
                      </th>
                      <th className="border border-gray-400 px-2 py-1.5 text-center text-[9px] font-semibold">
                        จำนวน (กรัม)
                      </th>
                      <th className="border border-gray-400 px-2 py-1.5 text-center text-[9px] font-semibold">
                        ราคา/กรัม
                      </th>
                      <th className="border border-gray-400 px-2 py-1.5 text-center text-[9px] font-semibold">
                        จำนวนเงิน (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page2Items.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                          {index + 1}
                        </td>
                        <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                          {item.typeName.replace("ทองหลอม", "ทองรูปพรรณเก่า")}
                        </td>
                        <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                          {(() => {
                            const g = lineGrams(item);
                            return g !== null
                              ? fmtGrams(g)
                              : item.weight.toLocaleString();
                          })()}
                        </td>
                        <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                          {fmtPerGram(item)}
                        </td>
                        <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                          {item.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - page2Items.length) }).map(
                      (_, i) => (
                        <tr key={`formal-empty-${i}`}>
                          <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                            &nbsp;
                          </td>
                          <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                            &nbsp;
                          </td>
                          <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                            &nbsp;
                          </td>
                          <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                            &nbsp;
                          </td>
                          <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                            &nbsp;
                          </td>
                        </tr>
                      ),
                    )}
                    <tr className="bg-gray-50">
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px] font-bold"></td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px] font-bold">
                        รวม -- {bahtText(calculateGrandTotal())} --
                      </td>
                      {/* รวมกรัม — บวกจากคอลัมน์ที่แสดงจริง ไม่ใช่น้ำหนักที่เก็บไว้
                          (ทองเก็บเป็นบาททอง) ไม่งั้นคอลัมน์จะบวกไม่ตรง */}
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px] font-bold">
                        {page2TotalGrams !== null
                          ? fmtGrams(page2TotalGrams)
                          : calculateTotalWeight().toFixed(2)}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        &nbsp;
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px] font-bold">
                        {calculateGrandTotal().toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[9px] mt-3 flex flex-col gap-y-1.5">
                  <div className="flex gap-x-2">
                    <span className="font-bold shrink-0">ชำระโดย :</span>
                    <div className="flex flex-col gap-y-1">
                      <div className="flex items-center gap-x-1">
                        <Checkbox
                          size="sm"
                          isSelected={isCash}
                          isReadOnly={payReadOnly}
                          onValueChange={(v) => choosePayMethod(v ? "cash" : null)}
                        >
                          <span className="text-[8px]">เงินสด</span>
                        </Checkbox>
                        <span className="flex-1 border-b border-dotted border-gray-400 px-1 font-bold">
                          {isCash ? calculateGrandTotal().toLocaleString() : " "}
                        </span>
                      </div>
                      {/* เงินโอน / บัตร / เช็ค รวมเป็นตัวเลือกเดียว ใช้ช่องธนาคาร
                          และเลขที่บัญชีชุดเดียวกัน — เหมือนใบที่ 1 */}
                      <div className="flex items-center gap-x-1">
                        <Checkbox
                          size="sm"
                          isSelected={isTransfer}
                          isReadOnly={payReadOnly}
                          onValueChange={(v) =>
                            choosePayMethod(v ? "transfer" : null)
                          }
                        >
                          <span className="text-[8px] whitespace-nowrap">
                            เงินโอน / บัตรเครดิต / เดบิต / เช็ค ธนาคาร
                          </span>
                        </Checkbox>
                        <span className="flex-1 border-b border-dotted border-gray-400 px-1 font-bold">
                          {isTransfer && bankLine ? bankLine : " "}
                        </span>
                        <span className="shrink-0">เลขที่</span>
                        <span className="flex-1 border-b border-dotted border-gray-400 px-1 font-bold">
                          {isTransfer && bankAccountNo ? bankAccountNo : " "}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-x-6 pl-12">
                    <span className="flex items-center gap-x-1">
                      ลงวันที่
                      <span className="border-b border-dotted border-gray-400 min-w-20 inline-block px-1 font-bold">
                        {isTransfer ? shortThaiDate(date) : " "}
                      </span>
                    </span>
                    <span className="flex items-center gap-x-1">
                      จำนวนเงิน
                      <span className="border-b border-dotted border-gray-400 min-w-20 inline-block px-1 font-bold">
                        {isTransfer
                          ? calculateGrandTotal().toLocaleString()
                          : " "}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="text-[9px] mt-3 leading-relaxed">
                  ข้าพเจ้าได้รับเงินไปถูกต้องครบถ้วนแล้ว
                  และขอรับรองว่าของที่นำมาขายนี้เป็นของข้าพเจ้าโดยแท้จริง
                  มิใช่เป็นของที่ได้มาโดยการกระทำผิดกฎหมายแต่อย่างใด
                  จึงขอลงลายมือชื่อไว้เป็นหลักฐาน
                </div>

                <div className="flex justify-between text-[9px] mt-10 px-4">
                  <div className="flex flex-col items-center gap-y-1">
                    {signatureImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signatureImage}
                        alt="ลายเซ็น"
                        className="max-h-10 max-w-[120px] object-contain"
                      />
                    ) : (
                      <span>...........................................</span>
                    )}
                    <span>ผู้ขาย/ผู้รับเงิน</span>
                    <span>วันที่................................</span>
                  </div>
                  <div className="flex flex-col items-center gap-y-1">
                    <span>...........................................</span>
                    <span>ผู้ซื้อ/ผู้รับสินค้า</span>
                    <span>วันที่................................</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
PreviewQuote.displayName = "PreviewQuote";
