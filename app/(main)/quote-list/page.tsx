'use client'

import { TabsComponent, TabsProps } from "@/components/tabs";
import { Avatar } from "@heroui/avatar";
import { HomeIcon } from "lucide-react";
import { useState } from "react";
import moment from "moment";
import { CmpInput } from "@/components/cmpInput";
import { DatePicker } from "@heroui/date-picker";

export default function QuoteList() {
    const tabs:TabsProps[] = [
      {
        id: 1,
        name: "ทั้งหมด",
        icon: <HomeIcon size={20} />
      },
      {
        id: 2,
        name: "รอดตรวจสอบ",
        icon: <HomeIcon size={20} />
      },
      {
        id: 3,
        name: "สำเร็จ",
        icon: <HomeIcon size={20} />
      },
      {
        id: 4,
        name: "ยกเลิก",
        icon: <HomeIcon size={20} />
      },
    ]
    const [quotation, setQuotation] = useState<QuotationResDto[]>([
      {
        id: "QUOT0000001",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 0,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 1,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      },
      {
        id: "QUOT0000002",
        buyer: {
          id: "BUY0000001",
          image: "",
          fname: "กอไก่",
          lname: "ขอไข่",
          phone: "0887779997",
          status: 0,
          createdAt: "2025-12-12 00:00:00",
          updatedAt: "2025-12-12 00:00:00"
        },
        quotation: [
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
            updatedAt: "2025-12-12 00:00:00"
          },
        ],
        status: 2,
        createdAt: "2025-12-12 00:00:00",
        updatedAt: "2025-12-12 00:00:00"
      }
    ]);

    return (
        <div className=" flex flex-col-reverse lg:flex-col w-full h-full lg:w-1/2">
            <TabsComponent tabs={tabs} />
            <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl p-3 gap-y-2 overflow-y-scroll scrollbar-hide">
                <span className=" font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">รายการใบเสนอราคา</span>
                <div className=" flex flex-row w-full items-center gap-x-2">
                  <CmpInput placeholder="ค้นหา" value="" onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)} />
                  <DatePicker 
                    className="max-w-[284px]" 
                    classNames={{
                      inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl"
                    }} 
                  />
                </div>
                <div className=" flex flex-col w-full h-full items-start gap-y-2 overflow-y-scroll scrollbar-hide">
                  {quotation.map((item, index) => (
                    <div key={index} className=" flex flex-col w-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl p-2 cursor-pointer">
                     <div className=" flex flex-col w-full h-full py-2">
                       <div className=" flex flex-row w-full items-center justify-between gap-x-2">
                        <span className=" font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">เลขที่ : {item.id}</span>
                        <span className=" font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">ราคาประเมิน {item.quotation.reduce((total, quotation) => total + quotation.total, 0)} บาท</span>
                      </div>

                      <span className=" text-[10px] text-black ">ออกใบเสนอราคาเมื่อ : {moment(item.createdAt).format("DD/MM/YYYY HH:mm")}</span>
                      </div>

                      <div className=" flex flex-row w-full border-1 border-black/10 bg-white/50  backdrop-blur-xl rounded-xl p-2 gap-x-3 items-center justify-between">
                        <div className=" flex flex-row gap-x-2">
                          <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="md" />
                          <div className=" flex flex-col">
                            <span className=" font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">{item.buyer.fname} {item.buyer.lname}</span>
                            <span className=" font-bold text-[10px] text-black">โทร {item.buyer.phone}</span>
                          </div>
                        </div>
                        <div >
                          <span className={
                            `font-bold text-sm bg-gradient-to-l from-transparent 
                             ${item.status === 0 ? "to-yellow-600/50" : item.status === 1 ? "to-green-600/50" : "to-red-600/50"} 
                             border-1 border-black/10 px-2 rounded-full text-black/70`
                          }>{
                            item.status === 0 
                              ? "รอตรวจสอบ" 
                              : item.status === 1 
                              ? "สำเร็จ" 
                              : "ยกเลิก"
                          }</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
        </div>
    )
}