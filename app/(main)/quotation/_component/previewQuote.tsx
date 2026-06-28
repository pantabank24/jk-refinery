import React from "react";
import { QuotationProps } from "./quotation";
import AutoResizeTextarea from "@/components/autoresizetextarea";
import { Checkbox } from "@heroui/checkbox";
import { Printer } from "lucide-react";

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

const IMG_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function thaiDate(d?: string | Date): string {
    const dt = d ? new Date(d) : new Date();
    if (isNaN(dt.getTime())) return "";
    return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}

interface Props {
    items: QuotationProps[];
    onPrint?: () => void;
    hidePrint?: boolean;          // ซ่อนปุ่มพิมพ์ (เช่น ฝั่งลูกค้า)
    store?: StoreHeader;          // หัวใบเสร็จ จากข้อมูลร้าน
    title?: string;               // ชื่อเอกสาร (default: ใบรับซื้อทองคำเก่า/ใบสำคัญรับจ่าย)
    customerName?: string;
    customerPhone?: string;
    date?: string | Date;         // วันที่บนเอกสาร (default: วันนี้)
    previewImages?: string[];
    beforeImages?: string[];      // รูปก่อนหลอม
    afterImages?: string[];       // รูปบนตราชั่ง (หลังหลอม)
    signatureImage?: string | null; // ลายเซ็น (data-URL หรือ URL)
    signerName?: string;
}

