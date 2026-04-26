-- Contacts module: central people directory grouped by company.
-- Replaces the Team tab in the sidebar; the underlying `team` /
-- `project_members` tables are left untouched per the self-contained
-- module rule.

create table companies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  company_name text not null,
  address text,
  website text,
  phone text,
  primary_contact_id uuid,
  created_at timestamptz not null default now()
);
alter table companies disable row level security;
create index companies_project_idx on companies (project_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  company_id uuid references companies(id) on delete set null,
  role_type text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
alter table contacts disable row level security;
create index contacts_project_idx on contacts (project_id);
create index contacts_company_idx on contacts (company_id);
create index contacts_email_idx on contacts (lower(email));
