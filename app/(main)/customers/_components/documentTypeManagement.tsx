"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Pencil, Plus, Trash, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import type { DocumentTypeDto } from "@/dtos/document-type-dto";

const COLUMNS = [
  { key: "sort_order", label: "ลำดับ" },
  { key: "name", label: "ชื่อประเภทเอกสาร" },
  { key: "code", label: "รหัส" },
  { key: "is_high_priority", label: "ความสำคัญ" },
  { key: "is_active", label: "สถานะ" },
  { key: "actions", label: "" },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

const inputStyle =
  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

// Document type list management — rendered as the "ประเภทเอกสาร" section of the
// ลูกค้า page. Mirrors BankManagement; the list feeds the upload selector on both
// the admin customer detail page and the customer's own โปรไฟล์ของฉัน.
export function DocumentTypeManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("document_types.create");
  const canUpdate = hasPermission("document_types.update");
  const canDelete = hasPermission("document_types.delete");

  const [types, setTypes] = useState<DocumentTypeDto[]>([]);
  const [loading, setLoading] = useState(true);

  const formDisc = useDisclosure();
  const delDisc = useDisclosure();

  // null = creating a new type; otherwise editing that one.
  const [editing, setEditing] = useState<DocumentTypeDto | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [delTarget, setDelTarget] = useState<DocumentTypeDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");

  const fetchTypes = async () => {
    try {
      const res = await api.get<DocumentTypeDto[]>("/document-types");
      setTypes((res.data as unknown as DocumentTypeDto[]) || []);
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    // Append after the current last type so new rows don't all pile up at 0.
    setSortOrder(String((types.at(-1)?.sort_order ?? 0) + 1));
    setIsActive(true);
    setIsHighPriority(false);
    setError("");
    formDisc.onOpen();
  };

  const openEdit = (t: DocumentTypeDto) => {
    setEditing(t);
    setName(t.name);
    setCode(t.code || "");
    setSortOrder(String(t.sort_order ?? 0));
    setIsActive(t.is_active);
    setIsHighPriority(t.is_high_priority);
    setError("");
    formDisc.onOpen();
  };

  const handleSave = async () => {
    if (!name.trim()) return setError("กรุณากรอกชื่อประเภทเอกสาร");
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
        is_high_priority: isHighPriority,
      };
      if (editing) await api.put(`/document-types/${editing.id}`, payload);
      else await api.post("/document-types", payload);
      formDisc.onClose();
      fetchTypes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (t: DocumentTypeDto) => {
    setDelTarget(t);
    setDelError("");
    delDisc.onOpen();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/document-types/${delTarget.id}`);
      delDisc.onClose();
      fetchTypes();
    } catch (err: unknown) {
      // The API refuses to delete a type that documents still carry — surface why.
      setDelError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  // เอกสารสำคัญ = ลูกค้าลบไม่ได้ + ทุกครั้งที่เปลี่ยนต้องผ่านการตรวจสอบ
  const priorityChip = (high: boolean) =>
    high ? (
      <Chip
        size="sm"
        variant="flat"
        startContent={<ShieldAlert size={12} />}
        className="bg-yellow-500/20 text-yellow-800 border-1 border-yellow-500/40 font-bold"
      >
        เอกสารสำคัญ
      </Chip>
    ) : (
      <span className="text-black/30 text-xs">ทั่วไป</span>
    );

  const statusChip = (active: boolean) => (
    <Chip
      size="sm"
      variant="flat"
      className={
        active
          ? "bg-green-500/20 text-green-700 border-1 border-green-500/30"
          : "bg-black/10 text-black/50 border-1 border-black/10"
      }
    >
      {active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
    </Chip>
  );

  const renderCell = (t: DocumentTypeDto, key: ColKey) => {
    switch (key) {
      case "sort_order":
        return <span className="text-black/50">{t.sort_order}</span>;
      case "name":
        return <span className="font-bold text-black/80">{t.name}</span>;
      case "code":
        return <span className="text-black/60">{t.code || "-"}</span>;
      case "is_high_priority":
        return priorityChip(t.is_high_priority);
      case "is_active":
        return statusChip(t.is_active);
      case "actions":
        return (
          <div className="flex items-center justify-end gap-x-1">
            {canUpdate && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-[#c09c42]"
                onPress={() => openEdit(t)}
              >
                <Pencil size={15} />
              </Button>
            )}
            {canDelete && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-red-500"
                onPress={() => askDelete(t)}
              >
                <Trash size={15} />
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-row items-center justify-between shrink-0 pb-3">
        <span className="text-sm text-black/50">
          ประเภทเอกสารที่เลือกได้ตอนอัปโหลดเอกสารลูกค้า
        </span>
        {canCreate && (
          <Button
            size="sm"
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            onPress={openCreate}
          >
            เพิ่มประเภทเอกสาร
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size="lg" color="warning" />
        </div>
      ) : (
        <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:scrollbar-hide">
          {/* Desktop: table */}
          <Table
            isHeaderSticky
            radius="sm"
            removeWrapper
            aria-label="รายการประเภทเอกสาร"
            classNames={{
              base: "hidden md:flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
            }}
          >
            <TableHeader columns={[...COLUMNS]}>
              {(col) => (
                <TableColumn
                  key={col.key}
                  align={col.key === "actions" ? "end" : "start"}
                >
                  {col.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={types} emptyContent="ยังไม่มีประเภทเอกสาร">
              {(t) => (
                <TableRow key={t.id} className="hover:bg-white rounded-2xl">
                  {(columnKey) => (
                    <TableCell>{renderCell(t, columnKey as ColKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Mobile: card list */}
          <div className="flex md:hidden flex-col gap-y-2 pb-4">
            {types.length === 0 && (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                ยังไม่มีประเภทเอกสาร
              </div>
            )}
            {types.map((t) => (
              <div
                key={t.id}
                className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-x-2"
              >
                <div className="flex flex-col min-w-0 gap-y-1">
                  <span className="font-bold text-sm text-black/80 truncate">
                    {t.name}
                  </span>
                  <div className="flex items-center gap-x-2">
                    <span className="text-[11px] text-black/40">
                      {t.code || "-"} · ลำดับ {t.sort_order}
                    </span>
                    {statusChip(t.is_active)}
                    {t.is_high_priority && priorityChip(true)}
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  {canUpdate && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="text-[#c09c42]"
                      onPress={() => openEdit(t)}
                    >
                      <Pencil size={15} />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="text-red-500"
                      onPress={() => askDelete(t)}
                    >
                      <Trash size={15} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / edit */}
      <Modal isOpen={formDisc.isOpen} onClose={formDisc.onClose} size="md">
        <ModalContent>
          <ModalHeader className="font-bold">
            {editing ? "แก้ไขประเภทเอกสาร" : "เพิ่มประเภทเอกสาร"}
          </ModalHeader>
          <ModalBody className="flex flex-col gap-y-3">
            <Input
              label="ชื่อประเภทเอกสาร"
              value={name}
              onValueChange={setName}
              classNames={{ inputWrapper: inputStyle }}
              placeholder="เช่น บัตรประชาชน, เล่มบัญชีธนาคาร"
              isRequired
            />
            <Input
              label="รหัส"
              value={code}
              onValueChange={setCode}
              classNames={{ inputWrapper: inputStyle }}
              placeholder="เช่น id_card, bank_book"
            />
            <Input
              label="ลำดับการแสดง"
              type="number"
              value={sortOrder}
              onValueChange={setSortOrder}
              classNames={{ inputWrapper: inputStyle }}
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col pr-3">
                <span className="text-sm text-black/60">เอกสารสำคัญ</span>
                <span className="text-[11px] text-black/40">
                  ลูกค้าลบไม่ได้ (เปลี่ยนได้) และทุกครั้งที่เพิ่มหรือเปลี่ยน
                  จะแจ้งพนักงานให้ตรวจสอบก่อน
                </span>
              </div>
              <Switch
                isSelected={isHighPriority}
                onValueChange={setIsHighPriority}
                color="warning"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col">
                <span className="text-sm text-black/60">เปิดใช้งาน</span>
                <span className="text-[11px] text-black/40">
                  ปิดแล้วจะไม่ขึ้นในตัวเลือกตอนอัปโหลดเอกสาร
                </span>
              </div>
              <Switch
                isSelected={isActive}
                onValueChange={setIsActive}
                color="warning"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                {error}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={formDisc.onClose} isDisabled={saving}>
              ยกเลิก
            </Button>
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl"
              onPress={handleSave}
              isLoading={saving}
            >
              บันทึก
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDelete}
        name={delTarget?.name}
        related={delError || undefined}
        loading={deleting}
      />
    </div>
  );
}
