-- Finish schedule extension to Materials. Each material can be flagged as
-- a finish schedule entry, which surfaces extra fields + a photo gallery.

alter table materials add column is_finish boolean not null default false;
alter table materials add column room text;
alter table materials add column color_finish text;
alter table materials add column installation_notes text;

-- Photos for finish schedule materials. Reuses the existing 'photos' bucket
-- with a 'materials/<material_id>/' path prefix.
create table material_photos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  storage_path text not null,
  storage_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table material_photos disable row level security;
create index material_photos_material_idx
  on material_photos (material_id, sort_order);
