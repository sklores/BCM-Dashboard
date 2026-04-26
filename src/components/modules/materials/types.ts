export type Material = {
  id: string;
  project_id: string;
  product_name: string;
  manufacturer: string | null;
  supplier: string | null;
  sku: string | null;
  price: number | null;
  lead_time: string | null;
  notes: string | null;
  is_finish: boolean;
  room: string | null;
  color_finish: string | null;
  installation_notes: string | null;
};

export type MaterialPhoto = {
  id: string;
  material_id: string;
  storage_path: string;
  storage_url: string | null;
  sort_order: number;
  created_at: string;
};
