-- Companies: pre-seeded category buckets per project. Every project should
-- show up with these seven category sections ready to fill — Bruno Clay
-- Team, Contractors, Architect, Engineer, MEPs, Client, Building.

alter table companies
  add column if not exists category text;

-- Best-effort backfill: existing companies have no category, leave them null
-- so they still render under an "Uncategorized" group until manually moved.
-- (Client-side ensure-categories code seeds the 7 placeholder rows.)

create index if not exists companies_category_idx on companies (project_id, category);
