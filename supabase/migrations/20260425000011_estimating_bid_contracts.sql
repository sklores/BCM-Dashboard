-- Estimating module (standalone, not project-tied — pre-construction tool)
create table estimates (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  project_name text,
  project_address text,
  estimate_date date,
  estimate_number text,
  fee_type text not null default 'percent',
  fee_value numeric(14, 2) not null default 0,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table estimates disable row level security;

create table estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  description text,
  quantity numeric(14, 2) not null default 0,
  unit text,
  unit_cost numeric(14, 2) not null default 0,
  -- total_cost is derived in the UI from quantity * unit_cost (don't trust client math
  -- on read; compute server-side via a generated column).
  total_cost numeric(14, 2) generated always as (quantity * unit_cost) stored,
  sort_order integer not null default 0
);
alter table estimate_line_items disable row level security;
create index estimate_line_items_estimate_idx
  on estimate_line_items (estimate_id, sort_order);


-- Bid Solicitation module (project-tied)
create table bid_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  trade_name text,
  scope_of_work text,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table bid_requests disable row level security;

-- The spec wrote "sub_id references users", but our model has a dedicated
-- subs (companies) table — bid invitations point at subs.id.
create table bid_invitations (
  id uuid primary key default gen_random_uuid(),
  bid_request_id uuid not null references bid_requests(id) on delete cascade,
  sub_id uuid not null references subs(id) on delete cascade,
  status text not null default 'invited',
  base_bid numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (bid_request_id, sub_id)
);
alter table bid_invitations disable row level security;

create table bid_line_items (
  id uuid primary key default gen_random_uuid(),
  bid_request_id uuid not null references bid_requests(id) on delete cascade,
  sub_id uuid references subs(id) on delete cascade,
  description text,
  amount numeric(14, 2),
  sort_order integer not null default 0
);
alter table bid_line_items disable row level security;
create index bid_line_items_request_idx on bid_line_items (bid_request_id);


-- Contracts module (project-tied)
create table prime_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contract_number text,
  client_name text,
  contract_type text,
  original_contract_value numeric(14, 2),
  retainage_percentage numeric(5, 2),
  start_date date,
  substantial_completion_date date,
  final_completion_date date,
  scope_of_work text,
  inclusions text,
  exclusions text,
  pdf_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table prime_contracts disable row level security;

create table subcontractor_agreements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_id uuid references subs(id) on delete set null,
  contract_number text,
  trade text,
  scope_of_work text,
  contract_value numeric(14, 2),
  retainage_percentage numeric(5, 2),
  start_date date,
  completion_date date,
  pdf_url text,
  status text not null default 'draft',
  bid_request_id uuid references bid_requests(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table subcontractor_agreements disable row level security;

create table sub_agreement_line_items (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references subcontractor_agreements(id) on delete cascade,
  description text,
  value numeric(14, 2),
  sort_order integer not null default 0
);
alter table sub_agreement_line_items disable row level security;

create table contract_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  co_number integer,
  co_date date,
  description text,
  amount numeric(14, 2),
  status text not null default 'pending',
  affects_client_contract boolean not null default false,
  affects_sub_contract boolean not null default false,
  sub_id uuid references subs(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table contract_change_orders disable row level security;
