"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/root-layout/sidebar";
import { BottomNav, useBottomNav } from "@/components/root-layout/bottom-nav";
import { AuthGuard } from "@/components/auth-guard";
import { PdpaConsentModal } from "@/components/pdpa-consent-modal";

export function MainContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Resolved here rather than inside BottomNav: the bar floats over the page, so
  // whoever gets one also has to give back the height it covers.
  const { visible: showBottomNav, items: bottomNavItems } = useBottomNav();

  return (
    <AuthGuard>
      {/* Below md the document itself scrolls: no 100vh cap and no nested scroll
          container, so a phone gets native page scrolling (and the address bar
          collapses, giving back the height it was covering). From md up <main>
          is still the scroller, which is what the desktop layouts size against.

          data-bottom-nav publishes the bar's height as --bottom-nav-h (see
          globals.css), which zeroes itself from lg up where the bar is hidden.
          Anything anchored to the bottom edge — the page's own padding, a
          floating action button — offsets by it instead of hard-coding a number
          that only some users need. */}
      <div
        className="relative flex flex-col md:h-screen"
        data-bottom-nav={showBottomNav ? "1" : undefined}
      >
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex flex-col w-full min-w-0 md:h-full md:overflow-auto px-5 lg:pl-80 pt-20 pb-[calc(1.25rem+var(--bottom-nav-h,0px))]">
          {children}
        </main>
        {showBottomNav && <BottomNav items={bottomNavItems} />}
        {/* Renders itself only when a consent is outstanding, and then blocks
            everything behind it until the customer accepts or logs out. */}
        <PdpaConsentModal />
      </div>
    </AuthGuard>
  );
}
