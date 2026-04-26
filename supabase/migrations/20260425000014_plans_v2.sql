-- Plans v2: drawings + RFIs + submittals + drawing pins.
-- Replaces the categorical plans table conceptually. The old `plans` table
-- is left in place for any data already entered; the new UI uses these tables.

create table drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  drawing_number text,
  title text,
  type text,
  revision_number text,
  revision_date date,
  uploaded_by uuid references users(id) on delete set null,
  pdf_url text,
  status text not null default 'current',
  superseded_by uuid references drawings(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table drawings disable row level security;
create index drawings_project_status_idx on drawings (project_id, status);
create index drawings_project_number_idx on drawings (project_id, drawing_number);

create table drawing_pins (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  x_position numeric,
  y_position numeric,
  pin_number integer,
  note text,
  rfi_id uuid,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table drawing_pins disable row level security;
create index drawing_pins_drawing_idx on drawing_pins (drawing_id);

create table rfis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rfi_number integer,
  drawing_id uuid references drawings(id) on delete set null,
  location_description text,
  question text,
  response text,
  status text not null default 'open',
  assigned_to uuid references users(id) on delete set null,
  drawing_pin_id uuid references drawing_pins(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table rfis disable row level security;
create index rfis_project_idx on rfis (project_id, status);

-- Now that the rfis table exists, complete the FK on drawing_pins.rfi_id.
alter table drawing_pins
  add constraint drawing_pins_rfi_id_fkey
  foreign key (rfi_id) references rfis(id) on delete set null;

create table submittals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  submittal_number integer,
  description text,
  spec_section text,
  submitted_by uuid references users(id) on delete set null,
  submitted_to text,
  date_submitted date,
  date_returned date,
  status text not null default 'pending',
  revision_number integer not null default 0,
  notes text,
  pdf_url text,
  created_at timestamptz not null default now()
);
alter table submittals disable row level security;
create index submittals_project_idx on submittals (project_id, status);
