import { SkeletonList } from "@/components/skeleton";
import { Suspense } from "react";
import { CustomerDetail } from "../customers/[mode]/_subpage/read";

const Loading = () => (
  <SkeletonList rows={6} />
);

// โปรไฟล์ฝั่งลูกค้า — ใช้หน้าเดียวกับ "รายละเอียดลูกค้า" แต่ scope ข้อมูลเป็นของตัวเอง
export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomerDetail selfMode />
    </Suspense>
  );
}
