-- Budget module: CSI-coded line-item budget plus clarifications notes.

create table budget_divisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  csi_code text,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table budget_divisions disable row level security;
create index budget_divisions_project_idx on budget_divisions (project_id);

create table budget_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  division_id uuid not null references budget_divisions(id) on delete cascade,
  description text,
  quantity numeric(12, 4),
  unit_measure text,
  material_allowance numeric(12, 2),
  material_unit_price numeric(12, 2),
  hours numeric(10, 2),
  hourly_rate numeric(10, 2),
  contractor_cost numeric(12, 2),
  notes text,
  status text,
  sent_to_owner_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table budget_line_items disable row level security;
create index budget_line_items_project_idx on budget_line_items (project_id);
create index budget_line_items_division_idx on budget_line_items (division_id);

create table budget_clarifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  section text not null,
  seq text,
  parent_seq text,
  body text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table budget_clarifications disable row level security;
create index budget_clarifications_project_idx on budget_clarifications (project_id);
