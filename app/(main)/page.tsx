"use client";

import { motion } from "framer-motion";
import {
  Coins,
  FileText,
  Clock,
  CheckCircle,
  Users,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  FilePlus,
  Receipt,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  BadgeCheck,
} from "lucide-react";
import { BoxCard } from "@/components/boxcard";
import { Avatar } from "@heroui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { VerifyBadge } from "@/components/verifyBadge";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DocumentTypeDto } from "@/dtos/document-type-dto";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { SalesStatusBanner } from "@/components/sales-status-banner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { NewsData, API_BASE } from "./news/_lib/constants";
import {
  STATUS_LABEL as QUOTATION_STATUS_LABEL,
  STATUS_COLOR as QUOTATION_STATUS_COLOR,
} from "./quote-list/_component/constants";

interface DashboardStats {
  my_credits: number;
  quotations_today: number;
  quotations_pending: number;
  quotations_approved: number;
  total_members: number;
  total_quotations: number;
  my_bills_pending: number;
  my_bills_completed: number;
}

interface GoldPriceLite {
  bar_buy: number;
  bar_sell: number;
  change_today: number;
  gold_date: string;
  gold_time: string;
  gold_round: string;
}

interface RecentItem {
  id: number;
  code: string;
  display_code?: string;
  status: number;
  total_amount: number;
  created_at: string;
  // Bills only — decides which sales list the row belongs to.
  metal?: string;
}

const BILL_STATUS_LABEL: Record<number, string> = {
  10: "รอออกบิล",
  11: "รอตรวจบิล",
  12: "สำเร็จ",
  13: "ยกเลิก",
  14: "เคลียร์แล้ว",
};
const BILL_STATUS_COLOR: Record<number, string> = {
  10: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  11: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  13: "bg-red-500/20 text-red-700 border-red-500/30",
  14: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};

