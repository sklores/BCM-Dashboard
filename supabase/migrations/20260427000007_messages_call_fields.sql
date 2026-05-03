-- Phase F verify: Call Log structure (contact pick, duration). Date is
-- carried by received_at — the composer just exposes a date picker for
-- call logs that writes to it.

alter table messages
  add column if not exists contact_id uuid references contacts(id) on delete set null,
  add column if not exists duration_minutes integer;

create index if not exists messages_contact_idx on messages (contact_id);
