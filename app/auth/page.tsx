"use client";

import { useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function AuthPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-y-6 w-full max-w-md px-6">
      {/* Logo & Title */}
      <div className="flex flex-col items-center gap-y-3">
        <img
          src="/images/jk-logo.png"
          alt="JK Gold Refinery"
          className="h-24 object-contain"
        />
        <span className="font-bold text-3xl bg-[#c09c42] bg-clip-text text-transparent">
          JK Gold Refinery
        </span>
        <span className="font-bold text-md bg-[#c09c42] bg-clip-text text-transparent -mt-3">
          กรุงเทพหลอมทอง
        </span>
      </div>

      {/* Login Card */}
      <div className="w-full border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl p-8 shadow-2xl">
        <span className="font-bold text-xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          เข้าสู่ระบบ
        </span>

        <form onSubmit={handleLogin} className="flex flex-col gap-y-4 mt-6">
          <Input
            type="email"
            label="อีเมล"
            placeholder="กรอกอีเมล"
            value={email}
            onValueChange={setEmail}
            classNames={{
              inputWrapper:
                "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
            }}
            isRequired
          />

          <Input
            type={showPassword ? "text" : "password"}
            label="รหัสผ่าน"
            placeholder="กรอกรหัสผ่าน"
            value={password}
            onValueChange={setPassword}
            classNames={{
              inputWrapper:
                "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl",
            }}
            endContent={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#c09c42]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            isRequired
          />

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            isLoading={loading}
            className="w-full bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg mt-2"
            size="lg"
            startContent={!loading && <LogIn size={18} />}
          >
            เข้าสู่ระบบ
          </Button>
        </form>
      </div>

      <span className="text-sm text-black/40">
        © 2026 JK Gold Refinery. All rights reserved.
      </span>
    </div>
  );
}
