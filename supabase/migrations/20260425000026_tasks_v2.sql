-- Tasks module v2: typed tasks, recurring, dependencies, multi-assignee,
-- attachments, punch list details.

alter table tasks
  add column if not exists task_type text default 'general',
  add column if not exists priority text default 'medium',
  add column if not exists recurring boolean default false,
  add column if not exists recurring_frequency text,
  add column if not exists recurring_end_date date,
  add column if not exists parent_task_id uuid references tasks(id) on delete set null,
  add column if not exists linked_module text,
  add column if not exists linked_record_id uuid,
  add column if not exists created_by uuid references users(id) on delete set null;

create table if not exists task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table task_assignees disable row level security;
create index if not exists task_assignees_task_idx on task_assignees (task_id);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_url text,
  file_name text,
  created_at timestamptz not null default now()
);
alter table task_attachments disable row level security;
create index if not exists task_attachments_task_idx on task_attachments (task_id);

create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  predecessor_task_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table task_dependencies disable row level security;
create index if not exists task_dependencies_task_idx on task_dependencies (task_id);
create index if not exists task_dependencies_pred_idx
  on task_dependencies (predecessor_task_id);

create table if not exists punch_list_details (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade unique,
  location text,
  responsible_sub_id uuid references contacts(id) on delete set null,
  sign_off_required boolean default false,
  sign_off_date date,
  sign_off_by uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table punch_list_details disable row level security;
create index if not exists punch_list_details_task_idx
  on punch_list_details (task_id);

insert into storage.buckets (id, name, public)
values ('tasks', 'tasks', true)
on conflict (id) do nothing;
