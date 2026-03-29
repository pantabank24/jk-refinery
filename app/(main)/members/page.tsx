"use client";

import { useEffect, useState } from "react";
import { CmpFilter } from "@/components/cmpFilter";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  User, Chip, Button,
} from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { Spinner } from "@heroui/spinner";

interface MemberData {
  id: number;
  code: string;
  image: string;
  fname: string;
  lname: string;
  phone: string;
  credits: number;
  status: number;
}

export default function Members() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { selectedStore, selectedBranch } = useStore();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        let url = "/members?limit=50";
        if (selectedStore) url += `&store_id=${selectedStore.id}`;
        if (selectedBranch) url += `&branch_id=${selectedBranch.id}`;
        const res = await api.get<MemberData[]>(url);
        setMembers((res.data as unknown as MemberData[]) || []);
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [selectedStore, selectedBranch]);

  const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
    "0": "success",
    "1": "danger",
    "2": "warning",
  };

  const statusTextMap: Record<string, string> = {
    "0": "ปกติ",
    "1": "ระงับ",
    "2": "รอตรวจ",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
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
      <div className="max-md:flex max-md:flex-col-reverse max-md:gap-y-2 md:grid md:grid-cols-3 flex-1 min-h-0 gap-x-5">
        {loading ? (
          <div className="md:col-span-2 flex items-center justify-center">
            <Spinner size="lg" color="warning" />
          </div>
        ) : (
          <Table
            isHeaderSticky
            className="md:col-span-2"
            radius="sm"
            removeWrapper
            classNames={{
              base: "flex flex-col h-full overflow-y-scroll scrollbar-hide flex flex-row md:flex-col w-full border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
            }}
          >
            <TableHeader>
              <TableColumn>ชื่อ</TableColumn>
              <TableColumn>เบอร์โทร</TableColumn>
              <TableColumn>เครดิต</TableColumn>
              <TableColumn>สถานะ</TableColumn>
            </TableHeader>
            <TableBody emptyContent="ยังไม่มีสมาชิก">
              {members.map((member) => (
                <TableRow
                  key={member.id}
                  className="hover:bg-white rounded-2xl cursor-pointer"
                  onClick={() => router.push(`/members/read?id=${member.id}`)}
                >
                  <TableCell>
                    <User
                      avatarProps={{ radius: "lg", src: member?.image }}
                      name={member?.fname + " " + member?.lname}
                      description={member.code}
                    />
                  </TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>
                    <span className="font-bold text-[#c09c42]">
                      {member.credits.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip
                      className="capitalize border-none gap-1 text-default-600"
                      color={statusColorMap[member.status.toString() || "0"]}
                      size="sm"
                      variant="dot"
                    >
                      {statusTextMap[member.status.toString()] || member.status}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div>
          <CmpFilter />
        </div>
      </div>
    </div>
  );
}
