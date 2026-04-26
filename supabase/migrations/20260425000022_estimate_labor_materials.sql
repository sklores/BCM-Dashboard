-- Estimating: Labor & Materials sheet. Per-job parent rows with
-- nested labor (regular + off-hour) and materials breakdown.

create table estimate_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text,
  assigned_sub_id uuid references subs(id) on delete set null,
  regular_hours numeric(10, 2),
  regular_rate numeric(10, 2),
  off_hour_hours numeric(10, 2),
  off_hour_rate numeric(10, 2),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table estimate_jobs disable row level security;
create index estimate_jobs_project_idx on estimate_jobs (project_id);

create table estimate_job_materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references estimate_jobs(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  item_name text,
  quantity numeric(10, 2),
  unit_price numeric(10, 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table estimate_job_materials disable row level security;
create index estimate_job_materials_job_idx on estimate_job_materials (job_id);
