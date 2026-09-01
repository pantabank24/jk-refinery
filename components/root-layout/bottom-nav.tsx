"use client";

import { Home, FileText, Target, ListChecks, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAutoSellStatus } from "@/hooks/use-auto-sell-status";
import type { ReactNode } from "react";

// The five places a customer actually goes. Everything else they own (รายการขาย,
// ใบเสนอราคา) stays in the sidebar — this bar exists because customers were not
// finding the ☰ at all, not to replace it.
interface BottomNavItem {
  href: string;
  // The name under the icon. Kept short on purpose — all five are on screen at
  // once and the bar has a phone's width to fit them in.
  label: string;
  // The full menu name, for screen readers and long-press tooltips.
  title: string;
  icon: ReactNode;
  show: boolean;
  // /bills/auto-sell and /bills/auto-sell/orders are separate destinations that
  // happen to nest in the URL, so the parent must match exactly or it would light
  // up while the child is open.
  exact?: boolean;
}

// useBottomNav resolves who sees the bar and what is on it. MainContent calls it
// (not BottomNav itself) because the page also has to reserve room at the bottom
// edge, and both answers have to come from the same evaluation.
export function useBottomNav(): { visible: boolean; items: BottomNavItem[] } {
  const { permissions, isCustomer } = useAuth();
  // Same raw-permission reasoning as the sidebar: these are customer actions, so
  // hasPermission (which auto-grants master) would be the wrong gate.
  const canCreateBill = permissions.includes("bills.create");
  const canPlaceOrder = permissions.includes("sell_orders.create");
  // Polls alongside the sidebar's own copy — the shop can switch auto-sell off at
  // any time and the two navs must not disagree about whether it exists.
  const { status: autoSell } = useAutoSellStatus(60000, isCustomer && canPlaceOrder);
  const showAutoSell = canPlaceOrder && !!autoSell?.enabled;

  const items: BottomNavItem[] = [
    { href: "/", label: "หน้าแรก", title: "หน้าแรก", icon: <Home size={19} />, show: true, exact: true },
    { href: "/bills/create", label: "ขาย", title: "ขาย", icon: <FileText size={19} />, show: canCreateBill },
    { href: "/bills/auto-sell", label: "ตั้งราคา", title: "ตั้งราคาขายอัตโนมัติ", icon: <Target size={19} />, show: showAutoSell, exact: true },
    { href: "/bills/auto-sell/orders", label: "คำสั่งขาย", title: "คำสั่งขายอัตโนมัติ", icon: <ListChecks size={19} />, show: showAutoSell },
    { href: "/account", label: "โปรไฟล์", title: "โปรไฟล์", icon: <UserCircle size={19} />, show: true },
  ].filter((i) => i.show);

  // Two entries is a header, not a navigation bar — if the customer has neither
  // selling nor auto-sell, the sidebar covers them fine.
  return { visible: isCustomer && items.length > 2, items };
}

export const BottomNav = ({ items }: { items: BottomNavItem[] }) => {
  const pathname = usePathname();

  const isActive = (item: BottomNavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    // Hidden from lg up, where the sidebar is on screen and this would be noise.
    // The wrapper spans the width but ignores pointer events so the page stays
    // tappable either side of the pill; only the bar itself takes taps back.
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      aria-label="เมนูหลัก"
    >
      {/* Frosted glass rather than a solid bar: the page keeps showing through, so
          the nav reads as floating over the content instead of cutting the screen
          off. saturate lifts the colour the blur washes out, the white top edge is
          the lit rim that sells the glass, and the tint stays at /45 — enough to
          keep the labels legible over whatever scrolls underneath.

          Five labelled items are wider than the narrowest phone, so the bar
          scrolls sideways rather than wrapping or squeezing the text. */}
      <div className="pointer-events-auto flex items-stretch max-w-full overflow-x-auto scrollbar-hide rounded-full border-1 border-white/50 bg-white/45 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.7)] p-1.5">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              // Every item carries its name — an icon alone left customers
              // guessing, which is the whole reason this bar exists. The label
              // is what sets the width, so the items come out even without
              // being forced to a fixed size.
              className={`flex flex-col items-center justify-center gap-y-0.5 shrink-0 min-w-14 px-2.5 py-1.5 rounded-full transition-colors duration-200 ${
                active
                  ? "bg-gradient-to-br from-[#c09c42] to-[#a07f2e] text-white shadow-sm"
                  : "text-black/55 active:bg-black/5"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="text-[10px] leading-none font-bold whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
