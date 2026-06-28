"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { AlertTriangle, ArrowLeft, Camera, Eye, EyeOff, Save } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

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

interface UserDetail {
  id: number;
  email: string;
  phone?: string;
  store_id?: number | null;
  branch_id?: number | null;
  role?: { id: number; name: string; display_name: string } | null;
}

interface MemberDetail {
  id: number;
  fname: string;
  lname: string;
  phone: string;
  credits: number;
  status: number;
  image: string;
  user?: UserDetail | null;
}

const PHONE_RE = /^0[0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Action = () => {
  const router = useRouter();
  const params = useParams<{ mode: string }>();
  const searchParams = useSearchParams();
  const mode = params?.mode ?? "add";
  const memberId = searchParams.get("id");
  const isEdit = mode === "edit";

  const { user, isMaster, isOwner } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [existingImage, setExistingImage] = useState("");

  // Existing user_id (edit mode)
  const [existingUserId, setExistingUserId] = useState<number | null>(null);
  const [originalEmail, setOriginalEmail] = useState("");

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
  const [initLoading, setInitLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [noOwnerWarning, setNoOwnerWarning] = useState(false);

  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const roleNeedsStore =
    selectedRole?.name === "owner" ||
    selectedRole?.name === "employee";
  const roleNeedsBranch = selectedRole?.name === "employee";

  // Load roles + stores, then load member data in edit mode
  useEffect(() => {
    const init = async () => {
      const [rolesRes, storesRes] = await Promise.all([
        api.get<RoleOption[]>("/roles"),
        (isMaster || isOwner) ? api.get<StoreOption[]>("/stores?limit=100") : Promise.resolve(null),
      ]);

      const list = (rolesRes.data as unknown as RoleOption[]) || [];
      setRoles(list);

      if (storesRes) {
        setStores((storesRes.data as unknown as StoreOption[]) || []);
      }

      if (isEdit && memberId) {
        try {
          const mRes = await api.get<MemberDetail>(`/members/${memberId}`);
          const m = mRes.data as unknown as MemberDetail;
          setFname(m.fname);
          setLname(m.lname);
          setPhone(m.phone || "");
          setCredits(String(m.credits ?? 0));
          setExistingImage(m.image || "");

          if (m.user) {
            setExistingUserId(m.user.id);
            setOriginalEmail(m.user.email || "");
            setEmail(m.user.email || "");
            if (m.user.role) {
              setRoleId(String(m.user.role.id));
            }
            // Fetch full user to get store_id / branch_id
            const uRes = await api.get<UserDetail>(`/users/${m.user.id}`);
            const u = uRes.data as unknown as UserDetail;
            if (u.store_id) setStoreId(String(u.store_id));
            if (u.branch_id) setBranchId(String(u.branch_id));
          }
        } catch {
          router.push("/members");
        }
      } else {
        // default role to employee on create
        const emp = list.find((r) => r.name === "employee");
        if (emp) setRoleId(String(emp.id));
      }

      setInitLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, memberId, isMaster, isOwner]);

  // Fetch branches when storeId or roleId changes
  useEffect(() => {
    const selected = roles.find((r) => String(r.id) === roleId);
    const needsBranch = selected?.name === "employee";
    const effectiveStore = storeId || (user?.store_id ? String(user.store_id) : "");

    if (effectiveStore && needsBranch) {
      api
        .get<BranchOption[]>(`/stores/${effectiveStore}/branches?limit=100`)
        .then((res) => setBranches((res.data as unknown as BranchOption[]) || []))
        .catch(() => setBranches([]));
    } else {
      setBranches([]);
      if (!needsBranch) setBranchId("");
    }
  }, [storeId, roleId, roles, user?.store_id]);

  // Clear store/branch when role changes to one that doesn't need them
  useEffect(() => {
    if (!roleNeedsStore) {
      setStoreId("");
      setBranchId("");
    } else if (!roleNeedsBranch) {
      setBranchId("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  // Email uniqueness check (debounced)
  useEffect(() => {
    if (!email || !EMAIL_RE.test(email) || email === originalEmail) {
      setEmailError("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ exists: boolean }>(
          `/users/check-email?email=${encodeURIComponent(email)}`
        );
        setEmailError(res.data?.exists ? "Email นี้ถูกใช้งานแล้ว" : "");
      } catch {
        setEmailError("");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email, originalEmail]);

  // No-owner warning for employee role
  useEffect(() => {
    const selected = roles.find((r) => String(r.id) === roleId);
    const needsBranch = selected?.name === "employee";
    const effectiveStoreId = storeId || (user?.store_id ? String(user.store_id) : "");
    if (!needsBranch || !effectiveStoreId) {
      setNoOwnerWarning(false);
      return;
    }
    api
      .get<{ has_owner: boolean }>(`/users/check-store-owner?store_id=${effectiveStoreId}`)
      .then((res) => setNoOwnerWarning(res.data?.has_owner === false))
      .catch(() => setNoOwnerWarning(false));
  }, [storeId, roleId, roles, user?.store_id]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const inputStyle =
    "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fname.trim()) return setError("กรุณากรอกชื่อจริง");
    if (!lname.trim()) return setError("กรุณากรอกนามสกุล");
    if (phone && !PHONE_RE.test(phone.replace(/\D/g, "")))
      return setError("เบอร์โทรศัพท์ไม่ถูกต้อง (10 หลัก ขึ้นต้นด้วย 0)");
    if (credits !== "" && parseFloat(credits) < 0)
      return setError("เครดิตต้องไม่ติดลบ");

    const hasAccountFields = email || password || confirmPassword;
    if (hasAccountFields || isEdit) {
      if (!isEdit && !email) return setError("กรุณากรอก Email");
      if (email && !EMAIL_RE.test(email)) return setError("รูปแบบ Email ไม่ถูกต้อง");
      if (emailError) return setError(emailError);
      if (!isEdit && !password) return setError("กรุณากรอกรหัสผ่าน");
      if (password && password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      if (password && password !== confirmPassword) return setError("รหัสผ่านไม่ตรงกัน");
    }

    if (roleNeedsStore && (isMaster || isOwner) && !storeId)
      return setError("กรุณาเลือกร้านค้า");
    if (roleNeedsBranch && !branchId)
      return setError("สิทธิ์นี้จำเป็นต้องระบุสาขา");

    setError("");
    setLoading(true);

    const effectiveStoreId = storeId ? Number(storeId) : (user?.store_id ?? undefined);
    const effectiveBranchId = branchId ? Number(branchId) : (user?.branch_id ?? undefined);

    try {
      if (isEdit && memberId) {
        // Update member info
        await api.put(`/members/${memberId}`, { fname, lname, phone });

        // Update linked user if exists
        if (existingUserId) {
          const userPayload: Record<string, unknown> = {
            name: `${fname} ${lname}`,
            role_id: roleId ? Number(roleId) : undefined,
            store_id: effectiveStoreId,
            branch_id: effectiveBranchId,
            clear_store: !effectiveStoreId,
            clear_branch: !effectiveBranchId,
          };
          if (email && email !== originalEmail) userPayload.email = email;
          if (password) userPayload.password = password;
          await api.put(`/users/${existingUserId}`, userPayload);
        }

        // Upload image if changed
        if (avatarFile) {
          const fd = new FormData();
          fd.append("image", avatarFile);
          await api.upload(`/members/${memberId}/image`, fd);
        }

        router.push(`/members/read?id=${memberId}`);
      } else {
        // Create
        const res = await api.post<{ id: number }>("/members", {
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
        const newId = (res.data as unknown as { id: number })?.id;
        if (avatarFile && newId) {
          const fd = new FormData();
          fd.append("image", avatarFile);
          await api.upload(`/members/${newId}/image`, fd);
        }
        router.push("/members");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : isEdit ? "บันทึกไม่สำเร็จ" : "สร้างสมาชิกไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  const displayAvatar = avatarPreview || (existingImage ? `${API_BASE}${existingImage}` : "");

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
          {isEdit ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}
        </div>
      </div>

      {initLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 rounded-full border-2 border-[#c09c42] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-y-5">

            {/* รูปโปรไฟล์ */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-[#c09c42]/50 bg-black/5 hover:border-[#c09c42] transition-colors group"
              >
                {displayAvatar ? (
                  <Image src={displayAvatar} alt="preview" fill className="object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-black/30 group-hover:text-[#c09c42] transition-colors">
                    <Camera size={22} />
                    <span className="text-[10px]">อัปโหลด</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Camera size={18} className="text-white drop-shadow" />
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

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

            {/* เครดิตเริ่มต้น (create only) */}
            {!isEdit && (
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
            )}

            {/* บัญชีผู้ใช้งาน */}
            <div className="flex flex-col gap-y-3">
              <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
                บัญชีผู้ใช้งาน
                {!isEdit && (
                  <span className="font-normal text-xs text-black/40 ml-1">
                    (ไม่บังคับ — กรอกเพื่อสร้าง login พร้อมกัน)
                  </span>
                )}
              </span>

              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onValueChange={setEmail}
                classNames={{ inputWrapper: inputStyle }}
                isInvalid={!!emailError}
                errorMessage={emailError}
                color={emailError ? "danger" : "default"}
              />

              {/* สิทธิ์ */}
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

              {/* ร้านค้า */}
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

              {/* คำเตือน: ไม่มีเจ้าของร้าน */}
              {noOwnerWarning && roleNeedsBranch && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    ร้านนี้ยังไม่มีเจ้าของร้าน แนะนำให้เพิ่มเจ้าของร้านก่อน
                    แต่ยังสามารถสร้างสมาชิกได้
                  </span>
                </div>
              )}

              {/* สาขา */}
              {roleNeedsBranch && (
                <Select
                  label="สาขา *"
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

              {/* รหัสผ่าน */}
              <Input
                label={isEdit ? "รหัสผ่านใหม่ (ไม่บังคับ)" : "รหัสผ่าน"}
                type={showPassword ? "text" : "password"}
                placeholder={isEdit ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "อย่างน้อย 6 ตัวอักษร"}
                value={password}
                onValueChange={setPassword}
                classNames={{ inputWrapper: inputStyle }}
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
              {password && (
                <Input
                  label="ยืนยันรหัสผ่าน"
                  type={showConfirm ? "text" : "password"}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onValueChange={setConfirmPassword}
                  classNames={{ inputWrapper: inputStyle }}
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
              )}
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
              {isEdit ? "บันทึกการเปลี่ยนแปลง" : "สร้างสมาชิก"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
