-- Photos module: per-project photo catalog backed by Supabase Storage.
-- Tags are AI-generated (Claude vision) plus user-editable. Original
-- filenames live in OneDrive, so we don't store them here.

create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  storage_url text,
  taken_at timestamptz,
  tags text[] not null default '{}',
  room text,
  stage text,
  ai_description text,
  notes text,
  uploaded_at timestamptz not null default now()
);

alter table photos disable row level security;

create index photos_project_taken_idx
  on photos (project_id, taken_at desc nulls last, uploaded_at desc);

create index photos_tags_gin_idx on photos using gin (tags);

-- Storage bucket for the binary blobs. Public so Claude vision can fetch
-- by URL. We can't disable RLS on storage.objects (owned by storage admin),
-- so add permissive policies for the photos bucket while we're in beta.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos_anon_select" on storage.objects;
drop policy if exists "photos_anon_insert" on storage.objects;
drop policy if exists "photos_anon_update" on storage.objects;
drop policy if exists "photos_anon_delete" on storage.objects;

create policy "photos_anon_select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'photos');

create policy "photos_anon_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'photos');

create policy "photos_anon_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');

create policy "photos_anon_delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'photos');
