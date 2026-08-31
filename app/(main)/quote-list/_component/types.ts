import { QuotationProps } from "../../quotation/_component/quotation";

export interface QuotationItem {
  id: number;
  type_id: string;
  type_name: string;
  /** gold|silver|platinum|palladium — missing means gold (legacy items) */
  metal?: string;
  price: number;
  percent: number;
  plus: number;
  plus_type?: number; // 0=บาท, 1=%
  weight: number;
  per_gram: number;
  total: number;
}

export interface QuotationData {
  id: number;
  code: string;
  // Stable number shown to users. For a quotation issued from a bill this is
  // the originating bill code; standalone documents fall back to code.
  display_code?: string;
  status: number;
  note: string;
  reject_reason: string;
  total_amount: number;
  // Set when this quotation was issued for a customer bill. Its saved items are a
  // consolidated single line (price = effective per-gram), so the detailed page-1
  // preview is rebuilt from the bill's delivery logs instead — see quotationDetailPanel.
  bill_id?: number | null;
  // user carries the member's saved profile address/tax id (address lives on the
  // linked login user, not the member row) — used for the quotation preview header.
  member?: { id: number; fname: string; lname: string; phone: string; code: string; user?: { address?: string; tax_id?: string; bank?: { name: string } | null; bank_account_no?: string; bank_account_name?: string } | null } | null;
  store?: { id: number; name: string; address?: string; phone?: string; tax_id?: string; tax_name?: string; website?: string; logo?: string } | null;
  branch?: { id: number; name: string } | null;
  // Store header snapshot — taken at creation time, so reprinting later still
  // shows the header as it was on the day of issue, even if the store's info
  // has since changed. Falls back to the live `store` relation above for
  // quotations created before this snapshot existed (empty store_name).
  store_name?: string;
  store_branch?: string;
  store_address?: string;
  store_phone?: string;
  store_tax_id?: string;
  store_tax_name?: string;
  store_website?: string;
  store_logo?: string;
  // Intentionally issued without a header — do not fall back to `store` above.
  no_header?: boolean;
  creator?: { id: number; name: string } | null;
  items?: QuotationItem[];
  // Detailed per-item lines captured at issue time, stored in the camelCase
  // QuotationProps shape (same as delivery-log items). `items` is stored
  // consolidated (one line per metal); this itemises page 1 on reprint.
  page1_items?: QuotationProps[] | null;
  images?: { id: number; image_url: string; type?: string }[];
  signer_name?: string;
  signer_phone?: string;
  // ชำระโดย ที่ติ๊กไว้ตอนออกใบ: "" | "cash" | "transfer"
  payment_method?: string;
  created_at: string;
}

export const quotationDisplayCode = (quotation: Pick<QuotationData, "code" | "display_code">) =>
  quotation.display_code || quotation.code;

export interface MemberOption {
  id: number;
  fname: string;
  lname: string;
  code: string;
}
