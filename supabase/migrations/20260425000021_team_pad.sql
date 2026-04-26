-- Team Pad: shared notepad visible to the whole team. Replaces the
-- Meeting Minutes section in Notes; Meeting Minutes is now a Report.

create table team_pad_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text,
  body text,
  last_edited_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table team_pad_notes disable row level security;
create index team_pad_notes_project_idx on team_pad_notes (project_id);
