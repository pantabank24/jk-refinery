"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { ArrowLeft, Save, ShieldOff } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";
import { useAuth } from "@/contexts/auth-context";

interface PermissionData {
  id: number;
  code: string;
  name: string;
  group_name: string;
  description: string;
}

interface RoleDetail {
  id: number;
  name: string;
  display_name: string;
  description: string;
  permissions?: { permission: { id: number; code: string } }[];
}

export default function RoleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;
  const { hasPermission } = useAuth();
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roleRes, permRes] = await Promise.all([
          api.get<RoleDetail>(`/roles/${roleId}`),
          api.get<PermissionData[]>("/permissions"),
        ]);

        const roleData = roleRes.data as unknown as RoleDetail;
        setRole(roleData);
        setAllPermissions((permRes.data as unknown as PermissionData[]) || []);

        // Set initially selected permissions
        const ids = new Set<number>();
        roleData?.permissions?.forEach((rp) => {
          if (rp.permission) ids.add(rp.permission.id);
        });
        setSelectedIds(ids);
      } catch {
        router.push("/settings/roles");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [roleId, router]);

  if (!hasPermission("roles.update")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const togglePermission = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/roles/${roleId}/permissions`, {
        permission_ids: Array.from(selectedIds),
      });
      router.push("/settings/roles");
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  // Group permissions by group_name
  const grouped = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.group_name]) acc[perm.group_name] = [];
    acc[perm.group_name].push(perm);
    return acc;
  }, {} as Record<string, PermissionData[]>);

  const groupNameMap: Record<string, string> = {
    stores: "ร้านค้า",
    branches: "สาขา",
    quotations: "ใบเสนอราคา",
    members: "สมาชิก",
    users: "ผู้ใช้",
    roles: "สิทธิ์",
    credits: "เครดิต",
    logs: "Logs",
    config: "ตั้งค่าระบบ",
    gold_types: "ประเภททอง",
    gold_prices: "ราคาทอง",
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex items-center gap-x-3">
          <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex flex-col">
            <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {role?.display_name}
            </div>
            <span className="text-xs text-black/50">{role?.name}</span>
          </div>
        </div>
        <Button
          isLoading={saving}
          className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
          startContent={!saving && <Save size={16} />}
          onPress={handleSave}
        >
          บันทึก
        </Button>
      </div>

      <div className="overflow-y-auto pb-4 space-y-4">
        {Object.entries(grouped).map(([group, perms]) => (
          <div
            key={group}
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5"
          >
            <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              {groupNameMap[group] || group}
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {perms.map((perm) => (
                <Checkbox
                  key={perm.id}
                  isSelected={selectedIds.has(perm.id)}
                  onValueChange={() => togglePermission(perm.id)}
                  color="warning"
                  size="sm"
                >
                  <span className="text-sm">{perm.name}</span>
                </Checkbox>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
