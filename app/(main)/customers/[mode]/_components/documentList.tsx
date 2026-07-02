import { Button } from "@heroui/button";
import {
  FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon,
  ExternalLink, Trash2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

export interface CustomerDocument {
  id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  file_ext: string;
  file_size: number;
  created_at: string;
}

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
export const DOC_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx";

export const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

const docIcon = (ext: string) => {
  if (IMAGE_EXTS.includes(ext)) return <ImageIcon size={18} className="text-emerald-600" />;
  if (ext === "pdf") return <FileText size={18} className="text-red-500" />;
  if (ext === "xlsx") return <FileSpreadsheet size={18} className="text-green-600" />;
  if (ext === "docx") return <FileText size={18} className="text-blue-600" />;
  return <FileIcon size={18} className="text-black/40" />;
};

interface Props {
  docs: CustomerDocument[];
  onDelete?: (doc: CustomerDocument) => void;
  emptyText?: string;
}

export const DocumentList = ({ docs, onDelete, emptyText = "ยังไม่มีเอกสาร" }: Props) => {
  if (docs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-black/40 text-sm">{emptyText}</div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-black/5">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-black/[0.03] rounded-xl">
          <a
            href={`${API_BASE}${d.file_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-x-3 min-w-0 flex-1 group"
          >
            {IMAGE_EXTS.includes(d.file_ext) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}${d.file_path}`}
                alt={d.file_name}
                className="w-10 h-10 rounded-lg object-cover border-1 border-black/10 shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-lg border-1 border-black/10 bg-white/50 flex items-center justify-center shrink-0">
                {docIcon(d.file_ext)}
              </span>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-black/70 truncate group-hover:text-[#c09c42] flex items-center gap-x-1">
                {d.file_name}
                <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 shrink-0" />
              </span>
              <span className="text-[10px] text-black/40">
                {d.file_ext.toUpperCase()} · {fmtSize(d.file_size)} · {fmtDate(d.created_at)}
              </span>
            </div>
          </a>
          {onDelete && (
            <Button isIconOnly size="sm" variant="light" className="text-red-500 shrink-0" onPress={() => onDelete(d)}>
              <Trash2 size={15} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};
