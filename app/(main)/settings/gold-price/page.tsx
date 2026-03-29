"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, RefreshCw } from "lucide-react";

interface GoldPrice {
  id: number;
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
  change_today: number;
  change_yesterday: number;
  gold_date: string;
  gold_time: string;
  gold_round: string;
  created_at: string;
}

export default function GoldPricePage() {
  const { hasPermission } = useAuth();
  const [latest, setLatest] = useState<GoldPrice | null>(null);
  const [history, setHistory] = useState<GoldPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const fetchData = async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.get<GoldPrice>("/gold-prices/latest"),
        api.get<GoldPrice[]>("/gold-prices/history?limit=20"),
      ]);
      setLatest((latestRes.data as unknown as GoldPrice) || null);
      setHistory((historyRes.data as unknown as GoldPrice[]) || []);
    } catch {
      setLatest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFetch = async () => {
    setFetching(true);
    try {
      await api.post("/gold-prices/fetch", {});
      await fetchData();
    } catch { /* ignore */ } finally {
      setFetching(false);
    }
  };

  const ChangeIcon = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUp size={14} className="text-green-600" />;
    if (value < 0) return <ArrowDown size={14} className="text-red-600" />;
    return <Minus size={14} className="text-black/40" />;
  };

  const changeColor = (v: number) =>
    v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-black/40";

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex flex-col">
          <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
            ราคาทองคำ
          </div>
          {latest && (
            <span className="text-xs text-black/40 pl-2">
              อัปเดท: {latest.gold_date} {latest.gold_time} (รอบ {latest.gold_round})
            </span>
          )}
        </div>
        {hasPermission("gold_prices.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<RefreshCw size={15} />}
            size="md"
            isLoading={fetching}
            onPress={handleFetch}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              ดึงราคาทอง
            </div>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1"><Spinner size="lg" color="warning" /></div>
      ) : latest ? (
        <>
          {/* Current price cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <BoxCard
              title="รับซื้อทองแท่ง"
              value={latest.bar_buy.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="ขายทองแท่ง"
              value={latest.bar_sell.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="รับซื้อทองรูปพรรณ"
              value={latest.ornament_buy.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="ขายทองรูปพรรณ"
              value={latest.ornament_sell.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
              flex
            />
          </div>

          {/* Change indicators */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="flex flex-row items-center gap-x-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
              <ChangeIcon value={latest.change_today} />
              <div className="flex flex-col">
                <span className="text-xs text-black/50">เปลี่ยนแปลงวันนี้</span>
                <span className={`font-bold text-sm ${changeColor(latest.change_today)}`}>
                  {latest.change_today > 0 ? "+" : ""}{latest.change_today.toLocaleString()} บาท
                </span>
              </div>
            </div>
            <div className="flex flex-row items-center gap-x-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
              <ChangeIcon value={latest.change_yesterday} />
              <div className="flex flex-col">
                <span className="text-xs text-black/50">เปลี่ยนแปลงเมื่อวาน</span>
                <span className={`font-bold text-sm ${changeColor(latest.change_yesterday)}`}>
                  {latest.change_yesterday > 0 ? "+" : ""}{latest.change_yesterday.toLocaleString()} บาท
                </span>
              </div>
            </div>
          </div>

          {/* History table */}
          {hasPermission("gold_prices.read") && history.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="px-5 pt-4 pb-2 shrink-0">
                <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  ประวัติราคาทอง
                </span>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                    <tr className="text-black/50">
                      <th className="text-left px-4 py-2">วันที่</th>
                      <th className="text-right px-4 py-2">รับซื้อแท่ง</th>
                      <th className="text-right px-4 py-2">ขายแท่ง</th>
                      <th className="text-right px-4 py-2">รับซื้อรูปพรรณ</th>
                      <th className="text-right px-4 py-2">ขายรูปพรรณ</th>
                      <th className="text-right px-4 py-2">เปลี่ยนแปลง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-t border-black/5 hover:bg-black/5">
                        <td className="px-4 py-2 text-black/60">
                          {row.gold_date} {row.gold_time}
                        </td>
                        <td className="px-4 py-2 text-right font-bold">{row.bar_buy.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold">{row.bar_sell.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold">{row.ornament_buy.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold">{row.ornament_sell.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-bold ${changeColor(row.change_today)}`}>
                          {row.change_today > 0 ? "+" : ""}{row.change_today}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-y-3 text-black/40">
          <span>ยังไม่มีข้อมูลราคาทอง</span>
          {hasPermission("gold_prices.create") && (
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl"
              startContent={<RefreshCw size={15} />}
              isLoading={fetching}
              onPress={handleFetch}
            >
              ดึงราคาทองเลย
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
