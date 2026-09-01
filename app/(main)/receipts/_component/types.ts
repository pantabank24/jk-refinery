// บันทึกใบเสร็จแอดมิน — receipts issued outside this system, typed in afterwards.
// Nothing here feeds bills, credit or stock; it is a record + a printable page.

export interface ReceiptItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  // The รวม column as written on the paper — typed, never derived. A real receipt's
  // line total does not always equal quantity × unit price, so only the grand
  // total is added up.
  amount: number;
}

export interface Receipt {
  id: number;
  code: string;
  issued_date: string;
  reference: string;
  customer_name: string;
  customer_address: string;
  customer_tax_id: string;
  pay_cash: boolean;
  pay_cheque: boolean;
  // The date on the รับชำระโดย line. The bank and account number beside it come
  // from the defaults, and the จำนวน is total_amount.
  paid_date: string | null;
  total_amount: number;
  items?: ReceiptItem[];
  creator?: { id: number; name: string } | null;
  created_at: string;
}

// The parts of the printed form that are the same on every receipt, edited from
// the ตั้งค่าเริ่มต้น modal on the list page.
export interface ReceiptSettings {
  logo_url: string;
  company_name: string;
  company_address: string;
  company_tax_id: string;
  company_phone: string;
  doc_title: string;
  seller_name: string;
  account_name: string;
  // The shop's own bank line — the same on every receipt, account number included
  // (the form's "เลขที่" is the ACCOUNT number, not a cheque number).
  bank_name: string;
  bank_account_no: string;
}

export const EMPTY_SETTINGS: ReceiptSettings = {
  logo_url: "",
  company_name: "",
  company_address: "",
  company_tax_id: "",
  company_phone: "",
  doc_title: "ใบกำกับภาษี/ใบเสร็จรับเงิน",
  seller_name: "",
  account_name: "",
  bank_name: "",
  bank_account_no: "",
};

export const IMG_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

// Money as it is printed: thousands separators, always two decimals.
export const money = (n: number) =>
  (n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Quantities print bare — the paper writes "1000 กรัม", with no thousands
// separator and no forced decimals, so neither is added here.
export const qty = (n: number) =>
  (n || 0).toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });

// The paper form is dated in พ.ศ. (03/08/2569), so every printed date converts.
// Takes "YYYY-MM-DD" or a full timestamp; returns "" for a blank/invalid date.
export const beDate = (iso?: string | null, pad = true) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = pad ? String(d.getDate()).padStart(2, "0") : String(d.getDate());
  const month = pad ? String(d.getMonth() + 1).padStart(2, "0") : String(d.getMonth() + 1);
  return `${day}/${month}/${d.getFullYear() + 543}`;
};

// <input type="date"> wants YYYY-MM-DD; the API returns a full timestamp.
export const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

// The one figure this module computes: รวมเป็นเงิน, the sum of the typed lines.
export const sumItems = (items: ReceiptItem[]) =>
  Math.round(items.reduce((s, it) => s + (it.amount || 0), 0) * 100) / 100;
