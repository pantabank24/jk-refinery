"use client";

import { SkeletonList } from "@/components/skeleton";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { ShieldCheck, Save, AlertTriangle } from "lucide-react";

interface SystemConfig { key: string; value: string; description: string; }

const TEXT_KEY = "pdpa_consent_text";
const VERSION_KEY = "pdpa_consent_version";
const MARKETING_KEY = "pdpa_marketing_text";

const inputStyle =
  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

export default function PdpaSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("config.update");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [text, setText] = useState("");
  const [version, setVersion] = useState("1");
  // What is live right now, so the page can say whether this edit will re-ask.
  const [marketing, setMarketing] = useState("");
  const [savedText, setSavedText] = useState("");
  const [savedVersion, setSavedVersion] = useState("1");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<SystemConfig[]>("/configs");
        const list = (res.data as unknown as SystemConfig[]) || [];
        const map: Record<string, string> = {};
        list.forEach((c) => { map[c.key] = c.value; });
        setText(map[TEXT_KEY] ?? "");
        setSavedText(map[TEXT_KEY] ?? "");
        setVersion(map[VERSION_KEY] ?? "1");
        setSavedVersion(map[VERSION_KEY] ?? "1");
        setMarketing(map[MARKETING_KEY] ?? "");
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        api.put("/configs", { key: TEXT_KEY, value: text }),
        api.put("/configs", { key: VERSION_KEY, value: version }),
        api.put("/configs", { key: MARKETING_KEY, value: marketing }),
      ]);
      setSavedText(text);
      setSavedVersion(version);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  // Editing the wording without bumping the version leaves everyone who already
  // accepted holding consent to text that no longer exists — the one mistake
  // this page is here to catch.
  const textChanged = text.trim() !== savedText.trim();
  const versionChanged = version.trim() !== savedVersion.trim();
  const needsBump = textChanged && !versionChanged;

  if (loading) {
    return (
      <SkeletonList rows={6} />
    );
  }

  return (
    <div className="flex flex-col md:h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex flex-row items-center gap-x-2 pl-2">
          <span className="text-[#c09c42]"><ShieldCheck size={22} /></span>
          <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            ประกาศความเป็นส่วนตัว
          </div>
        </div>
        {canEdit && (
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

      <div className="flex flex-col gap-y-4 md:overflow-y-auto pb-4">
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-4">
          <div className="flex flex-col">
            <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              ประกาศที่ลูกค้าต้องกดรับทราบ
            </span>
            <span className="text-xs text-black/50">
              แสดงตอนลูกค้าเข้าระบบ ปิดหน้าต่างไม่ได้จนกว่าจะกดรับทราบ ·
              เว้นว่างไว้ = ปิดการบังคับทั้งหมด
            </span>
          </div>

          <Textarea
            label="ข้อความประกาศ"
            value={text}
            minRows={10}
            isDisabled={!canEdit}
            onValueChange={setText}
            description="ขึ้นบรรทัดใหม่และเว้นบรรทัดว่างเพื่อแยกย่อหน้าได้ ระบบแสดงตามที่พิมพ์"
            classNames={{ inputWrapper: inputStyle }}
          />

          <Input
            type="number"
            label="เวอร์ชันข้อความ"
            value={version}
            isDisabled={!canEdit}
            onValueChange={setVersion}
            description="บวกเลขนี้เมื่อแก้ข้อความ แล้วลูกค้าทุกคนจะถูกถามให้ยอมรับใหม่"
            classNames={{ inputWrapper: inputStyle }}
          />

          {needsBump && (
            <div className="flex flex-row items-start gap-x-2 bg-amber-50 border-1 border-amber-200 rounded-2xl px-3 py-2.5">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span className="text-xs font-bold text-amber-700">
                แก้ข้อความแล้วแต่ยังไม่ได้บวกเวอร์ชัน — ลูกค้าที่ยอมรับไปแล้วจะไม่ถูกถามใหม่
                และหลักฐานเดิมจะอ้างถึงข้อความที่ไม่มีอยู่แล้ว
                ถ้าตั้งใจแก้แค่คำผิดก็บันทึกได้เลย
              </span>
            </div>
          )}
        </div>

        {/* The one thing on this screen that really is a consent, and therefore
            the one thing that must be refusable. */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-4">
          <div className="flex flex-col">
            <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              ความยินยอมรับข่าวสาร (ไม่บังคับ)
            </span>
            <span className="text-xs text-black/50">
              ไม่แสดงในหน้าต่างที่ปิดไม่ได้ — ลูกค้าเปิด/ปิดเองได้ที่หน้าโปรไฟล์ ·
              เว้นว่างไว้ = ซ่อนหัวข้อนี้จากหน้าโปรไฟล์ไปเลย
            </span>
          </div>

          <Textarea
            label="ข้อความยินยอมรับข่าวสาร"
            value={marketing}
            minRows={3}
            isDisabled={!canEdit}
            onValueChange={setMarketing}
            description="เว้นว่างถ้ายังไม่ต้องการขอความยินยอมด้านการตลาด"
            classNames={{ inputWrapper: inputStyle }}
          />
        </div>

        {/* Preview — the same pre-line box the modal renders, so what is typed
            here is what the customer reads. */}
        <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
          <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            ตัวอย่างที่ลูกค้าเห็น
          </span>
          {text.trim() === "" ? (
            <div className="text-sm text-black/40 py-4 text-center">
              ยังไม่มีข้อความ — ลูกค้าจะไม่ถูกขอให้รับทราบ
            </div>
          ) : (
            <div className="border-1 border-black/10 bg-white/60 rounded-2xl p-4 text-sm text-black/70 leading-relaxed whitespace-pre-line">
              {text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
