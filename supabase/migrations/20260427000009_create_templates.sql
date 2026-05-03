-- Create module: per-document-type template upload. Users upload an
-- existing client contract / sub agreement / SOW / etc. once and all
-- future generations of that document type follow that template's
-- format, structure, and language. Multiple uploads per type are
-- preserved (history) but only one is `active` at a time.

create table if not exists create_templates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  file_url text,
  file_name text,
  source_text text,
  extracted_structure jsonb,
  uploaded_by uuid references users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  active boolean not null default true
);
alter table create_templates disable row level security;

create index if not exists create_templates_doctype_idx
  on create_templates (document_type, active, uploaded_at desc);

-- Storage bucket for uploaded template files.
insert into storage.buckets (id, name, public)
values ('create-templates', 'create-templates', true)
on conflict (id) do nothing;
