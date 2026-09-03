"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, Camera, Eye, EyeOff, Save, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import type { BankDto } from "@/dtos/bank-dto";
import type { DocumentTypeDto } from "@/dtos/document-type-dto";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import {
  DocumentList, DOC_ACCEPT, fmtSize, type CustomerDocument,
} from "../_components/documentList";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  tax_id?: string;
  bank_id?: number | null;
  bank_account_no?: string;
  bank_account_name?: string;
  avatar?: string;
  is_active: boolean;
  store_name?: string | null;
  // ร้านที่ลูกค้าสังกัด (ไม่ใช่ store_name ซึ่งเป็นชื่อร้านของลูกค้าเองบนใบเสร็จ)
  store_id?: number | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CustomerAction = () => {
  const router = useRouter();
  const params = useParams<{ mode: string }>();
  const searchParams = useSearchParams();
  const isEdit = (params?.mode ?? "add") === "edit";
  const customerId = searchParams.get("id");

  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [existingAvatar, setExistingAvatar] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ร้านที่ลูกค้าสังกัด — ลูกค้าเป็นข้อมูลระดับร้าน พนักงานร้านอื่นต้องไม่เห็น.
  // staff ผูกกับร้านตัวเองอยู่แล้ว (backend เป็นคนกำหนด ไม่รับจาก body) มีแต่ master
  // ที่ต้องเลือก เพราะ master ไม่ได้สังกัดร้านไหน
  const { isMaster } = useAuth();
  const { stores, selectedStore } = useStore();
  const [storeId, setStoreId] = useState("");

  // Payout account. bankId is the Select's key — "" means ไม่ระบุ.
  const [banks, setBanks] = useState<BankDto[]>([]);
  const [bankId, setBankId] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // ตั้งค่าเริ่มต้นเป็นร้านที่ master เลือกไว้ใน store context (ค่าเริ่มต้นคือร้านหลัก)
  useEffect(() => {
    if (isMaster && !storeId && selectedStore) setStoreId(String(selectedStore.id));
  }, [isMaster, storeId, selectedStore]);

  // Documents: existing (edit) live-managed; pending (create) queued until save.
  // Every attachment carries the type it was picked under, so a queued file keeps
  // its label all the way to the upload that happens after the customer exists.
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; typeId: string }[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docTypes, setDocTypes] = useState<DocumentTypeDto[]>([]);
  const [attachTypeId, setAttachTypeId] = useState("");

  const [initLoading, setInitLoading] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<BankDto[]>("/banks")
      .then((res) => setBanks((res.data as unknown as BankDto[]) || []))
      .catch(() => setBanks([]));
    api
      .get<DocumentTypeDto[]>("/document-types")
      .then((res) => setDocTypes(((res.data as unknown as DocumentTypeDto[]) || []).filter((t) => t.is_active)))
      .catch(() => setDocTypes([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !customerId) return;
    const load = async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          api.get<Customer>(`/customers/${customerId}`),
          api.get<CustomerDocument[]>(`/customers/${customerId}/documents`),
        ]);
        const c = cRes.data as unknown as Customer;
        setName(c.name);
        setEmail(c.email);
        setPhone(c.phone || "");
        setStoreName(c.store_name || "");
        setAddress(c.address || "");
        setTaxId(c.tax_id || "");
        setStoreId(c.store_id ? String(c.store_id) : "");
        setBankId(c.bank_id ? String(c.bank_id) : "");
        setBankAccountNo(c.bank_account_no || "");
        setBankAccountName(c.bank_account_name || "");
        setIsActive(c.is_active);
        setExistingAvatar(c.avatar || "");
        setDocs((dRes.data as unknown as CustomerDocument[]) || []);
      } catch {
        router.push("/customers");
      } finally {
        setInitLoading(false);
      }
    };
    load();
  }, [isEdit, customerId, router]);

  // Disabled banks stay out of the picker, except the one this customer is already
  // on — otherwise editing them would silently drop their bank.
  const bankOptions = banks.filter((b) => b.is_active || String(b.id) === bankId);

  const attachTypeIsHigh = docTypes.some(
    (t) => String(t.id) === attachTypeId && t.is_high_priority
  );
  const typeNameOf = (id: string) => docTypes.find((t) => String(t.id) === id)?.name ?? "ไม่ระบุประเภท";

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleDocSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!attachTypeId) {
      setError("กรุณาเลือกประเภทเอกสารก่อนแนบไฟล์");
      if (docRef.current) docRef.current.value = "";
      return;
    }
    const arr = Array.from(files);
    if (isEdit && customerId) {
      // Upload immediately in edit mode.
      setDocUploading(true);
      setError("");
      try {
        const fd = new FormData();
        arr.forEach((f) => fd.append("files", f));
        fd.append("document_type_id", attachTypeId);
        await api.upload(`/customers/${customerId}/documents`, fd);
        const dRes = await api.get<CustomerDocument[]>(`/customers/${customerId}/documents`);
        setDocs((dRes.data as unknown as CustomerDocument[]) || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "อัปโหลดเอกสารไม่สำเร็จ");
      } finally {
        setDocUploading(false);
      }
    } else {
      setError("");
      const queued = arr.map((file) => ({ file, typeId: attachTypeId }));
      setPendingFiles((prev) =>
        // A high-priority type stands for one document, so a second pick under the
        // same type replaces the queued one rather than queueing a duplicate the
        // API would reject on save.
        attachTypeIsHigh
          ? [...prev.filter((p) => p.typeId !== attachTypeId), queued[0]]
          : [...prev, ...queued]
      );
    }
    if (docRef.current) docRef.current.value = "";
  };

  const deleteExistingDoc = async (doc: CustomerDocument) => {
    if (!customerId) return;
    try {
      await api.delete(`/customers/${customerId}/documents/${doc.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch { /* ignore */ }
  };

  const removePending = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const inputStyle = "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณากรอกชื่อ");
    if (!email.trim()) return setError("กรุณากรอกอีเมล");
    if (!EMAIL_RE.test(email)) return setError("รูปแบบอีเมลไม่ถูกต้อง");
    if (!isEdit && !password) return setError("กรุณากำหนดรหัสผ่าน");
    if (password && password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (password && password !== confirmPassword) return setError("รหัสผ่านไม่ตรงกัน");
    // master ไม่ได้สังกัดร้าน จึงต้องเลือกให้ลูกค้าเอง ไม่งั้นลูกค้าจะไม่โผล่ในลิสต์
    // ของร้านไหนเลย (เห็นได้เฉพาะ master)
    if (isMaster && stores.length > 1 && !storeId) return setError("กรุณาเลือกร้านของลูกค้า");

    setError("");
    setLoading(true);
    try {
      let targetId = customerId;
      if (isEdit && customerId) {
        await api.put(`/customers/${customerId}`, {
          name, email,
          ...(password ? { password } : {}),
          phone,
          store_id: isMaster && storeId ? Number(storeId) : undefined,
          store_name: storeName,
          address,
          tax_id: taxId,
          // 0 = ไม่ระบุ; the API maps it back to NULL so a bank can be cleared.
          bank_id: bankId ? Number(bankId) : 0,
          bank_account_no: bankAccountNo,
          bank_account_name: bankAccountName,
          is_active: isActive,
        });
      } else {
        const res = await api.post<{ id: number }>("/customers", {
          name, email, password, phone,
          store_id: isMaster && storeId ? Number(storeId) : undefined,
          store_name: storeName || undefined,
          address: address || undefined,
          tax_id: taxId || undefined,
          bank_id: bankId ? Number(bankId) : undefined,
          bank_account_no: bankAccountNo || undefined,
          bank_account_name: bankAccountName || undefined,
        });
        targetId = String((res.data as unknown as { id: number })?.id);
        // Upload queued documents now that we have an id.
        if (targetId && pendingFiles.length > 0) {
          // One request per type — the API labels a whole batch with a single type.
          const byType: Record<string, File[]> = {};
          for (const p of pendingFiles) {
            byType[p.typeId] = [...(byType[p.typeId] ?? []), p.file];
          }
          for (const typeId of Object.keys(byType)) {
            const fd = new FormData();
            byType[typeId].forEach((f) => fd.append("files", f));
            fd.append("document_type_id", typeId);
            await api.upload(`/customers/${targetId}/documents`, fd);
          }
        }
      }

      // Avatar upload (both modes) once we have an id.
      if (avatarFile && targetId) {
        const fd = new FormData();
        fd.append("avatar", avatarFile);
        await api.upload(`/customers/${targetId}/avatar`, fd);
      }

      router.push(targetId ? `/customers/read?id=${targetId}` : "/customers");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const displayAvatar = avatarPreview || (existingAvatar ? `${API_BASE}${existingAvatar}` : "");

  return (
    <div className="flex flex-col md:h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          {isEdit ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}
        </div>
      </div>

      {initLoading ? (
        <div className="flex items-center justify-center flex-1"><Spinner size="lg" color="warning" /></div>
      ) : (
        <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6 md:overflow-y-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-y-5">
            {/* Avatar */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-[#c09c42]/50 bg-black/5 hover:border-[#c09c42] transition-colors group"
              >
                {displayAvatar ? (
                  <Image src={displayAvatar} alt="preview" fill className="object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-black/30 group-hover:text-[#c09c42] transition-colors">
                    <Camera size={22} />
                    <span className="text-[10px]">อัปโหลด</span>
                  </div>
                )}
                <div className="absolute inset-0 group-hover:bg-black/20 transition-colors rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Camera size={18} className="text-white drop-shadow" />
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* ข้อมูลลูกค้า */}
            <div className="flex flex-col gap-y-3">
              <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
                ข้อมูลลูกค้า
              </span>
              <Input label="ชื่อ" value={name} onValueChange={setName} classNames={{ inputWrapper: inputStyle }} isRequired />
              <Input label="ชื่อบริษัท / ร้านค้า" value={storeName} onValueChange={setStoreName} classNames={{ inputWrapper: inputStyle }} placeholder="ชื่อบริษัทหรือร้านค้า" />
              <Input label="เบอร์โทร" value={phone} onValueChange={setPhone} classNames={{ inputWrapper: inputStyle }} />
              <Textarea label="ที่อยู่" value={address} onValueChange={setAddress} minRows={2} classNames={{ inputWrapper: inputStyle }} placeholder="ที่อยู่สำหรับติดต่อ/ออกเอกสาร" />
              <Input label="เลขประจำตัวผู้เสียภาษี" value={taxId} onValueChange={setTaxId} classNames={{ inputWrapper: inputStyle }} placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" />
              {isEdit && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-black/60">เปิดใช้งาน</span>
                  <Switch isSelected={isActive} onValueChange={setIsActive} color="warning" />
                </div>
              )}
            </div>

            {/* ร้านที่สังกัด — master เท่านั้น (staff ผูกกับร้านตัวเองโดยอัตโนมัติ) */}
            {isMaster && (
              <Select
                label="ร้านที่สังกัด"
                placeholder="เลือกร้าน"
                description="พนักงานและเจ้าของร้านนี้เท่านั้นที่จะเห็นลูกค้ารายนี้"
                selectedKeys={storeId ? new Set([storeId]) : new Set([])}
                onSelectionChange={(keys) =>
                  setStoreId((Array.from(keys)[0] as string) ?? "")
                }
                classNames={{ trigger: inputStyle }}
              >
                {stores.map((st) => (
                  <SelectItem key={String(st.id)} textValue={st.name}>
                    {st.name}
                  </SelectItem>
                ))}
              </Select>
            )}

            {/* บัญชีธนาคาร */}
            <div className="flex flex-col gap-y-3">
              <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
                บัญชีธนาคาร
              </span>
              <Select
                label="ธนาคาร"
                placeholder="เลือกธนาคาร"
                selectedKeys={bankId ? new Set([bankId]) : new Set([])}
                onSelectionChange={(keys) =>
                  setBankId((Array.from(keys)[0] as string) ?? "")
                }
                classNames={{ trigger: inputStyle }}
              >
                {bankOptions.map((b) => (
                  <SelectItem key={String(b.id)} textValue={b.name}>
                    {b.name}
                    {b.code ? ` (${b.code})` : ""}
                    {b.is_active ? "" : " — ปิดใช้งาน"}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="เลขที่บัญชี"
                value={bankAccountNo}
                onValueChange={(v) => setBankAccountNo(v.replace(/[^0-9-]/g, ""))}
                inputMode="numeric"
                classNames={{ inputWrapper: inputStyle }}
                placeholder="เลขที่บัญชีธนาคาร"
              />
              <Input
                label="ชื่อบัญชี"
                value={bankAccountName}
                onValueChange={setBankAccountName}
                classNames={{ inputWrapper: inputStyle }}
                placeholder="ชื่อเจ้าของบัญชี"
              />
            </div>

            {/* บัญชีเข้าสู่ระบบ */}
            <div className="flex flex-col gap-y-3">
              <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
                บัญชีเข้าสู่ระบบ
              </span>
              <Input label="อีเมล" type="email" value={email} onValueChange={setEmail} classNames={{ inputWrapper: inputStyle }} isRequired />
              <Input
                label={isEdit ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน"}
                type={showPassword ? "text" : "password"}
                value={password}
                onValueChange={setPassword}
                classNames={{ inputWrapper: inputStyle }}
                isRequired={!isEdit}
                endContent={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#c09c42]">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              {password && (
                <Input
                  label="ยืนยันรหัสผ่าน"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onValueChange={setConfirmPassword}
                  classNames={{ inputWrapper: inputStyle }}
                />
              )}
            </div>

            {/* เอกสาร */}
            <div className="flex flex-col gap-y-2">
              <span className="font-bold text-md bg-gradient-to-r from-black/90 to-yellow-400 bg-clip-text text-transparent">
                เอกสาร
              </span>
              {/* ประเภทต้องเลือกก่อนแนบ ไม่งั้นไฟล์จะขึ้นเป็น "ไม่ระบุประเภท" */}
              <div className="flex items-end gap-x-2">
                <Select
                  size="sm"
                  label="ประเภทเอกสาร"
                  className="flex-1"
                  selectedKeys={attachTypeId ? [attachTypeId] : []}
                  onSelectionChange={(keys) => setAttachTypeId(String(Array.from(keys)[0] ?? ""))}
                  classNames={{ trigger: inputStyle }}
                >
                  {docTypes.map((t) => (
                    <SelectItem key={String(t.id)}>
                      {t.is_high_priority ? `${t.name} (เอกสารสำคัญ)` : t.name}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm" variant="flat"
                  className="border-1 border-black/10 bg-black/5 font-bold h-10 shrink-0"
                  startContent={<Upload size={14} />}
                  isLoading={docUploading}
                  isDisabled={!attachTypeId}
                  onPress={() => docRef.current?.click()}
                >
                  แนบไฟล์
                </Button>
                <input
                  ref={docRef}
                  type="file"
                  accept={DOC_ACCEPT}
                  multiple={!attachTypeIsHigh}
                  className="hidden"
                  onChange={(e) => handleDocSelect(e.target.files)}
                />
              </div>
              <span className="text-[11px] text-black/40 -mt-1">
                รองรับ รูปภาพ, PDF, DOCX, XLSX
                {attachTypeIsHigh && " — เอกสารสำคัญแนบได้ 1 ไฟล์ และต้องผ่านการตรวจสอบ"}
              </span>

              {/* Existing docs (edit) */}
              {isEdit && docs.length > 0 && (
                <div className="border-1 border-black/10 rounded-2xl bg-white/30">
                  {/* หน้าจัดการลูกค้าเป็นฝั่งพนักงาน จึงลบเอกสารสำคัญได้ */}
                  <DocumentList docs={docs} onDelete={deleteExistingDoc} canDeleteHighPriority />
                </div>
              )}

              {/* Pending files (create) */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-col gap-y-1">
                  {pendingFiles.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-1 border-black/10 bg-white/30 rounded-xl px-3 py-2">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-black/70 font-bold">{p.file.name}</span>
                        <span className="text-[10px] text-[#8a6f2a]">{typeNameOf(p.typeId)}</span>
                      </div>
                      <div className="flex items-center gap-x-2 shrink-0">
                        <span className="text-[10px] text-black/40">{fmtSize(p.file.size)}</span>
                        <button type="button" onClick={() => removePending(i)} className="text-red-500">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isEdit && pendingFiles.length === 0 && (
                <span className="text-xs text-black/30">ยังไม่ได้แนบไฟล์ (จะอัปโหลดหลังสร้างลูกค้า)</span>
              )}
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
              size="lg"
              startContent={!loading && <Save size={18} />}
            >
              {isEdit ? "บันทึกการเปลี่ยนแปลง" : "สร้างลูกค้า"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
