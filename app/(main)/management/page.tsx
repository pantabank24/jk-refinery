"use client";

import { Button } from "@heroui/button";
import { Plus } from "lucide-react";

export default function ManagementPage() {
  return (
    <div className=" flex flex-col h-full">
      <div className=" flex flex-row items-center justify-between shrink-0 py-5">
        <div className=" flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          การจัดการ
        </div>
        <Button
          className="border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl font-bold shadow-md"
          startContent={<Plus size={15} />}
          size="md"
          onPress={() => {}}
        />
      </div>

      <div className=" w-1/2 border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl p-2 ">
        <Button />
        <Button />
        <Button />
        <Button />
        <Button />
        <Button />
        <Button />
      </div>
    </div>
  );
}
