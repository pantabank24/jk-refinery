"use client";

import { CmpInput } from "./cmpInput";
import { CmpSelect } from "./cmpSelect";

export const CmpFilter = () => {
  return (
    <div className="flex flex-row md:flex-col w-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl md:rounded-4xl p-3 gap-y-3 gap-x-2">
      <div className=" max-md:hidden flex font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
        ตัวกรอง
      </div>
      <CmpInput
        placeholder="ค้นหา"
        value=""
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          console.log(e.target.value)
        }
      />
      <CmpSelect
        data={[]}
        placeholder="เลือก"
        value=""
        onChange={(value) => console.log(value)}
      />
    </div>
  );
};
