"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { ArrowLeft, Save, Trash } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";

interface RoleOption { id: number; name: string; display_name: string }
interface StoreOption { id: number; name: string }
interface BranchOption { id: number; name: string }

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { hasPermission } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, rolesRes, storesRes] = await Promise.all([
          api.get<{ id: number; name: string; email: string; phone: string; is_active: boolean; role_id: number; store_id: number; branch_id: number }>(`/users/${userId}`),
          api.get<RoleOption[]>("/roles"),
          api.get<StoreOption[]>("/stores?limit=100"),
        ]);
        const u = userRes.data as unknown as { name: string; email: string; phone: string; is_active: boolean; role_id: number; store_id: number; branch_id: number };
        if (u) {
          setName(u.name);
          setEmail(u.email);
          setPhone(u.phone || "");
          setIsActive(u.is_active);
          if (u.role_id) setRoleId(String(u.role_id));
          if (u.store_id) setStoreId(String(u.store_id));
          if (u.branch_id) setBranchId(String(u.branch_id));
        }
        setRoles((rolesRes.data as unknown as RoleOption[]) || []);
        setStores((storesRes.data as unknown as StoreOption[]) || []);
      } catch {
        router.push("/users");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, router]);

  useEffect(() => {
    if (storeId) {
      api.get<BranchOption[]>(`/stores/${storeId}/branches?limit=100`).then((res) =>
        setBranches((res.data as unknown as BranchOption[]) || [])
      );
    } else {
      setBranches([]);
    }
  }, [storeId]);

  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const requiresBranch =
    selectedRole?.name === "employee" || selectedRole?.name === "branch";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresBranch && !branchId) return setError("สิทธิ์นี้จำเป็นต้องระบุสาขา");
    setError("");
    setSaving(true);
    try {
      await api.put(`/users/${userId}`, {
        name,
        email,
        phone,
        is_active: isActive,
        role_id: roleId ? Number(roleId) : undefined,
        store_id: storeId ? Number(storeId) : undefined,
        branch_id: branchId ? Number(branchId) : undefined,
      });
      router.push("/users");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "แก้ไขพนักงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("ต้องการลบพนักงานนี้หรือไม่?")) return;
    try {
      await api.delete(`/users/${userId}`);
      router.push("/users");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;

  const inputStyle = "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex items-center gap-x-3">
          <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
          <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            แก้ไขพนักงาน
          </div>
        </div>
        {hasPermission("users.delete") && (
          <Button color="danger" variant="light" startContent={<Trash size={16} />} onPress={handleDelete}>
            ลบพนักงาน
          </Button>
        )}
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="ชื่อ" value={name} onValueChange={setName} classNames={{ inputWrapper: inputStyle }} isRequired />
          <Input label="อีเมล" type="email" value={email} onValueChange={setEmail} classNames={{ inputWrapper: inputStyle }} isRequired />
          <Input label="เบอร์โทร" value={phone} onValueChange={setPhone} classNames={{ inputWrapper: inputStyle }} />

          <Select label="สิทธิ์" placeholder="เลือกสิทธิ์" selectedKeys={roleId ? [roleId] : []}
            onChange={(e) => setRoleId(e.target.value)} classNames={{ trigger: inputStyle }}>
            {roles.map((r) => <SelectItem key={String(r.id)}>{r.display_name}</SelectItem>)}
          </Select>

          <Select label="ร้าน" placeholder="เลือกร้าน" selectedKeys={storeId ? [storeId] : []}
            onChange={(e) => setStoreId(e.target.value)} classNames={{ trigger: inputStyle }}>
            {stores.map((s) => <SelectItem key={String(s.id)}>{s.name}</SelectItem>)}
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
              {branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>)}
            </Select>
          )}

          <Switch isSelected={isActive} onValueChange={setIsActive}>
            <span className="text-sm">{isActive ? "ใช้งาน" : "ระงับการใช้งาน"}</span>
          </Switch>

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <Button type="submit" isLoading={saving}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg" startContent={!saving && <Save size={18} />}>
            บันทึก
          </Button>
        </form>
      </div>
    </div>
  );
}