// Sections fade + slide in, staggered one after another as the page mounts.
const sectionContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const sectionItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function Home() {
  const { user, loading, permissions, hasPermission, isCustomer } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { status: salesStatus } = useSalesStatus();
  const [newsList, setNewsList] = useState<NewsData[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsData | null>(null);
  const newsDisc = useDisclosure();
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const scrollNews = (dir: 1 | -1) => {
    newsScrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };
  const [goldPrice, setGoldPrice] = useState<GoldPriceLite | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  // ชื่อเอกสารสำคัญที่ลูกค้ายังไม่ได้ส่ง — ว่างไว้แปลว่าไม่ต้องเตือนอะไร
  const [missingDocTypes, setMissingDocTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<DashboardStats>("/dashboard/stats")
      .then((res) => setStats(res.data as unknown as DashboardStats))
      .catch(() => setStats(null));
    api
      .get<NewsData[]>("/news/visible?limit=10")
      .then((res) => setNewsList((res.data as unknown as NewsData[]) || []))
      .catch(() => setNewsList([]));
    api
      .get<GoldPriceLite>("/gold-prices/latest")
      .then((res) =>
        setGoldPrice((res.data as unknown as GoldPriceLite) || null),
      )
      .catch(() => setGoldPrice(null));
    api
      .get<RecentItem[]>(isCustomer ? "/bills?limit=5" : "/quotations?limit=5")
      .then((res) =>
        setRecentItems((res.data as unknown as RecentItem[]) || []),
      )
      .catch(() => setRecentItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isCustomer]);

  // เตือนแบบเบา ๆ ให้ลูกค้าส่งเอกสารยืนยันตัวตน ยังไม่ส่งก็ใช้งานได้ตามปกติ
  // ชื่อเอกสารอ่านจาก master data ไม่ฮาร์ดโค้ด เผื่อร้านตั้งเอกสารสำคัญเพิ่ม
  useEffect(() => {
    if (!user || !isCustomer) {
      setMissingDocTypes([]);
      return;
    }
    type DocRow = { document_type_id?: number | null; approval_status?: string };
    Promise.all([
      api.get<DocumentTypeDto[]>("/document-types").catch(() => null),
      api.get<DocRow[]>("/customers/me/documents").catch(() => null),
    ]).then(([tRes, dRes]) => {
      const types = ((tRes?.data as unknown as DocumentTypeDto[]) || []).filter(
        (t) => t.is_active && t.is_high_priority,
      );
      const docs = (dRes?.data as unknown as DocRow[]) || [];
      // นับว่ายังต้องส่งทั้งกรณีไม่เคยอัปโหลด และกรณีอัปโหลดแล้วไม่ผ่าน — ลูกค้า
      // ต้องลงมืออย่างเดียวกัน ส่วนที่รอตรวจสอบอยู่ถือว่าส่งแล้ว ไม่ต้องเตือนซ้ำ
      const missing = types.filter(
        (t) =>
          !docs.some(
            (d) => d.document_type_id === t.id && d.approval_status !== "rejected",
          ),
      );
      setMissingDocTypes(missing.map((t) => t.name));
    });
  }, [user, isCustomer]);

  const openNews = (item: NewsData) => {
    setSelectedNews(item);
    newsDisc.onOpen();
  };

  // Open a recent-activity row where it actually lives. For a customer that is a
  // bill: finished ones (สำเร็จ/เคลียร์แล้ว) sit in "บิลทั้งหมด", the rest on the
  // sales list for their metal — billId there opens the bill straight away.
  const openRecent = (item: RecentItem) => {
    if (!isCustomer) {
      router.push("/quote-list");
      return;
    }
    if (item.status === 12 || item.status === 14) {
      router.push("/bills/issued");
      return;
    }
    const list = item.metal === "silver" ? "/bills/silver" : "/bills";
    router.push(`${list}?billId=${item.id}`);
  };

  if (loading || !user) return null;

  const creditsValue = stats
    ? stats.my_credits.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  // permissions.includes (not hasPermission) for bills.create — it's a customer-only
  // privilege, not something master should be auto-granted.
  const quickActions = [
    {
      label: "+ ขาย",
      href: "/bills/create",
      icon: <ShoppingBag size={18} />,
      show: permissions.includes("bills.create"),
    },
    {
      label: "สร้างใบเสนอราคา",
      href: "/quotation",
      icon: <FilePlus size={18} />,
      show: hasPermission("quotations.create"),
    },
    {
      label: "รายการขายทอง",
      href: "/bills",
      icon: <Receipt size={18} />,
      show: hasPermission("bills.read"),
    },
    {
      label: "รายการขายเงิน",
      href: "/bills/silver",
      icon: <Receipt size={18} />,
      show: hasPermission("bills.read"),
    },
    {
      label: "ใบเสนอราคา",
      href: "/quote-list",
      icon: <FileText size={18} />,
      show: hasPermission("quotations.read"),
    },
    {
      label: "สมาชิก",
      href: "/members",
      icon: <Users size={18} />,
      show: hasPermission("members.read"),
    },
  ].filter((a) => a.show);

  return (
    <motion.div
      variants={sectionContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-y-2 mt-4 h-full pb-6"
    >
      <motion.div variants={sectionItem} className="flex flex-row gap-x-2 mb-5">
        <Avatar
          src={user.avatar ? `${API_BASE}${user.avatar}` : undefined}
          name={user.name}
          size="lg"
        />
        <div className="flex flex-col">
          <span className="font-bold text-lg text-black">สวัสดี</span>
          <span className="font-bold text-2xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent -mt-2 flex items-center gap-x-1.5">
            {user.name}
            {/* พนักงานไม่มีเอกสารสำคัญ badge จึงขึ้นเฉพาะฝั่งลูกค้า */}
            {isCustomer && <VerifyBadge status={user.verification_status} size={18} />}
          </span>
        </div>
      </motion.div>

      {/* ยืนยันบัญชี — ตั้งใจให้เบา (โทนเทา ไม่ใช่สีเตือน) เพราะยังไม่ส่งเอกสาร
          ก็ขายได้ตามปกติ เป็นคำชวน ไม่ใช่สิ่งกีดขวาง */}
      {missingDocTypes.length > 0 && (
        <motion.div variants={sectionItem} className="mb-3">
          <button
            type="button"
            onClick={() => router.push("/account?tab=docs")}
            className="w-full flex flex-row items-center gap-x-2.5 rounded-2xl border-1 border-black/10 bg-black/[0.03] px-3 py-2 text-left hover:bg-black/[0.07] transition-colors"
          >
            <BadgeCheck size={16} className="text-black/30 shrink-0" />
            <span className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-black/60">ยืนยันบัญชีของคุณ</span>
              <span className="text-[11px] text-black/40 truncate">
                อัปโหลด{missingDocTypes.join(" และ ")}เพื่อยืนยันบัญชี
              </span>
            </span>
            <ChevronRight size={15} className="text-black/25 shrink-0" />
          </button>
        </motion.div>
      )}

      {salesStatus?.enabled && (
        <motion.div variants={sectionItem} className="mb-3">
          <SalesStatusBanner status={salesStatus} showWhenOpen />
        </motion.div>
      )}

      {user.store && (
        <motion.div
          variants={sectionItem}
          className="flex items-center gap-x-2 mb-2 pl-2"
        >
          <span className="text-sm text-black/50">ร้าน:</span>
          <span className="text-sm font-bold text-[#c09c42]">
            {user.store.name}
          </span>
          {user.branch && (
            <>
              <span className="text-sm text-black/50">| สาขา:</span>
              <span className="text-sm font-bold text-[#c09c42]">
                {user.branch.name}
              </span>
            </>
          )}
        </motion.div>
      )}

      {quickActions.length > 0 && (
        <motion.div
          variants={sectionItem}
          className="flex flex-wrap gap-2 mb-2"
        >
          {quickActions.map((a) => (
            <motion.button
              key={a.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(a.href)}
              className="flex items-center gap-x-2 px-4 py-2.5 rounded-2xl border-1 border-black/10 bg-black/5 backdrop-blur-xl hover:bg-black/10 transition-colors"
            >
              <span className="text-[#c09c42]">{a.icon}</span>
              <span className="text-sm font-bold text-black/70">{a.label}</span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Top info row: gold price + credits side by side (only as many as apply) */}
      {(goldPrice || permissions.includes("credits.use")) && (
        <motion.div
          variants={sectionItem}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1"
        >
          {goldPrice && (
            <div className="flex flex-col border-1 border-black/10 bg-gradient-to-br from-black/10 to-transparent backdrop-blur-xl rounded-3xl p-4 gap-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-x-1.5">
                  <TrendingUp size={15} className="text-[#c09c42]" />{" "}
                  ราคาทองคำวันนี้
                </span>
                <div
                  className={`flex items-center gap-x-1 text-xs font-bold ${goldPrice.change_today > 0 ? "text-green-700" : goldPrice.change_today < 0 ? "text-red-600" : "text-black/40"}`}
                >
                  {goldPrice.change_today > 0 ? (
                    <ArrowUp size={12} />
                  ) : goldPrice.change_today < 0 ? (
                    <ArrowDown size={12} />
                  ) : (
                    <Minus size={12} />
                  )}
                  {Math.abs(goldPrice.change_today)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-black/50">
                    รับซื้อ
                  </span>
                  <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {goldPrice.bar_buy.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-black/50">
                    ขายออก
                  </span>
                  <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    {goldPrice.bar_sell.toLocaleString()}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-black/40">
                อัปเดต {goldPrice.gold_date} {goldPrice.gold_time}{" "}
                {goldPrice.gold_round}
              </span>
            </div>
          )}

          {/* credits.use is a constraint, not a privilege — master is never auto-granted it. */}
          {permissions.includes("credits.use") && (
            <BoxCard
              color="bg-gradient-to-tl from-transparent to-yellow-200"
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              title="เครดิตคงเหลือ"
              unit="บาท"
              icon={<Coins size={45} className="text-yellow-600" />}
              value={creditsValue}
              flex
            />
          )}
        </motion.div>
      )}

      <motion.div variants={sectionItem} className="flex flex-col gap-y-2">
        <span className="font-bold text-md text-[#c09c42] pl-2">ภาพรวม</span>
        {isCustomer ? (
          <div className="flex flex-wrap w-full gap-2">
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="บิลที่รอดำเนินการ"
                flex={true}
                unit="บิล"
                value={stats ? String(stats.my_bills_pending) : "—"}
                icon={<Clock size={28} className="text-yellow-600" />}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="บิลที่เสร็จแล้ว"
                flex={true}
                unit="บิล"
                value={stats ? String(stats.my_bills_completed) : "—"}
                icon={<CheckCircle size={28} className="text-yellow-600" />}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap w-full gap-2">
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="ใบเสนอราคาวันนี้"
                flex={true}
                unit="ใบ"
                value={stats ? String(stats.quotations_today) : "—"}
                icon={<FileText size={28} className="text-yellow-600" />}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="รอการอนุมัติ"
                flex={true}
                unit="ใบ"
                value={stats ? String(stats.quotations_pending) : "—"}
                icon={<Clock size={28} className="text-yellow-600" />}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="อนุมัติแล้ว"
                flex={true}
                unit="ใบ"
                value={stats ? String(stats.quotations_approved) : "—"}
                icon={<CheckCircle size={28} className="text-yellow-600" />}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="สมาชิกทั้งหมด"
                flex={true}
                unit="คน"
                value={stats ? String(stats.total_members) : "—"}
                icon={<Users size={28} className="text-yellow-600" />}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <BoxCard
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
                title="ใบเสนอราคาทั้งหมด"
                flex={true}
                unit="ใบ"
                value={stats ? String(stats.total_quotations) : "—"}
                icon={<FileText size={28} className="text-yellow-600" />}
              />
            </div>
          </div>
        )}
      </motion.div>

      {recentItems.length > 0 && (
        <motion.div variants={sectionItem}>
          <div className="flex items-center justify-between mt-2 pl-2 pr-1">
            <span className="font-bold text-md text-[#c09c42]">
              กิจกรรมล่าสุด
            </span>
            <button
              onClick={() => router.push(isCustomer ? "/bills" : "/quote-list")}
              className="text-xs font-bold text-[#c09c42]"
            >
              ดูทั้งหมด →
            </button>
          </div>
          <div className="flex flex-col gap-y-2">
            {recentItems.map((item) => {
              const label = isCustomer
                ? BILL_STATUS_LABEL
                : QUOTATION_STATUS_LABEL;
              const color = isCustomer
                ? BILL_STATUS_COLOR
                : QUOTATION_STATUS_COLOR;
              return (
                <div
                  key={item.id}
                  onClick={() => openRecent(item)}
                  className="flex items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl px-4 py-3 cursor-pointer transition-all hover:bg-black/10 hover:shadow-md"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-black/80">
                      {item.display_code || item.code}
                    </span>
                    <span className="text-[10px] text-black/40">
                      {new Date(item.created_at).toLocaleDateString("th-TH")}
                    </span>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <span className="font-bold text-sm text-yellow-700">
                      {item.total_amount.toLocaleString()} บาท
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-1 ${color[item.status]}`}
                    >
                      {label[item.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div variants={sectionItem} className="flex flex-col gap-y-2 pb-5">
        <span className="font-bold text-md text-[#c09c42] pl-2">ข่าวสาร</span>
        {newsList.length === 0 ? (
          <span className="text-sm text-black/30 pl-2">ยังไม่มีข่าวสาร</span>
        ) : (
          <div className="relative">
            {newsList.length > 1 && (
              <button
                onClick={() => scrollNews(-1)}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 border-1 border-black/10 shadow-md hover:bg-white transition-colors"
              >
                <ChevronLeft size={16} className="text-[#c09c42]" />
              </button>
            )}
            <div
              ref={newsScrollRef}
              className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
            >
              {newsList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openNews(item)}
                  className="flex flex-col w-60 shrink-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
                >
                  <div className="w-full h-36 bg-gradient-to-br from-[#c09c42]/30 to-transparent flex items-center justify-center shrink-0">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${API_BASE}${item.image_url}`}
                        alt={item.title}
                        className="w-full h-full object-cover [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]"
                      />
                    ) : (
                      <Newspaper size={32} className="text-[#c09c42]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-y-1.5 p-4">
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent line-clamp-1">
                      {item.title}
                    </span>
                    <span className="text-xs text-black/50 line-clamp-2">
                      {item.body}
                    </span>
                    <span className="text-xs font-bold text-[#c09c42] mt-1">
                      อ่านเพิ่มเติม →
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {newsList.length > 1 && (
              <button
                onClick={() => scrollNews(1)}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 border-1 border-black/10 shadow-md hover:bg-white transition-colors"
              >
                <ChevronRight size={16} className="text-[#c09c42]" />
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* News detail */}
      <Modal
        isOpen={newsDisc.isOpen}
        onOpenChange={newsDisc.onOpenChange}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {selectedNews?.title}
            </span>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedNews?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}${selectedNews.image_url}`}
                alt={selectedNews.title}
                className="w-full max-h-72 object-cover rounded-2xl"
              />
            )}
            <p className="text-sm text-black/70 whitespace-pre-wrap">
              {selectedNews?.body}
            </p>
            {selectedNews && (
              <span className="text-xs text-black/40">
                {new Date(selectedNews.created_at).toLocaleDateString("th-TH")}
                {selectedNews.creator && ` · โดย ${selectedNews.creator.name}`}
              </span>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
