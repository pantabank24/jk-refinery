"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@heroui/spinner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-gradient-to-tl from-[#c09c42]/40 via-transparent to-transparent">
        <div className="flex flex-col items-center gap-y-4">
          <img src="/images/jk-logo.png" alt="Loading" className="h-20 object-contain animate-pulse" />
          <Spinner size="lg" color="warning" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
