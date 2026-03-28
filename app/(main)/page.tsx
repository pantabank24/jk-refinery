import {Coins} from "lucide-react"
import { Progress } from "@heroui/progress";
import { BoxCard } from "@/components/boxcard";
import { Avatar } from "@heroui/avatar";

export default function Home() {
  return (
    <div className=" flex flex-col gap-y-2 mt-4">
      <div className=" flex flex-row gap-x-2 mb-5">
        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="lg" />
        <div className=" flex flex-col">
          <span className=" font-bold text-lg text-black">สวัสดี </span>
          <span className=" font-bold text-2xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent -mt-2">คุณวีรชัย ชัยนุมาศ</span>
        </div>
      </div>
      <BoxCard 
        color="bg-gradient-to-tl from-transparent to-yellow-200" 
        textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
        title="เครดิตคงเหลือ" unit="บาท" 
        icon={<Coins size={45} className=" text-yellow-600" />} 
        value="40,000" 
        max="80,000" 
        progress={50} 
      />
      <span className=" font-bold text-md text-[#c09c42]  mt-2 pl-2">ภาพรวม</span>
      <div className=" grid grid-cols-1 sm:grid-cols-2 w-full lg:w-1/2 gap-2 ">
        <BoxCard textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent" title="ออกใบเสนอทั้งหมด" subtitle="สำเร็จ 3 ยกเลิก 2" flex={true} unit="ใบ" value="5" />
        <BoxCard textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent" title="ยอดซื้อทั้งหมด" flex={true} unit="บาท" value="40,000" />
      </div>

      <span className=" font-bold text-md text-[#c09c42]  mt-2 pl-2">ข่าวสาร</span>
    </div>
  );
}
