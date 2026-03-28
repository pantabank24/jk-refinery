import { Button } from "@heroui/button"
import { Plus } from "lucide-react"

export const CmpButton = () => {
    return (
        <div
            className="bg-gradient-to-br from-blue-600/50 to-transparent border-1 border-black/10 rounded-full w-14 h-14 flex items-center justify-center"
        >
            <Plus size={20} />
        </div>
    )
}