"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/root-layout/sidebar";
import { AuthGuard } from "@/components/auth-guard";

export function MainContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      {/* Below md the document itself scrolls: no 100vh cap and no nested scroll
          container, so a phone gets native page scrolling (and the address bar
          collapses, giving back the height it was covering). From md up <main>
          is still the scroller, which is what the desktop layouts size against. */}
      <div className="relative flex flex-col md:h-screen">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex flex-col w-full min-w-0 md:h-full md:overflow-auto px-5 lg:pl-80 pt-20 pb-5">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
