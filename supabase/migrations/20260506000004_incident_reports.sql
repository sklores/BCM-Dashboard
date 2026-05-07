-- Incident reports: safety / property damage / near miss / injury logs.
-- Mobile is the primary author (Super at the moment of the incident),
-- dashboard reads. Photos attached separately so a single report can
-- have N before/after/scene photos without growing the main row.

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,

  -- When (split so users can log past incidents accurately)
  incident_date date not null,
  incident_time time,

  -- Where on the project site
  location text,

  -- Classification
  severity text,        -- 'minor' | 'moderate' | 'severe' | 'critical'
  incident_type text,   -- 'near_miss' | 'injury' | 'property_damage' |
                        -- 'equipment_failure' | 'safety_violation' | 'other'

  -- Narrative fields
  description text not null,
  involved_persons text,
  witnesses text,
  actions_taken text,

  -- Provenance
  device_id text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table incident_reports disable row level security;
create index incident_reports_project_date_idx
  on incident_reports (project_id, incident_date desc, reported_at desc);

create table incident_report_photos (
  id uuid primary key default gen_random_uuid(),
  incident_report_id uuid not null
    references incident_reports(id) on delete cascade,
  storage_path text not null,
  storage_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table incident_report_photos disable row level security;
create index incident_report_photos_incident_idx
  on incident_report_photos (incident_report_id, sort_order);
