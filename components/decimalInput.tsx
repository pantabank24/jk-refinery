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
}

// A number input that keeps its own text state so you can actually type decimals
// ("1.", "0.05") without the trailing dot getting stripped on every render.
// It still reflects external numeric changes (autofill, real-time ticks, resets)
// as long as they differ from what's typed.
export function DecimalInput({ label, placeholder = "0", value, onChange, isReadOnly, endContent }: Props) {
  const [text, setText] = useState(value === 0 ? "" : String(value));

  // Sync when the external value changes to something other than the current
  // text (e.g. "1." parses to 1; if value is also 1 we leave the dot alone).
  useEffect(() => {
    if ((parseFloat(text) || 0) !== value) {
      setText(value === 0 ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    // Allow only digits and a single decimal point while typing.
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
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
