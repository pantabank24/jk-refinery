"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Switch } from "@heroui/switch";
import { useDisclosure } from "@heroui/modal";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

export default function EditStorePage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const { hasPermission } = useAuth();

  if (!hasPermission("stores.update")) {
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
  const [isMain, setIsMain] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const delDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/stores/${storeId}`);
      router.push("/stores");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบร้านไม่สำเร็จ");
      delDisc.onClose();
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    api.get<{ name: string; address: string; phone: string; is_main: boolean; is_active: boolean }>(`/stores/${storeId}`).then((res) => {
      const data = res.data as unknown as { name: string; address: string; phone: string; is_main: boolean; is_active: boolean };
      if (data) {
        setName(data.name);
        setAddress(data.address);
        setPhone(data.phone);
        setIsMain(!!data.is_main);
        setIsActive(data.is_active);
      }
    });
  }, [storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.put(`/stores/${storeId}`, { name, address, phone, is_main: isMain, is_active: isActive });
      router.push(`/stores/${storeId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "แก้ไขร้านไม่สำเร็จ");
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
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1">
          แก้ไขร้าน
        </div>
        {hasPermission("stores.delete") && (
          <Button isIconOnly variant="light" color="danger" onPress={delDisc.onOpen}>
            <Trash2 size={20} />
          </Button>
        )}
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อร้าน" value={name} onValueChange={setName}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} isRequired />
          <Textarea label="ที่อยู่" value={address} onValueChange={setAddress}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <Input label="เบอร์โทร" value={phone} onValueChange={setPhone}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          <div className="text-xs text-black/50 bg-black/5 border-1 border-black/10 rounded-xl px-4 py-2">
            ข้อมูลหัวใบเสร็จ (โลโก้ ชื่อบนใบ ที่อยู่ ผู้เสียภาษี) ตั้งค่าแยกในแต่ละสาขาแล้ว
          </div>
          <Switch isSelected={isMain} onValueChange={setIsMain}>
            <span className="text-sm">ตั้งเป็นร้านหลัก</span>
          </Switch>
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

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDelete}
        name={name}
        related="สาขาทั้งหมดของร้านนี้จะถูกลบไปด้วย"
        loading={deleting}
      />
    </div>
  );
}
