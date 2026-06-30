"use client";

interface Props {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}

export function NewsImagePicker({ previewUrl, onPick, onClear }: Props) {
  return (
    <div>
      <label className="block text-sm font-bold text-black/70 mb-2">รูปภาพประกอบ (ไม่บังคับ)</label>
      {previewUrl ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="w-32 h-32 object-cover rounded-2xl border border-black/10" />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
          >
            ×
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-black/20 rounded-2xl cursor-pointer hover:border-[#c09c42]/60 hover:bg-[#c09c42]/5 transition-all">
          <span className="text-xs text-black/40 text-center px-2">คลิกเพื่อเลือกรูป</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onPick(e.target.files[0]); }}
          />
        </label>
      )}
    </div>
  );
}
