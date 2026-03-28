import { Tabs, Tab } from "@heroui/tabs";

export interface TabsProps {
    id: number;
    name: string;
    icon: React.ReactNode;
}

interface Props {
    tabs: TabsProps[];
}

export const TabsComponent = ({ tabs }: Props) => {
    return (
        <div className=" flex flex-row w-full items-center justify-center max-lg:pt-4 lg:pb-2">
                <Tabs 
                    radius="full" 
                    size="lg"
                    classNames={{
                      tabList: "bg-black/5 backdrop-blur-xl border-1 border-black/10 shadow-sm text-amber-700",
                      tab: " font-bold text-md",
                      panel: "bg-black"
                    }}
                    >
                    {tabs.map((tab) => (
                        <Tab key={tab.id} title={tab.name} />
                    ))}
                </Tabs>
            </div>
    )
}