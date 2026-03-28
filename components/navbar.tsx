import Image from "next/image";
import { User } from "./user";
import { Badge } from "@heroui/badge";
import { Bell, ShoppingBag } from "lucide-react";

export const Navbar = () => {
  return (
    <div className=" fixed z-50 flex w-screen h-20 py-2 pl-3 pr-3 lg:pr-7">
      <div className=" flex w-full h-full justify-between bg-black/5 border-1 border-black/10 backdrop-blur shadow-sm rounded-2xl items-center py-1 px-5">
        <div className=" flex flex-row h-full items-center gap-x-2">
          <img
            src="/images/jk-logo.png"
            alt="Logo"
            className=" flex h-full object-contain"
          />
          <div className=" flex flex-col max-sm:hidden">
            <span className=" font-bold text-xl bg-[#c09c42] bg-clip-text text-transparent">
              JK Gold Refinery
            </span>
            <span className=" font-bold text-sm bg-[#c09c42] bg-clip-text text-transparent -mt-2">
              กรุงเทพหลอมทอง
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Badge color="danger" content={2} isInvisible={false} shape="circle">
            <Bell className="text-[#c09c42] " />
          </Badge>
          <Badge color="danger" content={5} isInvisible={false} shape="circle">
            <ShoppingBag className="text-[#c09c42] " />
          </Badge>
          <User />
        </div>
      </div>
    </div>
  );
};
