import { useRef } from "react";
import { Printer } from "lucide-react";

// Store buy-in rules — shown (and signed) before the quotation, as an A5 paper
// document matching the quotation preview.
export const BUY_RULES: { n: string; title: string; text: string }[] = [
  { n: "1", title: "การยืนยันตัวตน", text: "ลูกค้าต้องแสดงบัตรประชาชน หรือบัตรที่ทางราชการออกให้ ทุกครั้งก่อนทำรายการซื้อ-ขาย เพื่อป้องกันการทุจริตและเพื่อความปลอดภัยของทั้งสองฝ่าย" },
  { n: "2", title: "การประเมินราคาโลหะมีค่า", text: "โลหะมีค่าทุกชิ้นที่นำมาขาย ทางร้านจะประเมินราคาก่อนทำการหลอม เพื่อให้ลูกค้าทราบราคาเบื้องต้นก่อนตัดสินใจ แกะ ตัด ทำลายชิ้นงาน ก่อนทำการหลอม" },
  { n: "3", title: "ราคาทองรับซื้อ", text: "ทางร้านยึดราคากลางทองคำตามที่สมาคมค้าทองคำประกาศ โดยจะนำมาคำนวณตามมาตรฐานของร้าน" },
  { n: "4", title: "กรณีชิ้นงานที่มีเพชร พลอย หรือพระเครื่อง", text: "หากลูกค้าประสงค์ให้ทางร้านแกะออก ทางร้านจะปฏิเสธการรับผิดชอบต่อความเสียหายที่อาจเกิดขึ้น" },
  { n: "5", title: "การตรวจสอบก่อนออกจากร้าน", text: "ลูกค้าต้องตรวจสอบเงินสดและทรัพย์สินของตนให้เรียบร้อยทุกครั้งก่อนออกจากร้าน เมื่อออกจากร้านไปแล้ว ทางร้านขอสงวนสิทธิ์ไม่รับผิดชอบต่อความผิดพลาดหรือความเสียหายใด" },
  { n: "7", title: "การยกเลิกการขายหลังการหลอม", text: "เมื่อผู้ขายทราบราคาประเมินแล้ว ยืนยันประสงค์ที่จะขาย เมื่อทางร้านได้ทำการหลอมแล้ว จะไม่สามารถยกเลิกหรือเปลี่ยนใจไม่ขายได้ในทุกกรณี เว้นแต่ราคาประเมินจะต่ำเกินกว่าราคาจริงหลังหลอม 30% ขึ้นไป" },
  { n: "8", title: "คำรับรองจากผู้ขาย", text: "ข้าพเจ้าขอรับรองว่าเป็นสมบัติของข้าพเจ้าโดยแท้จริง และขอรับรองว่าของที่นำมาขายนั้นเป็นของบริสุทธิ์ ถ้าหากเป็นของทุจริตแล้ว ข้าพเจ้าขอรับผิดชอบทั้งสิ้น และได้อ่านทบทวนเรียบร้อยแล้วจึงลงนามไว้เป็นหลักฐาน" },
];

interface Props {
  signatureImage?: string | null; // data-URL or URL
  signerName?: string;
  onPrint?: () => void;
}

const printStyles = `
  @media print {
    @page { size: A5 portrait; margin: 10mm; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* Only the cloned document (appended to <body>) prints; everything else is
       removed from layout so it starts at the page top and paginates. */
    body > *:not(.terms-print-clone) { display: none !important; }
    .terms-print-clone { display: block !important; }
    .terms-print-clone .no-print, .terms-print-clone button { display: none !important; }
    .terms-print-clone .bg-gray-100 { background: #fff !important; border: none !important; padding: 0 !important; }
    #terms-print-section { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background-color: white !important; box-shadow: none !important; font-size: 12px !important; }
  }
`;

export const TermsForm = ({ signatureImage, signerName, onPrint }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Print by cloning to the <body> root → prints in normal flow (paginates),
  // not clipped inside the modal.
  const handlePrint = () => {
    const el = rootRef.current;
    if (!el) { onPrint?.(); return; }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add("terms-print-clone");
    clone.style.display = "none";
    document.body.appendChild(clone);
    window.print();
    document.body.removeChild(clone);
  };

  return (
    <div ref={rootRef} className="flex flex-col items-center w-full terms-print-container">
      <style>{printStyles}</style>

      {onPrint && (
        <button
          type="button"
          onClick={handlePrint}
          className="no-print self-end mb-2 flex items-center gap-x-1.5 text-xs font-bold text-[#c09c42] hover:text-yellow-700"
        >
          <Printer size={14} /> พิมพ์
        </button>
      )}

      <div className="w-full flex justify-center bg-gray-100 p-2 rounded-lg border border-gray-300 print:border-none print:p-0 print:bg-white">
        {/* Responsive A5 paper: fills width up to 560px, no scale hacks. */}
        <div
          id="terms-print-section"
          className="bg-white text-black p-[24px] text-[12px] w-full max-w-[560px] shadow-lg print:shadow-none"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-gray-700 pb-2 mb-3">
            <h1 className="text-base font-bold leading-snug">กฎและรายละเอียดของการรับซื้อทอง เงิน และนาก</h1>
            <p className="text-[11px] text-gray-600">ของทางร้าน</p>
          </div>

          {/* Rules */}
          <ol className="flex flex-col gap-y-2">
            {BUY_RULES.map((r) => (
              <li key={r.n} className="flex gap-x-2 leading-relaxed">
                <span className="font-bold shrink-0">{r.n}.</span>
                <span>
                  <span className="font-bold">{r.title} : </span>
                  {r.text}
                </span>
              </li>
            ))}
          </ol>

          {/* Signature */}
          <div className="flex flex-row justify-end mt-10">
            <div className="flex flex-col items-center gap-y-1">
              {signatureImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureImage} alt="ลายเซ็น" className="h-14 object-contain" />
              ) : (
                <div className="h-14 flex items-end">
                  <span>....................................................</span>
                </div>
              )}
              <span className="border-t border-gray-500 px-4 pt-1 text-[11px]">
                {signerName ? `( ${signerName} )` : "ลงชื่อ"}
              </span>
              <span className="text-[11px]">ผู้ขาย / เจ้าของสินทรัพย์</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
