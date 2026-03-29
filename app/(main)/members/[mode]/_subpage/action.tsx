"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

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

export const Action = () => {
  const router = useRouter();
  const { user, isMaster, isOwner } = useAuth();

  // ข้อมูลส่วนตัว
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [phone, setPhone] = useState("");

  // เครดิต
  const [credits, setCredits] = useState("");

  // บัญชีผู้ใช้งาน
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // ร้าน/สาขา
  const [storeId, setStoreId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // role ที่เลือกอยู่ตอนนี้
  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const roleNeedsStore =
    selectedRole?.name === "owner" ||
    selectedRole?.name === "branch" ||
    selectedRole?.name === "employee";
  const roleNeedsBranch =
    selectedRole?.name === "branch" || selectedRole?.name === "employee";

  useEffect(() => {
    api
      .get<RoleOption[]>("/roles")
      .then((res) => setRoles((res.data as unknown as RoleOption[]) || []));

    // master และ owner ต้องเลือกร้านเอง
    if (isMaster || isOwner) {
      api
        .get<StoreOption[]>("/stores?limit=100")
        .then((res) => setStores((res.data as unknown as StoreOption[]) || []));
    }
  }, [isMaster, isOwner]);

  // เมื่อ storeId เปลี่ยน → ดึง branches
  useEffect(() => {
    if (storeId) {
      api
        .get<BranchOption[]>(`/stores/${storeId}/branches?limit=100`)
        .then((res) => setBranches((res.data as unknown as BranchOption[]) || []))
        .catch(() => setBranches([]));
    } else {
      setBranches([]);
      setBranchId("");
    }
  }, [storeId]);

  // เมื่อ role เปลี่ยน → เคลียร์ store/branch ถ้าไม่จำเป็น
  useEffect(() => {
    if (!roleNeedsStore) {
      setStoreId("");
      setBranchId("");
    }
    if (!roleNeedsBranch) {
      setBranchId("");
    }
  }, [roleId]);

  const inputStyle =
    "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fname || !lname) return setError("กรุณากรอกชื่อและนามสกุล");

    if (email || password || confirmPassword) {
      if (!email) return setError("กรุณากรอก Email");
      if (!password) return setError("กรุณากรอกรหัสผ่าน");
      if (password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      if (password !== confirmPassword) return setError("รหัสผ่านไม่ตรงกัน");
    }

    if (roleNeedsBranch && !branchId) {
      return setError("สิทธิ์นี้จำเป็นต้องระบุสาขา");
    }

    setError("");
    setLoading(true);
    try {
      // ถ้าไม่ได้เลือก store ใน form → ใช้จาก JWT (สำหรับ branch/employee ที่ผู้สร้างเป็น owner)
      const effectiveStoreId = storeId
        ? Number(storeId)
        : user?.store_id ?? undefined;
      const effectiveBranchId = branchId
        ? Number(branchId)
        : user?.branch_id ?? undefined;

      await api.post("/members", {
        fname,
        lname,
        phone,
        credits: credits ? parseFloat(credits) : 0,
        store_id: effectiveStoreId,
        branch_id: effectiveBranchId,
        email: email || undefined,
        password: password || undefined,
        role_id: roleId ? Number(roleId) : undefined,
      });
      router.push("/members");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "สร้างสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const hasAccountFields = email || password || confirmPassword;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button
          isIconOnly
          variant="light"
          onPress={() => router.back()}
          className="text-[#c09c42]"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          เพิ่มสมาชิก
        </div>
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-5">

          {/* ข้อมูลส่วนตัว */}
          <div className="flex flex-col gap-y-3">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              ข้อมูลส่วนตัว
            </span>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="ชื่อจริง"
                placeholder="ชื่อจริง"
                value={fname}
                onValueChange={setFname}
                classNames={{ inputWrapper: inputStyle }}
                isRequired
              />
              <Input
                label="นามสกุล"
                placeholder="นามสกุล"
                value={lname}
                onValueChange={setLname}
                classNames={{ inputWrapper: inputStyle }}
                isRequired
              />
            </div>
            <Input
              label="เบอร์โทรศัพท์"
              placeholder="08x-xxx-xxxx"
              value={phone}
              onValueChange={setPhone}
              classNames={{ inputWrapper: inputStyle }}
            />
          </div>

          {/* เครดิตเริ่มต้น */}
          <div className="flex flex-col gap-y-3">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              เครดิตเริ่มต้น
            </span>
            <Input
              label="จำนวนเครดิต (บาท)"
              placeholder="0"
              type="number"
              min="0"
              value={credits}
              onValueChange={setCredits}
              classNames={{ inputWrapper: inputStyle }}
            />
          </div>

          {/* บัญชีผู้ใช้งาน */}
          <div className="flex flex-col gap-y-3">
            <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
              บัญชีผู้ใช้งาน{" "}
              <span className="font-normal text-xs text-black/40">
                (ไม่บังคับ — กรอกเพื่อสร้าง login พร้อมกัน)
              </span>
            </span>

            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onValueChange={setEmail}
              classNames={{ inputWrapper: inputStyle }}
              isRequired={!!hasAccountFields}
            />

            {/* เลือกสิทธิ์ */}
            <Select
              label="สิทธิ์"
              placeholder="เลือกสิทธิ์"
              selectedKeys={roleId ? [roleId] : []}
              onChange={(e) => setRoleId(e.target.value)}
              classNames={{ trigger: inputStyle }}
            >
              {roles.map((r) => (
                <SelectItem key={String(r.id)}>{r.display_name}</SelectItem>
              ))}
            </Select>

            {/* ร้านค้า — แสดงเมื่อ role = owner/branch/employee และเป็น master หรือ owner */}
            {roleNeedsStore && (isMaster || isOwner) && stores.length > 0 && (
              <Select
                label="ร้านค้า"
                placeholder="เลือกร้านค้า"
                selectedKeys={storeId ? [storeId] : []}
                onChange={(e) => setStoreId(e.target.value)}
                classNames={{ trigger: inputStyle }}
              >
                {stores.map((s) => (
                  <SelectItem key={String(s.id)}>{s.name}</SelectItem>
                ))}
              </Select>
            )}

            {/* สาขา — แสดงเมื่อ role = branch/employee */}
            {roleNeedsBranch && (
              <Select
                label={`สาขา${roleNeedsBranch ? " *" : ""}`}
                placeholder="เลือกสาขา"
                selectedKeys={branchId ? [branchId] : []}
                onChange={(e) => setBranchId(e.target.value)}
                classNames={{ trigger: inputStyle }}
                isDisabled={branches.length === 0}
                color={roleNeedsBranch && !branchId ? "danger" : "default"}
              >
                {branches.map((b) => (
                  <SelectItem key={String(b.id)}>{b.name}</SelectItem>
                ))}
              </Select>
            )}

            <Input
              label="รหัสผ่าน"
              type={showPassword ? "text" : "password"}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={password}
              onValueChange={setPassword}
              classNames={{ inputWrapper: inputStyle }}
              isRequired={!!hasAccountFields}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#c09c42]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <Input
              label="ยืนยันรหัสผ่าน"
              type={showConfirm ? "text" : "password"}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              classNames={{ inputWrapper: inputStyle }}
              isRequired={!!hasAccountFields}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="text-[#c09c42]"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            isLoading={loading}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg"
            startContent={!loading && <Save size={18} />}
          >
            สร้างสมาชิก
          </Button>
        </form>
      </div>
    </div>
  );
};
