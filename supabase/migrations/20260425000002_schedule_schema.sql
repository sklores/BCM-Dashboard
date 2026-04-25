-- Schedule module schema. Hierarchy: phase -> task -> subtask, with material_cards
-- attached to tasks. Soft dependencies between tasks. Milestones live alongside phases.
-- Public share tokens enable login-less Milestone view sharing.
--
-- Global alerts table is shared across modules (Schedule writes to it on soft-dep risk).

create table schedule_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  status text not null default 'not_started',
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references schedule_phases(id) on delete cascade,
  name text not null,
  status text not null default 'not_started',
  assigned_sub_id uuid references project_members(id) on delete set null,
  assigned_user_id uuid references users(id) on delete set null,
  start_date date,
  end_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table schedule_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references schedule_tasks(id) on delete cascade,
  name text not null,
  status text not null default 'not_started',
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table schedule_material_cards (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references schedule_tasks(id) on delete cascade,
  product_name text,
  manufacturer text,
  supplier text,
  lead_time text,
  instructions text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table schedule_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_task_id uuid not null references schedule_tasks(id) on delete cascade,
  successor_task_id uuid not null references schedule_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (predecessor_task_id, successor_task_id)
);

create table schedule_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  date date,
  status text not null default 'not_started',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table schedule_milestone_share_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module_key text not null,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Beta has no auth; disable RLS so anon key can read/write (matches earlier tables).
alter table schedule_phases                disable row level security;
alter table schedule_tasks                 disable row level security;
alter table schedule_subtasks              disable row level security;
alter table schedule_material_cards        disable row level security;
alter table schedule_task_dependencies     disable row level security;
alter table schedule_milestones            disable row level security;
alter table schedule_milestone_share_tokens disable row level security;
alter table alerts                         disable row level security;
