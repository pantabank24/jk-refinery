"use client";

import { useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";
import { BranchLogoInput } from "../_component/branchLogoInput";

export default function CreateBranchPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const { hasPermission } = useAuth();

  const [name, setName] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [website, setWebsite] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!hasPermission("branches.create")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return setError("กรุณากรอกชื่อสาขา");
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ id: number }>(`/stores/${storeId}/branches`, {
        name,
        header_name: headerName,
        website,
        tax_name: taxName,
        tax_id: taxId,
        address,
        phone,
        is_main: isMain,
      });
      const created = res.data as unknown as { id: number } | undefined;
      if (logoFile && created?.id) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await api.upload(`/stores/${storeId}/branches/${created.id}/logo`, fd);
      }
      router.push(`/stores/${storeId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "สร้างสาขาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const wrapCls = {
    inputWrapper:
      "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
  };

  return (
    <div className="flex flex-col md:h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          สร้างสาขาใหม่
        </div>
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 md:overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อสาขา" placeholder="เช่น สาขาลาดพร้าว" value={name} onValueChange={setName}
            classNames={wrapCls} isRequired />

          <div className="text-xs font-bold text-black/40 uppercase tracking-wide pt-2">หัวใบเสร็จของสาขานี้</div>
          <BranchLogoInput file={logoFile} onFileChange={setLogoFile} />
          <Input label="ชื่อร้าน (บนหัวใบเสร็จ)" placeholder="ชื่อที่แสดงตัวใหญ่บนใบเสร็จ" value={headerName} onValueChange={setHeaderName}
            classNames={wrapCls} />
          <Input label="รายละเอียดร้าน (บรรทัดใต้ชื่อร้าน)" placeholder="เช่น เว็บไซต์ / Line" value={website} onValueChange={setWebsite}
            classNames={wrapCls} />
          <Textarea label="ที่อยู่" value={address} onValueChange={setAddress} classNames={wrapCls} />
          <Input label="เบอร์โทร" value={phone} onValueChange={setPhone} classNames={wrapCls} />
          <Input label="ชื่อผู้เสียภาษี" value={taxName} onValueChange={setTaxName} classNames={wrapCls} />
          <Input label="เลขประจำตัวผู้เสียภาษี" value={taxId} onValueChange={setTaxId} classNames={wrapCls} />

          <Switch isSelected={isMain} onValueChange={setIsMain}>
            <span className="text-sm">ตั้งเป็นสาขาหลัก</span>
          </Switch>

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
