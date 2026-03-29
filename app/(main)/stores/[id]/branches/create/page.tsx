"use client";

import { useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";

export default function CreateBranchPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const { hasPermission } = useAuth();

  if (!hasPermission("branches.create")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return setError("กรุณากรอกชื่อสาขา");
    setError("");
    setLoading(true);
    try {
      await api.post(`/stores/${storeId}/branches`, { name, address, phone });
      router.push(`/stores/${storeId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "สร้างสาขาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          สร้างสาขาใหม่
        </div>
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อสาขา" placeholder="กรอกชื่อสาขา" value={name} onValueChange={setName}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} isRequired />
          <Textarea label="ที่อยู่สาขา" placeholder="กรอกที่อยู่" value={address} onValueChange={setAddress}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <Input label="เบอร์โทร" placeholder="กรอกเบอร์โทร" value={phone} onValueChange={setPhone}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <Button type="submit" isLoading={loading}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg" startContent={!loading && <Save size={18} />}>
            สร้างสาขา
          </Button>
        </form>
      </div>
    </div>
  );
}
