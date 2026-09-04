"use client";

import { SkeletonLines } from "@/components/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
        {/* App boot. The mark stays — it is the one moment branding belongs on
            screen — but the spinner under it becomes the shape of the shell that
            is about to appear. */}
        <div className="flex flex-col items-center gap-y-5 w-64">
          <img src="/images/jk-logo.png" alt="Loading" className="h-20 object-contain animate-pulse" />
          <SkeletonLines count={3} className="w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
