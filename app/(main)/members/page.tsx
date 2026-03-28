"use client";

import { CmpFilter } from "@/components/cmpFilter";

import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  User,
  Chip,
  Button,
} from "@heroui/react";
import { ArrowLeft, Plus, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Members() {
  const router = useRouter();
  const members: BuyerDto[] = [
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "BUY0000001",
      image: "",
      fname: "กอไก่",
      lname: "ขอไข่",
      phone: "0887779997",
      credits: 100,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
  ];

  const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
    "0": "success",
    "1": "danger",
    "2": "warning",
  };

  return (
    <div className=" flex flex-col h-full">
      <div className=" flex flex-row items-center justify-between shrink-0 py-5">
        <div className=" flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          สมาชิก
        </div>
        <Button
          className="border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl font-bold shadow-md"
          startContent={<Plus size={15} />}
          size="md"
          onPress={() => router.push("/members/add")}
        >
          <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
            เพิ่มสมาชิก
          </div>
        </Button>
      </div>
      <div className=" max-md:flex max-md:flex-col-reverse max-md:gap-y-2 md:grid md:grid-cols-3 flex-1 min-h-0 gap-x-5">
        <Table
          isHeaderSticky
          className=" md:col-span-2"
          radius="sm"
          removeWrapper
          classNames={{
            base: " flex flex-col h-full overflow-y-scroll scrollbar-hide flex flex-row md:flex-col w-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl p-2",
          }}
        >
          <TableHeader>
            <TableColumn>ชื่อ</TableColumn>
            <TableColumn>เบอร์โทร</TableColumn>
            <TableColumn>เครดิต</TableColumn>
            <TableColumn>สถานะ</TableColumn>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow
                key={index}
                className="hover:bg-white rounded-2xl cursor-pointer"
                onClick={() => router.push(`/members/read?id=${member.id}`)}
              >
                <TableCell>
                  <User
                    avatarProps={{ radius: "lg", src: member?.image }}
                    name={member?.fname + " " + member?.lname}
                  />
                </TableCell>
                <TableCell>{member.phone}</TableCell>
                <TableCell>{member.credits}</TableCell>
                <TableCell>
                  <Chip
                    className="capitalize border-none gap-1 text-default-600"
                    color={statusColorMap[member.status.toString() || "0"]}
                    size="sm"
                    variant="dot"
                  >
                    {member.status}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div>
          <CmpFilter />
        </div>
      </div>
    </div>
  );
}
