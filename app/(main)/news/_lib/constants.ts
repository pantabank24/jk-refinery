export type Audience = "all" | "customer" | "staff";

export const AUDIENCE_OPTIONS: { key: Audience; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "customer", label: "ลูกค้า" },
  { key: "staff", label: "พนักงาน/เจ้าของ" },
];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "ทั้งหมด",
  customer: "ลูกค้า",
  staff: "พนักงาน/เจ้าของ",
};

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");

export interface NewsData {
  id: number;
  title: string;
  body: string;
  image_url: string;
  audience: Audience;
  creator?: { id: number; name: string } | null;
  created_at: string;
}
