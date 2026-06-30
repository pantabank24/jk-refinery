"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Name of the record being deleted, shown in bold. */
  name?: string;
  /** Optional note listing related records that get removed too. */
  related?: string;
  loading?: boolean;
}

// Shared confirm dialog for delete actions. Keeps the wording + danger styling
// consistent across every deletable resource.
export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, name, related, loading }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-x-2">
          <AlertTriangle size={18} className="text-red-600" />
          <span className="font-bold text-red-600">ยืนยันการลบ</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-black/70">
            ต้องการลบ {name ? <span className="font-bold">{name}</span> : "รายการนี้"} หรือไม่?
          </p>
          {related && (
            <p className="text-xs text-amber-700 bg-amber-50 border-1 border-amber-200 rounded-xl p-2">
              {related}
            </p>
          )}
          <p className="text-[11px] text-black/40">การลบนี้ไม่สามารถย้อนกลับได้จากหน้านี้</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={loading}>ยกเลิก</Button>
          <Button color="danger" onPress={onConfirm} isLoading={loading}>ลบ</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
