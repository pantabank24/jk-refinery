"use client";

import { useRef } from "react";
import { Button } from "@heroui/button";
import { ImagePlus, X } from "lucide-react";

const IMG_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:8080";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
  // Existing saved logo path (e.g. "/uploads/branches/x.png"), shown until a new
  // file is picked.
  currentPath?: string;
}

// Compact logo picker for the branch receipt header — previews the selected (or
// currently saved) image and lets the user replace/clear it.
export function BranchLogoInput({ file, onFileChange, currentPath }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file
    ? URL.createObjectURL(file)
    : currentPath
      ? `${IMG_BASE}${currentPath}`
      : null;

  return (
    <div className="flex items-center gap-x-3">
      <div className="h-16 w-16 shrink-0 rounded-2xl border-1 border-black/10 bg-black/5 flex items-center justify-center overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="logo" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus size={22} className="text-black/30" />
        )}
      </div>
      <div className="flex flex-col gap-y-1">
        <span className="text-xs font-semibold text-black/60">โลโก้ร้าน (บนหัวใบเสร็จ)</span>
        <div className="flex items-center gap-x-2">
          <Button size="sm" variant="flat" onPress={() => inputRef.current?.click()}
            className="rounded-xl border-1 border-black/10 bg-black/5">
            เลือกรูป
          </Button>
          {(file || currentPath) && (
            <Button isIconOnly size="sm" variant="light" color="danger"
              onPress={() => onFileChange(null)}>
              <X size={16} />
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
