"use client";

import { Badge } from "@heroui/badge";
import {
  Bell,
  LogOut,
  Menu,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { StoreBranchSelector } from "@/components/store-branch-selector";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import moment from "moment";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");

interface NavbarProps {
  onMenuClick?: () => void;
}

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "quotation_approved":
      return <CheckCircle size={16} className="text-green-500 shrink-0" />;
    case "quotation_rejected":
      return <XCircle size={16} className="text-red-500 shrink-0" />;
    case "credit_deposit":
      return <ArrowUp size={16} className="text-green-500 shrink-0" />;
    case "credit_withdraw":
      return <ArrowDown size={16} className="text-red-500 shrink-0" />;
    default:
      return <Bell size={16} className="text-gray-400 shrink-0" />;
  }
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ count: number }>(
        "/notifications/unread-count",
      );
      setUnreadCount(res.data?.count ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<Notification[]>("/notifications?limit=20");
      setNotifications((res.data as Notification[]) ?? []);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleBellOpen = async (open: boolean) => {
    setNotifOpen(open);
    if (open) {
      await fetchNotifications();
      await fetchUnreadCount();
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className=" fixed z-50 flex w-screen h-20 py-2 pl-3 pr-3 lg:pr-7">
      <div className=" flex w-full h-full justify-between bg-black/5 border-1 border-black/10 backdrop-blur shadow-sm rounded-2xl items-center py-1 px-5">
        <div className=" flex flex-row h-full items-center gap-x-2">
          <button
            onClick={onMenuClick}
            className="lg:hidden mr-1 p-2 rounded-xl hover:bg-black/10 transition-colors text-[#c09c42]"
          >
            <Menu size={20} />
          </button>
          <img
            src="/images/jk-logo.png"
            alt="Logo"
            className=" flex h-full object-contain"
          />
          <div className=" flex flex-col max-sm:hidden">
            <span className=" font-bold text-xl bg-[#c09c42] bg-clip-text text-transparent">
              JK Gold & Diamond
            </span>
            <span className=" font-bold text-sm bg-[#c09c42] bg-clip-text text-transparent -mt-2">
              กรุงเทพหลอมทอง
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Store / branch selector (master & owner) */}
          <div className="max-sm:hidden">
            <StoreBranchSelector />
          </div>

          {/* Notification Bell */}
          <Popover
            isOpen={notifOpen}
            onOpenChange={handleBellOpen}
            placement="bottom"
          >
            <PopoverTrigger>
              <button className="relative focus:outline-none flex items-center justify-center">
                <Badge
                  color="danger"
                  content={unreadCount}
                  isInvisible={unreadCount === 0}
                  shape="circle"
                >
                  <Bell className="text-[#c09c42] cursor-pointer" size={20} />
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-80 max-w-[calc(100vw-2rem)] max-h-[480px] overflow-hidden flex flex-col bg-white/60 backdrop-blur-xl border border-black/10 shadow-xl rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
                <span className="font-bold text-sm">การแจ้งเตือน</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-[#c09c42] hover:underline"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>
              {/* Notification list */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-black/40">
                    ไม่มีการแจ้งเตือน
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={`flex gap-3 px-4 py-3 border-b border-black/5 cursor-pointer hover:bg-black/10 transition-colors ${
                        !n.is_read ? "bg-[#c09c42]/10" : "bg-transparent"
                      }`}
                    >
                      <div className="mt-0.5">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-black/80 truncate">
                          {n.title}
                        </span>
                        <span className="text-xs text-black/60 line-clamp-2">
                          {n.body}
                        </span>
                        <span className="text-[10px] text-black/40 mt-0.5">
                          {moment(n.created_at).fromNow()}
                        </span>
                      </div>
                      {!n.is_read && (
                        <div className="ml-auto mt-1 shrink-0">
                          <span className="w-2 h-2 rounded-full bg-[#c09c42] block" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Dropdown>
            <DropdownTrigger>
              <div className="flex items-center gap-2 cursor-pointer">
                <Avatar
                  src={user?.avatar ? `${API_BASE}${user.avatar}` : undefined}
                  name={user?.name}
                  size="sm"
                  className="shrink-0"
                />
                <div className="flex flex-col max-sm:hidden">
                  <span className="text-xs font-bold text-black/70">
                    {user?.name || "ไม่ทราบชื่อ"}
                  </span>
                  <span className="text-[10px] text-[#c09c42] -mt-0.5">
                    {user?.role?.display_name || user?.role?.name || ""}
                  </span>
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                key="logout"
                startContent={<LogOut size={16} />}
                className="text-danger"
                color="danger"
                onPress={logout}
              >
                ออกจากระบบ
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};
