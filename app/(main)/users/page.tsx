"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Plus, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, User as UserAvatar,
} from "@heroui/react";

interface UserData {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  role?: { id: number; name: string; display_name: string } | null;
  store?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
}

export default function UsersPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get<UserData[]>(`/users?page=${page}&limit=20`);
        setUsers((res.data as unknown as UserData[]) || []);
        setTotal((res as { total_rows?: number }).total_rows || 0);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [page]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
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

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" color="warning" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-y-4">
          <UserCog size={64} className="text-[#c09c42]/30" />
          <span className="text-black/40 text-lg">ยังไม่มีพนักงาน</span>
        </div>
      ) : (
        <Table
          isHeaderSticky
          radius="sm"
          removeWrapper
          classNames={{
            base: "flex flex-col h-full overflow-y-scroll scrollbar-hide border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
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
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="hover:bg-white rounded-2xl cursor-pointer"
                onClick={() => router.push(`/users/${user.id}/edit`)}
              >
                <TableCell>
                  <UserAvatar
                    avatarProps={{
                      radius: "lg",
                      src: `https://i.pravatar.cc/150?u=${user.id}`,
                    }}
                    name={user.name}
                    description={user.phone}
                  />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-black/70">{user.email}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color="warning" variant="flat">
                    {user.role?.display_name || user.role?.name || "-"}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs text-black/70">{user.store?.name || "-"}</span>
                    <span className="text-[10px] text-black/50">{user.branch?.name || ""}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="dot" color={user.is_active ? "success" : "danger"}>
                    {user.is_active ? "ใช้งาน" : "ระงับ"}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
