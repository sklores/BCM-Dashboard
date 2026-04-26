-- Notes module: scratch pad, meeting notes, meeting minutes, pending items.

create table scratch_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  title text,
  body text,
  tagged_module text,
  tagged_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table scratch_notes disable row level security;
create index scratch_notes_project_idx on scratch_notes (project_id);
create index scratch_notes_user_idx on scratch_notes (user_id);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  meeting_name text,
  date date,
  location text,
  attendees jsonb not null default '[]'::jsonb,
  notes_body text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table meetings disable row level security;
create index meetings_project_idx on meetings (project_id);

create table meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  name text
);
alter table meeting_attendees disable row level security;
create index meeting_attendees_meeting_idx on meeting_attendees (meeting_id);

create table action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  description text,
  assigned_to uuid references contacts(id) on delete set null,
  due_date date,
  converted_to_task boolean not null default false,
  task_id uuid,
  created_at timestamptz not null default now()
);
alter table action_items disable row level security;
create index action_items_meeting_idx on action_items (meeting_id);

create table meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft',
  pdf_url text,
  distributed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table meeting_minutes disable row level security;
create index meeting_minutes_project_idx on meeting_minutes (project_id);

create table pending_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  description text,
  raised_by uuid references contacts(id) on delete set null,
  meeting_id uuid references meetings(id) on delete set null,
  status text not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table pending_items disable row level security;
create index pending_items_project_idx on pending_items (project_id);
