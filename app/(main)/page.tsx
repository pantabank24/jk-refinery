"use client";

import { Coins, FileText, Clock, CheckCircle, Users } from "lucide-react";
import { BoxCard } from "@/components/boxcard";
import { Avatar } from "@heroui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSalesStatus } from "@/hooks/use-sales-status";
import { SalesStatusBanner } from "@/components/sales-status-banner";

interface DashboardStats {
  my_credits: number;
  quotations_today: number;
  quotations_pending: number;
  quotations_approved: number;
  total_members: number;
  total_quotations: number;
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { status: salesStatus } = useSalesStatus();

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
  }, [user]);

  if (loading || !user) return null;

  const creditsValue = stats
    ? stats.my_credits.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  return (
    <div className="flex flex-col gap-y-2 mt-4">
      <div className="flex flex-row gap-x-2 mb-5">
        <Avatar name={user.name} size="lg" />
        <div className="flex flex-col">
          <span className="font-bold text-lg text-black">สวัสดี</span>
          <span className="font-bold text-2xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent -mt-2">
            {user.name}
          </span>
        </div>
      </div>

      {salesStatus?.enabled && (
        <div className="mb-3">
          <SalesStatusBanner status={salesStatus} showWhenOpen />
        </div>
      )}

      {user.store && (
        <div className="flex items-center gap-x-2 mb-2 pl-2">
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
        </div>
      )}

      <BoxCard
        color="bg-gradient-to-tl from-transparent to-yellow-200"
        textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
        title="เครดิตคงเหลือ"
        unit="บาท"
        icon={<Coins size={45} className="text-yellow-600" />}
        value={creditsValue}
      />

      <span className="font-bold text-md text-[#c09c42] mt-2 pl-2">ภาพรวม</span>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 w-full gap-2">
        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          title="ใบเสนอราคาวันนี้"
          flex={true}
          unit="ใบ"
          value={stats ? String(stats.quotations_today) : "—"}
          icon={<FileText size={28} className="text-yellow-600" />}
        />
        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          title="รอการอนุมัติ"
          flex={true}
          unit="ใบ"
          value={stats ? String(stats.quotations_pending) : "—"}
          icon={<Clock size={28} className="text-yellow-600" />}
        />
        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          title="อนุมัติแล้ว"
          flex={true}
          unit="ใบ"
          value={stats ? String(stats.quotations_approved) : "—"}
          icon={<CheckCircle size={28} className="text-yellow-600" />}
        />
        <BoxCard
          textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
          title="สมาชิกทั้งหมด"
          flex={true}
          unit="คน"
          value={stats ? String(stats.total_members) : "—"}
          icon={<Users size={28} className="text-yellow-600" />}
        />
      </div>

      <span className="font-bold text-md text-[#c09c42] mt-2 pl-2">ข่าวสาร</span>
    </div>
  );
}
