"use client";

import { Tooltip } from "@heroui/tooltip";
import { BadgeCheck } from "lucide-react";

// Mirrors internal/verification on the API. A customer's badge is derived from the
// review state of their high-priority documents (บัตรประชาชน, เล่มบัญชี, ...):
// nothing on file reads grey, a copy waiting for staff reads yellow, a checked copy
// reads blue, and a turned-down one reads red until they send a new copy.
export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

const STYLE: Record<VerificationStatus, { color: string; label: string }> = {
  none:     { color: "text-black/25",   label: "ยังไม่มีเอกสารยืนยันตัวตน" },
  pending:  { color: "text-yellow-500", label: "เอกสารรอตรวจสอบ" },
  verified: { color: "text-sky-500",    label: "ยืนยันตัวตนแล้ว" },
  rejected: { color: "text-red-500",    label: "เอกสารไม่ผ่านการตรวจสอบ" },
};

interface Props {
  status?: string | null;
  size?: number;
  /** Renders the label beside the icon instead of only on hover. */
  showLabel?: boolean;
  className?: string;
}

export function VerifyBadge({ status, size = 16, showLabel, className = "" }: Props) {
  const style = STYLE[(status as VerificationStatus) ?? "none"] ?? STYLE.none;

  const icon = (
    <BadgeCheck
      size={size}
      className={`${style.color} shrink-0 ${className}`}
      // Yellow reads as "something is happening" — the pulse says it is waiting on
      // someone rather than settled.
      strokeWidth={2.2}
    />
  );

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-x-1">
        {icon}
        <span className={`text-[11px] font-bold ${style.color}`}>{style.label}</span>
      </span>
    );
  }

  return (
    <Tooltip content={style.label} size="sm" delay={200}>
      <span className="inline-flex items-center">{icon}</span>
    </Tooltip>
  );
}
