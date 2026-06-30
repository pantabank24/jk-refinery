"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Monitor, LogIn, ChevronLeft, ChevronRight, ShieldOff } from "lucide-react";
import moment from "moment";
import { useAuth } from "@/contexts/auth-context";

interface LoginLogData {
  id: number;
  user_id: number | null;
  user?: { name: string; email: string } | null;
  email: string;
  ip: string;
  user_agent: string;
  device: string;
  success: boolean;
  fail_reason: string;
  created_at: string;
}

interface ActivityLogData {
  id: number;
  user_id: number | null;
  user?: { name: string; email: string } | null;
  method: string;
  path: string;
  description: string;
  status_code: number;
  ip: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}

const METHOD_COLOR: Record<string, "primary" | "success" | "warning" | "danger" | "default"> = {
  GET: "primary",
  POST: "success",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
};

const STATUS_COLOR = (code: number): "success" | "warning" | "danger" | "default" => {
  if (code >= 200 && code < 300) return "success";
  if (code >= 400 && code < 500) return "warning";
  if (code >= 500) return "danger";
  return "default";
};

export default function LogsPage() {
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "activity">("login");

  // Login logs state
  const [loginLogs, setLoginLogs] = useState<LoginLogData[]>([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage] = useState(1);
  const [loginFilter, setLoginFilter] = useState<"" | "true" | "false">("");
  const [loadingLogin, setLoadingLogin] = useState(true);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLogData[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState("");
  const [loadingActivity, setLoadingActivity] = useState(true);

  if (!hasPermission("logs.read")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const LIMIT = 20;

  useEffect(() => {
    const fetchLoginLogs = async () => {
      setLoadingLogin(true);
      try {
        let url = `/logs/login?page=${loginPage}&limit=${LIMIT}`;
        if (loginFilter !== "") url += `&success=${loginFilter}`;
        const res = await api.get<LoginLogData[]>(url);
        setLoginLogs((res.data as unknown as LoginLogData[]) || []);
        setLoginTotal((res as { total_rows?: number }).total_rows || 0);
      } catch {
        setLoginLogs([]);
      } finally {
        setLoadingLogin(false);
      }
    };
    fetchLoginLogs();
  }, [loginPage, loginFilter]);

  useEffect(() => {
    const fetchActivityLogs = async () => {
      setLoadingActivity(true);
      try {
        let url = `/logs/activity?page=${activityPage}&limit=${LIMIT}`;
        if (methodFilter) url += `&method=${methodFilter}`;
        const res = await api.get<ActivityLogData[]>(url);
        setActivityLogs((res.data as unknown as ActivityLogData[]) || []);
        setActivityTotal((res as { total_rows?: number }).total_rows || 0);
      } catch {
        setActivityLogs([]);
      } finally {
        setLoadingActivity(false);
      }
    };
    fetchActivityLogs();
  }, [activityPage, methodFilter]);

  const loginTotalPages = Math.ceil(loginTotal / LIMIT);
  const activityTotalPages = Math.ceil(activityTotal / LIMIT);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          Logs การใช้งาน
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-row gap-x-2 shrink-0 mb-4">
        <button
          onClick={() => setActiveTab("login")}
          className={`flex items-center gap-x-2 px-4 py-2 rounded-2xl font-bold text-sm transition-all border-1 ${
            activeTab === "login"
              ? "bg-gradient-to-br from-[#c09c42]/60 to-transparent border-black/20"
              : "border-black/10 bg-black/5"
          }`}
        >
          <LogIn size={16} className="text-[#c09c42]" />
          <span className="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            Login Logs
          </span>
          <Chip size="sm" color="warning" variant="flat">{loginTotal}</Chip>
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-x-2 px-4 py-2 rounded-2xl font-bold text-sm transition-all border-1 ${
            activeTab === "activity"
              ? "bg-gradient-to-br from-[#c09c42]/60 to-transparent border-black/20"
              : "border-black/10 bg-black/5"
          }`}
        >
          <Monitor size={16} className="text-[#c09c42]" />
          <span className="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            Activity Logs
          </span>
          <Chip size="sm" color="warning" variant="flat">{activityTotal}</Chip>
        </button>
      </div>

      {/* ====== LOGIN LOGS ====== */}
      {activeTab === "login" && (
        <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
          {/* Filter */}
          <div className="flex flex-row gap-x-2 shrink-0">
            {[
              { label: "ทั้งหมด", value: "" },
              { label: "สำเร็จ", value: "true" },
              { label: "ล้มเหลว", value: "false" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => { setLoginFilter(f.value as "" | "true" | "false"); setLoginPage(1); }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border-1 transition-all ${
                  loginFilter === f.value
                    ? "bg-gradient-to-br from-[#c09c42]/40 to-transparent border-[#c09c42]/50"
                    : "border-black/10 bg-black/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingLogin ? (
            <div className="flex items-center justify-center flex-1">
              <Spinner size="lg" color="warning" />
            </div>
          ) : loginLogs.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-black/40">
              ยังไม่มี Login logs
            </div>
          ) : (
            <div className="flex flex-col gap-y-2 overflow-y-auto scrollbar-hide flex-1">
              {loginLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-row items-center justify-between border-1 border-black/10 bg-white/30 backdrop-blur-xl rounded-xl px-4 py-2 gap-x-3"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-x-2">
                      <Chip size="sm" color={log.success ? "success" : "danger"} variant="flat">
                        {log.success ? "สำเร็จ" : "ล้มเหลว"}
                      </Chip>
                      <span className="font-bold text-sm text-black/80 truncate">
                        {log.user?.name || log.email}
                      </span>
                    </div>
                    {!log.success && log.fail_reason && (
                      <span className="text-[10px] text-red-500">{log.fail_reason}</span>
                    )}
                    <span className="text-[10px] text-black/50 mt-0.5">
                      {log.device} · IP: {log.ip}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-black/60">
                      {moment(log.created_at).format("DD/MM/YY HH:mm:ss")}
                    </div>
                    <div className="text-[10px] text-black/40 max-w-[180px] truncate" title={log.user_agent}>
                      {log.user_agent}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {loginTotalPages > 1 && (
            <div className="flex flex-row items-center justify-center gap-x-3 shrink-0 pt-2">
              <Button isIconOnly size="sm" variant="light" isDisabled={loginPage <= 1}
                onPress={() => setLoginPage((p) => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm text-black/60">
                {loginPage} / {loginTotalPages}
              </span>
              <Button isIconOnly size="sm" variant="light" isDisabled={loginPage >= loginTotalPages}
                onPress={() => setLoginPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ====== ACTIVITY LOGS ====== */}
      {activeTab === "activity" && (
        <div className="flex flex-col flex-1 min-h-0 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 gap-y-3">
          {/* Method filter */}
          <div className="flex flex-row gap-x-2 shrink-0">
            {["", "GET", "POST", "PUT", "DELETE"].map((m) => (
              <button
                key={m}
                onClick={() => { setMethodFilter(m); setActivityPage(1); }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border-1 transition-all ${
                  methodFilter === m
                    ? "bg-gradient-to-br from-[#c09c42]/40 to-transparent border-[#c09c42]/50"
                    : "border-black/10 bg-black/5"
                }`}
              >
                {m || "ทั้งหมด"}
              </button>
            ))}
          </div>

          {loadingActivity ? (
            <div className="flex items-center justify-center flex-1">
              <Spinner size="lg" color="warning" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-black/40">
              ยังไม่มี Activity logs
            </div>
          ) : (
            <div className="flex flex-col gap-y-2 overflow-y-auto scrollbar-hide flex-1">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-row items-center justify-between border-1 border-black/10 bg-white/30 backdrop-blur-xl rounded-xl px-4 py-2 gap-x-3"
                >
                  <div className="flex flex-row items-center gap-x-3 min-w-0">
                    <Chip size="sm" color={METHOD_COLOR[log.method] || "default"} variant="flat"
                      className="shrink-0 font-mono">
                      {log.method}
                    </Chip>
                    <div className="flex flex-col min-w-0">
                      {log.description ? (
                        <>
                          <span className="text-sm font-bold text-black/80 truncate">
                            {log.user?.name || "Guest"} {log.description}
                          </span>
                          <span className="font-mono text-[10px] text-black/40 truncate">
                            {log.path} · IP: {log.ip} · {log.duration_ms}ms
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-xs text-black/80 truncate">{log.path}</span>
                          <span className="text-[10px] text-black/50">
                            {log.user?.name || "Guest"} · IP: {log.ip} · {log.duration_ms}ms
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Chip size="sm" color={STATUS_COLOR(log.status_code)} variant="dot">
                      {log.status_code}
                    </Chip>
                    <div className="text-[10px] text-black/40 mt-0.5">
                      {moment(log.created_at).format("DD/MM/YY HH:mm:ss")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {activityTotalPages > 1 && (
            <div className="flex flex-row items-center justify-center gap-x-3 shrink-0 pt-2">
              <Button isIconOnly size="sm" variant="light" isDisabled={activityPage <= 1}
                onPress={() => setActivityPage((p) => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm text-black/60">
                {activityPage} / {activityTotalPages}
              </span>
              <Button isIconOnly size="sm" variant="light" isDisabled={activityPage >= activityTotalPages}
                onPress={() => setActivityPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
