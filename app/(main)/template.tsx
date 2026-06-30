"use client";

import { motion } from "framer-motion";

// `template.tsx` (unlike `layout.tsx`) remounts on every navigation, so this
// animation reliably fires each time — no AnimatePresence/exit timing games
// (which only flash inconsistently against the App Router's own transitions).
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col h-full w-full min-h-0"
    >
      {children}
    </motion.div>
  );
}
