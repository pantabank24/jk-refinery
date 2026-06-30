"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Camera, RotateCcw, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// Live webcam preview in a modal; captures a still frame as a File on confirm.
export function WebcamCaptureModal({ isOpen, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [captured, setCaptured] = useState<string | null>(null); // preview data-URL before confirming

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setCaptured(null);
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์"));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  const handleShot = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleConfirm = () => {
    if (!captured) return;
    fetch(captured)
      .then((res) => res.blob())
      .then((blob) => {
        onCapture(new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="md">
      <ModalContent>
        <ModalHeader>ถ่ายภาพจากกล้อง</ModalHeader>
        <ModalBody>
          {error ? (
            <div className="flex flex-col items-center gap-y-2 py-8 text-center text-sm text-red-500">
              <AlertCircle size={28} />
              {error}
            </div>
          ) : captured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured} alt="ภาพที่ถ่าย" className="w-full rounded-xl border border-black/10" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl border border-black/10 bg-black"
            />
          )}
        </ModalBody>
        <ModalFooter>
          {captured ? (
            <>
              <Button variant="light" startContent={<RotateCcw size={16} />} onPress={() => setCaptured(null)}>
                ถ่ายใหม่
              </Button>
              <Button
                className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
                onPress={handleConfirm}
              >
                ใช้รูปนี้
              </Button>
            </>
          ) : (
            <Button
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold"
              startContent={<Camera size={16} />}
              onPress={handleShot}
              isDisabled={!!error}
            >
              ถ่ายภาพ
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
