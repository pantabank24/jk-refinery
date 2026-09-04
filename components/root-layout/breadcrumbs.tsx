"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// Every page's name, keyed by its exact path. Taken from what each page and the
// sidebar already call themselves — a breadcrumb that invents its own wording for
// a screen is worse than none, because the reader then has two names for one page.
const ROUTE_LABELS: Record<string, string> = {
  "/": "หน้าแรก",
  "/account": "โปรไฟล์",
  "/profile": "แก้ไขโปรไฟล์",

  "/quotation-intake": "เปิดใบเสนอราคา",
  "/quotation-intake/create": "เปิดใบใหม่",
  "/quotation": "ออกใบเสนอราคา",
  "/quote-list": "ใบเสนอราคาทั้งหมด",

  "/reports/sales": "รายงานยอดขาย",

  "/bills": "รายการขายทอง",
  "/bills/silver": "รายการขายเงิน",
  "/bills/create": "ขาย",
  "/bills/sell": "ขายแทนลูกค้า",
  "/bills/issued": "บิลทั้งหมด",
  "/bills/auto-sell": "ตั้งราคาขายอัตโนมัติ",
  "/bills/auto-sell/orders": "คำสั่งขายอัตโนมัติ",

  "/customers": "ลูกค้า",
  "/members": "สมาชิก",
  "/credit-management": "จัดการเครดิต",
  "/users": "ผู้ใช้งาน",

  "/stores": "ร้านค้าและสาขา",
  "/management": "การจัดการ",
  "/news": "ข่าวสาร",
  "/receipts": "บันทึกใบเสร็จ",
  "/realtime-gold": "ราคาทองเรียลไทม์",

  "/settings/config": "ตั้งค่าระบบ",
  "/settings/gold-types": "ประเภททอง",
  "/settings/gold-price": "ราคาทองคำ",
  "/settings/silver-price": "ราคาเงิน",
  "/settings/line-notification": "การแจ้งเตือน LINE",
  "/settings/roles": "จัดการสิทธิ์",
  "/settings/logs": "Logs การใช้งาน",
  "/settings/sales-price": "ตั้งค่าราคาขาย",
  "/settings/customer-sell": "ตั้งค่าลูกค้าขาย",
  "/settings/silver-sell": "ตั้งค่าขายเงิน",
  "/settings/auto-sell": "ตั้งค่าขายอัตโนมัติ",
  "/settings/pdpa": "ประกาศความเป็นส่วนตัว (PDPA)",
};

// Pages that hang straight off หน้าแรก — every entry the sidebar offers, plus the
// few top-level screens reached from elsewhere. Without this the URL would invent
// nesting that does not exist: /bills/silver would read "รายการขายทอง ›
// รายการขายเงิน", as if the silver list lived inside the gold one, when they are
// two separate menu entries.
const SECTION_ROOTS = new Set([
  "/account",
  "/profile",
  "/quotation-intake",
  "/quotation",
  "/quote-list",
  "/reports/sales",
  "/bills",
  "/bills/silver",
  "/bills/create",
  "/bills/sell",
  "/bills/issued",
  "/bills/auto-sell",
  "/bills/auto-sell/orders",
  "/customers",
  "/members",
  "/credit-management",
  "/users",
  "/stores",
  "/management",
  "/news",
  "/receipts",
  "/realtime-gold",
  "/settings/config",
  "/settings/gold-types",
  "/settings/gold-price",
  "/settings/silver-price",
  "/settings/line-notification",
  "/settings/roles",
  "/settings/logs",
]);

// Where the URL lies about the hierarchy the other way round. These settings pages
// are opened from inside ตั้งค่าระบบ, but their URLs sit under "/settings", which is
// not a page at all — walking upwards would invent a parent nobody can navigate to.
const PARENT_OF: Record<string, string> = {
  "/settings/sales-price": "/settings/config",
  "/settings/customer-sell": "/settings/config",
  "/settings/silver-sell": "/settings/config",
  "/settings/auto-sell": "/settings/config",
  "/settings/pdpa": "/settings/config",
};

// Lists whose numeric child IS a real page (/quote-list/12, /stores/3, …), so that
// crumb can be a link. Deliberately explicit: /news/5 is not a page (only
// /news/5/edit is), and a breadcrumb must never offer a link that 404s.
const DETAIL_PARENTS = ["/quote-list", "/receipts", "/stores", "/settings/roles"];

// Trailing segments that are actions rather than places.
const SEGMENT_LABELS: Record<string, string> = {
  create: "เพิ่มใหม่",
  edit: "แก้ไข",
  read: "รายละเอียด",
  branches: "สาขา",
  orders: "รายการคำสั่ง",
};

const parentByUrl = (path: string) => {
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
};

const isDetailPath = (path: string) =>
  DETAIL_PARENTS.includes(parentByUrl(path)) && /^\d+$/.test(path.split("/").pop() ?? "");

function labelFor(path: string): string {
  const known = ROUTE_LABELS[path];
  if (known) return known;
  const segment = path.split("/").pop() ?? "";
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // A bare id — the row someone drilled into.
  if (/^\d+$/.test(segment)) return "รายละเอียด";
  return decodeURIComponent(segment);
}

export interface Crumb {
  href: string;
  label: string;
  /** Only a real, reachable page is offered as a link. */
  linkable: boolean;
}

export function crumbsFor(pathname: string): Crumb[] {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return [];

  const chain: Crumb[] = [];
  let path = clean;
  // Bounded: a malformed path must not spin here.
  for (let hop = 0; hop < 10 && path && path !== "/"; hop++) {
    chain.unshift({
      href: path,
      label: labelFor(path),
      linkable: !!ROUTE_LABELS[path] || isDetailPath(path),
    });
    path = SECTION_ROOTS.has(path) ? "/" : (PARENT_OF[path] ?? parentByUrl(path));
  }
  chain.unshift({ href: "/", label: ROUTE_LABELS["/"], linkable: true });
  return chain;
}

// The trail sits in the top bar's left half, which the logo vacated when it moved
// to the head of the sidebar. Hidden below lg: there the bar still carries the
// logo and there is no width to spare.
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname ?? "/");
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="เส้นทางหน้า" className="min-w-0 max-lg:hidden">
      <ol className="flex flex-row items-center gap-x-1 min-w-0">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex flex-row items-center gap-x-1 min-w-0">
              {i > 0 && (
                <ChevronRight size={13} className="shrink-0 text-black/25" />
              )}
              {last ? (
                <span
                  aria-current="page"
                  className="truncate text-sm font-bold text-black/70"
                >
                  {crumb.label}
                </span>
              ) : crumb.linkable ? (
                <Link
                  href={crumb.href}
                  className="truncate text-sm text-black/45 hover:text-[#c09c42] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-sm text-black/35">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
