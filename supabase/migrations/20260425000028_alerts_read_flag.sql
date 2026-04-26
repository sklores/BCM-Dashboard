-- Alerts: read flag for the new notifications bell.
alter table alerts
  add column if not exists read boolean not null default false;
create index if not exists alerts_unread_idx
  on alerts (project_id, read, created_at desc);
