import { Button } from "@heroui/button";
import { X, Save } from "lucide-react";

export interface QuotationProps {
    typeId: string;
    typeName: string;
    price: number;
    plus: number;
    percent: number;
    weight: number;
    perGram: number;
    total: number;
}

interface Props {
    quotation: QuotationProps[];
    onRemove: (index: number) => void;
    onSave: () => void;
    saving: boolean;
}

export const Quotation = ({ quotation, onRemove, onSave, saving }: Props) => {
    const totalAmount = quotation.reduce((s, i) => s + i.total, 0);
    const totalWeight = quotation.reduce((s, i) => s + (i.weight || 0), 0);
    return (
        <div className="flex flex-col h-full w-full max-w-[500px] border-1 border-black/10 bg-white/15 shadow-xl backdrop-blur-xl rounded-4xl p-3 gap-y-2 max-lg:hidden">
            <span className=" font-bold text-xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">รายการใบเสนอราคา</span>
            <div className=" flex flex-col gap-y-2 overflow-y-auto scrollbar-hide rounded-2xl flex-1">
                {quotation.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-black/40 text-sm">
                        กด + เพื่อเพิ่มรายการ
                    </div>
                ) : (
                    quotation.map((item, index) => (
                        <div key={index} className=" flex flex-col w-full border-1 border-black/10 bg-black/5  backdrop-blur-xl rounded-2xl p-3">
                            <div className=" flex w-full justify-between mb-2">
                                <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{index + 1}. {item.typeName}</span>
                                <div
                                    className=" cursor-pointer h-5 w-5 bg-gradient-to-br from-red-600/50 to-transparent border-1 border-black/10 rounded-full flex items-center justify-center"
                                    onClick={() => onRemove(index)}
                                >
                                    <X size={15} className=" text-red-600" />
                                </div>
                            </div>
                            <div className=" w-full grid grid-cols-3 gap-2">
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">ราคา</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.price.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">ราคาบวก</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.plus.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">เปอร์เซ็นต์</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.percent}</span>
                                </div>
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">น้ำหนัก</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.weight}</span>
                                </div>
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">ต่อกรัม</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.perGram.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col h-full w-full border-1 border-black/10 bg-black/5 shadow-xl backdrop-blur-xl rounded-xl p-1">
                                    <span className=" font-bold text-xs text-black pl-2">รวม</span>
                                    <span className=" font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">{item.total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Summary above the save button: weight and total */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                    <span className="font-bold text-[10px] text-black/50 pl-1">น้ำหนักรวม</span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
                        {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex flex-col border-1 border-black/10 bg-black/5 rounded-xl p-1.5">
                    <span className="font-bold text-[10px] text-black/50 pl-1">ยอดรวม</span>
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-1">
                        {totalAmount.toLocaleString()}
                    </span>
                </div>
            </div>

            <Button
                className=" w-full bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold"
                isDisabled={quotation.length === 0}
                isLoading={saving}
                onPress={onSave}
                startContent={!saving ? <Save size={16} /> : undefined}
            >
                บันทึกใบเสนอราคา
            </Button>
        </div>
    );
}
