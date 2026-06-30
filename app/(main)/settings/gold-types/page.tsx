"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Pencil, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";

type OperandType = "number" | "price" | "percent" | "plus" | "weight" | "service";
type Operator = "+" | "-" | "*" | "/";

interface FormulaStep {
  operator: Operator;
  operand_type: OperandType;
  value: number;
}

interface GoldType {
  id: number;
  name: string;
  metal?: string;
  description: string;
  price_source: string;
  default_percent: number;
  default_plus: number;
  formula_steps: string;
  service_rate: number;
  plus_type: number;
  sort_order: number;
  is_active: boolean;
}

const METAL_LABELS: Record<string, string> = {
  gold: "ทอง",
  silver: "เงิน",
  platinum: "แพลตินัม",
  palladium: "แพลเลเดียม",
};

// Valid price sources per metal. Platinum/palladium are entered at quotation
// time, so their only "source" is manual.
const PRICE_SOURCES_BY_METAL: Record<string, Record<string, string>> = {
  gold: {
    bar_buy: "รับซื้อทองแท่ง",
    bar_sell: "ขายทองแท่ง",
    ornament_buy: "รับซื้อทองรูปพรรณ",
    ornament_sell: "ขายทองรูปพรรณ",
  },
  silver: {
    buy: "รับซื้อเงิน",
    sell: "ขายเงิน",
    spot: "Spot",
  },
  platinum: { manual: "กรอกตอนออกใบ" },
  palladium: { manual: "กรอกตอนออกใบ" },
};

// Flattened lookup for display (across all metals).
const PRICE_SOURCE_LABELS: Record<string, string> = Object.assign(
  {},
  ...Object.values(PRICE_SOURCES_BY_METAL),
);

const OPERATORS: { value: Operator; symbol: string; label: string }[] = [
  { value: "+", symbol: "+", label: "บวก" },
  { value: "-", symbol: "−", label: "ลบ" },
  { value: "*", symbol: "×", label: "คูณ" },
  { value: "/", symbol: "÷", label: "หาร" },
];

const OPERAND_OPTIONS: { value: OperandType; label: string; desc: string }[] = [
  { value: "number",  label: "กำหนดเอง",  desc: "ตัวเลขคงที่" },
  { value: "price",   label: "ราคาทอง",   desc: "จาก price source" },
  { value: "percent", label: "เปอร์เซ็นต์", desc: "กรอกตอนออกใบเสนอราคา" },
  { value: "plus",    label: "ราคาบวก",   desc: "กรอกตอนออกใบเสนอราคา" },
  { value: "weight",  label: "น้ำหนัก",   desc: "กรอกตอนออกใบเสนอราคา" },
  { value: "service", label: "ค่าบริการ",  desc: "ค่าตัวคูณกำหนดเองของประเภทนี้ (service_rate)" },
];

const OPERAND_LABELS = Object.fromEntries(OPERAND_OPTIONS.map((o) => [o.value, o.label])) as Record<OperandType, string>;
const OP_SYMBOLS = Object.fromEntries(OPERATORS.map((o) => [o.value, o.symbol])) as Record<Operator, string>;

function parseSteps(raw: string): FormulaStep[] {
  try {
    const s = JSON.parse(raw || "[]");
    return Array.isArray(s) ? s : [];
  } catch { return []; }
}

function stepLabel(s: FormulaStep) {
  return s.operand_type === "number" ? s.value.toLocaleString() : OPERAND_LABELS[s.operand_type];
}

function formulaPreview(priceSourceLabel: string, steps: FormulaStep[]): string {
  if (!steps.length) return `${priceSourceLabel} (ยังไม่ได้กำหนดสูตร)`;
  let r = priceSourceLabel;
  for (const s of steps) r = `(${r} ${OP_SYMBOLS[s.operator]} ${stepLabel(s)})`;
  return `${r} = ผลลัพธ์`;
}

