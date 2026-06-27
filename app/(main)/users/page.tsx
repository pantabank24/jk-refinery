"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Plus, Search, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, User as UserAvatar,
} from "@heroui/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface UserData {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  is_active: boolean;
  role?: { id: number; name: string; display_name: string } | null;
  store?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
}

interface RoleOption { id: number; name: string; display_name: string }
interface StoreOption { id: number; name: string }
interface BranchOption { id: number; name: string }

export default function UsersPage() {
  const router = useRouter();
  const { hasPermission, isMaster, isOwner, user } = useAuth();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // filter state
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isActive, setIsActive] = useState("");

  // options
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  // load static options once
  useEffect(() => {
    api.get<RoleOption[]>("/roles")
      .then((res) => setRoles((res.data as unknown as RoleOption[]) || []));
    if (isMaster) {
      api.get<StoreOption[]>("/stores?limit=100")
        .then((res) => setStores((res.data as unknown as StoreOption[]) || []));
    }
  }, [isMaster]);

  // when store changes (master/owner), reload branches
  useEffect(() => {
    const sid = storeId || (!isMaster && isOwner && user?.store_id ? String(user.store_id) : "");
    if (!sid) {
      setBranches([]);
      setBranchId("");
      return;
    }
    api.get<BranchOption[]>(`/stores/${sid}/branches?limit=100`)
      .then((res) => setBranches((res.data as unknown as BranchOption[]) || []))
      .catch(() => setBranches([]));
    setBranchId("");
  }, [storeId, isMaster, isOwner, user?.store_id]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (roleId) params.set("role_id", roleId);
    if (storeId) params.set("store_id", storeId);
    if (branchId) params.set("branch_id", branchId);
    if (isActive !== "") params.set("is_active", isActive);
    return params.toString();
  }, [page, search, roleId, storeId, branchId, isActive]);

  useEffect(() => {
    setLoading(true);
    api.get<UserData[]>(`/users?${buildQuery()}`)
      .then((res) => {
        setUsers((res.data as unknown as UserData[]) || []);
        setTotal((res as unknown as { total_rows?: number }).total_rows || 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [buildQuery]);

  // reset to page 1 when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const inputStyle = "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-xl";

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5">
        <div className="flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          จัดการพนักงาน
        </div>
        {hasPermission("users.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="md"
            onPress={() => router.push("/users/create")}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              เพิ่มพนักงาน
            </div>
          </Button>
        )}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-2 shrink-0">
        <Input
          placeholder="ค้นหาชื่อ / อีเมล"
          value={search}
          onValueChange={handleFilterChange(setSearch)}
          classNames={{ inputWrapper: inputStyle }}
          startContent={<Search size={14} className="text-black/40" />}
          className="w-52"
          isClearable
          onClear={() => handleFilterChange(setSearch)("")}
        />

        <Select
          placeholder="สิทธิ์ทั้งหมด"
          selectedKeys={roleId ? [roleId] : []}
          onChange={(e) => handleFilterChange(setRoleId)(e.target.value)}
          classNames={{ trigger: inputStyle }}
          className="w-40"
        >
          {roles.map((r) => (
            <SelectItem key={String(r.id)}>{r.display_name}</SelectItem>
          ))}
        </Select>

        {/* store — master only */}
        {isMaster && stores.length > 0 && (
          <Select
            placeholder="ร้านทั้งหมด"
            selectedKeys={storeId ? [storeId] : []}
            onChange={(e) => handleFilterChange(setStoreId)(e.target.value)}
            classNames={{ trigger: inputStyle }}
            className="w-44"
          >
            {stores.map((s) => (
              <SelectItem key={String(s.id)}>{s.name}</SelectItem>
            ))}
          </Select>
        )}

        {/* branch — master + owner */}
        {(isMaster || isOwner) && branches.length > 0 && (
          <Select
            placeholder="สาขาทั้งหมด"
            selectedKeys={branchId ? [branchId] : []}
            onChange={(e) => handleFilterChange(setBranchId)(e.target.value)}
            classNames={{ trigger: inputStyle }}
            className="w-44"
          >
            {branches.map((b) => (
              <SelectItem key={String(b.id)}>{b.name}</SelectItem>
            ))}
          </Select>
        )}

        <Select
          placeholder="สถานะทั้งหมด"
          selectedKeys={isActive !== "" ? [isActive] : []}
          onChange={(e) => handleFilterChange(setIsActive)(e.target.value)}
          classNames={{ trigger: inputStyle }}
          className="w-40"
        >
          <SelectItem key="true">ใช้งาน</SelectItem>
          <SelectItem key="false">ระงับ</SelectItem>
        </Select>

        {(search || roleId || storeId || branchId || isActive !== "") && (
          <Button
            size="sm"
            variant="light"
            className="text-black/40 self-center"
            onPress={() => {
              setSearch(""); setRoleId(""); setStoreId("");
              setBranchId(""); setIsActive(""); setPage(1);
            }}
          >
            ล้าง
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" color="warning" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-y-4">
          <UserCog size={64} className="text-[#c09c42]/30" />
          <span className="text-black/40 text-lg">ไม่พบข้อมูล</span>
        </div>
      ) : (
        <>
          <Table
            isHeaderSticky
            radius="sm"
            removeWrapper
            classNames={{
              base: "flex flex-col flex-1 overflow-y-scroll scrollbar-hide border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
            }}
          >
            <TableHeader>
              <TableColumn>ชื่อ</TableColumn>
              <TableColumn>อีเมล</TableColumn>
              <TableColumn>สิทธิ์</TableColumn>
              <TableColumn>ร้าน / สาขา</TableColumn>
              <TableColumn>สถานะ</TableColumn>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="hover:bg-white rounded-2xl cursor-pointer"
                  onClick={() => router.push(`/users/${u.id}/edit`)}
                >
                  <TableCell>
                    <UserAvatar
                      avatarProps={{
                        radius: "lg",
                        src: u.avatar ? `${API_BASE}${u.avatar}` : undefined,
                        name: u.name,
                      }}
                      name={u.name}
                      description={u.phone}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-black/70">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color="warning" variant="flat">
                      {u.role?.display_name || u.role?.name || "-"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-black/70">{u.store?.name || "-"}</span>
                      <span className="text-[10px] text-black/50">{u.branch?.name || ""}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="dot" color={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "ใช้งาน" : "ระงับ"}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {total > 20 && (
            <div className="flex justify-center gap-2 shrink-0 pb-2">
              <Button size="sm" variant="flat" isDisabled={page === 1} onPress={() => setPage(page - 1)}>ก่อนหน้า</Button>
              <span className="text-sm text-black/50 self-center">{page} / {Math.ceil(total / 20)}</span>
              <Button size="sm" variant="flat" isDisabled={page >= Math.ceil(total / 20)} onPress={() => setPage(page + 1)}>ถัดไป</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
