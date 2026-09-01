"use client";

import { useParams } from "next/navigation";
import { ReceiptForm } from "../_component/receiptForm";

export default function EditReceiptPage() {
  const params = useParams();
  return <ReceiptForm receiptId={Number(params.id)} />;
}
