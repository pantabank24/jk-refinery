import { Suspense } from "react";
import { Spinner } from "@heroui/spinner";
import { CustomerDetail } from "../customers/[mode]/_subpage/read";

const Loading = () => (
  <div className="flex items-center justify-center h-full">
    <Spinner size="lg" color="warning" />
  </div>
);

// โปรไฟล์ฝั่งลูกค้า — ใช้หน้าเดียวกับ "รายละเอียดลูกค้า" แต่ scope ข้อมูลเป็นของตัวเอง
export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomerDetail selfMode />
    </Suspense>
  );
}
