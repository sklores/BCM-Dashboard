-- Photos: support saving an annotated copy linked back to the original.
alter table photos
  add column if not exists annotated_from_id uuid references photos(id) on delete set null;
create index if not exists photos_annotated_from_idx
  on photos (annotated_from_id);
