-- Beta has no auth (Supabase email/password lands later, MS SSO in v2).
-- Without policies, RLS silently blocks all anon reads/writes. Disable it
-- here so the dashboard can read/write with the anon key during beta.
-- Re-enable and add policies before introducing auth.

alter table projects        disable row level security;
alter table users           disable row level security;
alter table project_members disable row level security;
alter table modules         disable row level security;
