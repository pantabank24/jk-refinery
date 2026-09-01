"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";
import { Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { ReceiptDocument } from "./receiptDocument";
import {
  EMPTY_SETTINGS,
  dateInput,
  money,
  sumItems,
  type Receipt,
  type ReceiptItem,
  type ReceiptSettings,
} from "./types";

const blankItem = (unit: string): ReceiptItem => ({
  description: "",
  quantity: 0,
  unit,
  unit_price: 0,
  amount: 0,
});

const todayInput = () => new Date().toISOString().slice(0, 10);

interface Props {
  // Absent = creating a new receipt.
  receiptId?: number;
}

// บันทึก/แก้ไขใบเสร็จ. The form on the left, the sheet that will print on the
// right — the preview is driven by the same state, so what is typed is what prints.
export function ReceiptForm({ receiptId }: Props) {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canRead = hasPermission("receipts.read");
  const canWrite = hasPermission(receiptId ? "receipts.update" : "receipts.create");

  const [settings, setSettings] = useState<ReceiptSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [issuedDate, setIssuedDate] = useState(todayInput());
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const [payCash, setPayCash] = useState(false);
  const [payCheque, setPayCheque] = useState(false);
  // The only part of รับชำระโดย entered per receipt — the bank, its account number
  // and the ชื่อบัญชี are defaults, and the จำนวน is the total below.
  const [paidDate, setPaidDate] = useState("");

  const total = useMemo(() => sumItems(items), [items]);

  useEffect(() => {
    if (!authLoading && !canRead) router.replace("/");
  }, [authLoading, canRead, router]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const sRes = await api.get<ReceiptSettings>("/receipts/settings");
        const s = (sRes.data as unknown as ReceiptSettings) ?? EMPTY_SETTINGS;
        if (cancelled) return;
        setSettings(s);

        if (!receiptId) {
          setItems([blankItem("กรัม")]);
          return;
        }
        const rRes = await api.get<Receipt>(`/receipts/${receiptId}`);
        const r = rRes.data as unknown as Receipt;
        if (cancelled || !r) return;
        setCode(r.code);
        setIssuedDate(dateInput(r.issued_date));
        setReference(r.reference);
        setCustomerName(r.customer_name);
        setCustomerAddress(r.customer_address);
        setCustomerTaxId(r.customer_tax_id);
        setPayCash(r.pay_cash);
        setPayCheque(r.pay_cheque);
        setPaidDate(dateInput(r.paid_date));
        setItems(r.items?.length ? r.items : [blankItem("กรัม")]);
      } catch {
        if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (canRead) load();
    return () => {
      cancelled = true;
    };
  }, [receiptId, canRead]);

  const setItem = (i: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems((prev) => [...prev, blankItem(prev[prev.length - 1]?.unit || "กรัม")]);

  const removeItem = (i: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const handleSave = async () => {
    setError("");
    const filled = items.filter(
      (it) =>
        it.description.trim() !== "" ||
        it.quantity !== 0 ||
        it.unit_price !== 0 ||
        it.amount !== 0,
    );
    if (filled.length === 0) {
      setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    try {
      const body = {
        code,
        issued_date: issuedDate,
        reference,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_tax_id: customerTaxId,
        pay_cash: payCash,
        pay_cheque: payCheque,
        paid_date: paidDate,
        items: filled.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          amount: it.amount,
        })),
      };
      if (receiptId) await api.put(`/receipts/${receiptId}`, body);
      else await api.post("/receipts", body);
      router.push("/receipts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && !canRead) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  const previewReceipt = {
    code,
    issued_date: issuedDate,
    reference,
    customer_name: customerName,
    customer_address: customerAddress,
    customer_tax_id: customerTaxId,
    pay_cash: payCash,
    pay_cheque: payCheque,
    paid_date: paidDate || null,
    items,
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between py-5 gap-x-3">
        <div className="flex items-center gap-x-2 min-w-0">
          <Button isIconOnly size="sm" variant="light" onPress={() => router.push("/receipts")}>
            <ArrowLeft size={18} />
          </Button>
          <span className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate">
            {receiptId ? "แก้ไขใบเสร็จ" : "บันทึกใบเสร็จ"}
          </span>
        </div>
        {canWrite && (
          <Button
            onPress={handleSave}
            isLoading={saving}
            startContent={!saving ? <Save size={15} /> : undefined}
            className="bg-gradient-to-bl from-transparent to-yellow-600/50 border-1 border-black/10 font-bold shrink-0"
          >
            บันทึก
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-xs font-bold text-red-700 border-1 border-red-200 bg-red-50 rounded-2xl px-3 py-2">
          {error}
        </div>
      )}

      {/* No inner scroll areas: the whole page scrolls as one, so the sheet is
          shown at its full height instead of inside a capped, separately-scrolling
          box beside a capped, separately-scrolling form. */}
      <div className="flex flex-col xl:flex-row gap-4 pb-5">
        {/* ── Entry form ── */}
        <div className="flex flex-col gap-y-3 w-full xl:w-[520px] xl:shrink-0">
          <div className="flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-4">
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide">หัวใบเสร็จ</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="เลขที่" value={code} onValueChange={setCode} variant="bordered" />
              <Input
                label="วันที่"
                type="date"
                value={issuedDate}
                onValueChange={setIssuedDate}
                variant="bordered"
              />
            </div>
            <Input label="อ้างอิง" value={reference} onValueChange={setReference} variant="bordered" />
          </div>

          <div className="flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-4">
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide">ข้อมูลลูกค้า</span>
            <Input
              label="ชื่อลูกค้า"
              value={customerName}
              onValueChange={setCustomerName}
              variant="bordered"
            />
            <Textarea
              label="ที่อยู่ (บรรทัดละ 1 แถว)"
              value={customerAddress}
              onValueChange={setCustomerAddress}
              variant="bordered"
              minRows={2}
            />
            <Input
              label="เลขประจำตัวผู้เสียภาษีอากร"
              value={customerTaxId}
              onValueChange={setCustomerTaxId}
              variant="bordered"
            />
          </div>

          <div className="flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black/40 uppercase tracking-wide">รายการ</span>
              <Button
                size="sm"
                variant="flat"
                startContent={<Plus size={14} />}
                onPress={addItem}
                className="rounded-xl border-1 border-black/10 bg-black/5"
              >
                เพิ่มรายการ
              </Button>
            </div>

            {items.map((it, i) => (
              <div
                key={i}
                className="flex flex-col gap-y-2 border-1 border-black/10 bg-white/40 rounded-2xl p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-black/50">ลำดับ {i + 1}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    isDisabled={items.length === 1}
                    onPress={() => removeItem(i)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <Input
                  size="sm"
                  label="รายละเอียด"
                  value={it.description}
                  onValueChange={(v) => setItem(i, { description: v })}
                  variant="bordered"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    size="sm"
                    label="จำนวน"
                    type="number"
                    value={it.quantity ? String(it.quantity) : ""}
                    onValueChange={(v) => setItem(i, { quantity: Number(v) || 0 })}
                    variant="bordered"
                  />
                  <Input
                    size="sm"
                    label="หน่วย"
                    value={it.unit}
                    onValueChange={(v) => setItem(i, { unit: v })}
                    variant="bordered"
                  />
                  <Input
                    size="sm"
                    label="ราคาต่อหน่วย"
                    type="number"
                    value={it.unit_price ? String(it.unit_price) : ""}
                    onValueChange={(v) => setItem(i, { unit_price: Number(v) || 0 })}
                    variant="bordered"
                  />
                </div>
                <Input
                  size="sm"
                  label="รวม"
                  type="number"
                  value={it.amount ? String(it.amount) : ""}
                  onValueChange={(v) => setItem(i, { amount: Number(v) || 0 })}
                  variant="bordered"
                />
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-black/10 pt-2">
              <span className="text-sm font-bold text-black/60">รวมเป็นเงิน</span>
              <span className="text-lg font-bold text-yellow-700">{money(total)}</span>
            </div>
            <span className="text-[10px] text-black/35">
              ช่อง &quot;รวม&quot; ของแต่ละบรรทัดกรอกเองตามใบจริง ระบบบวกให้เฉพาะยอดรวมท้ายใบ
            </span>
          </div>

          <div className="flex flex-col gap-y-3 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-4">
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide">รับชำระโดย</span>
            <div className="flex items-center gap-x-6">
              <Checkbox size="sm" color="warning" isSelected={payCash} onValueChange={setPayCash}>
                <span className="text-sm">เงินสด</span>
              </Checkbox>
              <Checkbox size="sm" color="warning" isSelected={payCheque} onValueChange={setPayCheque}>
                <span className="text-sm">เช็ค</span>
              </Checkbox>
            </div>
            <Input
              label="วันที่"
              type="date"
              value={paidDate}
              onValueChange={setPaidDate}
              variant="bordered"
            />
            {/* Everything else on this block is fixed, so it is shown read-only
                rather than hidden — the entry screen should still look like the
                paper it is copied from. */}
            <div className="flex flex-col gap-y-1 border-1 border-black/10 bg-white/40 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-black/40">
                จากค่าเริ่มต้น — แก้ได้ที่ปุ่มตั้งค่าบนหน้ารายการ
              </span>
              <div className="flex justify-between text-xs">
                <span className="text-black/50">ธนาคาร</span>
                <span className="font-bold text-black/70">{settings.bank_name || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-black/50">เลขที่บัญชี</span>
                <span className="font-bold text-black/70">{settings.bank_account_no || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-black/50">ชื่อบัญชี</span>
                <span className="font-bold text-black/70">{settings.account_name || "—"}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-black/10 pt-1 mt-0.5">
                <span className="text-black/50">จำนวนที่รับชำระ</span>
                <span className="font-bold text-yellow-700">{money(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Live preview of the sheet that prints ── */}
        <div className="flex-1 min-w-0">
          <ReceiptDocument settings={settings} receipt={previewReceipt} />
        </div>
      </div>
    </div>
  );
}
