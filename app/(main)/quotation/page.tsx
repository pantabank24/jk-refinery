"use client";

import { Coins, HomeIcon } from "lucide-react";
import { Progress } from "@heroui/progress";
import { BoxCard } from "@/components/boxcard";
import { Avatar } from "@heroui/avatar";
import { Calculate } from "./_component/calculate";
import { TabsComponent, TabsProps } from "@/components/tabs";
import { useState } from "react";
import { Quotation, QuotationProps } from "./_component/quotation";
import { PreviewQuote } from "./_component/previewQuote";
import { Preview } from "./_component/preview";

export default function Home() {
  const tabs: TabsProps[] = [
    {
      id: 1,
      name: "ทอง",
      icon: <HomeIcon size={20} />,
    },
    {
      id: 2,
      name: "เงิน",
      icon: <HomeIcon size={20} />,
    },
    {
      id: 3,
      name: "แพลตินัม",
      icon: <HomeIcon size={20} />,
    },
    {
      id: 4,
      name: "แพลเลเดียม",
      icon: <HomeIcon size={20} />,
    },
  ];

  const [tab, setTab] = useState(1);

  const [quotation, setQuotation] = useState<QuotationProps[]>([
    {
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
    },
    {
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
    },
    {
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
    },
    {
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
    },
    {
      typeId: "0",
      typeName: "ทอง",
      plus: 0,
      price: 0,
      percent: 0,
      weight: 0,
      perGram: 0,
      total: 0,
    },
  ]);

  return (
    <div className=" h-full flex flex-row gap-x-5 ">
      <div className=" flex flex-col w-full lg:flex-col-reverse justify-center items-center">
        <Calculate />
        <TabsComponent tabs={tabs} />
        {/* <Preview items={quotation} /> */}
      </div>
      <Quotation quotation={quotation} />
    </div>
  );
}
