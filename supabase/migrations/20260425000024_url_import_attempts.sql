-- URL import toolbox memory: log every attempt so we can learn which fetcher
-- works per domain and try it first next time.
create table url_import_attempts (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  tool text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
alter table url_import_attempts disable row level security;
create index url_import_attempts_domain_idx
  on url_import_attempts (domain, succeeded, created_at desc);
