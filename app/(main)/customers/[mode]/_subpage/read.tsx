"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { ArrowLeft, Pencil, ShieldOff, Upload, FolderOpen, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { CustomerCard } from "../_components/customerCard";
import { DocumentList, DOC_ACCEPT, type CustomerDocument } from "../_components/documentList";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  tax_id?: string;
  avatar?: string;
  is_active: boolean;
  store_name?: string | null;
  store?: { id: number; name: string } | null;
}

interface Bill {
  id: number;
  code: string;
  status: number;
  total_amount: number;
  gold_round?: string;
  created_at: string;
}

const STATUS_LABEL: Record<number, string> = { 10: "รอออกบิล", 11: "รอตรวจบิล", 12: "สำเร็จ", 13: "ยกเลิก", 14: "เคลียร์แล้ว" };
const STATUS_COLOR: Record<number, string> = {
  10: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  11: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  12: "bg-green-500/20 text-green-700 border-green-500/30",
  13: "bg-red-500/20 text-red-700 border-red-500/30",
  14: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

export const CustomerDetail = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("customers.read");
  const canUpdate = hasPermission("customers.update");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bills");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const docRef = useRef<HTMLInputElement>(null);

  const deleteDisc = useDisclosure();
  const [docTarget, setDocTarget] = useState<CustomerDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!customerId) return;
    const dRes = await api.get<CustomerDocument[]>(`/customers/${customerId}/documents`);
    setDocs((dRes.data as unknown as CustomerDocument[]) || []);
  }, [customerId]);

  const fetchAll = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const [cRes, dRes, bRes] = await Promise.all([
        api.get<Customer>(`/customers/${customerId}`),
        api.get<CustomerDocument[]>(`/customers/${customerId}/documents`),
        api.get<Bill[]>(`/bills?created_by=${customerId}&limit=100`).catch(() => null),
      ]);
      setCustomer((cRes.data as unknown as Customer) || null);
      setDocs((dRes.data as unknown as CustomerDocument[]) || []);
      setBills((bRes?.data as unknown as Bill[]) || []);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => {
    if (!customerId) { router.push("/customers"); return; }
    if (canRead) fetchAll();
  }, [canRead, customerId, fetchAll, router]);

  const handleAvatarUpload = async (file: File) => {
    if (!customerId) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api.upload<Customer>(`/customers/${customerId}/avatar`, fd);
      setCustomer(res.data as unknown as Customer);
    } catch { /* silent */ }
  };

  const handleUploadDocs = async (files: FileList | null) => {
    if (!files || files.length === 0 || !customerId) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      await api.upload(`/customers/${customerId}/documents`, fd);
      await fetchDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (docRef.current) docRef.current.value = "";
    }
  };

  const askDeleteDoc = (d: CustomerDocument) => { setDocTarget(d); deleteDisc.onOpen(); };
  const handleDeleteDoc = async () => {
    if (!docTarget || !customerId) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${customerId}/documents/${docTarget.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== docTarget.id));
      deleteDisc.onClose();
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;
  }
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <span className="font-bold text-sm">ไม่พบข้อมูลลูกค้า</span>
        <Button variant="light" startContent={<ArrowLeft size={16} />} onPress={() => router.push("/customers")}>กลับ</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.push("/customers")} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1">
          รายละเอียดลูกค้า
        </div>
        {canUpdate && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl font-bold shadow-md"
            startContent={<Pencil size={14} />}
            size="sm"
            onPress={() => router.push(`/customers/edit?id=${customer.id}`)}
          >
            <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">แก้ไข</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-x-5 gap-y-4 overflow-y-auto md:overflow-hidden scrollbar-hide">
        {/* Left: card */}
        <div className="flex flex-col gap-y-3 md:w-72 shrink-0 md:overflow-y-auto md:min-h-0 scrollbar-hide">
          <CustomerCard
            name={customer.name}
            email={customer.email}
            avatar={customer.avatar}
            phone={customer.phone}
            storeName={customer.store_name || customer.store?.name || ""}
            address={customer.address}
            taxId={customer.tax_id}
            isActive={customer.is_active}
            canEdit={canUpdate}
            onImageUpload={handleAvatarUpload}
          />
        </div>

        {/* Right: tabs */}
        <div className="flex flex-col w-full gap-y-2 md:flex-1 md:min-h-0">
          <Tabs
            aria-label="customer tabs"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as string)}
            classNames={{ tabList: "bg-black/5 border-1 border-black/10" }}
          >
            <Tab key="bills" title={`บิลที่ออก (${bills.length})`} />
            <Tab key="docs" title={`เอกสาร (${docs.length})`} />
          </Tabs>

          {tab === "bills" ? (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              {bills.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีบิล</div>
              ) : (
                <div className="overflow-auto scrollbar-hide">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="sticky top-0 bg-black/5 backdrop-blur-xl">
                      <tr className="text-left text-black/40 text-xs">
                        <th className="px-4 py-2.5 font-bold">เลขที่บิล</th>
                        <th className="px-4 py-2.5 font-bold">วันที่</th>
                        <th className="px-4 py-2.5 font-bold">รอบราคา</th>
                        <th className="px-4 py-2.5 font-bold text-center">สถานะ</th>
                        <th className="px-4 py-2.5 font-bold text-right">ยอดรวม (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => (
                        <tr key={b.id} className="border-t border-black/5 hover:bg-white/40">
                          <td className="px-4 py-2.5 font-bold text-black/70">{b.code}</td>
                          <td className="px-4 py-2.5 text-black/60">{fmtDate(b.created_at)}</td>
                          <td className="px-4 py-2.5 text-black/60">{b.gold_round || "-"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-1 ${STATUS_COLOR[b.status] || ""}`}>
                              {STATUS_LABEL[b.status] || b.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                            {b.total_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col md:flex-1 md:min-h-0 border-1 border-black/10 bg-white/20 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-black/5 shrink-0">
                <div className="flex items-center gap-x-2 font-bold text-sm text-black/70">
                  <FolderOpen size={16} className="text-[#c09c42]" />
                  เอกสาร ({docs.length})
                </div>
                {canUpdate && (
                  <>
                    <input ref={docRef} type="file" accept={DOC_ACCEPT} multiple className="hidden" onChange={(e) => handleUploadDocs(e.target.files)} />
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                      startContent={<Upload size={14} />}
                      isLoading={uploading}
                      onPress={() => docRef.current?.click()}
                    >
                      อัปโหลด
                    </Button>
                  </>
                )}
              </div>
              {error && (
                <div className="mx-4 mt-3 text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>
              )}
              <div className="overflow-y-auto scrollbar-hide p-2">
                <DocumentList
                  docs={docs}
                  onDelete={canUpdate ? askDeleteDoc : undefined}
                  emptyText="ยังไม่มีเอกสาร (รองรับ รูปภาพ, PDF, DOCX, XLSX)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete document confirm */}
      <Modal isOpen={deleteDisc.isOpen} onClose={deleteDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-red-600 flex items-center gap-x-2"><Trash2 size={18} /> ยืนยันการลบเอกสาร</span></ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">ต้องการลบ <span className="font-bold">{docTarget?.file_name}</span> หรือไม่?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteDisc.onClose} isDisabled={deleting}>ยกเลิก</Button>
            <Button color="danger" onPress={handleDeleteDoc} isLoading={deleting}>ลบ</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
