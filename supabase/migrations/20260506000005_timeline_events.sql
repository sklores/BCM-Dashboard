-- Timeline events: per-project audit log of meaningful changes that
-- power the Calendar → Timeline tab. Distinct from `alerts` (which is
-- the global notification bus) — Timeline is purely "what happened on
-- this project, newest first" and never expires / is never marked read.
--
-- Sources that write here:
--   - Schedule: phase / task status changes
--   - Budget:   line-item or division updates (with diff in details jsonb)
--   - Photos:   per-photo upload event
-- Sources Timeline reads directly (no row here):
--   - daily_logs           (one row IS the event)
--   - incident_reports     (one row IS the event)

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module_key text not null,           -- 'schedule' | 'budget' | 'photos'
  event_type text not null,           -- 'phase_status_changed', 'line_item_updated', 'photo_uploaded', ...
  title text not null,                -- one-line human-readable summary
  details jsonb not null default '{}'::jsonb,
                                      -- e.g. { "field": "contractor_cost", "from": 4500, "to": 5200 }
  ref_table text,                     -- pointer back to source row, e.g. 'schedule_phases'
  ref_id uuid,                        -- the source row id
  actor text,                         -- user email / device id, optional
  created_at timestamptz not null default now()
);
alter table timeline_events disable row level security;
create index timeline_events_project_idx
  on timeline_events (project_id, created_at desc);
create index timeline_events_module_idx
  on timeline_events (project_id, module_key, created_at desc);
