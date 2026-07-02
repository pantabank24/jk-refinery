import { useRef } from "react";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Camera, Phone, Building2, MapPin, Mail, ReceiptText } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface Props {
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  storeName?: string;
  address?: string;
  taxId?: string;
  isActive: boolean;
  canEdit?: boolean;
  onImageUpload?: (file: File) => void;
}

export const CustomerCard = ({
  name, email, avatar, phone, storeName, address, taxId, isActive, canEdit, onImageUpload,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) onImageUpload(file);
    e.target.value = "";
  };

  const avatarSrc = avatar ? `${API_BASE}${avatar}` : undefined;

  return (
    <div className="flex flex-col w-full md:w-72 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl px-4 py-5 items-center gap-y-3">
      <div className="relative group">
        <Avatar src={avatarSrc} name={name} className="flex w-28 h-28 text-large" />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
            >
              <Camera size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-y-1">
        <span className="font-bold text-xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent text-center">
          {name}
        </span>
        <Chip color={isActive ? "success" : "danger"} variant="flat" size="sm" className="font-bold">
          {isActive ? "ใช้งาน" : "ปิดใช้งาน"}
        </Chip>
      </div>

      <div className="flex flex-col w-full gap-y-2 mt-1">
        <InfoRow icon={<Mail size={14} />} value={email} />
        <InfoRow icon={<Building2 size={14} />} label="บริษัท/ร้านค้า" value={storeName || "-"} />
        <InfoRow icon={<Phone size={14} />} label="เบอร์โทร" value={phone || "-"} />
        <InfoRow icon={<MapPin size={14} />} label="ที่อยู่" value={address || "-"} multiline />
        <InfoRow icon={<ReceiptText size={14} />} label="เลขประจำตัวผู้เสียภาษี" value={taxId || "-"} />
      </div>
    </div>
  );
};

function InfoRow({ icon, label, value, multiline }: { icon: React.ReactNode; label?: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-x-2 text-sm border-1 border-black/5 bg-white/30 rounded-2xl px-3 py-2">
      <span className="text-[#c09c42] mt-0.5 shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        {label && <span className="text-[10px] font-bold text-black/40">{label}</span>}
        <span className={`text-black/70 font-bold text-xs break-words ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
