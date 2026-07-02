"use client";

import { useEffect, useState, useCallback } from "react";
import { Avatar } from "@heroui/avatar";
import { Pencil, Trash2, ShieldOff, Plus, Eye } from "lucide-react";
import { CmpInput } from "@/components/cmpInput";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  avatar?: string;
  is_active: boolean;
  store_name?: string | null;
  store?: { id: number; name: string } | null;
}

export default function CustomersPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("customers.read");
  const canCreate = hasPermission("customers.create");
  const canUpdate = hasPermission("customers.update");
  const canDelete = hasPermission("customers.delete");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const deleteDisc = useDisclosure();
  const [target, setTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/customers?limit=100";
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get<Customer[]>(url);
      setCustomers((res.data as unknown as Customer[]) || []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => { if (canRead) fetchCustomers(); }, [fetchCustomers, canRead]);

  const askDelete = (c: Customer) => { setTarget(c); deleteDisc.onOpen(); };

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${target.id}`);
      deleteDisc.onClose();
      fetchCustomers();
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

  return (
    <div className="flex flex-col h-full gap-y-3">
      <div className="flex flex-row items-center justify-between shrink-0 pt-5 px-1">
        <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
          ลูกค้า
        </span>
        {canCreate && (
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
            startContent={<Plus size={16} />}
            onPress={() => router.push("/customers/add")}
          >
            เพิ่มลูกค้า
          </Button>
        )}
      </div>

      <div className="flex flex-row items-center gap-x-2 shrink-0">
        <div className="flex-1">
          <CmpInput placeholder="ค้นหาชื่อหรืออีเมล" value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="lg" color="warning" /></div>
        ) : customers.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">ยังไม่มีลูกค้า</div>
        ) : (
          <div className="flex flex-col gap-y-2 pb-4">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex flex-row items-center justify-between border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 cursor-pointer hover:bg-black/10 transition-colors"
                onClick={() => router.push(`/customers/read?id=${c.id}`)}
              >
                <div className="flex flex-row items-center gap-x-3">
                  <Avatar size="sm" name={c.name} src={c.avatar ? `${API_BASE}${c.avatar}` : undefined} />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-black/70">{c.name}
                      {!c.is_active && <span className="ml-2 text-[10px] text-red-500">(ปิดใช้งาน)</span>}
                    </span>
                    <span className="text-[11px] text-black/40">{c.email}</span>
                    {(c.store_name || c.store?.name) && (
                      <span className="text-[10px] text-black/40">
                        {c.store_name || c.store?.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-row items-center gap-x-1" onClick={(e) => e.stopPropagation()}>
                  <Button isIconOnly size="sm" variant="light" className="text-black/50" onPress={() => router.push(`/customers/read?id=${c.id}`)}>
                    <Eye size={15} />
                  </Button>
                  {canUpdate && (
                    <Button isIconOnly size="sm" variant="light" className="text-[#c09c42]" onPress={() => router.push(`/customers/edit?id=${c.id}`)}>
                      <Pencil size={15} />
                    </Button>
                  )}
                  {canDelete && (
                    <Button isIconOnly size="sm" variant="light" className="text-red-500" onPress={() => askDelete(c)}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE CONFIRM */}
      <Modal isOpen={deleteDisc.isOpen} onClose={deleteDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader><span className="font-bold text-red-600">ยืนยันการลบ</span></ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">ต้องการลบลูกค้า <span className="font-bold">{target?.name}</span> หรือไม่?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteDisc.onClose} isDisabled={deleting}>ยกเลิก</Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>ลบ</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
