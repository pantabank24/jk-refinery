"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  User, Chip, Button,
} from "@heroui/react";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8080";

interface MemberData {
  id: number;
  code: string;
  image: string;
  fname: string;
  lname: string;
  phone: string;
  credits: number;
  status: number;
  store?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  user?: { role?: { id: number; name: string; display_name: string } | null } | null;
}

const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
  "0": "success", "1": "danger", "2": "warning",
};
const statusTextMap: Record<string, string> = {
  "0": "ปกติ", "1": "ระงับ", "2": "รอตรวจ",
};

const LIMIT = 20;

export default function Members() {
  const router = useRouter();
  const { hasPermission, isMaster, loading: authLoading } = useAuth();
  const canRead = hasPermission("members.read");

  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) p.set("search", search);
    if (statusFilter !== "") p.set("status", statusFilter);
    return p.toString();
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!authLoading && !canRead) {
      router.replace("/");
    }
  }, [authLoading, canRead, router]);

  useEffect(() => {
    if (!canRead) return;
    setLoading(true);
    api.get<MemberData[]>(`/members?${buildQuery()}`)
      .then((res) => {
        setMembers((res.data as unknown as MemberData[]) || []);
        setTotal((res as unknown as { total_rows?: number }).total_rows || 0);
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [buildQuery, canRead]);

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const inputStyle = "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-xl";
  const totalPages = Math.ceil(total / LIMIT);

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col h-full gap-y-3">
      {/* header */}
      <div className="flex flex-row items-center justify-between shrink-0 pt-5">
        <div className="flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          สมาชิก
        </div>
        {hasPermission("members.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="md"
            onPress={() => router.push("/members/add")}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              เพิ่มสมาชิก
            </div>
          </Button>
        )}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-2 shrink-0">
        <Input
          placeholder="ค้นหาชื่อ / รหัส / เบอร์"
          value={search}
          onValueChange={handleFilterChange(setSearch)}
          classNames={{ inputWrapper: inputStyle }}
          startContent={<Search size={14} className="text-black/40" />}
          className="w-56"
          isClearable
          onClear={() => handleFilterChange(setSearch)("")}
        />
        <Select
          placeholder="สถานะทั้งหมด"
          selectedKeys={statusFilter !== "" ? [statusFilter] : []}
          onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
          classNames={{ trigger: inputStyle }}
          className="w-40"
        >
          <SelectItem key="0">ปกติ</SelectItem>
          <SelectItem key="1">ระงับ</SelectItem>
          <SelectItem key="2">รอตรวจ</SelectItem>
        </Select>
        {(search || statusFilter !== "") && (
          <Button
            size="sm"
            variant="light"
            className="text-black/40 self-center"
            onPress={() => { setSearch(""); setStatusFilter(""); setPage(1); }}
          >
            ล้าง
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" color="warning" />
        </div>
      ) : (
        <>
          <Table
            isHeaderSticky
            radius="sm"
            removeWrapper
            classNames={{
              base: "flex flex-col flex-1 min-h-0 overflow-y-scroll scrollbar-hide border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
            }}
          >
            <TableHeader>
              <TableColumn>สมาชิก</TableColumn>
              <TableColumn>สิทธิ์</TableColumn>
              <TableColumn>เบอร์โทร</TableColumn>
              <TableColumn>เครดิต</TableColumn>
              {isMaster ? <TableColumn>ร้าน / สาขา</TableColumn> : null}
              <TableColumn>สถานะ</TableColumn>
            </TableHeader>
            <TableBody emptyContent="ไม่พบข้อมูล">
              {members.map((m) => (
                <TableRow
                  key={m.id}
                  className="hover:bg-white rounded-2xl cursor-pointer"
                  onClick={() => router.push(`/members/read?id=${m.id}`)}
                >
                  <TableCell>
                    <User
                      avatarProps={{
                        radius: "lg",
                        src: m.image ? `${API_BASE}${m.image}` : undefined,
                        name: m.fname,
                      }}
                      name={`${m.fname} ${m.lname}`}
                      description={m.code}
                    />
                  </TableCell>
                  <TableCell>
                    {m.user?.role ? (
                      <Chip size="sm" variant="flat" color="default">
                        {m.user.role.display_name || m.user.role.name}
                      </Chip>
                    ) : (
                      <span className="text-xs text-black/30">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-black/70">{m.phone || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-[#c09c42]">
                      {m.credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  {isMaster ? (
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-black/70">{m.store?.name || "-"}</span>
                        <span className="text-[10px] text-black/40">{m.branch?.name || ""}</span>
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Chip
                      color={statusColorMap[String(m.status)] || "default"}
                      size="sm"
                      variant="dot"
                    >
                      {statusTextMap[String(m.status)] || String(m.status)}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 shrink-0 pb-2">
              <Button size="sm" variant="flat" isDisabled={page === 1} onPress={() => setPage(page - 1)}>ก่อนหน้า</Button>
              <span className="text-sm text-black/50 self-center">{page} / {totalPages}</span>
              <Button size="sm" variant="flat" isDisabled={page >= totalPages} onPress={() => setPage(page + 1)}>ถัดไป</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
