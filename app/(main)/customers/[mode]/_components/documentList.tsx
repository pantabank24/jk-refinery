import { useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { ImageViewer } from "@/components/image-viewer";
import {
  FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon,
  ExternalLink, Maximize2, Trash2, RefreshCw, Check, X, ShieldAlert,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface CustomerDocument {
  id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  file_ext: string;
  file_size: number;
  document_type_id?: number | null;
  // Preloaded by the API. Absent on documents uploaded before types existed, and
  // on ones whose type was later removed from the master list.
  document_type?: { id: number; name: string; code?: string; is_high_priority?: boolean } | null;
  // Only high-priority documents are ever "pending" — everything else is born
  // approved because there is nothing to check.
  approval_status?: ApprovalStatus;
  reject_reason?: string;
  approved_at?: string | null;
  created_at: string;
}

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
export const DOC_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx";

export const isHighPriority = (d: CustomerDocument) => !!d.document_type?.is_high_priority;

/** เอกสารสำคัญที่ยังรอพนักงานตรวจสอบ — ตัวที่ทำให้ Tab ขึ้นจุดแดง */
export const isPendingReview = (d: CustomerDocument) =>
  isHighPriority(d) && d.approval_status === "pending";

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

const APPROVAL_CHIP: Record<ApprovalStatus, { label: string; className: string }> = {
  pending:  { label: "รอตรวจสอบ",   className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40" },
  approved: { label: "ตรวจสอบแล้ว", className: "bg-sky-500/15 text-sky-700 border-sky-500/40" },
  rejected: { label: "ไม่ผ่าน",      className: "bg-red-500/15 text-red-700 border-red-500/40" },
};

interface Props {
  docs: CustomerDocument[];
  /** ลบเอกสาร — เอกสารสำคัญจะไม่แสดงปุ่มนี้เมื่อ canDeleteHighPriority = false */
  onDelete?: (doc: CustomerDocument) => void;
  /** เปลี่ยนเอกสารสำคัญ (อัปโหลดทับของเดิม) — ทางเลือกแทนการลบ */
  onReplace?: (doc: CustomerDocument) => void;
  /** ตรวจสอบเอกสารสำคัญ — เฉพาะพนักงานที่มีสิทธิ์ customers.approve_documents */
  onApprove?: (doc: CustomerDocument) => void;
  onReject?: (doc: CustomerDocument) => void;
  /** พนักงานลบเอกสารสำคัญได้ ลูกค้าลบไม่ได้ */
  canDeleteHighPriority?: boolean;
  emptyText?: string;
}

export const DocumentList = ({
  docs, onDelete, onReplace, onApprove, onReject,
  canDeleteHighPriority = false, emptyText = "ยังไม่มีเอกสาร",
}: Props) => {
  // Images open in the viewer; pdf/docx/xlsx still go to a new tab, since there is
  // nothing here that can render them. The viewer walks the image documents only,
  // so paging through it never lands on a file it cannot show.
  const imageDocs = useMemo(() => docs.filter((d) => IMAGE_EXTS.includes(d.file_ext)), [docs]);
  const [viewing, setViewing] = useState<number | null>(null);

  if (docs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-black/40 text-sm">{emptyText}</div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-black/5">
      {docs.map((d) => {
        const high = isHighPriority(d);
        const status = high ? (d.approval_status ?? "pending") : undefined;
        const chip = status ? APPROVAL_CHIP[status] : null;
        // A customer keeps at least one copy of an identity document on file at all
        // times: they swap it, they never remove it.
        const showDelete = onDelete && (!high || canDeleteHighPriority);

        return (
          <div key={d.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-black/[0.03] rounded-xl gap-x-2">
            {(() => {
              const isImage = IMAGE_EXTS.includes(d.file_ext);
              const Wrapper = isImage ? "button" : "a";
              const wrapperProps = isImage
                ? {
                    type: "button" as const,
                    onClick: () => setViewing(imageDocs.findIndex((x) => x.id === d.id)),
                  }
                : {
                    href: `${API_BASE}${d.file_path}`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  };
              return (
            <Wrapper
              {...wrapperProps}
              className="flex items-center gap-x-3 min-w-0 flex-1 group text-left"
            >
              {isImage ? (
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
              <div className="flex flex-col min-w-0 gap-y-0.5">
                <span className="text-sm font-bold text-black/70 truncate group-hover:text-[#c09c42] flex items-center gap-x-1">
                  {d.file_name}
                  {isImage ? (
                    <Maximize2 size={11} className="opacity-0 group-hover:opacity-60 shrink-0" />
                  ) : (
                    <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 shrink-0" />
                  )}
                </span>
                <div className="flex items-center gap-x-1.5 min-w-0 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border-1 shrink-0 max-w-[140px] truncate bg-[#c09c42]/10 text-[#8a6f2a] border-[#c09c42]/30 flex items-center gap-x-1">
                    {high && <ShieldAlert size={9} />}
                    {d.document_type?.name || "ไม่ระบุประเภท"}
                  </span>
                  {chip && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border-1 shrink-0 ${chip.className}`}>
                      {chip.label}
                    </span>
                  )}
                  <span className="text-[10px] text-black/40 truncate">
                    {d.file_ext.toUpperCase()} · {fmtSize(d.file_size)} · {fmtDate(d.created_at)}
                  </span>
                </div>
                {status === "rejected" && d.reject_reason && (
                  <span className="text-[10px] text-red-600 truncate">เหตุผล: {d.reject_reason}</span>
                )}
              </div>
            </Wrapper>
              );
            })()}

            <div className="flex items-center shrink-0">
              {onApprove && status === "pending" && (
                <Button isIconOnly size="sm" variant="light" className="text-sky-600" title="อนุมัติ" onPress={() => onApprove(d)}>
                  <Check size={16} />
                </Button>
              )}
              {onReject && status === "pending" && (
                <Button isIconOnly size="sm" variant="light" className="text-amber-600" title="ไม่ผ่าน" onPress={() => onReject(d)}>
                  <X size={16} />
                </Button>
              )}
              {onReplace && high && (
                <Button isIconOnly size="sm" variant="light" className="text-[#c09c42]" title="เปลี่ยนเอกสาร" onPress={() => onReplace(d)}>
                  <RefreshCw size={15} />
                </Button>
              )}
              {showDelete && (
                <Button isIconOnly size="sm" variant="light" className="text-red-500" onPress={() => onDelete(d)}>
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <ImageViewer
        images={imageDocs.map((d) => ({
          url: `${API_BASE}${d.file_path}`,
          name: d.file_name,
        }))}
        index={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
};
