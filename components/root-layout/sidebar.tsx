"use client";

import { Home, FileText, List, Users, Store, Settings, Shield, ScrollText, Gem, TrendingUp, Coins, SlidersHorizontal, X, Wallet, Receipt, UserCircle, Radio, MessageCircle, ShoppingBag, Target, ListChecks, ReceiptText, Camera, BarChart3, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAutoSellStatus } from "@/hooks/use-auto-sell-status";
import { useNewBadge } from "@/hooks/use-new-badge";
import { useCallback, useEffect, useState, type ReactNode } from "react";

// ขายอัตโนมัติ launched 31 ก.ค. 2026 — flag it as new for a week, then delete this
// line and the isNew prop below.
const AUTO_SELL_NEW_UNTIL = "2026-08-07T23:59:59+07:00";

// เปิดใบเสนอราคา / รายงานยอดขาย / บันทึกใบเสร็จ ship together on 4 ก.ย. 2026 —
// flagged new for a week, then delete this line and the three isNew props below.
const SEP_2026_NEW_UNTIL = "2026-09-11T23:59:59+07:00";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface MenuItem {
  id: number;
  name: string;
  href: string;
  icon: ReactNode;
  show: boolean;
  badge?: number;
  isNew?: boolean;
}

interface MenuGroup {
  id: string;
  /** null = no header; the item stands on its own at the top of the list. */
  name: string | null;
  items: MenuItem[];
}

// Which groups the user has folded away. Per-browser, not per-account: it is a
// view preference, not data.
const COLLAPSED_KEY = "jk_sidebar_collapsed";

