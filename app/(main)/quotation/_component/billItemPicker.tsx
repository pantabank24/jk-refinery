"use client";

import { SkeletonList } from "@/components/skeleton";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";

// A customer bill item the master can pick for the current issuance round.
export interface PickableItem {
  billId: number;
  itemId: number;
  typeName: string;
  metal?: string;
  price: number;
  weight: number;
  total: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: PickableItem[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  loading?: boolean;
}

// Shared picker for "which submitted items to issue this round". Ticked items are
// averaged into the round's locked price; unticked ones stay in the bill for later.
// Used both on the bills list (before opening the quote) and on the quote page.
export function BillItemPicker({
  isOpen, onClose, items, selected, onChange, onConfirm, confirmLabel = "ยืนยัน", loading = false,
}: Props) {
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const allSelected = items.length > 0 && selected.size === items.length;
  const sel = items.filter((i) => selected.has(i.itemId));
  const selTotal = sel.reduce((s, i) => s + i.total, 0);
  const selWeight = sel.reduce((s, i) => s + (i.weight || 0), 0);
  const selAvg = selWeight > 0 ? selTotal / selWeight : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      classNames={{ base: "rounded-3xl border-1 border-black/10 shadow-2xl" }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
            เลือกรายการที่จะออกใบ
          </span>
          <span className="text-xs font-normal text-black/50">
            ติ๊กรายการที่จะออกใบรอบนี้ — รายการที่ไม่ติ๊กจะค้างในบิลรอออกรอบถัดไป
          </span>
        </ModalHeader>
        <ModalBody>
          {loading ? (
            <SkeletonList rows={6} />
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-black/40 text-sm">ไม่มีรายการให้เลือก</div>
          ) : (
            <div className="flex flex-col gap-y-3">
              <Checkbox
                size="sm"
                color="warning"
                isSelected={allSelected}
                isIndeterminate={!allSelected && selected.size > 0}
                onValueChange={(v) => onChange(v ? new Set(items.map((i) => i.itemId)) : new Set())}
              >
                <span className="text-sm font-bold text-black/70">เลือกทั้งหมด ({items.length} รายการ)</span>
              </Checkbox>

              <div className="flex flex-col gap-y-1.5">
                {items.map((it, i) => {
                  const ticked = selected.has(it.itemId);
                  return (
                    <div
                      key={it.itemId}
                      className={`flex items-center gap-x-2 border rounded-xl px-3 py-2 transition-colors ${ticked ? "bg-yellow-500/10 border-yellow-500/30" : "bg-black/5 border-black/10 opacity-60"}`}
                    >
                      <Checkbox
                        size="sm"
                        color="warning"
                        isSelected={ticked}
                        onValueChange={() => toggle(it.itemId)}
                        aria-label={`เลือก ${it.typeName}`}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-bold text-black/70 truncate">{i + 1}. {it.typeName}</span>
                        <span className="text-[11px] text-black/50 whitespace-nowrap">
                          ราคา {it.price.toLocaleString()} · น้ำหนัก {it.weight} · รวม {it.total.toLocaleString()} บาท
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary — this is exactly what will lock the round's price */}
              <div className="grid grid-cols-3 gap-1.5 border-1 border-yellow-200 bg-yellow-50 rounded-xl p-2.5">
                <div className="flex flex-col">
                  <span className="text-[10px] text-black/50">เลือกแล้ว</span>
                  <span className="text-sm font-bold text-yellow-700">{selected.size}/{items.length} รายการ</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-black/50">ราคาเฉลี่ย</span>
                  <span className="text-sm font-bold text-yellow-700">{selAvg > 0 ? selAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-black/50">ยอดที่เลือก</span>
                  <span className="text-sm font-bold text-yellow-700">{selTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>ยกเลิก</Button>
          <Button
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
            onPress={onConfirm}
            isDisabled={loading || selected.size === 0}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
