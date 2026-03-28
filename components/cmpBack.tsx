"use client";

import { Button } from "@heroui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export const CmpBack = () => {
  const router = useRouter();
  return (
    <div className=" max-md:fixed z-50 flex flex-row items-center justify-between shrink-0 pb-3">
      <Button
        className="border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl font-bold shadow-md"
        startContent={<ArrowLeft size={15} />}
        size="md"
        onPress={() => router.back()}
      >
        <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
          ย้อนกลับ
        </div>
      </Button>
    </div>
  );
};
