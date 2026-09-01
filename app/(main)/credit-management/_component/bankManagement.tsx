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
import { Pencil, Plus, Trash } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import type { BankDto } from "@/dtos/bank-dto";

const COLUMNS = [
  { key: "sort_order", label: "ลำดับ" },
  { key: "name", label: "ชื่อธนาคาร" },
  { key: "code", label: "รหัส" },
  { key: "is_active", label: "สถานะ" },
  { key: "actions", label: "" },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

const inputStyle =
  "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl";

// Bank list management — rendered as the "ธนาคาร" section of the จัดการเครดิต page.
export function BankManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("banks.create");
  const canUpdate = hasPermission("banks.update");
  const canDelete = hasPermission("banks.delete");

  const [banks, setBanks] = useState<BankDto[]>([]);
  const [loading, setLoading] = useState(true);

  const formDisc = useDisclosure();
  const delDisc = useDisclosure();

  // null = creating a new bank; otherwise editing that one.
  const [editing, setEditing] = useState<BankDto | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [delTarget, setDelTarget] = useState<BankDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");

  const fetchBanks = async () => {
    try {
      const res = await api.get<BankDto[]>("/banks");
      setBanks((res.data as unknown as BankDto[]) || []);
    } catch {
      setBanks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    // Append after the current last bank so new rows don't all pile up at 0.
    setSortOrder(String((banks.at(-1)?.sort_order ?? 0) + 1));
    setIsActive(true);
    setError("");
    formDisc.onOpen();
  };

  const openEdit = (b: BankDto) => {
    setEditing(b);
    setName(b.name);
    setCode(b.code || "");
    setSortOrder(String(b.sort_order ?? 0));
    setIsActive(b.is_active);
    setError("");
    formDisc.onOpen();
  };

  const handleSave = async () => {
    if (!name.trim()) return setError("กรุณากรอกชื่อธนาคาร");
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      };
      if (editing) await api.put(`/banks/${editing.id}`, payload);
      else await api.post("/banks", payload);
      formDisc.onClose();
      fetchBanks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (b: BankDto) => {
    setDelTarget(b);
    setDelError("");
    delDisc.onOpen();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/banks/${delTarget.id}`);
      delDisc.onClose();
      fetchBanks();
    } catch (err: unknown) {
      // The API refuses to delete a bank that customers still use — surface why.
      setDelError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

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

  const renderCell = (b: BankDto, key: ColKey) => {
    switch (key) {
      case "sort_order":
        return <span className="text-black/50">{b.sort_order}</span>;
      case "name":
        return <span className="font-bold text-black/80">{b.name}</span>;
      case "code":
        return <span className="text-black/60">{b.code || "-"}</span>;
      case "is_active":
        return statusChip(b.is_active);
      case "actions":
        return (
          <div className="flex items-center justify-end gap-x-1">
            {canUpdate && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-[#c09c42]"
                onPress={() => openEdit(b)}
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
                onPress={() => askDelete(b)}
              >
                <Trash size={15} />
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-1 md:min-h-0">
      <div className="flex flex-row items-center justify-between shrink-0 pb-3">
        <span className="text-sm text-black/50">
          รายชื่อธนาคารที่เลือกได้ในฟอร์มลูกค้า
        </span>
        {canCreate && (
          <Button
            size="sm"
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            onPress={openCreate}
          >
            เพิ่มธนาคาร
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
            aria-label="รายการธนาคาร"
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
            <TableBody items={banks} emptyContent="ยังไม่มีธนาคาร">
              {(b) => (
                <TableRow key={b.id} className="hover:bg-white rounded-2xl">
                  {(columnKey) => (
                    <TableCell>{renderCell(b, columnKey as ColKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Mobile: card list */}
          <div className="flex md:hidden flex-col gap-y-2 pb-4">
            {banks.length === 0 && (
              <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                ยังไม่มีธนาคาร
              </div>
            )}
            {banks.map((b) => (
              <div
                key={b.id}
                className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-x-2"
              >
                <div className="flex flex-col min-w-0 gap-y-1">
                  <span className="font-bold text-sm text-black/80 truncate">
                    {b.name}
                  </span>
                  <div className="flex items-center gap-x-2">
                    <span className="text-[11px] text-black/40">
                      {b.code || "-"} · ลำดับ {b.sort_order}
                    </span>
                    {statusChip(b.is_active)}
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  {canUpdate && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="text-[#c09c42]"
                      onPress={() => openEdit(b)}
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
                      onPress={() => askDelete(b)}
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
            {editing ? "แก้ไขธนาคาร" : "เพิ่มธนาคาร"}
          </ModalHeader>
          <ModalBody className="flex flex-col gap-y-3">
            <Input
              label="ชื่อธนาคาร"
              value={name}
              onValueChange={setName}
              classNames={{ inputWrapper: inputStyle }}
              isRequired
            />
            <Input
              label="รหัสธนาคาร"
              value={code}
              onValueChange={setCode}
              classNames={{ inputWrapper: inputStyle }}
              placeholder="เช่น KBANK, SCB"
            />
            <Input
              label="ลำดับการแสดง"
              type="number"
              value={sortOrder}
              onValueChange={setSortOrder}
              classNames={{ inputWrapper: inputStyle }}
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col">
                <span className="text-sm text-black/60">เปิดใช้งาน</span>
                <span className="text-[11px] text-black/40">
                  ปิดแล้วจะไม่ขึ้นในตัวเลือกของฟอร์มลูกค้า
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
