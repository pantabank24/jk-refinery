import { useRef } from "react";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Camera } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface MemberUser {
  email: string;
  role?: { display_name: string };
}

interface Props {
  id: number;
  code: string;
  image: string;
  fname: string;
  lname: string;
  phone: string;
  status: number;
  user?: MemberUser | null;
  canEdit?: boolean;
  onImageUpload?: (file: File) => void;
}

const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
  "0": "success", "1": "danger", "2": "warning",
};
const statusTextMap: Record<string, string> = {
  "0": "ปกติ", "1": "ระงับ", "2": "รอตรวจ",
};

export const MemberCard = ({ id: _id, code, image, fname, lname, phone, status, user, canEdit, onImageUpload }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) onImageUpload(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const avatarSrc = image ? `${API_BASE}${image}` : undefined;

  return (
    <div className="flex flex-col w-full md:w-72 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl px-3 py-5 items-center gap-y-3">
      <div className="relative group">
        <Avatar
          src={avatarSrc}
          name={fname}
          className="flex w-28 h-28 text-large"
        />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
            >
              <Camera size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-y-1">
        <span className="font-bold text-xl bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
          {fname} {lname}
        </span>
        <span className="text-xs font-bold text-black/50">รหัสสมาชิก: {code}</span>
        {phone && <span className="text-xs text-black/50">โทร: {phone}</span>}
        {user?.email && (
          <div className="bg-gradient-to-r from-transparent to-yellow-200/50 rounded-full px-3 py-0.5 border-1 border-black/10 mt-1">
            <span className="text-xs font-bold">{user.email}</span>
          </div>
        )}
        {user?.role && (
          <span className="text-xs text-black/50">{user.role.display_name}</span>
        )}
      </div>

      <Chip color={statusColorMap[String(status)] || "default"} variant="flat" size="sm">
        {statusTextMap[String(status)] || String(status)}
      </Chip>
    </div>
  );
};
