"use client";

import { SkeletonList } from "@/components/skeleton";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import {
  Ban,
  Camera,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronRight as GoIcon,
  IdCard,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ImageViewer } from "@/components/image-viewer";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import { EditIntakeModal } from "./_component/editIntakeModal";
import {
  INTAKE_CANCELLED,
  INTAKE_OPEN,
  INTAKE_STATUS_COLOR,
  INTAKE_STATUS_LABEL,
  INTAKE_USED,
  intakeImages,
  type QuotationIntake,
} from "./_component/types";

const PAGE_SIZE = 20;

const TABS: { key: string; label: string; status?: number }[] = [
  { key: "open", label: "รอออกใบเสนอราคา", status: INTAKE_OPEN },
  { key: "used", label: "ออกใบเสนอราคาแล้ว", status: INTAKE_USED },
  { key: "cancelled", label: "ยกเลิก", status: INTAKE_CANCELLED },
  { key: "all", label: "ทั้งหมด" },
];

// รายการใบเปิดงาน. Picking an open row drops straight into the quotation screen
// with that job's customer and before-melt photos already attached — the point of
// the whole flow is that the counter never has to re-key or re-shoot any of it.
export default function QuotationIntakeListPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("quotations.read");
  const canCreate = hasPermission("quotations.create");
  const canDelete = hasPermission("quotations.delete");

  const [intakes, setIntakes] = useState<QuotationIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  // Full-screen photo viewer for one intake's pictures.
  const [viewer, setViewer] = useState<{ images: { url: string; name: string }[]; index: number } | null>(null);

  const [editing, setEditing] = useState<QuotationIntake | null>(null);
  const cancelDisc = useDisclosure();
  const deleteDisc = useDisclosure();
  const [target, setTarget] = useState<QuotationIntake | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  const fetchIntakes = useCallback(async () => {
    setLoading(true);
    try {
      const status = TABS.find((t) => t.key === tab)?.status;
      const params = [`page=${page}`, `limit=${PAGE_SIZE}`];
      if (status !== undefined) params.push(`status=${status}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      const res = await api.get<QuotationIntake[]>(`/quotation-intakes?${params.join("&")}`);
      setIntakes((res.data as unknown as QuotationIntake[]) || []);
      setTotalPages((res as { total_pages?: number }).total_pages || 1);
      setTotalRows((res as { total_rows?: number }).total_rows || 0);
    } catch {
      setIntakes([]);
      setTotalPages(1);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, tab]);

  useEffect(() => {
    if (canRead) void fetchIntakes();
  }, [canRead, fetchIntakes]);

  // An open job goes straight to the quotation screen; a closed one has nothing
  // left to do, so its row only opens its photos.
  const openIntake = (intake: QuotationIntake) => {
    if (intake.status === INTAKE_OPEN && canCreate) {
      router.push(`/quotation?intakeId=${intake.id}`);
      return;
    }
    showPhotos(intake);
  };

  const showPhotos = (intake: QuotationIntake) => {
    const images = [
      ...intakeImages(intake, "id_card").map((url, i) => ({
        url,
        name: `บัตรประชาชน ${i + 1}`,
      })),
      ...intakeImages(intake, "before_melt").map((url, i) => ({
        url,
        name: `ก่อนหลอม ${i + 1}`,
      })),
    ];
    if (images.length === 0) return;
    setViewer({ images, index: 0 });
  };

  const handleCancel = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.post(`/quotation-intakes/${target.id}/cancel`, {});
      cancelDisc.onClose();
      setTarget(null);
      await fetchIntakes();
    } catch {
      /* the api layer surfaces the error */
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.delete(`/quotation-intakes/${target.id}`);
      deleteDisc.onClose();
      setTarget(null);
      await fetchIntakes();
    } catch {
      /* the api layer surfaces the error */
    } finally {
      setBusy(false);
    }
  };

  const photoCounts = (intake: QuotationIntake) => ({
    before: intakeImages(intake, "before_melt").length,
    idCard: intakeImages(intake, "id_card").length,
  });

  const StatusChip = ({ status }: { status: number }) => (
    <span
      className={`inline-flex items-center rounded-full border-1 px-2 py-0.5 text-[10px] font-bold ${INTAKE_STATUS_COLOR[status]}`}
    >
      {INTAKE_STATUS_LABEL[status]}
    </span>
  );

  const PhotoBadges = ({ intake }: { intake: QuotationIntake }) => {
    const { before, idCard } = photoCounts(intake);
    return (
      <div className="flex items-center gap-x-2">
        <span
          className={`inline-flex items-center gap-x-1 text-[11px] font-bold ${idCard > 0 ? "text-[#c09c42]" : "text-black/25"}`}
        >
          <IdCard size={13} />
          {idCard}
        </span>
        <span
          className={`inline-flex items-center gap-x-1 text-[11px] font-bold ${before > 0 ? "text-[#c09c42]" : "text-black/25"}`}
        >
          <Camera size={13} />
          {before}
        </span>
      </div>
    );
  };

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div className="flex flex-row items-center justify-between shrink-0 py-5 gap-x-3">
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 truncate">
            เปิดใบเสนอราคา
          </span>
          <span className="text-xs text-black/40 pl-2">
            งานที่รับของและถ่ายรูปไว้แล้ว รอออกใบเสนอราคา
          </span>
        </div>
        {canCreate && (
          <Button
            size="sm"
            startContent={<Plus size={15} />}
            onPress={() => router.push("/quotation-intake/create")}
            className="shrink-0 bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold"
          >
            เปิดใบใหม่
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-y-2 shrink-0 pb-3">
        <Tabs
          size="sm"
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(String(key));
            setPage(1);
          }}
          classNames={{ tabList: "bg-black/5 border-1 border-black/10 rounded-2xl" }}
        >
          {TABS.map((t) => (
            <Tab key={t.key} title={t.label} />
          ))}
        </Tabs>
        <Input
          size="sm"
          variant="bordered"
          placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร"
          startContent={<Search size={15} className="text-black/30" />}
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          className="max-w-md"
        />
      </div>

      <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:scrollbar-hide">
        {loading ? (
          <SkeletonList rows={6} />
        ) : intakes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-2 py-10 text-black/40 text-sm">
            ยังไม่มีใบเปิดงานในหมวดนี้
            {canCreate && tab === "open" && (
              <Button
                size="sm"
                variant="flat"
                startContent={<Plus size={14} />}
                onPress={() => router.push("/quotation-intake/create")}
                className="rounded-xl border-1 border-black/10 bg-black/5 font-bold"
              >
                เปิดใบใหม่
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table
                isHeaderSticky
                radius="sm"
                removeWrapper
                classNames={{
                  base: "flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-2",
                }}
              >
                <TableHeader>
                  <TableColumn>เลขที่</TableColumn>
                  <TableColumn>วันที่เปิดงาน</TableColumn>
                  <TableColumn>ลูกค้า</TableColumn>
                  <TableColumn>รูป</TableColumn>
                  <TableColumn>สถานะ</TableColumn>
                  <TableColumn>ผู้เปิดงาน</TableColumn>
                  <TableColumn> </TableColumn>
                </TableHeader>
                <TableBody items={intakes} emptyContent="ไม่พบข้อมูล">
                  {(intake) => (
                    <TableRow
                      key={intake.id}
                      className="cursor-pointer hover:bg-white/60 rounded-xl"
                      onClick={() => openIntake(intake)}
                    >
                      <TableCell>
                        <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                          #{intake.id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/60">
                          {moment(intake.created_at).format("DD/MM/YYYY HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-black/70">
                            {intake.customer_name || "—"}
                          </span>
                          <span className="text-[10px] text-black/40">
                            {intake.customer_phone || "ไม่มีเบอร์โทร"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PhotoBadges intake={intake} />
                      </TableCell>
                      <TableCell>
                        <StatusChip status={intake.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/50">
                          {intake.creator?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {/* The row itself navigates, so the action buttons have to
                            stop the click here or "ยกเลิก" would also open the
                            quotation screen behind the dialog. */}
                        <div
                          className="flex items-center justify-end gap-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {intake.status === INTAKE_OPEN && canCreate && (
                            <>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                title="แก้ไขข้อมูล / เพิ่มรูป"
                                onPress={() => setEditing(intake)}
                              >
                                <Pencil size={15} className="text-black/40" />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                title="ยกเลิกใบเปิดงาน"
                                onPress={() => {
                                  setTarget(intake);
                                  cancelDisc.onOpen();
                                }}
                              >
                                <Ban size={15} className="text-black/40" />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                title="ออกใบเสนอราคา"
                                onPress={() => openIntake(intake)}
                              >
                                <GoIcon size={16} className="text-[#c09c42]" />
                              </Button>
                            </>
                          )}
                          {intake.status !== INTAKE_USED && canDelete && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              title="ลบใบเปิดงาน"
                              onPress={() => {
                                setTarget(intake);
                                deleteDisc.onOpen();
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: cards */}
            <div className="flex flex-col gap-y-2 pb-4 md:hidden">
              {intakes.map((intake) => (
                <div
                  key={intake.id}
                  onClick={() => openIntake(intake)}
                  className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-2 cursor-pointer hover:shadow-md"
                >
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      #{intake.id}
                    </span>
                    <StatusChip status={intake.status} />
                  </div>
                  <div className="flex flex-row items-end justify-between gap-x-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-black/70 truncate">
                        {intake.customer_name || "—"}
                      </span>
                      <span className="text-[10px] text-black/40 truncate">
                        {intake.customer_phone || "ไม่มีเบอร์โทร"} ·{" "}
                        {moment(intake.created_at).format("DD/MM/YYYY HH:mm")}
                      </span>
                    </div>
                    <PhotoBadges intake={intake} />
                  </div>
                  {intake.status === INTAKE_OPEN && (
                    <div
                      className="flex flex-row items-center justify-end gap-x-1 pt-1 border-t-1 border-black/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          startContent={<Trash2 size={14} />}
                          onPress={() => {
                            setTarget(intake);
                            deleteDisc.onOpen();
                          }}
                        >
                          ลบ
                        </Button>
                      )}
                      {canCreate && (
                        <Button
                          size="sm"
                          variant="light"
                          startContent={<Pencil size={14} />}
                          onPress={() => setEditing(intake)}
                        >
                          แก้ไข
                        </Button>
                      )}
                      {canCreate && (
                        <Button
                          size="sm"
                          variant="light"
                          startContent={<Ban size={14} />}
                          onPress={() => {
                            setTarget(intake);
                            cancelDisc.onOpen();
                          }}
                        >
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex flex-row items-center justify-center gap-x-3 shrink-0 pt-1 pb-4">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            isDisabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-black/60">
            {page} / {totalPages}
            <span className="text-xs text-black/35 ml-2">
              ทั้งหมด {totalRows.toLocaleString()} รายการ
            </span>
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            isDisabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      <EditIntakeModal
        intake={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void fetchIntakes()}
      />

      <ImageViewer
        images={viewer?.images ?? []}
        index={viewer ? viewer.index : null}
        onClose={() => setViewer(null)}
      />

      {/* Cancelling is not deleting — the row and its photos stay as a record of
          what came over the counter, so this gets its own wording. */}
      <Modal isOpen={cancelDisc.isOpen} onClose={cancelDisc.onClose} size="sm">
        <ModalContent>
          <ModalHeader className="font-bold">ยกเลิกใบเปิดงาน</ModalHeader>
          <ModalBody>
            <p className="text-sm text-black/70">
              ต้องการยกเลิก{" "}
              <span className="font-bold">
                ใบเปิดงาน #{target?.id} ({target?.customer_name})
              </span>{" "}
              หรือไม่?
            </p>
            <p className="text-xs text-black/40">
              ใบนี้จะถูกปิดโดยไม่ออกใบเสนอราคา รูปที่ถ่ายไว้ยังเก็บอยู่ในระบบ
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={cancelDisc.onClose} isDisabled={busy}>
              ไม่ใช่ตอนนี้
            </Button>
            <Button color="danger" variant="flat" onPress={handleCancel} isLoading={busy}>
              ยกเลิกใบเปิดงาน
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        isOpen={deleteDisc.isOpen}
        onClose={deleteDisc.onClose}
        onConfirm={handleDelete}
        name={target ? `ใบเปิดงาน #${target.id} (${target.customer_name})` : "ใบเปิดงานนี้"}
        related="รูปก่อนหลอมและรูปบัตรประชาชนของใบนี้จะถูกลบไปด้วย"
        loading={busy}
      />
    </div>
  );
}
