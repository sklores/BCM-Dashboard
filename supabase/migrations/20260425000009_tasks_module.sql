-- Tasks module: live ticket tracking system. Independent from schedule_tasks
-- (planned timeline items) — this is the active tickets list with assignees,
-- live time tracking, and status updates.

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started',
  assigned_sub_id uuid references project_subs(id) on delete set null,
  assigned_user_id uuid references users(id) on delete set null,
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  sort_order integer not null default 0
);

alter table tasks disable row level security;

create index tasks_project_status_idx on tasks (project_id, status);

-- Seed a handful of tickets on BCM Construction so the UI has content.
with target as (
  select id as project_id from projects where name = 'BCM Construction' limit 1
)
insert into tasks (project_id, title, description, status, start_date, due_date, sort_order)
select project_id, title, description, status, start_date::date, due_date::date, ord
from target,
     (values
        ('Confirm electrical panel size with inspector',
         'Need to verify 200A vs 400A before MEP rough-in. Awaiting callback.',
         'in_progress', '2026-04-20', '2026-04-28', 0),
        ('Schedule plumbing rough-in inspection',
         'Once plumbing rough-in completes, request city inspection.',
         'not_started', '2026-04-25', '2026-05-08', 1),
        ('Fix joist hanger callouts',
         'Two minor notes from frame inspection — see PDF in Messages.',
         'in_progress', '2026-04-23', '2026-04-26', 2),
        ('Order kitchen windows',
         'Supplier delay — pushed to May 9. Confirm replacement materials.',
         'delayed', '2026-04-15', '2026-04-22', 3),
        ('Final walkthrough prep',
         'Punch list cleanup before owner walkthrough.',
         'not_started', '2026-08-01', '2026-08-05', 4)
     ) as t(title, description, status, start_date, due_date, ord);
