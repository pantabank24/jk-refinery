"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Save, ChevronRight, Tag } from "lucide-react";
import Link from "next/link";

interface SystemConfig {
  key: string;
  value: string;
  description: string;
}

export default function ConfigPage() {
  const { hasPermission } = useAuth();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const fetchConfigs = async () => {
    try {
      const res = await api.get<SystemConfig[]>("/configs");
      const list = (res.data as unknown as SystemConfig[]) || [];
      setConfigs(list);
      const map: Record<string, string> = {};
      list.forEach((c) => { map[c.key] = c.value; });
      setValues(map);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all(
        Object.entries(values).map(([key, value]) =>
          api.put("/configs", { key, value })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const autoFetch = values["gold_price_auto_fetch"] === "true";
  const cronExpr = values["gold_price_cron"] || "";

  // Keys rendered by dedicated sections / the sales-price page (excluded here).
  const HANDLED_KEYS = [
    "gold_price_auto_fetch", "gold_price_cron",
    "sales_hours_enabled", "sales_open_time", "sales_close_time",
    "sales_enabled", "sales_realtime_after_hours",
  ];

  const CRON_PRESETS = [
    { label: "ทุก 15 นาที", value: "*/15 * * * *" },
    { label: "ทุก 30 นาที", value: "*/30 * * * *" },
    { label: "ทุก ชั่วโมง", value: "0 * * * *" },
    { label: "ทุก 2 ชั่วโมง", value: "0 */2 * * *" },
    { label: "วันละครั้ง 9:00", value: "0 9 * * *" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ตั้งค่าระบบ
        </div>
        {hasPermission("config.update") && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-3xl shadow-md"
            startContent={<Save size={15} />}
            isLoading={saving}
            onPress={handleSave}
          >
            {saved ? "บันทึกแล้ว ✓" : "บันทึก"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-y-4 overflow-y-auto pb-4">
        {/* Gold price cron section */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-4">
          <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            ดึงราคาทองอัตโนมัติ
          </span>

          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm">เปิดใช้งาน Auto Fetch</span>
              <span className="text-xs text-black/50">ระบบจะดึงราคาทองตามเวลาที่กำหนด</span>
            </div>
            <Switch
              isDisabled={!hasPermission("config.update")}
              isSelected={autoFetch}
              color="warning"
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, gold_price_auto_fetch: v ? "true" : "false" }))
              }
            />
          </div>

          {autoFetch && (
            <div className="flex flex-col gap-y-3">
              <Input
                label="Cron Expression"
                placeholder="*/30 * * * *"
                value={cronExpr}
                isDisabled={!hasPermission("config.update")}
                onValueChange={(v) => setValues((prev) => ({ ...prev, gold_price_cron: v }))}
                description="รูปแบบ: นาที ชั่วโมง วัน เดือน วันสัปดาห์"
                classNames={{
                  inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                }}
              />

              <div className="flex flex-col gap-y-2">
                <span className="text-xs text-black/50">ตัวอย่างที่พบบ่อย:</span>
                <div className="flex flex-wrap gap-2">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      disabled={!hasPermission("config.update")}
                      onClick={() =>
                        setValues((prev) => ({ ...prev, gold_price_cron: preset.value }))
                      }
                      className={`text-xs px-3 py-1.5 rounded-xl border-1 transition-all ${
                        cronExpr === preset.value
                          ? "bg-yellow-500/30 border-yellow-500/50 font-bold"
                          : "bg-black/5 border-black/10 hover:bg-black/10"
                      }`}
                    >
                      {preset.label}
                      <span className="ml-1 text-black/40">({preset.value})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sales price settings — opens a dedicated page */}
        <Link
          href="/settings/sales-price"
          className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 hover:bg-black/10 transition-colors backdrop-blur-xl rounded-3xl p-5"
        >
          <div className="flex flex-row items-center gap-x-3">
            <span className="text-[#c09c42]"><Tag size={20} /></span>
            <div className="flex flex-col">
              <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                ตั้งค่าราคาขาย
              </span>
              <span className="text-xs text-black/50">
                เปิด/ปิดการขาย · เวลาสมาคม · ราคาเรียลไทม์ · ตารางเวลาล่วงหน้า
              </span>
            </div>
          </div>
          <ChevronRight size={20} className="text-black/40" />
        </Link>

        {/* Other configs */}
        {configs
          .filter((c) => !HANDLED_KEYS.includes(c.key))
          .map((cfg) => (
            <div
              key={cfg.key}
              className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3"
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm">{cfg.key}</span>
                {cfg.description && (
                  <span className="text-xs text-black/50">{cfg.description}</span>
                )}
              </div>
              <Input
                value={values[cfg.key] || ""}
                isDisabled={!hasPermission("config.update")}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [cfg.key]: v }))}
                classNames={{
                  inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
