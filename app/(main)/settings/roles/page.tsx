"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Plus, Shield, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";

interface RoleData {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_system: boolean;
  permissions?: { id: number; permission: { id: number; code: string; name: string } }[];
}

export default function RolesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDisplay, setNewRoleDisplay] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchRoles = async () => {
    try {
      const res = await api.get<RoleData[]>("/roles");
      setRoles((res.data as unknown as RoleData[]) || []);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreate = async () => {
    if (!newRoleName || !newRoleDisplay) return;
    setCreating(true);
    try {
      await api.post("/roles", { name: newRoleName, display_name: newRoleDisplay });
      onClose();
      setNewRoleName("");
      setNewRoleDisplay("");
      fetchRoles();
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ต้องการลบสิทธิ์นี้หรือไม่?")) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchRoles();
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          จัดการสิทธิ์
        </div>
        {hasPermission("roles.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="md"
            onPress={onOpen}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">สร้างสิทธิ์ใหม่</div>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => router.push(`/settings/roles/${role.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c09c42]/30 to-transparent flex items-center justify-center">
                    <Shield size={20} className="text-[#c09c42]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {role.display_name}
                    </span>
                    <span className="text-xs text-black/50">{role.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-x-2">
                  {role.is_system && <Chip size="sm" color="warning" variant="flat">ระบบ</Chip>}
                  {!role.is_system && hasPermission("roles.delete") && (
                    <Button isIconOnly size="sm" color="danger" variant="light" onPress={() => handleDelete(role.id)}>
                      <Trash size={14} />
                    </Button>
                  )}
                </div>
              </div>
              <span className="text-xs text-black/50">{role.description}</span>
              <span className="text-xs text-[#c09c42] font-bold">
                {role.permissions?.length || 0} สิทธิ์
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>สร้างสิทธิ์ใหม่</ModalHeader>
          <ModalBody>
            <Input label="ชื่อ (English)" placeholder="เช่น supervisor" value={newRoleName} onValueChange={setNewRoleName}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
            <Input label="ชื่อแสดง" placeholder="เช่น หัวหน้างาน" value={newRoleDisplay} onValueChange={setNewRoleDisplay}
              classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>ยกเลิก</Button>
            <Button isLoading={creating} className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold" onPress={handleCreate}>
              สร้าง
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
