'use client'

import { BoxCard } from "@/components/boxcard";
import { TabsComponent, TabsProps } from "@/components/tabs";
import { Tab, Tabs } from "@heroui/tabs";
import { ArrowUp, ArrowUpFromDot, Home } from "lucide-react";
import { Input } from "@heroui/input";
import { CmpInput } from "@/components/cmpInput";
import { useState } from "react";
import { CmpSelect, Option } from "@/components/cmpSelect";
import { Button } from "@heroui/button";
import { CmpButton } from "@/components/cmpButton";

export const Calculate = () => {

  const goldType:Option[] = [
    {
      value: "0",
      label: "ทองหลอม"
    },
    {
      value: "1",
      label: "ทองคำแท่ง 96.5%"
    },
    {
      value: "2",
      label: "ทองรูปพรรณ"
    },
    {
      value: "3",
      label: "กรอบทอง/ตลับทอง"
    },
    {
      value: "4",
      label: "ทอง 9K"
    },
    {
      value: "5",
      label: "ทอง 14K"
    },
    {
      value: "6",
      label: "ทอง 18K"
    },
    {
      value: "7",
      label: "อื่น ๆ"
    }
  ]

    return (
        <div className=" flex flex-col h-full w-full xl:w-[700px] overflow-hidden">
            <div className="flex flex-col h-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-4xl p-3 gap-y-2 overflow-y-scroll scrollbar-hide">
              <div className={`flex flex-row w-full bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 p-2 rounded-3xl `}>
                <div className=" flex flex-row w-full justify-between">
                  <span className=" text-[10px] font-bold text-black/50">อัปเดท : 11 December 2025 21:13</span>
                  <div className=" flex flex-row items-center gap-x-2">
                    <div className=" flex flex-row items-center text-green-800">
                      <ArrowUp size={10} className=" font-bold" />
                      <span className=" text-[10px] font-bold">100</span>
                    </div>

                    <div className=" flex flex-row items-center text-green-800">
                      <span className=" text-[10px] font-bold">วันนี้</span>
                      <span className=" text-[10px] font-bold ml-1">200</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-full grid grid-cols-2 gap-x-2">
                <BoxCard textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent" flex title="ราคารับซื้อ (บาท)" value="63,350" />
                <BoxCard textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent" flex title="ราคาขาย (บาท)" value="63,450" />
              </div>

              <span className=" font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 mt-5">คำนวณราคาทอง</span>

              <div className=" w-full grid grid-cols-2 gap-2 mb-5">
                <CmpInput label="ราคาทอง" placeholder="0" value="" onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)} />
                <CmpSelect data={goldType} label="ประเภท" placeholder="เลือก" value="" onChange={(value) => console.log(value)} />
                <CmpInput label="เปอร์เซ็นต์ %" placeholder="0" value="" onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)} />
                <CmpInput label="ราคาบวก" placeholder="0" value="" onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)} />
                <CmpInput label="น้ำหนัก" placeholder="0" value="" onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)} />
              </div>

              <BoxCard 
                textColor="bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent" 
                color="bg-gradient-to-l from-transparent to-yellow-600/50"
                flex 
                title="ราคาประเมิน" 
                subtitle="อัพเดทราคาทุก 30 วินาที"
                value="63,350" 
              />

              <div className=" flex h-full w-full items-end justify-end">
                <CmpButton />
              </div>
            </div>
            
        </div>
    );
}