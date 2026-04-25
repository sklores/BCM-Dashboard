-- Messages module: each project has an inbound_email; forwards from
-- Postmark land in the messages table via an edge function.

alter table projects add column inbound_email text;

-- Backfill existing projects from address (street part before first comma).
update projects
set inbound_email =
  lower(regexp_replace(split_part(address, ',', 1), '[^a-zA-Z0-9]', '', 'g'))
  || '@bcmdashboard.com'
where inbound_email is null and address is not null;

-- Auto-generate on insert when caller didn't supply one.
create or replace function generate_project_inbound_email()
returns trigger as $$
begin
  if new.inbound_email is null and new.address is not null then
    new.inbound_email :=
      lower(regexp_replace(split_part(new.address, ',', 1), '[^a-zA-Z0-9]', '', 'g'))
      || '@bcmdashboard.com';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_inbound_email on projects;
create trigger projects_set_inbound_email
  before insert on projects
  for each row
  execute function generate_project_inbound_email();

create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  from_email text,
  from_name text,
  subject text,
  body text,
  received_at timestamptz not null default now()
);

alter table messages disable row level security;

create index messages_project_received_idx
  on messages (project_id, received_at desc);

-- Seed a couple of test messages on BCM Construction so the UI has content.
with target as (
  select id from projects where name = 'BCM Construction' limit 1
)
insert into messages (project_id, from_email, from_name, subject, body, received_at)
select id,
       e.from_email, e.from_name, e.subject, e.body, e.received_at::timestamptz
from target,
     (values
        ('joe@acmeplumbing.com', 'Joe Smith', 'Plumbing rough-in scheduled',
         'Hi team — confirming Monday 9 AM for plumbing rough-in. Crew of 3 will be onsite. Need plywood subfloor cleared in master bath. Thanks, Joe',
         '2026-04-22 09:14:00'),
        ('inspector@nyc.gov', 'D. Hernandez',
         'Frame inspection result',
         'Inspection passed. Report attached. Two minor notes on the joist hangers in the rear addition — see PDF. Schedule MEP whenever ready.',
         '2026-04-23 14:02:00'),
        ('emma@windowco.com', 'Emma Liu',
         'Window delivery delay',
         'Heads up — kitchen window delivery slipped from May 2 to May 9 due to a glass shortage at the supplier. Other windows still on track.',
         '2026-04-24 11:31:00')
     ) as e(from_email, from_name, subject, body, received_at);
