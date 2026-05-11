-- Photos kind: photos table now stores PDFs too. Inbound emails with
-- attachments fan out to this table — images get vision-tagged, PDFs
-- get stored as-is with kind='pdf'. UI filters by kind so Photos vs
-- PDFs render with the right thumbnail / open behavior.

alter table photos add column if not exists kind text not null default 'photo';

-- Constrain to the known kinds so a typo doesn't pollute the data.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photos_kind_check'
  ) then
    alter table photos
      add constraint photos_kind_check check (kind in ('photo', 'pdf'));
  end if;
end$$;

create index if not exists photos_project_kind_idx
  on photos (project_id, kind);
