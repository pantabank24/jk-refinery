"use client";

import { CmpBack } from "@/components/cmpBack";
import { CmpButton } from "@/components/cmpButton";
import { CmpInput } from "@/components/cmpInput";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export const Action = () => {
  const router = useRouter();

  const members: BuyerDto = {
    id: "0000001",
    username: "jkgoldrefinery",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    fname: "คุณวีรชัย",
    lname: "ชัยนุมาศ",
    phone: "0887779997",
    credits: 100,
    status: 0,
    createdAt: "2025-12-12 00:00:00",
    updatedAt: "2025-12-12 00:00:00",
  };

  return (
    <div className=" flex flex-col w-full h-full ">
      <CmpBack />
      <div
        className={`flex flex-col max-md:mt-12 w-full xl:w-1/2 border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl p-4`}
      >
        <div>
          <span className=" font-bold text-2xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
            สร้างผู้ใช้งาน
          </span>
        </div>

        <div className=" grid grid-cols-2 gap-2">
          <div className=" col-span-2 flex flex-col items-center justify-center gap-y-2">
            <Avatar
              src={"https://i.pravatar.cc/150?u=a042581f4e29026024d"}
              className=" flex w-28 h-28"
            />
            <Button className=" h-8 bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold">
              แก้ไขข้อมูล
            </Button>
          </div>
          <div className=" col-span-2">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              ข้อมูลส่วนตัว
            </span>
          </div>
          <CmpInput
            placeholder="ชื่อจริง"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />
          <CmpInput
            placeholder="นามสกุล"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />
          <CmpInput
            placeholder="เบอร์โทรศัพท์"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />
          <div />
          <div className=" col-span-2">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              เครดิตเริ่มต้น
            </span>
          </div>
          <CmpInput
            placeholder="จำนวน"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />

          <div className=" col-span-2">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              บัญชี
            </span>
          </div>
          <CmpInput
            placeholder="ชื่อผู้ใช้"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />
          <div></div>
          <CmpInput
            placeholder="รหัสผ่าน"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />
          <CmpInput
            placeholder="ยืนยันรหัสผ่าน"
            value=""
            onChange={(e) => console.log(e.target.value)}
          />

          <div className=" col-span-2 mt-5">
            <Button className=" h-10 w-full bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold">
              สร้างผู้ใช้งาน
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
