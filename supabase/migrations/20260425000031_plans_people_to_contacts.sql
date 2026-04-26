-- Plans: switch person-pickers from the legacy users table to the
-- project Contacts directory. Drop FK constraints to users; the columns
-- now hold contacts(id) values. Existing user-id values that don't
-- correspond to a contact are nulled out so dropdowns don't show "?"
-- for orphan references.

alter table drawings drop constraint if exists drawings_uploaded_by_fkey;
alter table drawing_pins drop constraint if exists drawing_pins_created_by_fkey;
alter table rfis drop constraint if exists rfis_assigned_to_fkey;
alter table submittals drop constraint if exists submittals_submitted_by_fkey;

update drawings
  set uploaded_by = null
  where uploaded_by is not null
    and uploaded_by not in (select id from contacts);
update drawing_pins
  set created_by = null
  where created_by is not null
    and created_by not in (select id from contacts);
update rfis
  set assigned_to = null
  where assigned_to is not null
    and assigned_to not in (select id from contacts);
update submittals
  set submitted_by = null
  where submitted_by is not null
    and submitted_by not in (select id from contacts);
