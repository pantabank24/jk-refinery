"use client";

import { Avatar } from "@heroui/avatar";
import { MemberCard } from "../_components/memberCard";
import { BoxCard } from "@/components/boxcard";
import { ArrowLeft, Coins, Plus, PlusIcon } from "lucide-react";
import { Button } from "@heroui/button";
import { CmpTab } from "../_components/tab";
import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  User,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
} from "@heroui/react";
import { CmpInput } from "@/components/cmpInput";
import { CmpSelect } from "@/components/cmpSelect";
import { CmpBack } from "@/components/cmpBack";

export const MemberDetail = () => {
  const [tab, setTab] = useState<string>("quote");

  const members: BuyerDto = {
    id: "0000001",
    username: "jkgoldrefinery",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    fname: "คุณวีรชัย",
    lname: "ชัยนุมาศ",
    phone: "0887779997",
    credits: 100,
    status: 0,
    createdAt: "2025-12-12 00:00:00",
    updatedAt: "2025-12-12 00:00:00",
  };

  const quotation: QuotationListResDto[] = [
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "QUOT0000001",
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
      status: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
  ];

  const creditTransaction: CreditTransactionResDto[] = [
    {
      id: "CT0000001",
      action: 0,
      amount: 0,
      balance: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "CT0000001",
      action: 1,
      amount: 0,
      balance: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
    {
      id: "CT0000001",
      action: 2,
      amount: 0,
      balance: 0,
      createdAt: "2025-12-12 00:00:00",
      updatedAt: "2025-12-12 00:00:00",
    },
  ];

  const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
    "0": "success",
    "1": "danger",
    "2": "warning",
  };

  const {
    isOpen: isOpenCredit,
    onOpen: onOpenCredit,
    onOpenChange: onOpenChangeCredit,
  } = useDisclosure();

  return (
    <div className=" flex flex-col w-full h-full ">
      <CmpBack />

      <div className=" max-md:mt-12 flex flex-col md:flex-row w-full flex-1 min-h-0 gap-x-5 ">
        <div className=" flex flex-col gap-y-2">
          <MemberCard data={members} />
          <BoxCard
            flex
            color="bg-gradient-to-tl from-transparent to-yellow-200"
            textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent"
            title="เครดิตคงเหลือ"
            unit="บาท"
            icon={<Coins size={45} className=" text-yellow-600" />}
            value="40,000"
            max="80,000"
            progress={50}
          />
        </div>

        <div className=" flex flex-col w-full gap-y-2 ">
          <div>
            <CmpTab onChange={(key) => setTab(key)} />
          </div>

          {tab == "quote" ? (
            <div className="flex flex-col w-full border-1 border-black/10 bg-white/20  backdrop-blur-xl rounded-xl md:flex-1 md:min-h-0 p-2 shadow-xl">
              <div className=" flex flex-row w-full justify-end gap-x-2 mb-3">
                <div>
                  <CmpInput value="" placeholder="ค้นหา" onChange={() => {}} />
                </div>
                <div className=" w-36">
                  <CmpSelect
                    data={[]}
                    value=""
                    placeholder="สถานะ"
                    onChange={() => {}}
                  />
                </div>
              </div>
              <Table
                isHeaderSticky
                className=" md:col-span-2"
                radius="sm"
                removeWrapper
                classNames={{
                  base: " flex flex-col h-full overflow-y-scroll scrollbar-hide",
                }}
              >
                <TableHeader>
                  <TableColumn>เลขที่</TableColumn>
                  <TableColumn>ราคาประเมิน</TableColumn>
                  <TableColumn>สถานะ</TableColumn>
                  <TableColumn>ออกเมื่อ</TableColumn>
                </TableHeader>
                <TableBody>
                  {quotation.map((item, index) => (
                    <TableRow
                      key={index}
                      className=" hover:bg-white rounded-full"
                    >
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.price}</TableCell>
                      <TableCell>
                        <Chip
                          className="capitalize border-none gap-1 text-default-600"
                          color={statusColorMap[item.status.toString() || "0"]}
                          size="sm"
                          variant="dot"
                        >
                          {item.status}
                        </Chip>
                      </TableCell>
                      <TableCell>{item.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col w-full border-1 border-black/10 bg-white/20  backdrop-blur-xl rounded-xl md:flex-1 md:min-h-0 p-2 shadow-xl">
              <div className=" flex flex-row w-full justify-end gap-x-2 mb-3">
                <div className=" w-36">
                  <CmpSelect
                    data={[]}
                    value=""
                    placeholder="สถานะ"
                    onChange={() => {}}
                  />
                </div>
                <div className=" flex h-full">
                  <Button
                    className="border-1 h-full border-black/10 bg-black/5  backdrop-blur-xl rounded-xl font-bold shadow-md"
                    startContent={<Plus size={15} />}
                    size="md"
                    onPress={onOpenCredit}
                  >
                    <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      เพิ่มเครดิต
                    </div>
                  </Button>
                </div>
              </div>
              <Table
                isHeaderSticky
                className=" md:col-span-2"
                radius="sm"
                removeWrapper
                classNames={{
                  base: " flex flex-col h-full overflow-y-scroll scrollbar-hide",
                }}
              >
                <TableHeader>
                  <TableColumn>วันที่</TableColumn>
                  <TableColumn>Action</TableColumn>
                  <TableColumn>จำนวน</TableColumn>
                  <TableColumn>คงเหลือ</TableColumn>
                </TableHeader>
                <TableBody>
                  {creditTransaction.map((item, index) => (
                    <TableRow
                      key={index}
                      className=" hover:bg-white rounded-full"
                    >
                      <TableCell>{item.createdAt}</TableCell>
                      <TableCell>
                        <Chip
                          className="capitalize border-none gap-1 text-default-600"
                          color={statusColorMap[item.action.toString() || "0"]}
                          size="sm"
                          variant="dot"
                        >
                          {item.action}
                        </Chip>
                      </TableCell>
                      <TableCell>{item.amount}</TableCell>
                      <TableCell>{item.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isOpenCredit}
        onOpenChange={onOpenChangeCredit}
        backdrop="blur"
        className="bg-white/50"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div>
                  <span className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
                    จัดการเครดิต
                  </span>
                </div>
              </ModalHeader>
              <ModalBody>
                <Tabs aria-label="Options">
                  <Tab key="increase" title="เพิ่ม"></Tab>
                  <Tab key="reduce" title="ลด"></Tab>
                </Tabs>
                <CmpInput
                  label="ระบุจำนวน"
                  placeholder="0"
                  value=""
                  onChange={(e) => console.log(e.target.value)}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  ยกเลิก
                </Button>
                <Button className=" h-10 bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold">
                  บันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
