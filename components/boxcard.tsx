import { Progress } from "@heroui/progress"
import { Coins } from "lucide-react"

interface Props {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    value: string;
    flex?: boolean;
    max?: string;
    progress?: number;
    unit?: string;
    color?: string;
    textColor?: string;
}

export const BoxCard = ({title, subtitle, icon, value, flex = false, max, progress, unit, color, textColor}: Props) => {
    return (
        <div className={`flex flex-col ${flex ? "w-full" : " w-full lg:w-96"} ${color ? color : "bg-gradient-to-br from-black/10 to-transparent"} border-1 border-black/10 p-4 rounded-3xl gap-y-2`}>
            <span className=" font-bold">{title}</span>
            <div className=" flex flex-row gap-x-4 items-center">
            {icon}
            <div>
                <span className={`font-bold text-3xl ${textColor ? textColor : "bg-gradient-to-l from-black/90 to-black/30"}  bg-clip-text text-transparent`}>{value} {unit}</span>
                {max && <span className=" font-bold text-xs text-black/50"> / {max}</span>}
            </div>
            </div>
            {subtitle && <span className=" font-bold text-xs text-black/50">{subtitle}</span>}

            {
                progress && (
                    <div className=" flex w-full p-2 bg-white/50 backdrop-blur-2xl border-1 border-black/5 rounded-2xl items-center gap-x-2">
                    <Progress aria-label="Loading..." color="warning" value={progress} size="md" />
                    <span className=" text-xs font-bold">{progress}%</span>
                </div>
                )
            }
        
      </div>
    )
}