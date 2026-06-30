"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { ArrowLeft, Plus, Edit, MapPin, Phone, Trash2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { useDisclosure } from "@heroui/modal";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

interface BranchData {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
}

interface StoreDetail {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  logo: string;
  is_active: boolean;
  branches: BranchData[];
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const { hasPermission } = useAuth();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const delDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/stores/${storeId}`);
      router.push("/stores");
    } catch { delDisc.onClose(); } finally { setDeleting(false); }
  };

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await api.get<StoreDetail>(`/stores/${storeId}`);
        setStore(res.data as unknown as StoreDetail);
      } catch {
        router.push("/stores");
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [storeId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  if (!store) return null;

  return (
    <div className="flex flex-col h-full gap-y-4">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex items-center gap-x-3">
          <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex flex-col">
            <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {store.name}
            </div>
            <span className="text-xs text-black/50">{store.code}</span>
          </div>
        </div>
        <div className="flex gap-x-2">
          {hasPermission("stores.update") && (
            <Button
              className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
              startContent={<Edit size={15} />}
              size="md"
              onPress={() => router.push(`/stores/${storeId}/edit`)}
            >
              <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">แก้ไข</div>
            </Button>
          )}
          {hasPermission("stores.delete") && (
            <Button isIconOnly variant="light" color="danger" size="md" className="rounded-4xl" onPress={delDisc.onOpen}>
              <Trash2 size={18} />
            </Button>
          )}
        </div>
      </div>

      {/* Store Info */}
      <div className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 flex flex-col gap-y-2">
        {store.address && (
          <div className="flex items-center gap-x-2 text-sm text-black/70">
            <MapPin size={16} className="text-[#c09c42]" />
            <span>{store.address}</span>
          </div>
        )}
        {store.phone && (
          <div className="flex items-center gap-x-2 text-sm text-black/70">
            <Phone size={16} className="text-[#c09c42]" />
            <span>{store.phone}</span>
          </div>
        )}
        <Chip size="sm" variant="dot" color={store.is_active ? "success" : "danger"}>
          {store.is_active ? "เปิดให้บริการ" : "ปิดให้บริการ"}
        </Chip>
      </div>

      {/* Branches */}
      <div className="flex flex-row items-center justify-between">
        <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          สาขาทั้งหมด ({store.branches?.length || 0})
        </span>
        {hasPermission("branches.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="sm"
            onPress={() => router.push(`/stores/${storeId}/branches/create`)}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">เพิ่มสาขา</div>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pb-4">
        {store.branches?.map((branch) => (
          <div
            key={branch.id}
            className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all gap-y-2"
            onClick={() => router.push(`/stores/${storeId}/branches/${branch.id}/edit`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                  {branch.name}
                </span>
                <span className="text-xs text-black/50">{branch.code}</span>
              </div>
              <Chip size="sm" variant="dot" color={branch.is_active ? "success" : "danger"}>
                {branch.is_active ? "เปิด" : "ปิด"}
              </Chip>
            </div>
            {branch.address && (
              <span className="text-xs text-black/50 truncate">{branch.address}</span>
            )}
          </div>
        ))}

        {(!store.branches || store.branches.length === 0) && (
          <div className="col-span-full flex items-center justify-center py-10 text-black/40">
            ยังไม่มีสาขา
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDelete}
        name={store.name}
        related={store.branches?.length ? `สาขาทั้งหมด ${store.branches.length} สาขาจะถูกลบไปด้วย` : undefined}
        loading={deleting}
      />
    </div>
  );
}
