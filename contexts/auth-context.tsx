"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, removeToken, hasToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  store_id: number | null;
  branch_id: number | null;
  role_id: number | null;
  store?: { id: number; code: string; name: string } | null;
  branch?: { id: number; code: string; name: string } | null;
  role?: { id: number; name: string; display_name: string } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isMaster: boolean;
  isOwner: boolean;
  isBranch: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      if (!hasToken()) {
        setLoading(false);
        return;
      }
      const res = await api.get<{ user: AuthUser; permissions: string[] }>("/auth/me");
      if (res.data) {
        setUser(res.data.user);
        setPermissions(res.data.permissions || []);
      }
    } catch {
      removeToken();
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser; permissions: string[] }>(
      "/auth/login",
      { email, password }
    );
    if (res.data) {
      setToken(res.data.token);
      setUser(res.data.user);
      setPermissions(res.data.permissions || []);
      router.push("/");
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setPermissions([]);
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
        loading,
        login,
        logout,
        refreshUser,
        hasPermission,
        isMaster: roleName === "master",
        isOwner: roleName === "owner",
        isBranch: roleName === "branch",
        isEmployee: roleName === "employee",
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
