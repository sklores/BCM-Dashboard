-- BCM Dashboard target-spec Phase A
-- Schema changes for the 12-module redesign. Idempotent — safe to re-run.

-- 1. Contacts: 8-bucket category set ----------------------------------
-- Existing values today: bcm_team / contractors / architect / engineer /
-- meps / client / building. Target: bcm_team / client / design_team /
-- subs_trade / subs_mep / permits_inspections / building / vendors.
-- Migration mapping: contractors → subs_trade, architect → design_team,
-- engineer → design_team (merge into one bucket), meps → subs_mep.
-- New buckets: permits_inspections, vendors (no rows yet — UI seeds).

alter table companies
  add column if not exists category text;

update companies set category = 'subs_trade'  where category = 'contractors';
update companies set category = 'design_team' where category in ('architect', 'engineer');
update companies set category = 'subs_mep'    where category = 'meps';

create index if not exists companies_category_idx
  on companies (project_id, category);

-- 2. Subs: scope-of-work field that the per-sub profile owns -----------

alter table subs
  add column if not exists scope_of_work text,
  add column if not exists source_extraction_id uuid references drawing_extractions(id) on delete set null,
  add column if not exists source_drawing_id uuid references drawings(id) on delete set null;

-- 3. Materials: assigned-sub link + new status enum --------------------
-- Status mapping: looking → specified, found → ordered,
-- purchased → delivered, onsite → installed.

alter table materials
  add column if not exists assigned_sub_id uuid references subs(id) on delete set null;

create index if not exists materials_assigned_sub_idx
  on materials (assigned_sub_id);

update materials set status = 'specified' where status = 'looking';
update materials set status = 'ordered'   where status = 'found';
update materials set status = 'delivered' where status = 'purchased';
update materials set status = 'installed' where status = 'onsite';

-- 4. Jobs: subcontractor scopes-of-work --------------------------------

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
  parent_phase_id uuid references schedule_phases(id) on delete set null,
  parent_subtask_id uuid references schedule_subtasks(id) on delete set null,
  location text,
  created_at timestamptz not null default now()
);
alter table jobs disable row level security;
create index if not exists jobs_project_idx       on jobs (project_id);
create index if not exists jobs_sub_idx           on jobs (sub_id);
create index if not exists jobs_parent_phase_idx  on jobs (parent_phase_id);

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

-- 5. Personal todos (per-project shared list for now; user filter TBD) --

create table if not exists personal_todos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  title text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table personal_todos disable row level security;
create index if not exists personal_todos_project_idx on personal_todos (project_id);

-- 6. Messages: priority + entry_type + follow-up link -------------------

alter table messages
  add column if not exists priority text default 'normal',
  add column if not exists entry_type text default 'email',
  add column if not exists follow_up_task_id uuid references tasks(id) on delete set null;

-- 7. Notes: typed + module-tagged fields on scratch_notes --------------
-- Extends the existing scratch_notes table to act as the unified Notes
-- entry for the new spec. Existing data keeps working; legacy meetings /
-- team_pad_notes tables stay around for read-back during migration.

alter table scratch_notes
  add column if not exists note_type text default 'scratch',
  add column if not exists tagged_module text,
  add column if not exists tagged_record_id uuid,
  add column if not exists promoted_to_message_id uuid references messages(id) on delete set null;

create index if not exists scratch_notes_tagged_idx
  on scratch_notes (tagged_module, tagged_record_id);

-- 8. Plans: per-project current-set share token -----------------------

create table if not exists plans_share_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table plans_share_tokens disable row level security;

alter table drawings
  add column if not exists upload_verified_date date,
  add column if not exists upload_verified_by text;

-- 9. Activity feed write-target ---------------------------------------
-- The alerts table already exists and has module_key/event_type/message
-- columns — repurpose it as the global activity feed. Add a "level"
-- column so info / warn / critical can be styled differently and a
-- "actor" column so we know who created the event.

alter table alerts
  add column if not exists level text default 'info',
  add column if not exists actor text;