export default function GoldTypesPage() {
  const { hasPermission } = useAuth();
  const [types, setTypes] = useState<GoldType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const delDisc = useDisclosure();
  const [delTarget, setDelTarget] = useState<GoldType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<GoldType | null>(null);
  const [metal, setMetal] = useState("gold");
  const [priceSource, setPriceSource] = useState("bar_buy");
  const [steps, setSteps] = useState<FormulaStep[]>([]);
  const [serviceRate, setServiceRate] = useState(0);

  // Price-source options for the metal currently being edited.
  const sourceOptions = PRICE_SOURCES_BY_METAL[metal] ?? PRICE_SOURCES_BY_METAL.gold;

  // preview sample values
  const SAMPLE_PRICE = 45000;
  const [samplePercent, setSamplePercent] = useState(96.5);
  const [samplePlus, setSamplePlus] = useState(0);
  const [sampleWeight, setSampleWeight] = useState(1);

  const usedOperands = new Set(steps.map((s) => s.operand_type));

  const fetchTypes = async () => {
    try {
      const res = await api.get<GoldType[]>("/gold-types");
      setTypes((res.data as unknown as GoldType[]) || []);
    } catch { setTypes([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTypes(); }, []);

  const askDelete = (gt: GoldType) => { setDelTarget(gt); delDisc.onOpen(); };
  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/gold-types/${delTarget.id}`);
      delDisc.onClose();
      fetchTypes();
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  const openEdit = (gt: GoldType) => {
    setSelected(gt);
    setMetal(gt.metal || "gold");
    setPriceSource(gt.price_source);
    setSteps(parseSteps(gt.formula_steps));
    setServiceRate(gt.service_rate ?? 0);
    onOpen();
  };

  // Switching metal resets the price source to that metal's first valid option.
  const handleMetalChange = (m: string) => {
    setMetal(m);
    const first = Object.keys(PRICE_SOURCES_BY_METAL[m] ?? {})[0] ?? "";
    setPriceSource(first);
  };

  const addStep = () =>
    setSteps((p) => [...p, { operator: "*", operand_type: "number", value: 1 }]);

  const removeStep = (i: number) =>
    setSteps((p) => p.filter((_, idx) => idx !== i));

  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((p) => {
      const n = [...p], t = i + dir;
      if (t < 0 || t >= n.length) return p;
      [n[i], n[t]] = [n[t], n[i]];
      return n;
    });

  const updateStep = (i: number, field: keyof FormulaStep, val: string) =>
    setSteps((p) =>
      p.map((s, idx) =>
        idx === i ? { ...s, [field]: field === "value" ? parseFloat(val) || 0 : val } : s
      ) as FormulaStep[]
    );

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/gold-types/${selected.id}`, {
        name: selected.name, metal, description: selected.description,
        price_source: priceSource,
        default_percent: selected.default_percent, default_plus: selected.default_plus,
        formula_steps: JSON.stringify(steps),
        service_rate: serviceRate,
        plus_type: selected.plus_type ?? 0,
        sort_order: selected.sort_order, is_active: selected.is_active,
      });
      onClose(); fetchTypes();
    } catch { /**/ } finally { setSaving(false); }
  };

  const previewCalc = (base: number) => {
    let r = base;
    for (const s of steps) {
      const op = s.operand_type === "price"   ? base
        : s.operand_type === "percent" ? samplePercent
        : s.operand_type === "plus"    ? samplePlus
        : s.operand_type === "weight"  ? sampleWeight
        : s.operand_type === "service" ? serviceRate
        : s.value;
      switch (s.operator) {
        case "+": r += op; break;
        case "-": r -= op; break;
        case "*": r *= op; break;
        case "/": if (op) r /= op; break;
      }
    }
    return r;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ประเภททองและสูตรคำนวณ
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {types.map((gt) => {
            const gtSteps = parseSteps(gt.formula_steps);
            return (
              <div key={gt.id} className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 gap-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-x-2">
                      <span className="font-bold text-md bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">{gt.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border-1 border-black/10 bg-black/5 text-black/60">{METAL_LABELS[gt.metal || "gold"]}</span>
                    </div>
                    {gt.description && <span className="text-xs text-black/50">{gt.description}</span>}
                  </div>
                  <div className="flex items-center gap-x-1">
                    {hasPermission("gold_types.update") && (
                      <Button isIconOnly size="sm" variant="light" onPress={() => openEdit(gt)}>
                        <Pencil size={15} className="text-[#c09c42]" />
                      </Button>
                    )}
                    {hasPermission("gold_types.delete") && (
                      <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => askDelete(gt)}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <span className="text-xs text-black/50">
                    แหล่งราคา: <span className="font-bold text-black/70">{PRICE_SOURCE_LABELS[gt.price_source] || gt.price_source}</span>
                  </span>
                  {(gt.service_rate ?? 0) > 0 && (
                    <span className="text-xs text-black/50">
                      service_rate: <span className="font-bold text-yellow-700">{gt.service_rate}</span>
                    </span>
                  )}
                  {gtSteps.length > 0 ? (
                    <div className="flex flex-col gap-y-1">
                      {gtSteps.map((s, i) => (
                        <div key={i} className="flex items-center gap-x-2 text-xs border-1 border-black/10 bg-black/5 rounded-xl px-3 py-1.5">
                          <span className="text-[#c09c42] font-bold w-4 text-center">{OP_SYMBOLS[s.operator]}</span>
                          {s.operand_type === "number"
                            ? <span className="font-bold">{s.value.toLocaleString()}</span>
                            : <span className="font-bold text-yellow-700">{OPERAND_LABELS[s.operand_type]}</span>}
                          <span className="text-black/30 ml-auto">ขั้นที่ {i + 1}</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-black/40 italic mt-0.5 break-all">
                        {formulaPreview(PRICE_SOURCE_LABELS[gt.price_source] || "ราคา", gtSteps)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-black/30 italic">ยังไม่ได้กำหนดสูตร</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Formula Builder Modal ─── */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="font-bold text-lg bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
              กำหนดสูตรคำนวณ
            </span>
            <span className="text-sm font-normal text-black/50">{selected?.name}</span>
          </ModalHeader>

          <ModalBody className="gap-y-6 pb-2">

            {/* Metal */}
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-bold text-black/70">โลหะ</span>
              <Select
                selectedKeys={[metal]}
                onChange={(e) => handleMetalChange(e.target.value)}
                classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              >
                {Object.entries(METAL_LABELS).map(([val, label]) => (
                  <SelectItem key={val}>{label}</SelectItem>
                ))}
              </Select>
            </div>

            {/* Price source */}
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-bold text-black/70">แหล่งราคาเริ่มต้น</span>
              <Select
                selectedKeys={[priceSource]}
                onChange={(e) => setPriceSource(e.target.value)}
                classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              >
                {Object.entries(sourceOptions).map(([val, label]) => (
                  <SelectItem key={val}>{label}</SelectItem>
                ))}
              </Select>
            </div>

            {/* Service rate */}
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-bold text-black/70">ค่าบริการ (service_rate)</span>
              <span className="text-xs text-black/40">ค่าตัวคูณที่ใช้เมื่อ operand_type = "ค่าบริการ" เช่น 0.0656 ≈ 1/15.244 กรัม/บาท</span>
              <Input
                type="number"
                value={serviceRate === 0 ? "" : serviceRate.toString()}
                placeholder="0.0656"
                onValueChange={(v) => setServiceRate(parseFloat(v) || 0)}
                classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
              />
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-black/70">ขั้นตอนคำนวณ</span>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus size={14} />}
                  onPress={addStep}
                  className="rounded-xl"
                >
                  เพิ่มขั้นตอน
                </Button>
              </div>

              {steps.length === 0 && (
                <button
                  onClick={addStep}
                  className="w-full py-8 text-sm text-black/30 border-2 border-dashed border-black/10 rounded-3xl hover:border-yellow-500/30 hover:text-black/50 transition-all"
                >
                  + กดเพื่อเพิ่มขั้นตอนแรก
                </button>
              )}

              <div className="flex flex-col gap-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-x-3 border-1 border-black/10 bg-gradient-to-br from-black/5 to-transparent rounded-3xl p-4">

                    {/* Left: step number */}
                    <div className="flex flex-col items-center gap-y-1 shrink-0">
                      <span className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-y-0.5 mt-1">
                        <button
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/10 disabled:opacity-20 transition-all"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx === steps.length - 1}
                          className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/10 disabled:opacity-20 transition-all"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Right: controls */}
                    <div className="flex flex-col gap-y-3 flex-1 min-w-0">

                      {/* Operator — pill buttons */}
                      <div className="flex flex-col gap-y-1.5">
                        <span className="text-xs text-black/50">การคำนวณ</span>
                        <div className="flex gap-x-2">
                          {OPERATORS.map((op) => (
                            <button
                              key={op.value}
                              onClick={() => updateStep(idx, "operator", op.value)}
                              className={`flex-1 py-2 rounded-xl text-sm font-bold border-1 transition-all ${
                                step.operator === op.value
                                  ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-700"
                                  : "bg-black/5 border-black/10 text-black/50 hover:bg-black/10"
                              }`}
                            >
                              <span className="text-base leading-none">{op.symbol}</span>
                              <span className="text-[10px] block">{op.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Operand type */}
                      <div className="flex flex-col gap-y-1.5">
                        <span className="text-xs text-black/50">คูณกับ / คำนวณกับ</span>
                        <div className="flex flex-wrap gap-2">
                          {OPERAND_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateStep(idx, "operand_type", opt.value)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border-1 transition-all ${
                                step.operand_type === opt.value
                                  ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-700"
                                  : "bg-black/5 border-black/10 text-black/50 hover:bg-black/10"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {step.operand_type !== "number" && (
                          <span className="text-[11px] text-[#c09c42]/80 italic pl-1">
                            ← {OPERAND_OPTIONS.find(o => o.value === step.operand_type)?.desc}
                          </span>
                        )}
                      </div>

                      {/* Value input — only when "number" */}
                      {step.operand_type === "number" && (
                        <div className="flex flex-col gap-y-1.5">
                          <span className="text-xs text-black/50">ค่าตัวเลข</span>
                          <Input
                            type="number"
                            value={step.value === 0 ? "" : step.value.toString()}
                            placeholder="กรอกตัวเลข"
                            onValueChange={(v) => updateStep(idx, "value", v)}
                            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => removeStep(idx)}
                      className="shrink-0 self-start w-7 h-7 rounded-xl flex items-center justify-center text-black/30 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live preview */}
            {steps.length > 0 && (
              <div className="flex flex-col gap-y-3 bg-black/5 border-1 border-black/10 rounded-3xl p-4">
                <span className="text-sm font-bold text-black/70">ตัวอย่างคำนวณ</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-y-1">
                    <span className="text-xs text-black/50">ราคาทอง (ตัวอย่าง)</span>
                    <div className="text-sm font-bold text-black/60 px-1">{SAMPLE_PRICE.toLocaleString()} บาท</div>
                  </div>
                  {usedOperands.has("percent") && (
                    <div className="flex flex-col gap-y-1">
                      <span className="text-xs text-black/50">เปอร์เซ็นต์</span>
                      <Input size="sm" type="number" value={samplePercent.toString()}
                        onValueChange={(v) => setSamplePercent(parseFloat(v) || 0)}
                        classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    </div>
                  )}
                  {usedOperands.has("plus") && (
                    <div className="flex flex-col gap-y-1">
                      <span className="text-xs text-black/50">ราคาบวก</span>
                      <Input size="sm" type="number" value={samplePlus.toString()}
                        onValueChange={(v) => setSamplePlus(parseFloat(v) || 0)}
                        classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    </div>
                  )}
                  {usedOperands.has("weight") && (
                    <div className="flex flex-col gap-y-1">
                      <span className="text-xs text-black/50">น้ำหนัก (กรัม)</span>
                      <Input size="sm" type="number" value={sampleWeight.toString()}
                        onValueChange={(v) => setSampleWeight(parseFloat(v) || 0)}
                        classNames={{ inputWrapper: "bg-white/60 border-1 border-black/10 rounded-xl" }} />
                    </div>
                  )}
                  {usedOperands.has("service") && (
                    <div className="flex flex-col gap-y-1">
                      <span className="text-xs text-black/50">ค่าบริการ (service_rate)</span>
                      <div className="text-sm font-bold text-yellow-700 px-1">{serviceRate > 0 ? serviceRate : <span className="text-red-400 text-xs">ยังไม่ได้กำหนด!</span>}</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-y-1 pt-1 border-t border-black/10">
                  <span className="text-[11px] text-black/40 italic break-all">
                    {formulaPreview(PRICE_SOURCE_LABELS[priceSource] || priceSource, steps)}
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-black/60">ผลลัพธ์</span>
                    <span className="font-bold text-xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent">
                      {previewCalc(SAMPLE_PRICE).toLocaleString(undefined, { maximumFractionDigits: 4 })} บาท
                    </span>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button variant="light" onPress={onClose}>ยกเลิก</Button>
            <Button
              isLoading={saving}
              className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl"
              onPress={handleSave}
            >
              บันทึกสูตร
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDelete}
        name={delTarget?.name}
        related="ประเภททองนี้จะถูกลบถาวร (ใบเสนอราคาเดิมที่อ้างชื่อนี้ไม่กระทบ)"
        loading={deleting}
      />
    </div>
  );
}
