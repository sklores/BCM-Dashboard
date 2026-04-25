export type Sub = {
  id: string;
  name: string;
  trade: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  license_number: string | null;
  notes: string | null;
};

export type ProjectSub = {
  id: string;
  project_id: string;
  sub_id: string;
};
