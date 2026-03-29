"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ShieldOff } from "lucide-react";

interface RoleOption {
  id: number;
  name: string;
  display_name: string;
}
interface StoreOption {
  id: number;
  name: string;
}
interface BranchOption {
  id: number;
  name: string;
}

export default function CreateUserPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  if (!hasPermission("users.create")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<RoleOption[]>("/roles").then((res) => setRoles((res.data as unknown as RoleOption[]) || []));
    api.get<StoreOption[]>("/stores?limit=100").then((res) => setStores((res.data as unknown as StoreOption[]) || []));
  }, []);

  useEffect(() => {
    if (storeId) {
      api.get<BranchOption[]>(`/stores/${storeId}/branches?limit=100`).then((res) =>
        setBranches((res.data as unknown as BranchOption[]) || [])
      );
    } else {
      setBranches([]);
      setBranchId("");
    }
  }, [storeId]);

  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const requiresBranch =
    selectedRole?.name === "employee" || selectedRole?.name === "branch";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return setError("กรุณากรอกข้อมูลให้ครบ");
    if (requiresBranch && !branchId) return setError("สิทธิ์นี้จำเป็นต้องระบุสาขา");
    setError("");
    setLoading(true);
    try {
      await api.post("/users", {
        name,
        email,
        password,
        phone,
        role_id: roleId ? Number(roleId) : undefined,
        store_id: storeId ? Number(storeId) : undefined,
        branch_id: branchId ? Number(branchId) : undefined,
      });
      router.push("/users");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "สร้างพนักงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          เพิ่มพนักงาน
        </div>
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อ" placeholder="ชื่อ-นามสกุล" value={name} onValueChange={setName}
            classNames={{ inputWrapper: inputStyle }} isRequired />
          <Input label="อีเมล" type="email" placeholder="email@example.com" value={email} onValueChange={setEmail}
            classNames={{ inputWrapper: inputStyle }} isRequired />
          <Input label="รหัสผ่าน" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={password} onValueChange={setPassword}
            classNames={{ inputWrapper: inputStyle }} isRequired />
          <Input label="เบอร์โทร" placeholder="08x-xxx-xxxx" value={phone} onValueChange={setPhone}
            classNames={{ inputWrapper: inputStyle }} />

          <Select label="สิทธิ์" placeholder="เลือกสิทธิ์" selectedKeys={roleId ? [roleId] : []}
            onChange={(e) => setRoleId(e.target.value)}
            classNames={{ trigger: inputStyle }}>
            {roles.map((r) => (
              <SelectItem key={String(r.id)}>{r.display_name}</SelectItem>
            ))}
          </Select>

          <Select label="ร้าน" placeholder="เลือกร้าน" selectedKeys={storeId ? [storeId] : []}
            onChange={(e) => setStoreId(e.target.value)}
            classNames={{ trigger: inputStyle }}>
            {stores.map((s) => (
              <SelectItem key={String(s.id)}>{s.name}</SelectItem>
            ))}
          </Select>

          {(branches.length > 0 || requiresBranch) && (
            <Select
              label={requiresBranch ? "สาขา *" : "สาขา"}
              placeholder="เลือกสาขา"
              selectedKeys={branchId ? [branchId] : []}
              onChange={(e) => setBranchId(e.target.value)}
              classNames={{ trigger: inputStyle }}
              isDisabled={branches.length === 0}
              color={requiresBranch && !branchId ? "danger" : "default"}
            >
              {branches.map((b) => (
                <SelectItem key={String(b.id)}>{b.name}</SelectItem>
              ))}
            </Select>
          )}

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <Button type="submit" isLoading={loading}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg" startContent={!loading && <Save size={18} />}>
            สร้างพนักงาน
          </Button>
        </form>
      </div>
    </div>
  );
}
