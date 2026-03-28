import { CmpButton } from "@/components/cmpButton";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

interface Props {
  data: BuyerDto;
}

export const MemberCard = ({ data }: Props) => {
  return (
    <div className=" flex flex-col w-full md:w-80 border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl px-3 py-5 items-center gap-y-4">
      <Avatar src={data.image} className=" flex w-40 h-40" />
      <div className=" flex flex-col items-center">
        <span className=" font-bold text-2xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent -mt-2">
          {data.fname} {data.lname}
        </span>
        <div className=" bg-gradient-to-r from-transparent to-yellow-200/50 rounded-full px-2 border-1 border-black/10 shandow-sm">
          <span className=" text-xs font-bold">Username : {data.username}</span>
        </div>
        <span className=" text-[10px] font-bold mt-1">
          Member ID : {data.id}
        </span>
      </div>
      <Button className=" h-8 bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold">
        แก้ไขข้อมูล
      </Button>
    </div>
  );
};
