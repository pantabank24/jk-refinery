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
function thaiDate(d?: string | Date): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}
function shortThaiDate(d?: string | Date): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear() + 543}`;
}

interface Props {
  items: QuotationProps[];
  onPrint?: () => void;
  hidePrint?: boolean; // ซ่อนปุ่มพิมพ์ (เช่น ฝั่งลูกค้า)
  store?: StoreHeader; // หัวใบเสร็จ จากข้อมูลร้าน
  title?: string; // ชื่อเอกสาร (default: ใบรับซื้อทองคำเก่า/ใบสำคัญรับจ่าย)
  documentNo?: string; // เลขที่เอกสาร (quotation.code) — แสดงในหน้าใบรับซื้อทองเก่าทางการ
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string; // ที่อยู่ลูกค้า (ผู้ขาย)
  customerTaxId?: string; // เลขประจำตัวผู้เสียภาษีของลูกค้า
  date?: string | Date; // วันที่บนเอกสาร (default: วันนี้)
  previewImages?: string[];
  beforeImages?: string[]; // รูปก่อนหลอม
  afterImages?: string[]; // รูปบนตราชั่ง (หลังหลอม)
  signatureImage?: string | null; // ลายเซ็น (data-URL หรือ URL)
  signerName?: string;
}

export const PreviewQuote = ({
  items,
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
}: Props) => {
  const [scale, setScale] = React.useState(1);

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
  const handlePrint = () => {
    const el = rootRef.current;
    if (!el) {
      onPrint?.();
      return;
    }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add("print-clone");
    clone.style.display = "none"; // hidden on screen; print CSS forces it visible
    document.body.appendChild(clone);

    const doPrint = () => {
      window.print();
      document.body.removeChild(clone);
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

  const calculateTotalWeight = () => {
    return items.reduce((sum, item) => sum + (item.weight || 0), 0);
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  // Groups items by gold type for the compact summary table next to the totals box.
  const groupByType = () => {
    const map = new Map<
      string,
      { typeName: string; weight: number; total: number }
    >();
    items.forEach((item) => {
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
      .print-clone .print-page:first-child { page-break-after: always; break-after: page; }
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
              <DropdownItem key="columns" isReadOnly className="cursor-default">
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
            </DropdownMenu>
          </Dropdown>
          <button
            type="button"
            onClick={handlePrint}
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
            {/* ============ Page 1: ใบเสนอราคาแบบละเอียด (เดิม) ============ */}
            <div
              className="print-page bg-white shadow-lg rounded-lg p-[20px] min-h-auto text-[10px]" // Explicit sizing to match A5 Print (210mm height, 20px padding)
            >
              {/* Receipt header — from the store's saved info */}
              {store && (store.name || store.address || store.tax_id) && (
                <div className="border-b-2 border-gray-700 pb-2 mb-3">
                  {/* Top block — centered */}
                  <div className="text-center py-0.5">
                    {store.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${IMG_BASE}${store.logo}`}
                        alt="logo"
                        className="h-10 mx-auto mb-1 object-contain"
                      />
                    )}
                    {store.name && (
                      <h1 className="text-[13px] font-bold leading-tight">
                        {store.name}
                      </h1>
                    )}
                    {store.website && (
                      <p className="text-[9px] font-bold">{store.website}</p>
                    )}
                    {store.branch && (
                      <p className="text-[8px]">สาขา {store.branch}</p>
                    )}
                    {store.address && (
                      <p className="text-[8px] leading-snug">{store.address}</p>
                    )}
                  </div>

                  {/* Taxpayer block — left aligned */}
                  {(store.tax_name || store.tax_id) && (
                    <div className="flex flex-col text-[8px] mt-2.5 leading-snug">
                      {store.tax_name && <p>{store.tax_name}</p>}
                      {store.tax_id && <p>เลขประจำตัวผู้เสียภาษี</p>}
                      {store.tax_id && (
                        <p className="font-bold">{store.tax_id}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Document title + customer/date — always shown */}
              <h2 className="text-[13px] font-bold text-center my-2">
                {title ?? "ใบรับซื้อทองคำเก่า/ใบสำคัญรับจ่าย"}
              </h2>
              <div className="flex justify-between items-end text-[9px] mb-2">
                <div className="flex flex-col">
                  <span className="font-bold">
                    ชื่อลูกค้า: {customerName ?? ""}
                  </span>
                  <span>เบอร์โทร: {customerPhone ?? ""}</span>
                  {customerAddress && <span>ที่อยู่: {customerAddress}</span>}
                  {customerTaxId && <span>เลขประจำตัวผู้เสียภาษี: {customerTaxId}</span>}
                </div>
                <span className="font-bold">วันที่: {thaiDate(date)}</span>
              </div>

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
                    {items.map((item, index) => (
                      <tr key={index + 1} className="hover:bg-gray-50">
                        {showSeq && (
                          <td className="border border-gray-400 px-2 text-center text-[8px]">
                            {index + 1}
                          </td>
                        )}
                        {showList && (
                          <td className="border border-gray-400 px-2 text-center text-[8px]">
                            {item.typeName.replace("ทองหลอม", "ทองรูปพรรณเก่า")}
                          </td>
                        )}
                        <td className="border border-gray-400 px-2 text-center text-[8px]">
                          {handleRounding(item.price)}
                        </td>
                        {showPlus && (
                          <td className="border border-gray-400 px-2  text-center text-[8px]">
                            {item.plus.toLocaleString()}
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
                    {Array.from({ length: Math.max(0, 5 - items.length) }).map(
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

                <div className=" flex flex-col text-[8px] gap-y-2 mt-3">
                  <div className=" flex flex-row gap-x-4">
                    <div className=" w-12 flex flex-row justify-end">
                      ชำระโดย
                    </div>
                    <div className=" flex flex-col gap-y-2">
                      <Checkbox size="sm">
                        <div className=" text-black text-[8px]">
                          เงินสด
                          ......................................................................
                        </div>
                      </Checkbox>
                      <Checkbox size="sm">
                        <div className=" text-black text-[8px]">
                          เช็ค / บัตร / เงินโอน ธนาคาร
                          ......................................................................
                        </div>
                      </Checkbox>
                    </div>
                  </div>
                  <div className=" flex flex-row gap-x-4">
                    <div className=" flex flex-row gap-x-4">
                      <div className=" w-12 flex flex-row justify-end">
                        เลขที่
                      </div>
                      <div className=" ">
                        .......................................
                      </div>
                    </div>
                    <div className=" flex flex-row">
                      ลงวันที่ .......................................
                    </div>
                    <div className=" flex flex-row">
                      จำนวนเงิน .......................................
                    </div>
                  </div>
                  <div className=" flex flex-row indent-16">
                    ข้าพเจ้าขอรับรองว่าเป็นสมบัติของข้าพเจ้าโดยแท้จริง
                    และขอรับรองว่าของที่นำมาขายนั้นเป็นของที่บริสุทธิ์
                    ถ้าหากเป็นของทุจริตแล้ว ข้าพเจ้าขอรับผิดชอบทั้งสิ้น
                    และได้อ่านทบทวนเรียบร้อยแล้วจึงลงนามไว้เป็นหลักฐาน
                  </div>
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
                              className="h-12 object-contain"
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
                        <span>ผู้ขาย/ผู้รับเงิน</span>
                      </div>
                      <div className=" flex flex-row justify-end">
                        ลงชื่อ
                        ...........................................................................
                        ผู้ซื้อ/ผู้รับสินค้า
                      </div>
                    </div>
                  </div>
                  {/* Uploaded images — all types flow together in one row, captioned below each thumbnail */}
                  {(() => {
                    const allImages = [
                      ...(beforeImages ?? []).map((src) => ({
                        src,
                        label: "ก่อนหลอม",
                      })),
                      ...(afterImages ?? []).map((src) => ({
                        src,
                        label: "หลังหลอม",
                      })),
                      ...(previewImages ?? []).map((src) => ({
                        src,
                        label: "รูปประกอบ",
                      })),
                    ];
                    return allImages.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-[8px] font-semibold mb-1">
                          รูปภาพประกอบ
                        </p>
                        <div>
                          {allImages.map((img, i) => (
                            <div
                              key={i}
                              className="inline-flex flex-col items-center align-top"
                              style={{
                                marginRight: "4px",
                                marginBottom: "4px",
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.src}
                                alt={`${img.label} ${i + 1}`}
                                className="w-auto object-contain rounded border border-gray-300"
                                style={{ height: "90px" }}
                              />
                              <span className="text-[6px] text-gray-500 leading-tight">
                                {img.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* ============ Page 2: ใบรับซื้อทองเก่า / ใบสำคัญจ่าย (แบบทางการ) ============ */}
            <div className="print-page bg-white shadow-lg rounded-lg p-[20px] text-[9px]">
              <div className="text-center">
                {store?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMG_BASE}${store.logo}`}
                    alt="logo"
                    className="h-8 mx-auto mb-1 object-contain"
                  />
                )}
                {store?.name && (
                  <h1 className="text-[13px] font-bold leading-tight">
                    {store.name}
                    {store.branch ? ` (${store.branch})` : " (สำนักงานใหญ่)"}
                  </h1>
                )}
                {store?.address && (
                  <p className="text-[9px] leading-snug">{store.address}</p>
                )}
                {store?.phone && (
                  <p className="text-[9px] font-bold bg-yellow-300 inline-block px-3 mt-0.5">
                    โทร {store.phone}
                  </p>
                )}
                {store?.tax_id && (
                  <p className="text-[9px] mt-0.5">
                    เลขประจำตัวผู้เสียภาษีอากร (Tax ID) {store.tax_id}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-start mt-2">
                <span className="w-10 text-[9px]">&nbsp;</span>
                <h2 className="text-[14px] font-bold text-center flex-1">
                  ใบรับซื้อทองเก่า / ใบสำคัญจ่าย
                </h2>
                <span className="w-10 text-[9px] font-bold text-right">
                  ต้นฉบับ
                </span>
              </div>

              <div className="flex justify-between text-[9px] mt-3">
                <div className="flex flex-col gap-y-0.5">
                  <div className="flex gap-x-2">
                    <span>ราคาทองคำแท่งซื้อเข้าบาทละ</span>
                    <span className="font-semibold">
                      {goldPrices ? goldPrices.bar_buy.toLocaleString() : "-"}
                    </span>
                    <span>บาท</span>
                  </div>
                  <div className="flex gap-x-2">
                    <span>ราคาทองคำแท่งขายออกบาทละ</span>
                    <span className="font-semibold">
                      {goldPrices ? goldPrices.bar_sell.toLocaleString() : "-"}
                    </span>
                    <span>บาท</span>
                  </div>
                  <div className="flex gap-x-2">
                    <span>ราคาทองรูปพรรณรับซื้อคืนต่อบาท</span>
                    <span className="font-semibold">
                      {goldPrices
                        ? goldPrices.ornament_buy.toLocaleString()
                        : "-"}
                    </span>
                    <span>บาท</span>
                  </div>
                  <div className="flex gap-x-2">
                    <span>ราคาทองรูปพรรณรับซื้อคืนต่อกรัม</span>
                    <span className="font-semibold">
                      {goldPrices
                        ? goldPrices.ornament_sell.toLocaleString()
                        : "-"}
                    </span>
                    <span>บาท</span>
                  </div>
                </div>
                <div className="flex flex-col gap-y-0.5 text-right">
                  <span>เลขที่ {documentNo ?? ""}</span>
                  <span>วันที่ {shortThaiDate(date)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-y-1.5 text-[9px] mt-3">
                <div>ชื่อลูกค้า : {customerName ?? ""}</div>
                <div className="flex items-center">
                  <span className="shrink-0">ที่อยู่ :</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 ml-1 px-1">
                    {customerAddress || " "}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="shrink-0">เลขประจำตัวผู้เสียภาษี :</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 ml-1 px-1">
                    {customerTaxId || " "}
                  </span>
                </div>
              </div>

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
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        {index + 1}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        {item.typeName.replace("ทองหลอม", "ทองรูปพรรณเก่า")}{" "}
                        รับซื้อ {item.percent}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        {item.weight.toLocaleString()}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        {item.perGram.toLocaleString()}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center text-[9px]">
                        {item.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - items.length) }).map(
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
                    <td className="border border-gray-400 px-2 py-1 text-center text-[9px] font-bold">
                      {calculateTotalWeight().toFixed(2)}
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
                    <Checkbox size="sm">
                      <span className="text-[8px]">เงินสด</span>
                    </Checkbox>
                    <div className="flex items-center gap-x-1">
                      <Checkbox size="sm">
                        <span className="text-[8px]">เงินโอน ธนาคาร</span>
                      </Checkbox>
                      <span className="flex-1 border-b border-dotted border-gray-400">
                        &nbsp;
                      </span>
                    </div>
                    <div className="flex items-center gap-x-1">
                      <Checkbox size="sm">
                        <span className="text-[8px]">
                          บัตรเครดิต/เดบิต/เช็ค ธนาคาร
                        </span>
                      </Checkbox>
                      <span className="border-b border-dotted border-gray-400 w-24 inline-block">
                        &nbsp;
                      </span>
                      <span className="shrink-0">เลขที่</span>
                      <span className="flex-1 border-b border-dotted border-gray-400">
                        &nbsp;
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-x-6 pl-12">
                  <span className="flex items-center gap-x-1">
                    ลงวันที่
                    <span className="border-b border-dotted border-gray-400 w-20 inline-block">
                      &nbsp;
                    </span>
                  </span>
                  <span className="flex items-center gap-x-1">
                    จำนวนเงิน
                    <span className="border-b border-dotted border-gray-400 w-20 inline-block">
                      &nbsp;
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
                      className="h-10 object-contain"
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
};
