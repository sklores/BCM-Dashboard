export type PermitType =
  | "building"
  | "electrical"
  | "plumbing"
  | "mechanical"
  | "demo"
  | "fire_suppression"
  | "elevator"
  | "other";

export const PERMIT_TYPES: PermitType[] = [
  "building",
  "electrical",
  "plumbing",
  "mechanical",
  "demo",
  "fire_suppression",
  "elevator",
  "other",
];

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
  building: "Building",
  electrical: "Electrical",
  plumbing: "Plumbing",
  mechanical: "Mechanical",
  demo: "Demo",
  fire_suppression: "Fire Suppression",
  elevator: "Elevator",
  other: "Other",
};

export type PermitStatus =
  | "not_applied"
  | "applied"
  | "under_review"
  | "issued"
  | "expired"
  | "closed";

export const PERMIT_STATUSES: PermitStatus[] = [
  "not_applied",
  "applied",
  "under_review",
  "issued",
  "expired",
  "closed",
];

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  not_applied: "Not Applied",
  applied: "Applied",
  under_review: "Under Review",
  issued: "Issued",
  expired: "Expired",
  closed: "Closed",
};

export const PERMIT_STATUS_STYLE: Record<PermitStatus, string> = {
  not_applied: "bg-zinc-800 text-zinc-300 border-zinc-700",
  applied: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  under_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  issued: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  expired: "bg-red-500/10 text-red-300 border-red-500/30",
  closed: "bg-zinc-700/40 text-zinc-300 border-zinc-700",
};

export type InspectionResult =
  | "scheduled"
  | "passed"
  | "failed"
  | "conditional"
  | "reinspection";

export const INSPECTION_RESULTS: InspectionResult[] = [
  "scheduled",
  "passed",
  "failed",
  "conditional",
  "reinspection",
];

export const INSPECTION_RESULT_LABEL: Record<InspectionResult, string> = {
  scheduled: "Scheduled",
  passed: "Passed",
  failed: "Failed",
  conditional: "Conditional",
  reinspection: "Re-inspection Required",
};

export const INSPECTION_RESULT_STYLE: Record<InspectionResult, string> = {
  scheduled: "bg-zinc-800 text-zinc-300 border-zinc-700",
  passed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-300 border-red-500/30",
  conditional: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  reinspection: "bg-orange-500/10 text-orange-300 border-orange-500/30",
};

export type ThirdPartyResult = "pending" | "passed" | "failed" | "conditional";

export const THIRD_PARTY_RESULTS: ThirdPartyResult[] = [
  "pending",
  "passed",
  "failed",
  "conditional",
];

export const THIRD_PARTY_RESULT_LABEL: Record<ThirdPartyResult, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  conditional: "Conditional",
};

export const THIRD_PARTY_RESULT_STYLE: Record<ThirdPartyResult, string> = {
  pending: "bg-zinc-800 text-zinc-300 border-zinc-700",
  passed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-300 border-red-500/30",
  conditional: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export type Permit = {
  id: string;
  project_id: string;
  parent_permit_id: string | null;
  permit_type: PermitType | null;
  jurisdiction: string | null;
  permit_number: string | null;
  applied_date: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  fee: number | null;
  status: PermitStatus;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
};

export type Inspection = {
  id: string;
  project_id: string;
  permit_id: string;
  inspection_type: string | null;
  scheduled_date: string | null;
  inspector_name: string | null;
  result: InspectionResult;
  notes: string | null;
  correction_notice_url: string | null;
  schedule_milestone_id: string | null;
  created_at: string;
};

export type ThirdPartyInspection = {
  id: string;
  project_id: string;
  inspection_type: string | null;
  inspector_contact_id: string | null;
  company: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  result: ThirdPartyResult;
  report_url: string | null;
  notes: string | null;
  created_at: string;
};

export type PermitPatch = Partial<Omit<Permit, "id" | "project_id" | "created_at">>;
export type InspectionPatch = Partial<
  Omit<Inspection, "id" | "project_id" | "created_at" | "permit_id">
>;
export type ThirdPartyInspectionPatch = Partial<
  Omit<ThirdPartyInspection, "id" | "project_id" | "created_at">
>;

export type ScheduleMilestone = {
  id: string;
  name: string;
  end_date: string | null;
};

export type InspectorContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtUsd(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target - today.getTime()) / (1000 * 60 * 60 * 24));
}
