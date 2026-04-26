-- Permits module: master + sub permits, inspections tied to permits,
-- third-party inspections (consultants) tied to a Contacts entry.

create table permits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_permit_id uuid references permits(id) on delete cascade,
  permit_type text,
  jurisdiction text,
  permit_number text,
  applied_date date,
  issued_date date,
  expiration_date date,
  fee numeric(14, 2),
  status text not null default 'not_applied',
  pdf_url text,
  notes text,
  created_at timestamptz not null default now()
);
alter table permits disable row level security;
create index permits_project_idx on permits (project_id);
create index permits_parent_idx on permits (parent_permit_id);
create index permits_expiration_idx on permits (expiration_date);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  permit_id uuid not null references permits(id) on delete cascade,
  inspection_type text,
  scheduled_date date,
  inspector_name text,
  result text not null default 'scheduled',
  notes text,
  correction_notice_url text,
  schedule_milestone_id uuid,
  created_at timestamptz not null default now()
);
alter table inspections disable row level security;
create index inspections_project_idx on inspections (project_id);
create index inspections_permit_idx on inspections (permit_id);

create table third_party_inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  inspection_type text,
  inspector_contact_id uuid references contacts(id) on delete set null,
  company text,
  scheduled_date date,
  completed_date date,
  result text not null default 'pending',
  report_url text,
  notes text,
  created_at timestamptz not null default now()
);
alter table third_party_inspections disable row level security;
create index third_party_project_idx on third_party_inspections (project_id);
