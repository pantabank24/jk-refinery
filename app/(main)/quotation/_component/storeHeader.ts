import type { StoreHeader } from "./previewQuote";

// Snapshot columns copied onto a quotation when it's issued (see jk-api
// internal/entity/quotation.go). Preserved on the record so the printed header
// stays accurate even if the store later edits its info.
export interface QuotationStoreSnapshot {
  store_name?: string;
  store_branch?: string;
  store_address?: string;
  store_phone?: string;
  store_tax_id?: string;
  store_tax_name?: string;
  store_website?: string;
  store_logo?: string;
  // Intentionally issued without a header — never fall back to the live store.
  no_header?: boolean;
}

// The receipt-header fields carried by the full store relation preloaded on
// bill/quotation detail responses (jk-api entity/store.go — Store has all of
// these, not just id/name).
export interface StoreHeaderSnapshot {
  address?: string;
  phone?: string;
  tax_id?: string;
  tax_name?: string;
  website?: string;
  logo?: string;
}

// Builds the PreviewQuote `store` header, preferring the issued-quotation
// snapshot and falling back to the live store relation. Returns undefined when
// neither is available so PreviewQuote simply omits the header.
// The live-store fallback exists only for legacy quotations that predate the
// snapshot columns — a no_header document skips it (headerless on purpose).
export function buildStoreHeader(
  snapshot?: QuotationStoreSnapshot | null,
  store?: (StoreHeaderSnapshot & { name?: string }) | null,
  branchName?: string,
): StoreHeader | undefined {
  if (snapshot?.no_header) return undefined;
  if (snapshot?.store_name) {
    return {
      name: snapshot.store_name,
      branch: snapshot.store_branch,
      address: snapshot.store_address,
      phone: snapshot.store_phone,
      tax_id: snapshot.store_tax_id,
      tax_name: snapshot.store_tax_name,
      website: snapshot.store_website,
      logo: snapshot.store_logo,
    };
  }
  if (store?.name) {
    return {
      name: store.name,
      branch: branchName,
      address: store.address,
      phone: store.phone,
      tax_id: store.tax_id,
      tax_name: store.tax_name,
      website: store.website,
      logo: store.logo,
    };
  }
  return undefined;
}
