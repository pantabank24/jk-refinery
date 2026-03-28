import { Printer } from "lucide-react";
import { PreviewQuote } from "./previewQuote";
import { QuotationProps } from "./quotation";

interface Props {
    items: QuotationProps[];
}

export const Preview = ({items}: Props) => {

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className=" flex flex-col w-full h-full">
            <button
                onClick={handlePrint}
                className="no-print backdrop-blur-xl border w-28 justify-evenly border-white/20 bg-gradient-to-b from-blue-500/60 to-blue-500/50 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 flex flex-row items-center pr-4 mb-4"
            >
                <Printer size={20} />
                พิมพ์
            </button>
            <div className=" flex h-full overflow-auto scrollbar-hide">
                <PreviewQuote items={items} onPrint={handlePrint} />
            </div>
        </div>
    );
};