"use client";

import { Input } from "@heroui/input";
import { useEffect, useState, type ReactNode } from "react";

interface Props {
  label?: string;
  placeholder?: string;
  /** Numeric source of truth from the parent. */
  value: number;
  onChange: (n: number) => void;
  isReadOnly?: boolean;
  endContent?: ReactNode;
  /** Max decimal places allowed while typing; unlimited when omitted. */
  maxDecimals?: number;
}

// Display external values rounded to maxDecimals (no trailing zeros).
const toText = (n: number, maxDecimals?: number) => {
  if (n === 0) return "";
  if (maxDecimals === undefined) return String(n);
  const f = Math.pow(10, maxDecimals);
  return String(Math.round(n * f) / f);
};

// A number input that keeps its own text state so you can actually type decimals
// ("1.", "0.05") without the trailing dot getting stripped on every render.
// It still reflects external numeric changes (autofill, real-time ticks, resets)
// as long as they differ from what's typed.
export function DecimalInput({ label, placeholder = "0", value, onChange, isReadOnly, endContent, maxDecimals }: Props) {
  const [text, setText] = useState(() => toText(value, maxDecimals));

  // Sync when the external value changes to something other than the current
  // text (e.g. "1." parses to 1; if value is also 1 we leave the dot alone).
  useEffect(() => {
    if ((parseFloat(text) || 0) !== value) {
      setText(toText(value, maxDecimals));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    // Allow only digits and a single decimal point, capped at maxDecimals when set.
    const pattern = maxDecimals === undefined
      ? /^\d*\.?\d*$/
      : new RegExp(`^\\d*\\.?\\d{0,${maxDecimals}}$`);
    if (raw !== "" && !pattern.test(raw)) return;
    setText(raw);
    onChange(parseFloat(raw) || 0);
  };

  return (
    <Input
      labelPlacement="inside"
      label={label ? <div className="font-bold text-md">{label}</div> : undefined}
      placeholder={placeholder}
      value={text}
      onValueChange={handle}
      isReadOnly={isReadOnly}
      inputMode="decimal"
      endContent={endContent}
      classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
    />
  );
}
