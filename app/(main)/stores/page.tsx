"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Plus, Store as StoreIcon, MapPin, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1").replace(/\/api\/v1$/, "");

interface StoreData {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  logo: string;
  is_active: boolean;
  branches?: { id: number; code: string; name: string; is_active: boolean }[];
}

export default function StoresPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await api.get<StoreData[]>("/stores?limit=100");
        setStores((res.data as unknown as StoreData[]) || []);
      } catch {
        setStores([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ร้านค้าและสาขา
        </div>
        {hasPermission("stores.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="md"
            onPress={() => router.push("/stores/create")}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              เพิ่มร้าน
            </div>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" color="warning" />
        </div>
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-y-4">
          <StoreIcon size={64} className="text-[#c09c42]/30" />
          <span className="text-black/40 text-lg">ยังไม่มีร้านค้า</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01] gap-y-3"
              onClick={() => router.push(`/stores/${store.id}`)}
            >
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-x-3">
                  {store.logo ? (
                    <img
                      src={`${API_BASE}${store.logo}`}
                      alt={store.name}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c09c42]/30 to-transparent flex items-center justify-center">
                      <StoreIcon size={24} className="text-[#c09c42]" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {store.name}
                    </span>
                    <span className="text-xs text-black/50">{store.code}</span>
                  </div>
                </div>
                <Chip
                  size="sm"
                  variant="dot"
                  color={store.is_active ? "success" : "danger"}
                >
                  {store.is_active ? "เปิด" : "ปิด"}
                </Chip>
              </div>

              {store.address && (
                <div className="flex items-center gap-x-2 text-sm text-black/60">
                  <MapPin size={14} className="text-[#c09c42] shrink-0" />
                  <span className="truncate">{store.address}</span>
                </div>
              )}

              {store.phone && (
                <div className="flex items-center gap-x-2 text-sm text-black/60">
                  <Phone size={14} className="text-[#c09c42] shrink-0" />
                  <span>{store.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-x-2 mt-1">
                <span className="text-xs text-[#c09c42] font-bold">
                  {store.branches?.length || 0} สาขา
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
