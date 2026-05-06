-- Work → To Do gets a richer shape that mirrors Notes → Pending Items:
-- a 3-state status (open / done / deferred) and a "raised by" contact.
-- The legacy `done` boolean stays for mobile compatibility — both apps
-- continue to read/write it for now; dashboard derives status from it
-- and writes both columns on save.

alter table personal_todos
  add column if not exists status text not null default 'open',
  add column if not exists raised_by uuid references contacts(id) on delete set null;

-- Backfill: any pre-existing done=true rows become status='done'.
update personal_todos set status = 'done' where done = true and status = 'open';

create index if not exists personal_todos_status_idx
  on personal_todos (project_id, status);
