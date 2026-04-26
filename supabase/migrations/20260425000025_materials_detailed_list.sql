-- Materials Detailed List: tracking + dimensions fields, plus the source URL
-- captured by the import flow.
alter table materials
  add column status text default 'looking',
  add column dimensions text,
  add column qty numeric(12, 4),
  add column source_url text;
