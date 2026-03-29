"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ArrowLeft, Save, Trash } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Switch } from "@heroui/switch";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";

export default function EditBranchPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const branchId = params.branchId as string;
  const { hasPermission } = useAuth();

  if (!hasPermission("branches.update")) {
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
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ name: string; address: string; phone: string; is_active: boolean }>(`/stores/${storeId}/branches/${branchId}`).then((res) => {
      const data = res.data as unknown as { name: string; address: string; phone: string; is_active: boolean };
      if (data) {
        setName(data.name);
        setAddress(data.address);
        setPhone(data.phone);
        setIsActive(data.is_active);
      }
    });
  }, [storeId, branchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.put(`/stores/${storeId}/branches/${branchId}`, { name, address, phone, is_active: isActive });
      router.push(`/stores/${storeId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "แก้ไขสาขาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("ต้องการลบสาขานี้หรือไม่?")) return;
    try {
      await api.delete(`/stores/${storeId}/branches/${branchId}`);
      router.push(`/stores/${storeId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบสาขาไม่สำเร็จ");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex items-center gap-x-3">
          <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
          <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            แก้ไขสาขา
          </div>
        </div>
        {hasPermission("branches.delete") && (
          <Button color="danger" variant="light" startContent={<Trash size={16} />} onPress={handleDelete}>
            ลบสาขา
          </Button>
        )}
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อสาขา" value={name} onValueChange={setName}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} isRequired />
          <Textarea label="ที่อยู่" value={address} onValueChange={setAddress}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <Input label="เบอร์โทร" value={phone} onValueChange={setPhone}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <Switch isSelected={isActive} onValueChange={setIsActive}>
            <span className="text-sm">{isActive ? "เปิดให้บริการ" : "ปิดให้บริการ"}</span>
          </Switch>

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <Button type="submit" isLoading={loading}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg" startContent={!loading && <Save size={18} />}>
            บันทึก
          </Button>
        </form>
      </div>
    </div>
  );
}
