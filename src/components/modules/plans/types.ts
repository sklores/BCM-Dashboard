export type DrawingStatus = "current" | "superseded";

export type ExtractionCategory =
  | "Architectural"
  | "Structural"
  | "Mechanical"
  | "Electrical"
  | "Plumbing"
  | "Civil"
  | "Specification"
  | "Dimension"
  | "Other";

export const EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  "Architectural",
  "Structural",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Civil",
  "Specification",
  "Dimension",
  "Other",
];

export const EXTRACTION_CATEGORY_DOT: Record<ExtractionCategory, string> = {
  Architectural: "bg-blue-400",
  Structural: "bg-zinc-400",
  Mechanical: "bg-orange-400",
  Electrical: "bg-yellow-400",
  Plumbing: "bg-cyan-400",
  Civil: "bg-emerald-400",
  Specification: "bg-violet-400",
  Dimension: "bg-pink-400",
  Other: "bg-zinc-500",
};

export type ExtractionStatus = "pending" | "confirmed" | "rejected";

export type DrawingExtraction = {
  id: string;
  drawing_id: string;
  category: ExtractionCategory | null;
  label: string | null;
  description: string | null;
  location_description: string | null;
  confidence: number | null;
  status: ExtractionStatus;
  pushed_to_materials: boolean;
  pushed_to_schedule: boolean;
  pushed_to_notes: boolean;
  created_at: string;
};

export type TitleBlockResult = {
  drawing_number: string | null;
  title: string | null;
  revision_number: string | null;
  revision_date: string | null;
  scale: string | null;
  project_name: string | null;
  sheet_size: string | null;
  readable: boolean;
};
export type RfiStatus = "open" | "responded" | "closed";
export type SubmittalStatus =
  | "pending"
  | "approved"
  | "approved_as_noted"
  | "rejected"
  | "resubmit_required";

export const STANDARD_DRAWING_TYPES = [
  "architectural",
  "structural",
  "mep",
  "civil",
  "shop_drawings",
  "stamped",
  "horizontal",
  "takeoffs",
] as const;

export const DRAWING_TYPE_LABEL: Record<string, string> = {
  architectural: "Architectural",
  structural: "Structural",
  mep: "MEP",
  civil: "Civil",
  shop_drawings: "Shop Drawings",
  stamped: "Stamped",
  horizontal: "Horizontal",
  takeoffs: "Takeoffs",
};

export type Drawing = {
  id: string;
  project_id: string;
  drawing_number: string | null;
  title: string | null;
  type: string | null;
  revision_number: string | null;
  revision_date: string | null;
  uploaded_by: string | null;
  pdf_url: string | null;
  status: DrawingStatus;
  superseded_by: string | null;
  created_at: string;
  title_block_read: boolean;
  extraction_status: "none" | "processing" | "complete" | "error";
  extraction_completed_at: string | null;
  scale: string | null;
  sheet_size: string | null;
  project_name: string | null;
};

export type DrawingPin = {
  id: string;
  drawing_id: string;
  x_position: number | null;
  y_position: number | null;
  pin_number: number | null;
  note: string | null;
  rfi_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type Rfi = {
  id: string;
  project_id: string;
  rfi_number: number | null;
  drawing_id: string | null;
  location_description: string | null;
  question: string | null;
  response: string | null;
  status: RfiStatus;
  assigned_to: string | null;
  drawing_pin_id: string | null;
  created_at: string;
  responded_at: string | null;
};

export type Submittal = {
  id: string;
  project_id: string;
  submittal_number: number | null;
  description: string | null;
  spec_section: string | null;
  submitted_by: string | null;
  submitted_to: string | null;
  date_submitted: string | null;
  date_returned: string | null;
  status: SubmittalStatus;
  revision_number: number;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
};

export type UserOption = {
  id: string;
  name: string;
};

export const RFI_STATUSES: RfiStatus[] = ["open", "responded", "closed"];

export const RFI_STATUS_LABEL: Record<RfiStatus, string> = {
  open: "Open",
  responded: "Responded",
  closed: "Closed",
};

export const RFI_STATUS_TEXT: Record<RfiStatus, string> = {
  open: "text-amber-400",
  responded: "text-blue-400",
  closed: "text-emerald-400",
};

export const SUBMITTAL_STATUSES: SubmittalStatus[] = [
  "pending",
  "approved",
  "approved_as_noted",
  "rejected",
  "resubmit_required",
];

export const SUBMITTAL_STATUS_LABEL: Record<SubmittalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  approved_as_noted: "Approved as Noted",
  rejected: "Rejected",
  resubmit_required: "Resubmit Required",
};

export const SUBMITTAL_STATUS_TEXT: Record<SubmittalStatus, string> = {
  pending: "text-zinc-400",
  approved: "text-emerald-400",
  approved_as_noted: "text-blue-400",
  rejected: "text-red-400",
  resubmit_required: "text-amber-400",
};

export const SUBMITTAL_ACTION_REQUIRED: SubmittalStatus[] = [
  "rejected",
  "resubmit_required",
];
