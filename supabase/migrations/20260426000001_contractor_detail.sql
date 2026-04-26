-- Contractor detail page: link Materials to a contractor, and let a sub
-- created from a Plans extraction track its origin so the detail page can
-- show what came from which drawing.

alter table materials
  add column if not exists assigned_sub_id uuid references subs(id) on delete set null;

create index if not exists materials_assigned_sub_idx
  on materials (assigned_sub_id);

alter table subs
  add column if not exists source_extraction_id uuid references drawing_extractions(id) on delete set null,
  add column if not exists source_drawing_id uuid references drawings(id) on delete set null;
