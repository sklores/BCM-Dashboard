-- Daily logs: classic construction manpower log. One log row per project
-- per day, with N crew entries (contractor/trade × manpower × work-hours
-- × description). Sourced from the user's "Daily Log Template" Excel —
-- mobile is the primary author (Super at end of day in the field).
-- Dashboard reads + can later add its own UI.

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  log_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table daily_logs disable row level security;
create index daily_logs_project_date_idx on daily_logs (project_id, log_date desc);

create table daily_log_entries (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  contractor_trade text,
  manpower integer,
  work_hours numeric(6, 2),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table daily_log_entries disable row level security;
create index daily_log_entries_log_idx
  on daily_log_entries (daily_log_id, sort_order);
