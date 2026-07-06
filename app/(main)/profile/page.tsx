"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, Camera, Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputStyle =
  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";
const sectionTitle =
  "font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser, isCustomer } = useAuth();

  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [existingAvatar, setExistingAvatar] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // Seed the form from the authenticated user once it is available.
  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setExistingAvatar(user.avatar || "");
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) return setError("กรุณากรอกชื่อ");
    if (!email.trim()) return setError("กรุณากรอกอีเมล");
    if (!EMAIL_RE.test(email)) return setError("รูปแบบอีเมลไม่ถูกต้อง");

    setSaving(true);
    try {
      await api.put("/auth/profile", { name, email, phone });
      if (avatarFile) {
        const fd = new FormData();
        fd.append("avatar", avatarFile);
        await api.upload("/auth/profile/avatar", fd);
      }
      await refreshUser();
      setAvatarFile(null);
      setAvatarPreview("");
      setSuccess("บันทึกโปรไฟล์เรียบร้อยแล้ว");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (!oldPassword) return setPwError("กรุณากรอกรหัสผ่านปัจจุบัน");
    if (newPassword.length < 6)
      return setPwError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
    if (newPassword !== confirmPassword)
      return setPwError("รหัสผ่านใหม่ไม่ตรงกัน");

    setPwSaving(true);
    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setPwSaving(false);
    }
  };

  const displayAvatar =
    avatarPreview || (existingAvatar ? `${API_BASE}${existingAvatar}` : "");

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
          แก้ไขโปรไฟล์
        </div>
      </div>

      {authLoading && !user ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" color="warning" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 overflow-y-auto pb-6">
          {/* ข้อมูลโปรไฟล์ */}
          <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-y-5">
              {/* Avatar */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-[#c09c42]/50 bg-black/5 hover:border-[#c09c42] transition-colors group"
                >
                  {displayAvatar ? (
                    <Image
                      src={displayAvatar}
                      alt="preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-black/30 group-hover:text-[#c09c42] transition-colors">
                      <Camera size={22} />
                      <span className="text-[10px]">อัปโหลด</span>
                    </div>
                  )}
                  <div className="absolute inset-0 group-hover:bg-black/20 transition-colors rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Camera size={18} className="text-white drop-shadow" />
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="flex flex-col gap-y-3">
                <span className={sectionTitle}>ข้อมูลส่วนตัว</span>
                <Input
                  label="ชื่อ"
                  value={name}
                  onValueChange={setName}
                  classNames={{ inputWrapper: inputStyle }}
                  isRequired
                />
                <Input
                  label="อีเมล"
                  type="email"
                  value={email}
                  onValueChange={setEmail}
                  classNames={{ inputWrapper: inputStyle }}
                  isRequired
                />
                <Input
                  label="เบอร์โทร"
                  value={phone}
                  onValueChange={setPhone}
                  classNames={{ inputWrapper: inputStyle }}
                />
                {user?.role && !isCustomer && (
                  <Input
                    label="สิทธิ์การใช้งาน"
                    value={user.role.display_name || user.role.name}
                    isReadOnly
                    isDisabled
                    classNames={{ inputWrapper: inputStyle }}
                  />
                )}
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                  {success}
                </div>
              )}

              <Button
                type="submit"
                isLoading={saving}
                className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
                size="lg"
                startContent={!saving && <Save size={18} />}
              >
                บันทึกโปรไฟล์
              </Button>
            </form>
          </div>

          {/* เปลี่ยนรหัสผ่าน */}
          <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
            <form
              onSubmit={handleChangePassword}
              className="flex flex-col gap-y-5"
            >
              <span className={sectionTitle}>เปลี่ยนรหัสผ่าน</span>
              <Input
                label="รหัสผ่านปัจจุบัน"
                type={showPassword ? "text" : "password"}
                value={oldPassword}
                onValueChange={setOldPassword}
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
              <Input
                label="รหัสผ่านใหม่"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onValueChange={setNewPassword}
                classNames={{ inputWrapper: inputStyle }}
              />
              <Input
                label="ยืนยันรหัสผ่านใหม่"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                classNames={{ inputWrapper: inputStyle }}
              />

              {pwError && (
                <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                  {pwSuccess}
                </div>
              )}

              <Button
                type="submit"
                isLoading={pwSaving}
                className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
                size="lg"
                startContent={!pwSaving && <KeyRound size={18} />}
              >
                เปลี่ยนรหัสผ่าน
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
