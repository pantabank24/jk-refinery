"use client";

import { useAuth } from "@/contexts/auth-context";

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
