export interface QuotationItem {
  id: number;
  type_id: string;
  type_name: string;
  price: number;
  percent: number;
  plus: number;
  weight: number;
  per_gram: number;
  total: number;
}

export interface QuotationData {
  id: number;
  code: string;
  status: number;
  note: string;
  reject_reason: string;
  total_amount: number;
  member?: { id: number; fname: string; lname: string; phone: string; code: string } | null;
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
  creator?: { id: number; name: string } | null;
  items?: QuotationItem[];
  images?: { id: number; image_url: string; type?: string }[];
  signer_name?: string;
  signer_phone?: string;
  created_at: string;
}

export interface MemberOption {
  id: number;
  fname: string;
  lname: string;
  code: string;
}
