"use client";

import { Select, SelectItem } from "@heroui/select";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";

export function StoreBranchSelector() {
  const { stores, branches, selectedStore, selectedBranch, setSelectedStore, setSelectedBranch } =
    useStore();
  const { isMaster, isOwner } = useAuth();

  // Only show selector for master and owner
  const canSelectStore = isMaster;
  const canSelectBranch = isMaster || isOwner;

  if (!canSelectStore && !canSelectBranch) return null;

  return (
    <div className="flex flex-row items-center gap-2">
      {canSelectStore && stores.length > 0 && (
        <Select
          size="sm"
          placeholder="เลือกร้าน"
          className="w-40"
          classNames={{
            trigger:
              "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-xl min-h-8 h-8",
            value: "text-xs",
          }}
          selectedKeys={selectedStore ? [String(selectedStore.id)] : []}
          onChange={(e) => {
            const store = stores.find((s) => String(s.id) === e.target.value);
            setSelectedStore(store || null);
          }}
        >
          {stores.map((store) => (
            <SelectItem key={String(store.id)}>{store.name}</SelectItem>
          ))}
        </Select>
      )}

      {canSelectBranch && branches.length > 0 && (
        <Select
          size="sm"
          placeholder="เลือกสาขา"
          className="w-40"
          classNames={{
            trigger:
              "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-xl min-h-8 h-8",
            value: "text-xs",
          }}
          selectedKeys={selectedBranch ? [String(selectedBranch.id)] : []}
          onChange={(e) => {
            const branch = branches.find((b) => String(b.id) === e.target.value);
            setSelectedBranch(branch || null);
          }}
        >
          {branches.map((branch) => (
            <SelectItem key={String(branch.id)}>{branch.name}</SelectItem>
          ))}
        </Select>
      )}
    </div>
  );
}