// pick pulls a group's entries out of the flat menu BY ID, in the order listed —
// the flat list stays the single place an entry's permissions and badge live, and
// an id that is hidden for this role simply drops out.
function pick(menu: MenuItem[], ids: number[]): MenuItem[] {
  return ids
    .map((id) => menu.find((item) => item.id === id))
    .filter((item): item is MenuItem => !!item && item.show);
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const currentPath = usePathname();
  const { hasPermission, permissions, unfinishedGoldBills, unfinishedSilverBills, isMaster, isCustomer } = useAuth();
  // Bill creation is customer-only. Use the raw permission list (NOT hasPermission,
  // which auto-grants master) so "สร้างบิล" hides from master/owner/employee.
  const canCreateBill = permissions.includes("bills.create");
  // Same reasoning for auto-sell: placing an order is a customer action, so the
  // raw permission decides (master manages orders from the settings page instead).
  // The menu also disappears entirely while the shop has the feature switched off
  // — re-read periodically because the master can flip it at any time. Only the
  // users who could place an order pay for the lookup (it reaches the price
  // sidecar), and this hook runs on every page.
  const canPlaceOrder = permissions.includes("sell_orders.create");
  const { status: autoSell } = useAutoSellStatus(60000, canPlaceOrder);
  const showAutoSell = canPlaceOrder && !!autoSell?.enabled;
  const autoSellIsNew = useNewBadge(AUTO_SELL_NEW_UNTIL);
  const sep2026IsNew = useNewBadge(SEP_2026_NEW_UNTIL);

  // Every group starts open, so the menu looks exactly as it always has and the
  // headings read as labels rather than as things to go hunting through. What the
  // user folds away is remembered.
  //
  // Read in an effect, not during render: these pages are prerendered, so touching
  // localStorage while rendering would bake one browser's answer into the static
  // HTML and mismatch on hydration. `hydrated` also holds the fold animation back
  // until the stored state has been applied, so a restored collapse does not play
  // as an animation on every page load.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* unreadable or malformed: everything stays open */
    }
    setHydrated(true);
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* private mode: the fold still works, it just will not be remembered */
      }
      return next;
    });
  }, []);

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

  const menu: MenuItem[] = [
    { id: 1, name: "หน้าแรก", href: "/", icon: <Home size={18} />, show: true },
    // เปิดใบเสนอราคา — ถ่ายรูปก่อนหลอมและเก็บข้อมูลลูกค้าไว้ก่อน แล้วค่อยกลับมาออก
    // ใบเสนอราคาทีหลัง. เมนูเดียวไปที่หน้ารายการ ซึ่งมีปุ่มเปิดใบใหม่อยู่ในตัว —
    // ไม่แยกเมนู "เปิดใบใหม่" ออกมาอีกอัน เพราะ sidebar ยาวพออยู่แล้ว.
    // อยู่เหนือ "ออกใบเสนอราคา" ตามลำดับงานจริงหน้าร้าน — ส่วนการออกใบเสนอราคาแบบเดิม
    // (ไม่ผ่านใบเปิดงาน) ยังใช้ได้เหมือนเดิมทุกอย่าง.
    { id: 28, name: "เปิดใบเสนอราคา", href: "/quotation-intake", icon: <Camera size={18} />, show: hasPermission("quotations.read") || hasPermission("quotations.create"), isNew: sep2026IsNew },
    { id: 2, name: "ออกใบเสนอราคา", href: "/quotation", icon: <FileText size={18} />, show: hasPermission("quotations.create") },
    { id: 3, name: "ใบเสนอราคาทั้งหมด", href: "/quote-list", icon: <List size={18} />, show: hasPermission("quotations.read") },
    // รายงานยอดขาย — one page, one tab per metal. It summarises documents the
    // caller can already read and re-applies the same scope, so it rides on
    // quotations.read like the list it summarises.
    { id: 30, name: "รายงานยอดขาย", href: "/reports/sales", icon: <BarChart3 size={18} />, show: hasPermission("quotations.read"), isNew: sep2026IsNew },
    { id: 14, name: "ขาย", href: "/bills/create", icon: <FileText size={18} />, show: canCreateBill },
    { id: 24, name: "ตั้งราคาขายอัตโนมัติ", href: "/bills/auto-sell", icon: <Target size={18} />, show: showAutoSell, isNew: autoSellIsNew },
    { id: 26, name: "คำสั่งขายอัตโนมัติ", href: "/bills/auto-sell/orders", icon: <ListChecks size={18} />, show: showAutoSell },
    { id: 22, name: "ขายแทนลูกค้า", href: "/bills/sell", icon: <ShoppingBag size={18} />, show: hasPermission("bills.sell") },
    // Bills are single-metal, so gold and silver sells get a list (and badge) each.
    { id: 15, name: "รายการขายทอง", href: "/bills", icon: <Receipt size={18} />, show: hasPermission("bills.read"), badge: unfinishedGoldBills },
    { id: 23, name: "รายการขายเงิน", href: "/bills/silver", icon: <Coins size={18} />, show: hasPermission("bills.read"), badge: unfinishedSilverBills },
    { id: 21, name: "โปรไฟล์", href: "/account", icon: <UserCircle size={18} />, show: isCustomer },
    { id: 16, name: "ลูกค้า", href: "/customers", icon: <UserCircle size={18} />, show: hasPermission("customers.read") },
    { id: 4, name: "สมาชิก", href: "/members", icon: <Users size={18} />, show: hasPermission("members.read") },
    { id: 13, name: "จัดการเครดิต", href: "/credit-management", icon: <Wallet size={18} />, show: hasPermission("credits.read") },
    { id: 5, name: "ร้านค้าและสาขา", href: "/stores", icon: <Store size={18} />, show: hasPermission("stores.read") },
    { id: 7, name: "การจัดการ", href: "/management", icon: <Settings size={18} />, show: isMaster },
    { id: 8, name: "ประเภททอง", href: "/settings/gold-types", icon: <Gem size={18} />, show: hasPermission("gold_types.read") },
    { id: 9, name: "ราคาทองคำ", href: "/settings/gold-price", icon: <TrendingUp size={18} />, show: hasPermission("gold_prices.read") },
    { id: 18, name: "ราคาทองเรียลไทม์", href: "/realtime-gold", icon: <Radio size={18} />, show: hasPermission("gold_prices.read") },
    { id: 19, name: "ราคาเงิน", href: "/settings/silver-price", icon: <Coins size={18} />, show: hasPermission("metal_prices.read") },
    // ตั้งค่าขายอัตโนมัติ lives inside ตั้งค่าระบบ, alongside the other sell settings.
    { id: 10, name: "ตั้งค่าระบบ", href: "/settings/config", icon: <SlidersHorizontal size={18} />, show: hasPermission("config.read") },
    { id: 20, name: "การแจ้งเตือน LINE", href: "/settings/line-notification", icon: <MessageCircle size={18} />, show: hasPermission("config.read") },
    { id: 11, name: "จัดการสิทธิ์", href: "/settings/roles", icon: <Shield size={18} />, show: hasPermission("roles.read") },
    { id: 27, name: "บันทึกใบเสร็จ", href: "/receipts", icon: <ReceiptText size={18} />, show: hasPermission("receipts.read"), isNew: sep2026IsNew },
    { id: 12, name: "Logs การใช้งาน", href: "/settings/logs", icon: <ScrollText size={18} />, show: hasPermission("logs.read") },
  ];

  // Grouping is drawn ON TOP of the existing order: within every group the entries
  // keep the sequence they have always had, and the boundaries fall where the flat
  // list already changed subject — so a user who knows where things are still finds
  // them in the same place, now under a heading.
  //
  // รายงาน is the one exception, and only because it is brand new: nobody has
  // muscle memory for it yet, so it is placed where it reads best (after the
  // people it reports on) rather than where it happened to be added.
  const groups: MenuGroup[] = [
    { id: "home", name: null, items: pick(menu, [1]) },
    { id: "quotation", name: "ใบเสนอราคา", items: pick(menu, [28, 2, 3]) },
    { id: "trade", name: "ซื้อขาย", items: pick(menu, [14, 24, 26, 22, 15, 23]) },
    { id: "people", name: "ลูกค้าและสมาชิก", items: pick(menu, [21, 16, 4, 13]) },
    { id: "report", name: "รายงาน", items: pick(menu, [30]) },
    { id: "store", name: "ร้านค้า", items: pick(menu, [5, 7]) },
    { id: "price", name: "ราคาและประเภทโลหะ", items: pick(menu, [8, 9, 18, 19]) },
    { id: "system", name: "ตั้งค่าระบบ", items: pick(menu, [10, 20, 11, 27, 12]) },
  ].filter((group) => group.items.length > 0);

  const MenuLink = ({ item }: { item: MenuItem }) => (
    <Link
      href={item.href}
      className={
        currentPath === item.href
          ? "flex flex-row items-center gap-x-3 p-3 hover:bg-black/10 rounded-2xl bg-gradient-to-br from-[#c09c42]/60 to-transparent border-1 border-black/10"
          : "flex flex-row items-center gap-x-3 p-3 hover:bg-black/10 rounded-2xl transition-colors duration-200"
      }
    >
      <span className="text-[#c09c42]">{item.icon}</span>
      <span className="font-bold text-sm bg-gradient-to-b from-black/70 to-[#c09c42]/60 bg-clip-text text-transparent flex-1">
        {item.name}
      </span>
      {item.isNew && (
        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white text-[9px] font-bold tracking-wide">
          New
        </span>
      )}
      {!!item.badge && item.badge > 0 && (
        <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );

  const MenuItems = () => (
    <>
      {groups.map((group) => {
        if (!group.name) {
          return group.items.map((item) => <MenuLink key={item.id} item={item} />);
        }

        const open = !collapsed.has(group.id);
        const holdsCurrent = group.items.some((item) => currentPath === item.href);
        // A folded group must not swallow what it was telling the user: the
        // waiting-bill counts and any New flag move up onto its header.
        const badge = group.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
        const hasNew = group.items.some((item) => item.isNew);

        return (
          <div key={group.id} className="flex flex-col">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleGroup(group.id)}
              className="flex flex-row items-center gap-x-2 px-3 pt-3 pb-1.5 rounded-2xl hover:bg-black/5 transition-colors"
            >
              {/* Folded, the heading is the only thing standing in for its items,
                  so it darkens into a row you would click. Unfolded it goes back
                  to being a quiet caption over links that speak for themselves. */}
              <span
                className={`text-[11px] font-bold tracking-wide flex-1 text-left ${
                  !open
                    ? holdsCurrent
                      ? "text-[#c09c42]"
                      : "text-black/60"
                    : "text-black/35"
                }`}
              >
                {group.name}
              </span>
              {!open && hasNew && (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#c09c42]" />
              )}
              {!open && badge > 0 && (
                <span className="min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              <ChevronDown
                size={14}
                className={`shrink-0 text-black/30 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
              />
            </button>

            {/* Same height trick as the report page's filter panel: the links stay
                mounted so the fold animates, and `inert` keeps a folded group out
                of the tab order. */}
            <div
              className={`grid ${hydrated ? "transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none" : ""}`}
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div
                className="overflow-hidden"
                {...(open
                  ? {}
                  : ({ inert: true } as unknown as React.HTMLAttributes<HTMLDivElement>))}
              >
                <div className="flex flex-col gap-y-1">
                  {group.items.map((item) => (
                    <MenuLink key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className="fixed w-80 h-screen px-4 pt-20 pb-5 max-lg:hidden ">
        <div className="flex flex-col h-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-4xl p-4 gap-y-1 overflow-y-scroll scrollbar-hide">
          <MenuItems />
        </div>
      </div>

      {/* ── Mobile menu — a full, frosted screen ──
          No backdrop: a panel edge to edge leaves nothing behind it to dim, and
          nothing outside it to tap. That also takes the dark bg-black/50 off the
          page, which is the thing iOS Safari was sampling to tint its status-bar
          and floating-bar strips grey — the panel is still frosted, but it is a
          light frost, so what gets sampled stays light. Closing is the ✕ or
          picking an item (navigation closes it — see the currentPath effect). */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex flex-col bg-white/85 backdrop-blur-xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Header — same height as the navbar it replaces, so the ✕ lands where
            the ☰ was and the menu does not appear to jump. */}
        <div className="flex items-center justify-between h-20 shrink-0 px-6">
          <span className="font-bold text-lg bg-[#c09c42] bg-clip-text text-transparent">
            เมนู
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 transition-colors text-black/50"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex flex-col gap-y-1 overflow-y-auto scrollbar-hide flex-1 px-4 pb-6">
          <MenuItems />
        </div>
      </div>
    </>
  );
};
