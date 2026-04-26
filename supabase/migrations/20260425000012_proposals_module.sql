-- Proposals module: client-facing documents generated from Estimating data.
-- Standalone (lists across all projects); links to an estimate by estimate_id
-- and optionally to a project by project_id.

create table proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  proposal_number text,
  proposal_date date,
  client_name text,
  project_name text,
  project_address text,
  proposal_type text not null default 'detailed',
  cover_letter text,
  scope_narrative text,
  timeline_summary text,
  team_section text,
  why_hire_us text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table proposals disable row level security;

-- Single global boilerplate row. We insert one default row and treat the
-- table as a singleton (the app always picks the first row).
create table company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  logo_url text,
  years_in_business integer,
  mission_statement text,
  portfolio_highlights text,
  standard_terms text,
  updated_at timestamptz not null default now()
);
alter table company_settings disable row level security;

insert into company_settings (company_name)
values ('BCM Construction');
