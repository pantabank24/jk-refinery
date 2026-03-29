"use client";

import { Home, FileText, List, Users, Store, Settings, UserCog, Shield, ScrollText, Gem, TrendingUp, SlidersHorizontal, X, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const currentPath = usePathname();
  const { hasPermission } = useAuth();

  // Close on route change (mobile)
  useEffect(() => {
    onClose?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const menu = [
    { id: 1,  name: "หน้าแรก",              href: "/",                    icon: <Home size={18} />,             show: true },
    { id: 2,  name: "ออกใบเสนอราคา",        href: "/quotation",           icon: <FileText size={18} />,         show: hasPermission("quotations.create") },
    { id: 3,  name: "ใบเสนอราคาทั้งหมด",    href: "/quote-list",          icon: <List size={18} />,             show: hasPermission("quotations.read") },
    { id: 4,  name: "สมาชิก",               href: "/members",             icon: <Users size={18} />,            show: hasPermission("members.read") },
    { id: 13, name: "จัดการเครดิต",         href: "/credit-management",   icon: <Wallet size={18} />,           show: hasPermission("credits.read") },
    { id: 5,  name: "ร้านค้าและสาขา",       href: "/stores",              icon: <Store size={18} />,            show: hasPermission("stores.read") },
    { id: 6,  name: "จัดการพนักงาน",        href: "/users",               icon: <UserCog size={18} />,          show: hasPermission("users.read") },
    { id: 7,  name: "การจัดการ",            href: "/management",          icon: <Settings size={18} />,         show: hasPermission("stores.read") },
    { id: 8,  name: "ประเภททอง",            href: "/settings/gold-types", icon: <Gem size={18} />,              show: hasPermission("gold_types.read") },
    { id: 9,  name: "ราคาทองคำ",            href: "/settings/gold-price", icon: <TrendingUp size={18} />,       show: hasPermission("gold_prices.read") },
    { id: 10, name: "ตั้งค่าระบบ",          href: "/settings/config",     icon: <SlidersHorizontal size={18} />, show: hasPermission("config.read") },
    { id: 11, name: "จัดการสิทธิ์",         href: "/settings/roles",      icon: <Shield size={18} />,           show: hasPermission("roles.read") },
    { id: 12, name: "Logs การใช้งาน",       href: "/settings/logs",       icon: <ScrollText size={18} />,       show: hasPermission("logs.read") },
  ];

  const visibleMenu = menu.filter((item) => item.show);

  const MenuItems = () => (
    <>
      {visibleMenu.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={
            currentPath === item.href
              ? "flex flex-row items-center gap-x-3 p-3 hover:bg-black/10 rounded-2xl bg-gradient-to-br from-[#c09c42]/60 to-transparent border-1 border-black/10"
              : "flex flex-row items-center gap-x-3 p-3 hover:bg-black/10 rounded-2xl transition-colors duration-200"
          }
        >
          <span className="text-[#c09c42]">{item.icon}</span>
          <span className="font-bold text-sm bg-gradient-to-b from-black/70 to-[#c09c42]/60 bg-clip-text text-transparent">
            {item.name}
          </span>
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className="fixed w-80 h-screen px-4 pt-20 pb-5 max-lg:hidden">
        <div className="flex flex-col h-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-4xl p-4 gap-y-1">
          <MenuItems />
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 pt-5 pb-5 px-4 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full border-1 border-black/10 bg-white/75 shadow-2xl backdrop-blur-xs rounded-4xl p-4 gap-y-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-bold text-base bg-[#c09c42] bg-clip-text text-transparent">
              เมนู
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/10 transition-colors text-black/50"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col gap-y-1 overflow-y-auto scrollbar-hide flex-1">
            <MenuItems />
          </div>
        </div>
      </div>
    </>
  );
};
