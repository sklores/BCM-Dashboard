-- Plans: storage bucket for drawing PDFs.
insert into storage.buckets (id, name, public)
values ('plans', 'plans', true)
on conflict (id) do nothing;

create policy "plans_read" on storage.objects
  for select using (bucket_id = 'plans');
create policy "plans_insert" on storage.objects
  for insert with check (bucket_id = 'plans');
create policy "plans_update" on storage.objects
  for update using (bucket_id = 'plans');
create policy "plans_delete" on storage.objects
  for delete using (bucket_id = 'plans');
