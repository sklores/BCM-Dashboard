-- Drawing extraction: add Contractors / Permits / General Notes as push
-- targets. Schedule + Materials remain unchanged.

alter table drawing_extractions
  add column if not exists pushed_to_contractors boolean not null default false,
  add column if not exists pushed_to_permits boolean not null default false,
  add column if not exists pushed_to_general_notes boolean not null default false;

-- General Notes: a Plans-resident jot-list for items that don't fit
-- elsewhere. Optionally tied to the originating drawing.
create table if not exists general_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  drawing_id uuid references drawings(id) on delete set null,
  body text,
  source text,
  source_extraction_id uuid references drawing_extractions(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table general_notes disable row level security;
create index if not exists general_notes_project_idx on general_notes (project_id);
create index if not exists general_notes_drawing_idx on general_notes (drawing_id);
