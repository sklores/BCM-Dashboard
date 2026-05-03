-- Materials delivery delay: track expected delivery + a timestamp of the
-- last "delay alert" written so the activity-feed write doesn't repeat
-- on every page load.

alter table materials
  add column if not exists expected_delivery_date date,
  add column if not exists delivery_delay_alerted_at timestamptz;
