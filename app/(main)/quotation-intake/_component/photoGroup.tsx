"use client";

import { useEffect, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { WebcamCaptureModal } from "@/components/webcam-capture-modal";
import { ImageViewer } from "@/components/image-viewer";

interface Props {
  label: string;
  hint?: string;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

// A row of photo thumbnails with two ways to add one: the device camera and the
// file picker.
//
// The camera tile branches on the hardware, because the two counters this runs on
// behave differently: on a phone or tablet a plain <input capture> hands the job
// to the native camera app (autofocus, flash, full sensor resolution — which is
// what a legible ID card needs), while a desktop browser silently ignores
// `capture` and would just reopen the file picker, so that case gets the webcam
// modal instead. Detection is by pointer type, resolved after mount so the server
// and the first client render agree.
export function PhotoGroup({ label, hint, files, setFiles }: Props) {
  const [showWebcam, setShowWebcam] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [nativeCamera, setNativeCamera] = useState(false);

  useEffect(() => {
    setNativeCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Fresh object URLs per file set, revoked on replacement — correct under Strict
  // Mode's setup/cleanup replay.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <div className="flex flex-col gap-y-1.5">
      <div className="flex flex-row items-baseline gap-x-2">
        <label className="text-xs font-bold text-black/70">{label}</label>
        {hint && <span className="text-[10px] text-black/35">{hint}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {files.map((_, i) => (
          <div key={i} className="relative w-20 h-20 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrls[i]}
              alt={`${label} ${i + 1}`}
              role="button"
              tabIndex={0}
              onClick={() => setViewerIndex(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewerIndex(i);
                }
              }}
              className="w-20 h-20 object-cover rounded-xl border-1 border-black/10 cursor-zoom-in"
            />
            <button
              type="button"
              aria-label="ลบรูปนี้"
              onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow"
            >
              ×
            </button>
          </div>
        ))}

        {nativeCamera ? (
          <label
            title="ถ่ายรูป"
            className="flex flex-col items-center justify-center gap-y-1 w-20 h-20 shrink-0 border-2 border-dashed border-[#c09c42]/40 bg-[#c09c42]/5 rounded-xl cursor-pointer hover:border-[#c09c42] transition-all"
          >
            <Camera size={18} className="text-[#c09c42]" />
            <span className="text-[10px] font-bold text-[#c09c42]">ถ่ายรูป</span>
            <input
              // Remounted per count so picking the same file twice still fires onChange.
              key={`cam-${files.length}`}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        ) : (
          <button
            type="button"
            title="ถ่ายรูปจากกล้อง"
            onClick={() => setShowWebcam(true)}
            className="flex flex-col items-center justify-center gap-y-1 w-20 h-20 shrink-0 border-2 border-dashed border-[#c09c42]/40 bg-[#c09c42]/5 rounded-xl hover:border-[#c09c42] transition-all"
          >
            <Camera size={18} className="text-[#c09c42]" />
            <span className="text-[10px] font-bold text-[#c09c42]">ถ่ายรูป</span>
          </button>
        )}

        <label
          title="เลือกไฟล์"
          className="flex flex-col items-center justify-center gap-y-1 w-20 h-20 shrink-0 border-2 border-dashed border-black/20 rounded-xl cursor-pointer hover:border-[#c09c42]/60 hover:bg-[#c09c42]/5 transition-all"
        >
          <ImageIcon size={18} className="text-black/30" />
          <span className="text-[10px] font-bold text-black/40">เลือกไฟล์</span>
          <input
            key={`file-${files.length}`}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      </div>

      <WebcamCaptureModal
        isOpen={showWebcam}
        onClose={() => setShowWebcam(false)}
        onCapture={(file) => setFiles((prev) => [...prev, file])}
      />
      <ImageViewer
        images={previewUrls.map((url, index) => ({
          url,
          name: `${label} ${index + 1}`,
        }))}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}
