export type RoleType =
  | "client"
  | "architect"
  | "general_contractor"
  | "subcontractor"
  | "mep"
  | "inspector"
  | "supplier"
  | "owner"
  | "pm"
  | "apm"
  | "super"
  | "other";

export const ROLE_TYPES: RoleType[] = [
  "client",
  "architect",
  "general_contractor",
  "subcontractor",
  "mep",
  "inspector",
  "supplier",
  "owner",
  "pm",
  "apm",
  "super",
  "other",
];

export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  client: "Client",
  architect: "Architect",
  general_contractor: "General Contractor",
  subcontractor: "Subcontractor",
  mep: "MEP",
  inspector: "Inspector",
  supplier: "Supplier",
  owner: "Owner",
  pm: "PM",
  apm: "APM",
  super: "Super",
  other: "Other",
};

export const ROLE_TYPE_STYLE: Record<RoleType, string> = {
  client: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  architect: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  general_contractor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  subcontractor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  mep: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  inspector: "bg-red-500/10 text-red-300 border-red-500/30",
  supplier: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  owner: "bg-pink-500/10 text-pink-300 border-pink-500/30",
  pm: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  apm: "bg-blue-500/10 text-blue-200 border-blue-500/20",
  super: "bg-zinc-700/40 text-zinc-300 border-zinc-700",
  other: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

export type CompanyCategory =
  | "bcm_team"
  | "client"
  | "design_team"
  | "subs_trade"
  | "subs_mep"
  | "permits_inspections"
  | "building"
  | "vendors";

export const COMPANY_CATEGORIES: CompanyCategory[] = [
  "bcm_team",
  "client",
  "design_team",
  "subs_trade",
  "subs_mep",
  "permits_inspections",
  "building",
  "vendors",
];

export const COMPANY_CATEGORY_LABEL: Record<CompanyCategory, string> = {
  bcm_team: "BCM Team",
  client: "Client",
  design_team: "Design Team",
  subs_trade: "Subs — Trade",
  subs_mep: "Subs — MEP",
  permits_inspections: "Permits & Inspections",
  building: "Building",
  vendors: "Vendors",
};

export type Company = {
  id: string;
  project_id: string;
  company_name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  primary_contact_id: string | null;
  category: CompanyCategory | null;
  sub_id: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  project_id: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
  role_type: RoleType | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type CompanyPatch = Partial<
  Pick<
    Company,
    | "company_name"
    | "address"
    | "website"
    | "phone"
    | "primary_contact_id"
    | "category"
  >
>;

export type ContactPatch = Partial<
  Pick<
    Contact,
    | "first_name"
    | "last_name"
    | "company_id"
    | "role_type"
    | "email"
    | "phone"
    | "address"
    | "notes"
  >
>;

export function contactDisplayName(c: Contact): string {
  const full = `${c.first_name} ${c.last_name}`.trim();
  return full || c.email || "Unnamed contact";
}
