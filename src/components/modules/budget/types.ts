export type BudgetDivision = {
  id: string;
  project_id: string;
  csi_code: string | null;
  name: string | null;
  sort_order: number;
  created_at: string;
};

export type BudgetLineItem = {
  id: string;
  project_id: string;
  division_id: string;
  description: string | null;
  quantity: number | null;
  unit_measure: string | null;
  material_allowance: number | null;
  material_unit_price: number | null;
  hours: number | null;
  hourly_rate: number | null;
  contractor_cost: number | null;
  notes: string | null;
  status: string | null;
  sent_to_owner_at: string | null;
  sort_order: number;
  created_at: string;
};

export type BudgetClarification = {
  id: string;
  project_id: string;
  section: ClarSection;
  seq: string | null;
  parent_seq: string | null;
  body: string | null;
  sort_order: number;
  created_at: string;
};

export type ClarSection = "clarifications" | "allowances" | "exclusions";

export const CLAR_SECTIONS: ClarSection[] = [
  "clarifications",
  "allowances",
  "exclusions",
];

export const CLAR_SECTION_LABEL: Record<ClarSection, string> = {
  clarifications: "Clarifications",
  allowances: "Allowances",
  exclusions: "Exclusions",
};

export type BudgetDivisionPatch = Partial<
  Pick<BudgetDivision, "csi_code" | "name" | "sort_order">
>;

export type BudgetLineItemPatch = Partial<
  Pick<
    BudgetLineItem,
    | "description"
    | "quantity"
    | "unit_measure"
    | "material_allowance"
    | "material_unit_price"
    | "hours"
    | "hourly_rate"
    | "contractor_cost"
    | "notes"
    | "status"
    | "sent_to_owner_at"
    | "sort_order"
  >
>;

export type BudgetClarificationPatch = Partial<
  Pick<
    BudgetClarification,
    "section" | "seq" | "parent_seq" | "body" | "sort_order"
  >
>;

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ---------- Computations ----------

export function lineMaterialTotal(line: BudgetLineItem): number {
  return (
    (Number(line.quantity) || 0) * (Number(line.material_unit_price) || 0)
  );
}

export function lineLaborTotal(line: BudgetLineItem): number {
  return (Number(line.hours) || 0) * (Number(line.hourly_rate) || 0);
}

export function lineSubtotal(line: BudgetLineItem): number {
  return (
    lineMaterialTotal(line) +
    lineLaborTotal(line) +
    (Number(line.contractor_cost) || 0)
  );
}

export function divisionTotal(lines: BudgetLineItem[]): number {
  return lines.reduce((s, l) => s + lineSubtotal(l), 0);
}
