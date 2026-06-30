const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// Converts a digit string (no leading sign) of up to 6 digits into Thai text,
// e.g. "30878" -> "สามหมื่นแปดร้อยเจ็ดสิบแปด".
function groupToThaiText(digits: string): string {
  let result = "";
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(digits[i]);
    if (digit === 0) continue;
    const place = len - i - 1;
    if (place === 0) {
      result += digit === 1 && len > 1 ? "เอ็ด" : THAI_DIGITS[digit];
    } else if (place === 1) {
      result += digit === 1 ? "สิบ" : digit === 2 ? "ยี่สิบ" : THAI_DIGITS[digit] + "สิบ";
    } else {
      result += THAI_DIGITS[digit] + THAI_PLACES[place];
    }
  }
  return result;
}

function integerToThaiText(value: number): string {
  if (value === 0) return "ศูนย์";
  const groups: string[] = [];
  let numStr = String(Math.floor(value));
  while (numStr.length > 0) {
    groups.unshift(numStr.slice(-6));
    numStr = numStr.slice(0, -6);
  }
  let result = "";
  groups.forEach((group, i) => {
    const trimmed = group.replace(/^0+/, "");
    if (!trimmed) return;
    result += groupToThaiText(trimmed);
    if (i < groups.length - 1) result += "ล้าน";
  });
  return result;
}

// Converts a baht amount (e.g. 30878.8) into Thai text, e.g.
// "สามหมื่นแปดร้อยเจ็ดสิบแปดบาทแปดสิบสตางค์" (or "...บาทถ้วน" when there's no satang).
export function bahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const prefix = amount < 0 ? "ลบ" : "";
  const bahtPart = `${prefix}${integerToThaiText(baht)}บาท`;
  return satang === 0 ? `${bahtPart}ถ้วน` : `${bahtPart}${integerToThaiText(satang)}สตางค์`;
}
