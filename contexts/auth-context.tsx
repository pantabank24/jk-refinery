"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, removeToken, hasToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  is_active: boolean;
  store_id: number | null;
  branch_id: number | null;
  role_id: number | null;
  store?: { id: number; code: string; name: string; address?: string; phone?: string; tax_id?: string; tax_name?: string; website?: string; logo?: string } | null;
  branch?: { id: number; code: string; name: string } | null;
  role?: { id: number; name: string; display_name: string } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  permissions: string[];
  credits: number;
  loading: boolean;
  unfinishedBills: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshUnfinishedBills: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isMaster: boolean;
  isOwner: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unfinishedBills, setUnfinishedBills] = useState(0);
  const router = useRouter();

  // Pull the count of bills that are not yet completed/cancelled (for the
  // sidebar badge). Scope is resolved server-side from the caller's role.
  const refreshUnfinishedBills = useCallback(async () => {
    try {
      if (!hasToken()) return;
      const res = await api.get<{ count: number }>("/bills/unfinished-count");
      setUnfinishedBills((res.data as unknown as { count: number })?.count ?? 0);
    } catch {
      setUnfinishedBills(0);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      if (!hasToken()) {
        setLoading(false);
        return;
      }
      const res = await api.get<{ user: AuthUser; permissions: string[]; credits: number }>("/auth/me");
      if (res.data) {
        setUser(res.data.user);
        setPermissions(res.data.permissions || []);
        setCredits(res.data.credits ?? 0);
        // Only customers/staff with bills.read get a meaningful count; the
        // endpoint is permission-gated so a 403 just yields 0.
        const perms = res.data.permissions || [];
        if (res.data.user?.role?.name === "master" || perms.includes("bills.read")) {
          void refreshUnfinishedBills();
        }
      }
    } catch {
      removeToken();
      setUser(null);
      setPermissions([]);
      setCredits(0);
    } finally {
      setLoading(false);
    }
  }, [refreshUnfinishedBills]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser; permissions: string[]; credits: number }>(
      "/auth/login",
      { email, password }
    );
    if (res.data) {
      setToken(res.data.token);
      setUser(res.data.user);
      setPermissions(res.data.permissions || []);
      setCredits(res.data.credits ?? 0);
      void refreshUnfinishedBills();
      router.push("/");
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setPermissions([]);
    setCredits(0);
    router.push("/auth");
  };

  const hasPermission = (permission: string) => {
    if (user?.role?.name === "master") return true;
    return permissions.includes(permission);
  };

  const roleName = user?.role?.name || "";

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        credits,
        loading,
        unfinishedBills,
        login,
        logout,
        refreshUser,
        refreshUnfinishedBills,
        hasPermission,
        isMaster: roleName === "master",
        isOwner: roleName === "owner",
        isEmployee: roleName === "employee",
        isCustomer: roleName === "customer",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
