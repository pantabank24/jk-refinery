"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { BoxCard } from "@/components/boxcard";
import { ArrowUp, ArrowDown, Minus, RefreshCw, Pencil } from "lucide-react";

// Format a Date for a <input type="datetime-local"> (local time, no seconds).
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface MetalPrice {
  id: number;
  symbol: string;
  buy: number;
  sell: number;
  spot: number;
  exchange: number;
  previous: number;
  change_today: number;
  price_date: string;
  price_time: string;
  round: string;
  source: string;
  valid_until?: string | null;
  created_at: string;
}

export default function SilverPricePage() {
  const { hasPermission } = useAuth();
  const [latest, setLatest] = useState<MetalPrice | null>(null);
  const [history, setHistory] = useState<MetalPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Manual entry (fallback when the auto feed is offline)
  const manualDisc = useDisclosure();
  const [mBuy, setMBuy] = useState("");
  const [mSell, setMSell] = useState("");
  const [mSpot, setMSpot] = useState("");
  const [mFrom, setMFrom] = useState("");
  const [mUntil, setMUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.get<MetalPrice>("/metal-prices/latest?symbol=XAG"),
        api.get<MetalPrice[]>("/metal-prices/history?symbol=XAG&limit=20"),
      ]);
      setLatest((latestRes.data as unknown as MetalPrice) || null);
      setHistory((historyRes.data as unknown as MetalPrice[]) || []);
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
      await api.post("/metal-prices/fetch", {});
      await fetchData();
    } catch { /* ignore */ } finally {
      setFetching(false);
    }
  };

  const openManual = () => {
    setMBuy(latest ? String(latest.buy) : "");
    setMSell(latest ? String(latest.sell) : "");
    setMSpot(latest ? String(latest.spot) : "");
    setMFrom(toLocalInput(new Date()));
    setMUntil(toLocalInput(new Date(Date.now() + 4 * 3600 * 1000)));
    manualDisc.onOpen();
  };

  const handleManualSave = async () => {
    if (!mFrom || !mUntil) return;
    setSaving(true);
    try {
      await api.post("/metal-prices/manual", {
        symbol: "XAG",
        buy: parseFloat(mBuy) || 0,
        sell: parseFloat(mSell) || 0,
        spot: parseFloat(mSpot) || 0,
        valid_from: new Date(mFrom).toISOString(),
        valid_until: new Date(mUntil).toISOString(),
      });
      manualDisc.onClose();
      await fetchData();
    } catch { /* ignore */ } finally {
      setSaving(false);
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
          <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent pl-2">
            ราคาเงิน
          </div>
          {latest && (
            <span className="text-xs text-black/40 pl-2">
              อัปเดท: {latest.price_date} {latest.price_time}{latest.round ? ` (รอบ ${latest.round})` : ""}
            </span>
          )}
          {latest?.source === "manual" && latest.valid_until && (
            <span className="text-xs font-bold text-amber-600 pl-2">
              ⚙ ราคากำหนดเอง · ใช้ถึง {new Date(latest.valid_until).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </div>
        {hasPermission("metal_prices.create") && (
          <div className="flex flex-row gap-x-2">
            <Button
              className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
              startContent={<Pencil size={15} />}
              size="md"
              onPress={openManual}
            >
              <div className="bg-gradient-to-r from-black/90 to-slate-500 bg-clip-text text-transparent">
                กรอกราคาเอง
              </div>
            </Button>
            <Button
              className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
              startContent={<RefreshCw size={15} />}
              size="md"
              isLoading={fetching}
              onPress={handleFetch}
            >
              <div className="bg-gradient-to-r from-black/90 to-slate-500 bg-clip-text text-transparent">
                ดึงอัตโนมัติ
              </div>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1"><Spinner size="lg" /></div>
      ) : latest ? (
        <>
          {/* Current price cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <BoxCard
              title="รับซื้อ"
              value={latest.buy.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="ขาย"
              value={latest.sell.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="Spot"
              value={latest.spot.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent"
              flex
            />
            <BoxCard
              title="ก่อนหน้า"
              value={latest.previous.toLocaleString()}
              textColor="bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent"
              flex
            />
          </div>

          {/* Change indicator */}
          <div className="grid grid-cols-1 gap-3 shrink-0">
            <div className="flex flex-row items-center gap-x-2 border-1 border-black/10 bg-black/5 rounded-2xl p-3">
              <ChangeIcon value={latest.change_today} />
              <div className="flex flex-col">
                <span className="text-xs text-black/50">เปลี่ยนแปลงวันนี้</span>
                <span className={`font-bold text-sm ${changeColor(latest.change_today)}`}>
                  {latest.change_today > 0 ? "+" : ""}{latest.change_today.toLocaleString()} บาท
                </span>
              </div>
            </div>
          </div>

          {/* History table */}
          {hasPermission("metal_prices.read") && history.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="px-5 pt-4 pb-2 shrink-0">
                <span className="font-bold text-md bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent">
                  ประวัติราคาเงิน
                </span>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                    <tr className="text-black/50">
                      <th className="text-left px-4 py-2">วันที่</th>
                      <th className="text-right px-4 py-2">รับซื้อ</th>
                      <th className="text-right px-4 py-2">ขาย</th>
                      <th className="text-right px-4 py-2">Spot</th>
                      <th className="text-right px-4 py-2">ที่มา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-t border-black/5 hover:bg-black/5">
                        <td className="px-4 py-2 text-black/60">
                          {row.price_date} {row.price_time}
                        </td>
                        <td className="px-4 py-2 text-right font-bold">{row.buy.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold">{row.sell.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold">{row.spot.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-black/50">{row.source === "manual" ? "กรอกมือ" : "อัตโนมัติ"}</td>
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
          <span>ยังไม่มีข้อมูลราคาเงิน</span>
          {hasPermission("metal_prices.create") && (
            <Button
              className="bg-gradient-to-r from-slate-500 to-slate-700 text-white font-bold rounded-2xl"
              startContent={<Pencil size={15} />}
              onPress={openManual}
            >
              กรอกราคาเงินเอง
            </Button>
          )}
        </div>
      )}

      {/* Manual entry modal */}
      <Modal isOpen={manualDisc.isOpen} onClose={manualDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-slate-500 bg-clip-text text-transparent">
              กรอกราคาเงินเอง
            </span>
          </ModalHeader>
          <ModalBody className="gap-y-3">
            <p className="text-xs text-black/40">ราคาต่อหน่วยตามที่ใช้ในสูตร (เงินแท่งใช้ค่า “รับซื้อ” แล้วหารด้วย 1000 ในสูตร)</p>
            <Input type="number" label="รับซื้อ" value={mBuy} onValueChange={setMBuy}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
            <Input type="number" label="ขาย" value={mSell} onValueChange={setMSell}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
            <Input type="number" label="Spot" value={mSpot} onValueChange={setMSpot}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="datetime-local" label="ใช้ตั้งแต่" value={mFrom} onValueChange={setMFrom}
                classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
              <Input type="datetime-local" label="ถึง" value={mUntil} onValueChange={setMUntil}
                classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
            </div>
            <p className="text-xs text-black/40">หมดช่วงเวลานี้แล้ว ระบบจะกลับไปใช้ราคาดึงอัตโนมัติ</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={manualDisc.onClose} isDisabled={saving}>ยกเลิก</Button>
            <Button
              className="bg-gradient-to-r from-slate-500 to-slate-700 text-white font-bold"
              isLoading={saving}
              onPress={handleManualSave}
            >
              บันทึก
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
