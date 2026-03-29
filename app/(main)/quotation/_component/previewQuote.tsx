import React from "react";
import { QuotationProps } from "./quotation";
import AutoResizeTextarea from "@/components/autoresizetextarea";
import { Checkbox } from "@heroui/checkbox";
import { Printer } from "lucide-react";

interface Props {
    items: QuotationProps[];
    onPrint: () => void;
    previewImages?: string[];
}

export const PreviewQuote = ({items, onPrint, previewImages}: Props) => {

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
      @page {
        size: A5 portrait;
        margin: 0;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Hide everything by default */
      body * {
        visibility: hidden;
      }

      /* Reset the outer wrappers */
      .print-container, .print-container * {
        visibility: visible !important;
        overflow: visible !important;
      }

      /* Reset the scaling wrapper */
      #scaling-wrapper {
        transform: none !important;
        margin: 0 !important;
        width: auto !important;
        height: auto !important;
        position: static !important;
        overflow: visible !important;
      }

      /* Print Section styling */
      #print-section {
        visibility: visible !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 560px !important; /* Force EXACT pixel width to match preview */
        margin: 0 !important;
        padding: 20px !important;
        background-color: white !important;
        min-height: 794px !important; /* Match A5 height */
      }

      /* Specific visibility fixes */
      #print-section * {
        visibility: visible !important;
      }

      /* Hide UI elements */
      button, .no-print {
        display: none !important;
      }

      /* Table tweaks */
      table {
        width: 100%;
        font-size: 11px;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  `;

    return (
        <div className="flex flex-col items-center w-full print-container">
            <style>{printStyles}</style>
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
                {/* Header */}
                {/* {isSelected ? (
                <div>
                    <div className="text-center py-6  border-gray-400">
                    <h1 className="text-2xl font-bold mb-2">{companyInfo.name}</h1>
                    <p className="text-lg font-semibold mb-2">
                        {companyInfo.website}
                    </p>
                    <p className="text-sm mb-2">{companyInfo.address}</p>
                    </div>

                    <div className=" flex  flex-col ml-5 border-b">
                    <p className="text-sm mb-2">{companyInfo.shopName}</p>
                    <p className="text-sm mb-2">
                        {companyInfo.taxId && "เลขประจำตัวผู้เสียภาษี"}
                    </p>
                    <p className="text-sm font-semibold">{companyInfo.taxId}</p>
                    <p></p>
                    </div>
                </div>
                ) : null} */}

                {/* Title and Info */}
                {/* <div className="p-1">
                <h2 className="text-xl font-bold text-center mb-4">
                    {quotationInfo.title} {namePref}
                </h2>
                <div className="flex justify-between items-center mb-1">
                    <div>
                    <p className="font-semibold">ชื่อลูกค้า: {cusName}</p>
                    <p className="">เบอร์โทร: {cusTel}</p>
                    </div>
                    <div className="text-right">
                    <p className="font-semibold">
                        วันที่:{" "}
                        {moment(date.toString()).locale("th").format("D MMMM YYYY")}
                    </p>
                    </div>
                </div>
                </div> */}

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

                    {/* Empty rows for spacing */}
                    {showSeq &&
                        Array.from({ length: Math.max(0, 10 - items.length) }).map(
                        (_, index) => (
                            <tr key={`empty-${index}`}>
                            {showSeq && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]">
                                {items.length + index + 1}
                                </td>
                            )}
                            {showList && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            {showPlus && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            {showPercent && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            {showgram && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            {showQty && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            {showRemark && (
                                <td className="border border-gray-400 px-2 text-center text-[10px]"></td>
                            )}
                            </tr>
                        )
                        )}
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
                        <div className=" flex flex-row justify-end">
                        ลงชื่อ
                        ...........................................................................
                        ผู้ขาย/ผู้รับเงิน
                        </div>
                        <div className=" flex flex-row justify-end">
                        ลงชื่อ
                        ...........................................................................
                        ผู้ซื้อ/ผู้รับสินค้า
                        </div>
                    </div>
                    </div>
                {/* Uploaded images */}
                {previewImages && previewImages.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-300">
                    <p className="text-[10px] font-semibold mb-2">รูปภาพประกอบ</p>
                    <div className="grid grid-cols-2 gap-2">
                      {previewImages.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`รูป ${i + 1}`}
                          className="w-full object-cover rounded border border-gray-300"
                          style={{ maxHeight: "160px" }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                </div>
                </div>
            </div>
                </div>
            </div>
        </div>
    )
}