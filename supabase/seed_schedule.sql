-- Seed Schedule data for the BCM Construction project so the views have content.
-- Idempotent: run after the schema migration. Adjust the project_id in the with-clause
-- if needed (this targets the BCM Construction seed row).

with target as (
  select id as project_id from projects where name = 'BCM Construction' limit 1
),
phase_rows as (
  insert into schedule_phases (project_id, name, status, start_date, end_date, sort_order)
  select project_id, name, status, start_date::date, end_date::date, ord
  from target,
       (values
          ('Foundation',   'complete',    '2026-03-01', '2026-03-21', 0),
          ('Framing',      'in_progress', '2026-03-22', '2026-04-25', 1),
          ('MEP Rough',    'in_progress', '2026-04-15', '2026-05-20', 2),
          ('Drywall',      'not_started', '2026-05-15', '2026-06-15', 3),
          ('Finishes',     'not_started', '2026-06-10', '2026-07-25', 4),
          ('Punch List',   'not_started', '2026-07-20', '2026-08-10', 5)
       ) as p(name, status, start_date, end_date, ord)
  returning id, name
)
insert into schedule_tasks (phase_id, name, status, start_date, end_date, sort_order)
select phase_rows.id, t.name, t.status, t.start_date::date, t.end_date::date, t.ord
from phase_rows
join (values
  ('Framing',   'Exterior wall framing', 'in_progress', '2026-03-22', '2026-04-05', 0),
  ('Framing',   'Interior wall framing', 'in_progress', '2026-04-01', '2026-04-18', 1),
  ('Framing',   'Roof trusses',          'not_started', '2026-04-15', '2026-04-25', 2),
  ('MEP Rough', 'Plumbing rough-in',     'in_progress', '2026-04-15', '2026-05-05', 0),
  ('MEP Rough', 'Electrical rough-in',   'delayed',     '2026-04-20', '2026-05-10', 1),
  ('MEP Rough', 'HVAC rough-in',         'not_started', '2026-05-01', '2026-05-20', 2),
  ('Drywall',   'Hang drywall',          'not_started', '2026-05-15', '2026-05-30', 0),
  ('Drywall',   'Tape & finish',         'not_started', '2026-05-28', '2026-06-15', 1)
) as t(phase_name, name, status, start_date, end_date, ord) on t.phase_name = phase_rows.name;

with target as (select id as project_id from projects where name = 'BCM Construction' limit 1)
insert into schedule_milestones (project_id, name, date, status, sort_order)
select project_id, name, date::date, status, ord from target,
       (values
          ('Permit approved',    '2026-02-25', 'complete',    0),
          ('Foundation poured',  '2026-03-15', 'complete',    1),
          ('Frame inspection',   '2026-04-25', 'in_progress', 2),
          ('MEP inspection',     '2026-05-22', 'not_started', 3),
          ('Final walkthrough',  '2026-08-05', 'not_started', 4)
       ) as m(name, date, status, ord);
