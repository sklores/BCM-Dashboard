create table plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  category text not null default 'stamped',
  description text,
  file_url text,
  uploaded_at timestamptz not null default now()
);

alter table plans disable row level security;

create index plans_project_category_idx on plans (project_id, category);
