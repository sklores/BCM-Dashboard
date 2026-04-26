-- Jobs: subcontractor-driven scopes of work. Distinct from internal Tasks
-- (which keep the existing tasks table) and from Subcontractor Agreements
-- in Paperwork (the legal layer). Jobs is the operational layer that bundles
-- a sub + assigned materials + referenced drawings.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_id uuid references subs(id) on delete set null,
  title text,
  scope text,
  status text not null default 'not_started',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);
alter table jobs disable row level security;
create index if not exists jobs_project_idx on jobs (project_id);
create index if not exists jobs_sub_idx on jobs (sub_id);

create table if not exists job_materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  unique (job_id, material_id)
);
alter table job_materials disable row level security;
create index if not exists job_materials_job_idx on job_materials (job_id);

create table if not exists job_drawings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  drawing_id uuid references drawings(id) on delete cascade,
  extraction_id uuid references drawing_extractions(id) on delete cascade,
  unique (job_id, drawing_id, extraction_id),
  check (drawing_id is not null or extraction_id is not null)
);
alter table job_drawings disable row level security;
create index if not exists job_drawings_job_idx on job_drawings (job_id);
