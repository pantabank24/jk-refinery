"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

// The privacy-notice gate. A customer who has not acknowledged the current
// version of the shop's notice sees this and nothing else — no close button, no
// Escape, no dismissing by clicking away.
//
// It asks for acknowledgement, not consent, for the shop's core handling: buying
// and paying for metal runs on the contract with the customer, and keeping the
// paperwork runs on tax law. Neither is something a customer could meaningfully
// refuse and still be a customer, and calling it consent would promise a
// withdrawal the shop is legally unable to honour. What IS consent — the
// marketing opt-in — is deliberately NOT here: a window the customer cannot
// close is the worst place to put a decision in front of them, and a tick box
// beside a notice invites second-guessing a notice that only needs reading. It
// lives on the profile page instead.
//
// The one deliberate escape is ออกจากระบบ: nobody should be trapped in a screen
// whose only physical option is to agree. It stays a quiet text link rather than
// a second button competing with รับทราบ.
export function PdpaConsentModal() {
  const { pdpa, acceptPdpa, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The server sends pdpa only while an acknowledgement is outstanding.
  if (!pdpa?.required) return null;

  const handleAccept = async () => {
    setSaving(true);
    setError("");
    try {
      await acceptPdpa();
    } catch (err: unknown) {
      // Nothing else can dismiss this modal, so a failed save must say so —
      // otherwise the button just goes quiet and the screen looks broken.
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      hideCloseButton
      isDismissable={false}
      isKeyboardDismissDisabled
      scrollBehavior="inside"
      placement="bottom"
      size="2xl"
      classNames={{
        // A sheet rising off the bottom edge: full width and square-bottomed on a
        // phone so it reads as part of the screen rather than a card floating in
        // the middle, and lifted back into a rounded panel from sm up.
        wrapper: "items-end",
        base: "m-0 sm:mb-4 sm:mx-auto max-w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl rounded-b-none sm:rounded-b-3xl bg-white/90 backdrop-blur-xl border-1 border-black/10",
      }}
    >
      <ModalContent>
        {/* The grab-handle line phones use to say "this sheet came up from the
            bottom" — visual only; there is nothing to drag it away with. */}
        <div className="sm:hidden shrink-0 pt-2.5 pb-0.5 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-black/15" />
        </div>

        <ModalHeader className="flex flex-row items-center gap-x-2 pt-3">
          <span className="text-[#c09c42]">
            <ShieldCheck size={20} />
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              ประกาศความเป็นส่วนตัว
            </span>
            <span className="text-xs font-normal text-black/40">
              กรุณาอ่านและกดรับทราบก่อนเริ่มใช้งาน
            </span>
          </div>
        </ModalHeader>

        <ModalBody>
          {/* The text is authored in ตั้งค่าระบบ as plain text with blank lines
              between paragraphs, so it is rendered pre-line rather than parsed. */}
          <div className="border-1 border-black/10 bg-black/5 rounded-2xl p-4 text-sm text-black/70 leading-relaxed whitespace-pre-line">
            {pdpa.text}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border-1 border-red-200 rounded-xl px-4 py-2">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex flex-col gap-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            fullWidth
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl"
            isLoading={saving}
            onPress={handleAccept}
          >
            รับทราบ
          </Button>
          <button
            type="button"
            onClick={logout}
            className="self-center text-xs font-bold text-black/40 hover:text-black/60 transition-colors py-1"
          >
            ออกจากระบบ
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
