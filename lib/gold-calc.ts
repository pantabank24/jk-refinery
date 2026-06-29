// Shared gold-pricing calculation used by both the create (calculate) and edit
// (quote-list) flows. Keeping a single source prevents the two screens from
// drifting — they must compute per-gram/total identically.

export type OperandType = "number" | "price" | "percent" | "plus" | "weight" | "service";

export interface FormulaStep {
  operator: "+" | "-" | "*" | "/";
  operand_type: OperandType;
  value: number;
}

export interface GoldType {
  id: number;
  name: string;
  metal?: string; // gold|silver|platinum|palladium (defaults to gold)
  price_source: string;
  default_percent: number;
  default_plus: number;
  formula_steps: string; // JSON-encoded FormulaStep[]
  service_rate: number;  // ค่าตัวคูณกำหนดเองต่อประเภท
  plus_type: number;     // 0=บาท, 1=%
}

export interface FormulaVars {
  price: number;
  percent: number;
  plus: number; // already converted to baht
  weight: number;
}

export function parseSteps(raw: string): FormulaStep[] {
  try {
    const steps = JSON.parse(raw || "[]");
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

export function getUsedVars(gt: GoldType): Set<OperandType> {
  return new Set(parseSteps(gt.formula_steps).map((s) => s.operand_type));
}

export function applyFormula(vars: FormulaVars, gt: GoldType): number {
  const steps = parseSteps(gt.formula_steps);
  if (steps.length > 0) {
    return steps.reduce((result, s) => {
      let operand: number;
      switch (s.operand_type) {
        case "price":   operand = vars.price;      break;
        case "percent": operand = vars.percent;    break;
        case "plus":    operand = vars.plus;       break;
        case "weight":  operand = vars.weight;     break;
        case "service": operand = gt.service_rate; break;
        default:        operand = s.value;
      }
      switch (s.operator) {
        case "+": return result + operand;
        case "-": return result - operand;
        case "*": return result * operand;
        case "/": return operand !== 0 ? result / operand : result;
        default: return result;
      }
    }, vars.price);
  }
  // legacy fallback
  return vars.price * (gt.default_percent / 100) + gt.default_plus;
}

export interface ComputeInput {
  goldType: GoldType | null;
  price: number;
  percent: number;
  plus: number; // raw plus as entered (baht or %, per the gold type's plus_type)
  weight: number;
  plusType?: number; // per-item override: 0=บาท, 1=% (falls back to goldType.plus_type)
}

// computeItem mirrors the create screen exactly:
// - plus is converted to baht when plus_type === 1 (%)
// - per-gram comes from the formula steps, or the legacy price·%+plus when none
// - when the formula already consumes weight, its output IS the total (do NOT
//   multiply by weight again); otherwise total = perGram · weight
export function computeItem({ goldType, price, percent, plus, weight, plusType }: ComputeInput): { perGram: number; total: number } {
  const hasFormula = goldType ? parseSteps(goldType.formula_steps).length > 0 : false;
  const usedVars: Set<OperandType> = goldType && hasFormula
    ? getUsedVars(goldType)
    : new Set<OperandType>(["percent", "plus"]);

  const effectivePlusType = plusType ?? goldType?.plus_type ?? 0;
  const plusBaht = effectivePlusType === 1 ? price * (plus / 100) : plus;
  const vars: FormulaVars = { price, percent, plus: plusBaht, weight };

  const perGram = goldType && hasFormula
    ? applyFormula(vars, goldType)
    : price * (percent / 100) + plusBaht;

  const total = usedVars.has("weight") ? perGram : perGram * weight;
  return { perGram, total };
}
