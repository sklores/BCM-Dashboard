-- Billing module: client pay applications + sub requisitions.
-- Change orders reuse the existing contract_change_orders table from the
-- Contracts module — the data is the same; the Billing UI just exposes it
-- alongside pay apps and requisitions.

create table pay_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  application_number integer,
  period_start date,
  period_end date,
  scheduled_value numeric(14, 2),
  work_completed_this_period numeric(14, 2),
  work_completed_to_date numeric(14, 2),
  retainage_held numeric(14, 2),
  previous_payments numeric(14, 2),
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table pay_applications disable row level security;
create index pay_applications_project_idx
  on pay_applications (project_id, application_number);

create table sub_requisitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Spec wrote "references users" but our model uses a separate subs table
  -- (consistent with bid_invitations / subcontractor_agreements).
  sub_id uuid references subs(id) on delete set null,
  period_start date,
  period_end date,
  scheduled_value numeric(14, 2),
  work_completed_this_period numeric(14, 2),
  work_completed_to_date numeric(14, 2),
  retainage_held numeric(14, 2),
  amount_due numeric(14, 2),
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);
alter table sub_requisitions disable row level security;
create index sub_requisitions_project_idx
  on sub_requisitions (project_id, sub_id);
