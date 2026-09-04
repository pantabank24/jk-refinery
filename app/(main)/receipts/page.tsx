"use client";

import { SkeletonList } from "@/components/skeleton";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { useDisclosure } from "@heroui/modal";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import { ReceiptSettingsModal } from "./_component/settingsModal";
import { EMPTY_SETTINGS, beDate, money, type Receipt, type ReceiptSettings } from "./_component/types";

const PAGE_SIZE = 20;

// บันทึกใบเสร็จแอดมิน — receipts issued outside this system, kept as records and
// reprintable. Master-only out of the box (see migration 000095).
export default function ReceiptsPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("receipts.read");
  const canCreate = hasPermission("receipts.create");
  const canUpdate = hasPermission("receipts.update");
  const canDelete = hasPermission("receipts.delete");

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settings, setSettings] = useState<ReceiptSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const settingsDisc = useDisclosure();
  const deleteDisc = useDisclosure();
  const [target, setTarget] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `&search=${encodeURIComponent(search)}` : "";
      const res = await api.get<Receipt[]>(`/receipts?page=${page}&limit=${PAGE_SIZE}${q}`);
      setReceipts((res.data as unknown as Receipt[]) || []);
      setTotalPages((res as { total_pages?: number }).total_pages || 1);
      setTotalRows((res as { total_rows?: number }).total_rows || 0);
    } catch {
      setReceipts([]);
      setTotalPages(1);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (canRead) fetchReceipts();
  }, [fetchReceipts, canRead]);

  useEffect(() => {
    if (!canRead) return;
    api
      .get<ReceiptSettings>("/receipts/settings")
      .then((res) => setSettings((res.data as unknown as ReceiptSettings) ?? EMPTY_SETTINGS))
      .catch(() => {});
  }, [canRead]);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.delete(`/receipts/${target.id}`);
      deleteDisc.onClose();
      setTarget(null);
      await fetchReceipts();
    } catch {
      /* the api layer surfaces the error */
    } finally {
      setDeleting(false);
    }
  };

  if (!authLoading && !canRead) return null;

  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div className="flex flex-row items-center justify-between shrink-0 py-5 gap-x-3">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2 truncate">
          บันทึกใบเสร็จ
        </div>
        <div className="flex items-center gap-x-2 shrink-0">
          {canUpdate && (
            <Button
              size="sm"
              variant="flat"
              startContent={<SlidersHorizontal size={14} />}
              onPress={settingsDisc.onOpen}
              className="rounded-xl border-1 border-black/10 bg-black/5"
            >
              ตั้งค่าเริ่มต้น
            </Button>
          )}
          {canCreate && (
            <Button
              size="sm"
              startContent={<Plus size={15} />}
              onPress={() => router.push("/receipts/create")}
              className="bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold"
            >
              บันทึกใบเสร็จ
            </Button>
          )}
        </div>
      </div>

      <div className="shrink-0 pb-3">
        <Input
          size="sm"
          variant="bordered"
          placeholder="ค้นหาเลขที่ / อ้างอิง / ชื่อลูกค้า"
          startContent={<Search size={15} className="text-black/30" />}
          value={search}
          // Any search starts from page 1 — page 4 of the old result set is rarely
          // a page of the new one.
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
        ) : receipts.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-black/40 text-sm">
            ยังไม่มีใบเสร็จที่บันทึกไว้
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
                  <TableColumn>วันที่</TableColumn>
                  <TableColumn>ลูกค้า</TableColumn>
                  <TableColumn>อ้างอิง</TableColumn>
                  <TableColumn>รวมเป็นเงิน</TableColumn>
                  <TableColumn> </TableColumn>
                </TableHeader>
                <TableBody items={receipts} emptyContent="ไม่พบข้อมูล">
                  {(r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-white/60 rounded-xl"
                      onClick={() => router.push(`/receipts/${r.id}`)}
                    >
                      <TableCell>
                        <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                          {r.code || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/60">{beDate(r.issued_date)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-bold text-black/70">
                          {r.customer_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-black/50">{r.reference || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-yellow-700">{money(r.total_amount)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-x-1">
                          {canUpdate && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => router.push(`/receipts/${r.id}`)}
                            >
                              <Pencil size={15} className="text-[#c09c42]" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => {
                                setTarget(r);
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
              {receipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/receipts/${r.id}`)}
                  className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3 gap-y-2 cursor-pointer hover:shadow-md"
                >
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <span className="font-bold text-sm bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate">
                      {r.code || "—"}
                    </span>
                    <span className="shrink-0 text-[10px] text-black/40">
                      {beDate(r.issued_date)}
                    </span>
                  </div>
                  <div className="flex flex-row items-end justify-between gap-x-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-black/70 truncate">
                        {r.customer_name || "—"}
                      </span>
                      {r.reference && (
                        <span className="text-[10px] text-black/40 truncate">
                          อ้างอิง {r.reference}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-bold text-sm text-yellow-700">
                      {money(r.total_amount)}
                    </span>
                  </div>
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

      <ReceiptSettingsModal
        isOpen={settingsDisc.isOpen}
        onClose={settingsDisc.onClose}
        settings={settings}
        onSaved={setSettings}
      />

      <ConfirmDeleteModal
        isOpen={deleteDisc.isOpen}
        onClose={deleteDisc.onClose}
        onConfirm={handleDelete}
        name={target?.code ? `ใบเสร็จ ${target.code}` : "ใบเสร็จนี้"}
        related="รายการทั้งหมดในใบเสร็จจะถูกลบไปด้วย"
        loading={deleting}
      />
    </div>
  );
}
