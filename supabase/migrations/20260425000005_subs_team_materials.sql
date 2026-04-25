-- Subs module: subs are companies (independent of users).
create table subs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text,
  contact_name text,
  contact_email text,
  contact_phone text,
  license_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table project_subs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_id uuid not null references subs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, sub_id)
);

-- Materials module: per-project catalog. Pricing lives here (not in Schedule).
create table materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  product_name text not null,
  manufacturer text,
  supplier text,
  sku text,
  price numeric(12, 2),
  lead_time text,
  notes text,
  created_at timestamptz not null default now()
);

-- Link Schedule's per-task material cards to the catalog. Schedule keeps its
-- task-specific fields (instructions, pdf_url); catalog is the pricing source.
alter table schedule_material_cards
  add column material_id uuid references materials(id) on delete set null;

alter table subs         disable row level security;
alter table project_subs disable row level security;
alter table materials    disable row level security;
