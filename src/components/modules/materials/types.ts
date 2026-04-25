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
};
