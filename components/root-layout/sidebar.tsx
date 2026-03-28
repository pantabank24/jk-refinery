"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Sidebar = () => {
  const currentPath = usePathname();

  const menu = [
    {
      id: 1,
      name: "หน้าแรก",
      href: "/",
      icon: <Home size={20} />,
    },
    {
      id: 2,
      name: "ออกใบเสนอราคา",
      href: "/quotation",
      icon: <Home size={20} />,
    },
    {
      id: 3,
      name: "ใบเสนอราคาทั้งหมด",
      href: "/quote-list",
      icon: <Home size={20} />,
    },
    {
      id: 4,
      name: "สมาชิก",
      href: "/members",
      icon: <Home size={20} />,
    },
    {
      id: 5,
      name: "การจัดการ",
      href: "/management",
      icon: <Home size={20} />,
    },
  ];

  return (
    <div className=" fixed w-80 h-screen px-4 pt-20 pb-5 max-lg:hidden">
      <div className="flex flex-col h-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-4xl p-4 gap-y-2">
        {menu.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={
              currentPath === item.href
                ? " flex flex-row items-center gap-x-2 p-2 hover:bg-black/10 rounded-2xl bg-gradient-to-br from-[#c09c42]/60 to-transparent border-1 border-black/10 "
                : " flex flex-row items-center gap-x-2 p-2 hover:bg-black/10 rounded-2xl"
            }
          >
            <span
              className={
                "font-bold text-md bg-gradient-to-b from-black/70 to-[#c09c42]/60 bg-clip-text text-transparent"
              }
            >
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
