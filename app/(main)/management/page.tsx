"use client";

import { Button } from "@heroui/button";
import { Store, UserCog, Shield, FileText, Users, Newspaper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function ManagementPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const menuItems = [
    {
      id: 1,
      name: "จัดการร้านค้าและสาขา",
      description: "เพิ่ม แก้ไข ลบ ร้านค้าและสาขา",
      icon: <Store size={24} className="text-[#c09c42]" />,
      href: "/stores",
      show: hasPermission("stores.read"),
    },
    {
      id: 2,
      name: "จัดการพนักงาน",
      description: "เพิ่ม แก้ไข ลบ พนักงาน กำหนดสิทธิ์",
      icon: <UserCog size={24} className="text-[#c09c42]" />,
      href: "/users",
      show: hasPermission("users.read"),
    },
    {
      id: 3,
      name: "จัดการสิทธิ์",
      description: "สร้างและกำหนดสิทธิ์การเข้าถึง",
      icon: <Shield size={24} className="text-[#c09c42]" />,
      href: "/settings/roles",
      show: hasPermission("roles.read"),
    },
    {
      id: 4,
      name: "ใบเสนอราคาทั้งหมด",
      description: "ดูและจัดการใบเสนอราคา",
      icon: <FileText size={24} className="text-[#c09c42]" />,
      href: "/quote-list",
      show: hasPermission("quotations.read"),
    },
    {
      id: 5,
      name: "สมาชิก",
      description: "จัดการข้อมูลสมาชิกและเครดิต",
      icon: <Users size={24} className="text-[#c09c42]" />,
      href: "/members",
      show: hasPermission("members.read"),
    },
    {
      id: 6,
      name: "จัดการข่าวสาร",
      description: "เพิ่ม แก้ไข ลบ ข่าวสารหน้าแรก",
      icon: <Newspaper size={24} className="text-[#c09c42]" />,
      href: "/news",
      show: hasPermission("news.create"),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          การจัดการ
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems
          .filter((item) => item.show)
          .map((item) => (
            <Button
              key={item.id}
              className="flex flex-col items-start h-auto border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 gap-y-2 hover:shadow-lg transition-all"
              variant="light"
              onPress={() => router.push(item.href)}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c09c42]/30 to-transparent flex items-center justify-center">
                {item.icon}
              </div>
              <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent text-left">
                {item.name}
              </span>
              <span className="text-xs text-black/50 text-left">
                {item.description}
              </span>
            </Button>
          ))}
      </div>
    </div>
  );
}
