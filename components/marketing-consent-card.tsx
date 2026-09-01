"use client";

import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface MarketingConsent {
  available: boolean;
  granted: boolean;
  text?: string;
}

// The withdrawal path for the marketing consent offered inside the privacy
// notice. PDPA expects taking a consent back to be as easy as giving it, so it
// is a switch on a page the customer already opens — not a request they have to
// make to the shop and wait on.
//
// Renders nothing when the shop has published no marketing wording, which is
// also how the whole optional consent stays switched off.
export function MarketingConsentCard({ className = "" }: { className?: string }) {
  const [state, setState] = useState<MarketingConsent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<MarketingConsent>("/auth/marketing-consent")
      .then((r) => setState((r.data as unknown as MarketingConsent) ?? null))
      .catch(() => setState(null));
  }, []);

  if (!state?.available) return null;

  const handleToggle = async (granted: boolean) => {
    setSaving(true);
    setError("");
    // Move the switch straight away — waiting on the round trip makes a toggle
    // feel like it ignored the tap.
    setState((prev) => (prev ? { ...prev, granted } : prev));
    try {
      const res = await api.put<MarketingConsent>("/auth/marketing-consent", { granted });
      setState((res.data as unknown as MarketingConsent) ?? null);
    } catch (err: unknown) {
      setState((prev) => (prev ? { ...prev, granted: !granted } : prev));
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 ${className}`}>
      <div className="flex flex-row items-center gap-x-2">
        <span className="text-[#c09c42]"><MessageCircle size={18} /></span>
        <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
          การรับข่าวสารและโปรโมชัน
        </span>
      </div>

      <div className="flex flex-row items-start justify-between gap-x-4">
        <span className="text-xs text-black/60 leading-relaxed flex-1">
          {state.text}
        </span>
        <div className="flex items-center gap-x-2 shrink-0 pt-0.5">
          {saving && <Spinner size="sm" color="warning" />}
          <Switch
            size="sm"
            color="warning"
            isSelected={state.granted}
            onValueChange={handleToggle}
            aria-label="ยินยอมรับข่าวสารและโปรโมชัน"
          />
        </div>
      </div>

      <span className="text-[10px] text-black/40">
        {state.granted
          ? "ปิดสวิตช์เมื่อใดก็ได้ ร้านจะหยุดติดต่อเพื่อการตลาดทันที การซื้อขายและเอกสารตามกฎหมายไม่เกี่ยวข้องกับการตั้งค่านี้"
          : "ยังไม่ได้ยินยอม ร้านจะติดต่อเฉพาะเรื่องที่เกี่ยวกับธุรกรรมของท่านเท่านั้น"}
      </span>

      {error && (
        <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
