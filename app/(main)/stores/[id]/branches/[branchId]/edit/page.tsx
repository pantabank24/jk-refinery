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
import { BranchLogoInput } from "../../_component/branchLogoInput";

interface BranchData {
  name: string;
  header_name: string;
  website: string;
  tax_name: string;
  tax_id: string;
  address: string;
  phone: string;
  logo: string;
  is_main: boolean;
  is_active: boolean;
}

export default function EditBranchPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const branchId = params.branchId as string;
  const { hasPermission } = useAuth();

  const [name, setName] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [website, setWebsite] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isMain, setIsMain] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<BranchData>(`/stores/${storeId}/branches/${branchId}`).then((res) => {
      const data = res.data as unknown as BranchData;
      if (data) {
        setName(data.name);
        setHeaderName(data.header_name ?? "");
        setWebsite(data.website ?? "");
        setTaxName(data.tax_name ?? "");
        setTaxId(data.tax_id ?? "");
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
        setLogo(data.logo ?? "");
        setIsMain(!!data.is_main);
        setIsActive(data.is_active);
      }
    });
  }, [storeId, branchId]);

  if (!hasPermission("branches.update")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.put(`/stores/${storeId}/branches/${branchId}`, {
        name,
        header_name: headerName,
        website,
        tax_name: taxName,
        tax_id: taxId,
        address,
        phone,
        is_main: isMain,
        is_active: isActive,
      });
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await api.upload(`/stores/${storeId}/branches/${branchId}/logo`, fd);
      }
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

  const wrapCls = {
    inputWrapper:
      "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
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

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อสาขา" value={name} onValueChange={setName} classNames={wrapCls} isRequired />

          <div className="text-xs font-bold text-black/40 uppercase tracking-wide pt-2">หัวใบเสร็จของสาขานี้</div>
          <BranchLogoInput file={logoFile} onFileChange={setLogoFile} currentPath={logo} />
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
