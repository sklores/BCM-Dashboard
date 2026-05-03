-- Phase H: Create module — document factory.
-- Every generated doc lives here, regardless of category. Content is
-- stored as markdown; the UI renders it for review and prints to PDF
-- via the browser. Tracking the doc lets the Saved tab list everything
-- that's ever been generated on the project.

create table if not exists generated_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category text not null,
  doc_type text not null,
  title text not null,
  content text,
  metadata jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table generated_documents disable row level security;

create index if not exists generated_documents_project_idx
  on generated_documents (project_id, created_at desc);
create index if not exists generated_documents_category_idx
  on generated_documents (project_id, category);
