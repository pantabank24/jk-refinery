"use client";

import { BillsList } from "./_component/billsList";

// รายการขายทอง. Silver sells live on their own page (/bills/silver) — bills are
// single-metal, so the two lists never overlap.
export default function GoldBillsPage() {
  return <BillsList metal="gold" />;
}
