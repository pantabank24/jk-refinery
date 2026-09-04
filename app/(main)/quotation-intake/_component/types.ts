export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

export const INTAKE_OPEN = 0;
export const INTAKE_USED = 1;
export const INTAKE_CANCELLED = 2;

export interface IntakeImage {
  id: number;
  image_url: string;
  type: string;
}

// ใบเปิดงาน — what the counter recorded before the goods were melted. It holds no
// items and no money; the quotation issued from it later carries all of that.
export interface QuotationIntake {
  id: number;
  store_id: number | null;
  branch_id: number | null;
  branch?: { id: number; name: string } | null;
  created_by: number | null;
  creator?: { id: number; name: string } | null;
  customer_id: number | null;
  customer?: { id: number; name: string; phone: string } | null;
  customer_name: string;
  customer_phone: string;
  note: string;
  status: number;
  quotation_id: number | null;
  used_at?: string | null;
  images?: IntakeImage[];
  created_at: string;
}

export const INTAKE_STATUS_LABEL: Record<number, string> = {
  [INTAKE_OPEN]: "รอออกใบเสนอราคา",
  [INTAKE_USED]: "ออกใบเสนอราคาแล้ว",
  [INTAKE_CANCELLED]: "ยกเลิก",
};

export const INTAKE_STATUS_COLOR: Record<number, string> = {
  [INTAKE_OPEN]: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  [INTAKE_USED]: "bg-green-500/20 text-green-700 border-green-500/30",
  [INTAKE_CANCELLED]: "bg-red-500/20 text-red-700 border-red-500/30",
};

/** Absolute URLs of one photo category, in upload order. */
export function intakeImages(
  intake: Pick<QuotationIntake, "images"> | null | undefined,
  type: string,
): string[] {
  return (intake?.images ?? [])
    .filter((img) => (img.type || "") === type)
    .map((img) => `${API_BASE}${img.image_url}`);
}

/** Photos of one category with their row ids, for UI that can delete them. */
export function intakeImageEntries(
  intake: Pick<QuotationIntake, "images"> | null | undefined,
  type: string,
): { id: number; url: string }[] {
  return (intake?.images ?? [])
    .filter((img) => (img.type || "") === type)
    .map((img) => ({ id: img.id, url: `${API_BASE}${img.image_url}` }));
}
