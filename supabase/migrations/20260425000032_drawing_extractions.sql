-- Plans: drawing intelligence + extraction.
alter table drawings
  add column if not exists title_block_read boolean not null default false,
  add column if not exists extraction_status text not null default 'none',
  add column if not exists extraction_completed_at timestamptz,
  add column if not exists scale text,
  add column if not exists sheet_size text,
  add column if not exists project_name text;

create table if not exists drawing_extractions (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  category text,
  label text,
  description text,
  location_description text,
  confidence numeric(3, 2),
  status text not null default 'pending',
  pushed_to_materials boolean not null default false,
  pushed_to_schedule boolean not null default false,
  pushed_to_notes boolean not null default false,
  created_at timestamptz not null default now()
);
alter table drawing_extractions disable row level security;
create index if not exists drawing_extractions_drawing_idx
  on drawing_extractions (drawing_id, status);
