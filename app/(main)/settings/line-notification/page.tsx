"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { MessageCircle, Save, CheckCircle2, XCircle, RefreshCw, Unlink } from "lucide-react";

interface LineStatus {
  line_notify_enabled: string;
  line_notify_target_id: string;
  line_bill_notify_threshold: string;
  token_set: boolean;
  oa_basic_id: string;
}

export default function LineNotificationPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("config.read");
  const canUpdate = hasPermission("config.update");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const [status, setStatus] = useState<LineStatus>({
    line_notify_enabled: "false",
    line_notify_target_id: "",
    line_bill_notify_threshold: "5",
    token_set: false,
    oa_basic_id: "",
  });

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  const fetchStatus = useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await api.get("/line/status");
      setStatus(res.data as unknown as LineStatus);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        api.put("/configs", { key: "line_notify_enabled", value: status.line_notify_enabled }),
        api.put("/configs", { key: "line_bill_notify_threshold", value: status.line_bill_notify_threshold }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await api.post("/line/unlink", {});
      await fetchStatus();
    } catch { /* ignore */ } finally {
      setUnlinking(false);
    }
  };

  const isLinked = !!status.line_notify_target_id;
  const addFriendUrl = status.oa_basic_id
    ? `https://line.me/R/ti/p/@${status.oa_basic_id.replace(/^@/, "")}`
    : null;

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col h-full gap-y-4 pt-5 px-1 overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-x-3 shrink-0">
        <MessageCircle size={22} className="text-[#c09c42]" />
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          การแจ้งเตือน LINE
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
      ) : (
        <div className="flex flex-col gap-y-4 max-w-lg">

          {/* Token status */}
          <div className={`flex items-center gap-x-3 border-1 rounded-2xl p-3 ${status.token_set ? "border-green-200 bg-green-50/60" : "border-red-200 bg-red-50/60"}`}>
            {status.token_set
              ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              : <XCircle size={18} className="text-red-500 shrink-0" />
            }
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${status.token_set ? "text-green-700" : "text-red-600"}`}>
                {status.token_set ? "Channel Access Token พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า Channel Access Token"}
              </span>
              <span className="text-xs text-black/40">
                ตั้งค่าใน .env: <code className="bg-black/5 px-1 rounded">LINE_CHANNEL_ACCESS_TOKEN</code> และ <code className="bg-black/5 px-1 rounded">LINE_CHANNEL_SECRET</code>
              </span>
            </div>
          </div>

          {/* Add friend / scan QR */}
          <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-black/70">เชื่อมต่อ LINE</span>
              <button onClick={fetchStatus} className="text-black/30 hover:text-black/60 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>

            {isLinked ? (
              <div className="flex flex-col gap-y-2">
                <div className="flex items-center gap-x-2 bg-green-50 border-1 border-green-200 rounded-xl px-3 py-2">
                  <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-green-700">เชื่อมต่อแล้ว</span>
                    <span className="text-[11px] text-black/50 truncate font-mono">{status.line_notify_target_id}</span>
                  </div>
                </div>
                {canUpdate && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    startContent={<Unlink size={13} />}
                    onPress={handleUnlink}
                    isLoading={unlinking}
                    className="self-start"
                  >
                    ยกเลิกการเชื่อมต่อ
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-y-3">
                <div className="flex items-center gap-x-2 bg-yellow-50 border-1 border-yellow-200 rounded-xl px-3 py-2">
                  <XCircle size={16} className="text-yellow-600 shrink-0" />
                  <span className="text-xs text-yellow-700 font-bold">ยังไม่ได้เชื่อมต่อ</span>
                </div>

                <div className="flex flex-col gap-y-1">
                  <span className="text-xs text-black/50 font-bold">วิธีเชื่อมต่อ</span>
                  <ol className="text-xs text-black/60 list-decimal list-inside space-y-1">
                    <li>กด &quot;เพิ่มเพื่อน&quot; หรือสแกน QR Code ด้านล่าง</li>
                    <li>ระบบจะบันทึก ID ของคุณอัตโนมัติเมื่อ follow</li>
                    <li>กด refresh เพื่อตรวจสอบสถานะ</li>
                  </ol>
                  <span className="text-[10px] text-black/35 mt-1">
                    หรือ invite bot เข้ากลุ่ม — จะรับแจ้งเตือนในกลุ่มแทน
                  </span>
                </div>

                {addFriendUrl ? (
                  <div className="flex flex-col items-center gap-y-3 py-2">
                    {/* QR image from LINE official */}
                    <img
                      src={`https://qr-official.line.me/gs/M/${status.oa_basic_id.replace(/^@/, "")}_256.png`}
                      alt="LINE QR Code"
                      className="w-36 h-36 rounded-xl border-1 border-black/10"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <a
                      href={addFriendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-x-2 bg-[#06C755] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#05b54d] transition-colors"
                    >
                      <MessageCircle size={16} />
                      เพิ่มเพื่อนใน LINE
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-black/40 bg-black/5 rounded-xl p-3">
                    ตั้งค่า <code className="bg-black/10 px-1 rounded">LINE_OA_BASIC_ID</code> ใน .env เพื่อแสดง QR Code
                    <br />เช่น <code className="bg-black/10 px-1 rounded">LINE_OA_BASIC_ID=@shopname</code>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enable toggle */}
          <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <span className="font-bold text-sm text-black/70">ตั้งค่าการแจ้งเตือน</span>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold">เปิดใช้งานการแจ้งเตือน</span>
                <span className="text-xs text-black/40">ส่งข้อความเมื่อบิลค้างถึงจำนวนที่กำหนด</span>
              </div>
              <Switch
                isSelected={status.line_notify_enabled === "true"}
                isDisabled={!canUpdate || !isLinked}
                onValueChange={(v) => setStatus((p) => ({ ...p, line_notify_enabled: v ? "true" : "false" }))}
                color="success"
              />
            </div>
          </div>

          {/* Threshold */}
          <div className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
            <span className="font-bold text-sm text-black/70">เกณฑ์การแจ้งเตือนบิล</span>
            <Input
              type="number"
              label="จำนวนบิล (รอเคลียร์) ที่จะแจ้งเตือน"
              placeholder="5"
              value={status.line_bill_notify_threshold}
              isDisabled={!canUpdate}
              onValueChange={(v) => setStatus((p) => ({ ...p, line_bill_notify_threshold: v }))}
              description="แจ้งเตือนทุกครั้งที่อนุมัติบิล และยอดสะสมถึงหรือเกินจำนวนนี้ ใส่ 0 เพื่อปิด"
              classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10" }}
            />
          </div>

          {/* Webhook URL hint */}
          <div className="flex flex-col border-1 border-blue-200 bg-blue-50/60 rounded-2xl p-3 gap-y-1">
            <span className="text-xs font-bold text-blue-700">Webhook URL</span>
            <span className="text-xs text-black/50">
              ตั้งค่าใน LINE Developer Console:
            </span>
            <code className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-lg break-all">
              https://yourdomain.com/api/v1/line/webhook
            </code>
          </div>

          {canUpdate && (
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold self-end"
              startContent={<Save size={14} />}
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!isLinked && status.line_notify_enabled === "true"}
            >
              {saved ? "บันทึกแล้ว ✓" : "บันทึก"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
