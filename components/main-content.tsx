"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/root-layout/sidebar";
import { AuthGuard } from "@/components/auth-guard";

export function MainContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="relative flex flex-col h-screen bg-gradient-to-tl from-[#c09c42]/40 via-transparent to-transparent">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex flex-col h-full w-full px-5 lg:pl-80 pt-20 pb-5">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
