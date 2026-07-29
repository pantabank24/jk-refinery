// การปัดเศษของใบเสนอราคา — ราคา/กรัม และ จำนวนเงิน ถูกพิมพ์เป็นจำนวนเต็มเสมอ
//
// อยู่เป็นโมดูลกลางเพราะต้องใช้ทั้งตอน "แสดงผล" (previewQuote) และตอน "บันทึก"
// (หน้าออกใบ + หน้าแก้ไขใบ) ถ้าสองฝั่งปัดคนละสูตร ตัวเลขที่พิมพ์กับตัวเลขใน DB
// จะไม่ตรงกัน ซึ่งเป็นปัญหาเวลาเอาไปกระทบยอดเครดิต/ยอดบิลภายหลัง

/**
 * ปันส่วนตัวเลขชุดหนึ่งให้เป็นจำนวนเต็มแบบ largest remainder: ปัดลงทุกตัวก่อน แล้ว
 * โปะทีละ 1 ให้ตัวที่เศษเหลือมากสุดไล่ลงไป จนผลรวมเท่ากับ `target` พอดี
 *
 * ทำแบบนี้เพราะถ้าปัดแต่ละบรรทัดอิสระ ผลรวมของบรรทัดจะเพี้ยนจากยอดรวมได้ 1-2 บาท
 * ซึ่งบนเอกสารการเงินอ่านเหมือนคิดเลขผิด แลกมาด้วยการที่บางบรรทัดต่างจากค่าปัดตรง ๆ
 * อยู่ 1 บาท — เป็นข้อแลกเปลี่ยนที่ยอมรับกันทั่วไปสำหรับเอกสารที่ต้องบวกให้ลงตัว
 */
export function apportionInts(values: number[], target: number): number[] {
  const out = values.map((v) => Math.floor(v || 0));
  if (out.length === 0) return out;
  let diff = Math.round(target) - out.reduce((s, v) => s + v, 0);
  if (diff === 0) return out;
  // เศษมากสุดได้ก่อน; เศษเท่ากันให้บรรทัดบนก่อน เพื่อให้ผลลัพธ์คงที่ทุกครั้งที่คำนวณ
  const byFrac = values
    .map((v, i) => ({ i, frac: (v || 0) - Math.floor(v || 0) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const step = diff > 0 ? 1 : -1;
  for (let k = 0; diff !== 0; k++) {
    out[byFrac[k % byFrac.length].i] += step;
    diff -= step;
  }
  return out;
}

/** ยอดรวมของเอกสารในรูปจำนวนเต็ม — ใช้เป็นเป้าหมายให้ทุกตารางปันส่วนเข้าหาตัวเดียวกัน */
export function roundedGrandTotal(lines: { total: number }[]): number {
  return Math.round(lines.reduce((s, i) => s + (i.total || 0), 0));
}

/**
 * ปัด ราคา/กรัม และ จำนวนเงิน ของทุกบรรทัดเป็นจำนวนเต็ม โดยบังคับให้ผลรวมของ
 * จำนวนเงินเท่ากับ `target` พอดี. น้ำหนัก/ราคา/% ไม่ถูกแตะ — ปัดเฉพาะช่องเงิน
 *
 * เป็น idempotent: ใบที่บันทึกค่าที่ปัดแล้วไว้ เมื่อส่งกลับเข้ามาอีกจะได้ค่าเดิม
 */
export function roundQuoteLines<T extends { perGram: number; total: number }>(
  lines: T[],
  target: number,
): T[] {
  const totals = apportionInts(
    lines.map((i) => i.total || 0),
    target,
  );
  return lines.map((line, i) => ({
    ...line,
    perGram: Math.round(line.perGram || 0),
    total: totals[i],
  }));
}
