import { Tabs, Tab, Chip } from "@heroui/react";
import { Coins, FileSpreadsheet } from "lucide-react";

interface Props {
  onChange: (value: string) => void;
}

export const CmpTab = ({ onChange }: Props) => {
  return (
    <Tabs
      aria-label="Options"
      color="warning"
      variant="underlined"
      onSelectionChange={(key) => onChange(key.toString())}
    >
      <Tab
        key="quote"
        className=" h-20"
        title={
          <div className="flex flex-col items-center">
            <div className=" flex w-14 h-14 items-center justify-center border-1 border-black/10 bg-gradient-to-l from-transparent to-yellow-600/50  backdrop-blur-xl rounded-full">
              <FileSpreadsheet size={30} />
            </div>
            <div className=" flex flex-row gap-x-1">
              <span>ใบเสนอราคา</span>
            </div>
          </div>
        }
      />
      <Tab
        key="credits"
        className=" h-20"
        title={
          <div className="flex flex-col items-center">
            <div className=" flex w-14 h-14 items-center justify-center border-1 border-black/10 bg-gradient-to-l from-transparent to-yellow-600/50  backdrop-blur-xl rounded-full">
              <Coins size={30} />
            </div>
            <div className=" flex flex-row gap-x-1">
              <span>เครดิต</span>
            </div>
          </div>
        }
      />
    </Tabs>
  );
};