export const PreviewQuote = ({items, onPrint, hidePrint, store, title, customerName, customerPhone, date, previewImages, beforeImages, afterImages, signatureImage, signerName}: Props) => {

    const [scale, setScale] = React.useState(1);

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
        if (!el) { onPrint?.(); return; }
        const clone = el.cloneNode(true) as HTMLElement;
        clone.classList.add("print-clone");
        clone.style.display = "none"; // hidden on screen; print CSS forces it visible
        document.body.appendChild(clone);
        window.print();
        document.body.removeChild(clone);
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

  const printStyles = `
    @media print {
      @page { size: A5 portrait; margin: 10mm; }
      html, body {
        margin: 0 !important; padding: 0 !important; background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Only the cloned document (appended to <body>) prints; everything else is
         removed from layout so the doc starts at the page top and paginates onto
         additional pages instead of being clipped. */
      body > *:not(.print-clone) { display: none !important; }
      .print-clone { display: block !important; }
      .print-clone .no-print, .print-clone button { display: none !important; }
      /* Neutralise the on-screen scaling/framing inside the clone. */
      .print-clone #scaling-wrapper {
        transform: none !important; width: 100% !important; min-width: 0 !important;
        margin: 0 !important; box-shadow: none !important; overflow: visible !important;
      }
      .print-clone .bg-gray-100 { background: #fff !important; border: none !important; padding: 0 !important; }
      .print-clone #print-section {
        width: 100% !important; max-width: none !important; box-shadow: none !important;
        padding: 0 !important; background: #fff !important;
      }
      table { width: 100%; font-size: 11px; page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      img { page-break-inside: avoid; }
    }
  `;

    return (
        <div ref={rootRef} className="flex flex-col items-center w-full print-container">
            <style>{printStyles}</style>
            {!hidePrint && (
                <button
                    type="button"
                    onClick={handlePrint}
                    className="no-print self-end mb-2 flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700"
                >
                    <Printer size={14} /> พิมพ์
                </button>
            )}
            <div className="w-full overflow-x-hidden flex justify-center bg-gray-100 p-2 rounded-lg border border-gray-300 print:border-none print:p-0 print:bg-white">
                <div
                    id="scaling-wrapper"
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: "top center",
                        width: "560px", // A5 portrait width
                        minWidth: "560px",
                        marginBottom: `-${(1 - scale) * 142}%` // Adjusted margin based on approx A5 ratio (1.414)
                    }}
                    className="relative bg-white shadow-lg print:shadow-none" 
                >
                    <div
                        id="print-section"
                        className="bg-white text-black p-[20px] min-h-auto text-[12px]" // Explicit sizing to match A5 Print (210mm height, 20px padding)
                    >
                {/* Receipt header — from the store's saved info */}
                {store && (store.name || store.address || store.tax_id) && (
                  <div className="border-b-2 border-gray-700 pb-2 mb-3">
                    {/* Top block — centered */}
                    <div className="text-center py-0.5">
                      {store.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${IMG_BASE}${store.logo}`} alt="logo" className="h-10 mx-auto mb-1 object-contain" />
                      )}
                      {store.name && <h1 className="text-base font-bold leading-tight">{store.name}</h1>}
                      {store.website && <p className="text-[11px] font-bold">{store.website}</p>}
                      {store.branch && <p className="text-[10px]">สาขา {store.branch}</p>}
                      {store.address && <p className="text-[10px] leading-snug">{store.address}</p>}
                    </div>

                    {/* Taxpayer block — left aligned */}
                    {(store.tax_name || store.tax_id) && (
                      <div className="flex flex-col text-[10px] mt-2.5 leading-snug">
                        {store.tax_name && <p>{store.tax_name}</p>}
                        {store.tax_id && <p>เลขประจำตัวผู้เสียภาษี</p>}
                        {store.tax_id && <p className="font-bold">{store.tax_id}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Document title + customer/date — always shown */}
                <h2 className="text-base font-bold text-center my-2">
                    {title ?? "ใบรับซื้อทองคำเก่า/ใบสำคัญรับจ่าย"}
                </h2>
                <div className="flex justify-between items-end text-[11px] mb-2">
                    <div className="flex flex-col">
                        <span className="font-bold">ชื่อลูกค้า: {customerName ?? ""}</span>
                        <span>เบอร์โทร: {customerPhone ?? ""}</span>
                    </div>
                    <span className="font-bold">วันที่: {thaiDate(date)}</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full border-collapse border border-gray-400">
                    <thead>
                    <tr className="bg-gray-100">
                        {showSeq && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            ลำดับ
                        </th>
                        )}
                        {showList && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            รายการ
                        </th>
                        )}
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                        ราคา{namePref}
                        </th>
                        {showPlus && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            ราคาบวก
                        </th>
                        )}
                        {showPercent && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            % ซื้อ
                        </th>
                        )}
                        {showgram && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            น้ำหนัก
                        </th>
                        )}
                        {showQty && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                            ต่อกรัม
                        </th>
                        )}
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold">
                        จำนวนเงิน
                        </th>
                        {showRemark && (
                        <th className="border border-gray-400 px-2 py-2 text-center text-[10px] font-semibold w-10">
                            หมายเหตุ
                        </th>
                        )}
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((item, index) => (
                        <tr key={index + 1} className="hover:bg-gray-50">
                        {showSeq && (
                            <td className="border border-gray-400 px-2 text-center text-[10px]">
                            {index + 1}
                            </td>
                        )}
                        {showList && (
                            <td className="border border-gray-400 px-2 text-center text-[10px]">
                            {item.typeName}
                            </td>
                        )}
                        <td className="border border-gray-400 px-2 text-center text-[10px]">
                            {handleRounding(item.price)}
                        </td>
                        {showPlus && (
                            <td className="border border-gray-400 px-2  text-center text-[10px]">
                            {item.plus.toLocaleString()}
                            </td>
                        )}
                        {showPercent && (
                            <td className="border border-gray-400 px-2  text-center text-[10px]">
                            {item.percent < 90
                                ? handleRounding(item.percent)
                                : item.percent}
                            </td>
                        )}
                        {showgram && (
                            <td className="border border-gray-400 px-2  text-center text-[10px]">
                            {item.weight.toLocaleString()}
                            </td>
                        )}
                        {showQty && (
                            <td className="border border-gray-400 px-2  text-center text-[10px]">
                            {handleRounding(item.perGram)}
                            </td>
                        )}
                        <td className="border border-gray-400 px-2 text-center text-[10px]">
                            {item.total.toLocaleString()}
                        </td>
                        {showRemark && (
                            <td className="border border-gray-400 px-2 text-center text-[10px]">
                            <AutoResizeTextarea />
                            </td>
                        )}
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>

                <div className="pt-4">
                <div className="flex justify-end">
                    <div className="w-52">
                    <div className="border border-gray-400 text-[10px]">
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

                <div className=" flex flex-col text-[10px] gap-y-2 mt-12">
                    <div className=" flex flex-row gap-x-4">
                    <div className=" w-12 flex flex-row justify-end">ชำระโดย</div>
                    <div className=" flex flex-col gap-y-2">
                        <Checkbox size="sm">
                        <div className=" text-black text-[10px]">
                            เงินสด
                            ......................................................................
                        </div>
                        </Checkbox>
                        <Checkbox size="sm">
                        <div className=" text-black text-[10px]">
                            เช็ค / บัตร / เงินโอน ธนาคาร
                            ......................................................................
                        </div>
                        </Checkbox>
                    </div>
                    </div>
                    <div className=" flex flex-row gap-x-4">
                    <div className=" flex flex-row gap-x-4">
                        <div className=" w-12 flex flex-row justify-end">เลขที่</div>
                        <div className=" ">
                        .......................................
                        </div>
                    </div>
                    <div className=" flex flex-row">
                        ลงวันที่ .......................................
                    </div>
                    <div className=" flex flex-row">
                        จำนวนเงิน
                        .......................................
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
                              <img src={signatureImage} alt="ลายเซ็น" className="h-12 object-contain" />
                              <span className="border-t border-gray-500 px-2 text-[10px] leading-tight">
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
                {/* Uploaded images, grouped by type */}
                {[
                  { label: "รูปก่อนหลอม", imgs: beforeImages },
                  { label: "รูปบนตราชั่ง (หลังหลอม)", imgs: afterImages },
                  { label: "รูปภาพประกอบ", imgs: previewImages },
                ].map((group) =>
                  group.imgs && group.imgs.length > 0 ? (
                    <div key={group.label} className="mt-6 pt-4 border-t border-gray-300">
                      <p className="text-[10px] font-semibold mb-2">{group.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.imgs.map((src, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={src}
                            alt={`${group.label} ${i + 1}`}
                            className="w-full object-cover rounded border border-gray-300"
                            style={{ maxHeight: "160px" }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
                </div>
                </div>
            </div>
                </div>
            </div>
        </div>
    )
}