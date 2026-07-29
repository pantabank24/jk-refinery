"use client";

import { BillsList } from "../_component/billsList";

// รายการขายเงิน — same list as /bills, filtered to silver bills.
export default function SilverBillsPage() {
  return <BillsList metal="silver" />;
}
