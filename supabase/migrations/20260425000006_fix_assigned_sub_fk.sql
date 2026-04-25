-- assigned_sub_id originally pointed at project_members; the new model has
-- a dedicated project_subs link table. Repoint the FK. No production data
-- has set this column yet, so clear and re-target.

update schedule_tasks set assigned_sub_id = null where assigned_sub_id is not null;

alter table schedule_tasks
  drop constraint if exists schedule_tasks_assigned_sub_id_fkey;

alter table schedule_tasks
  add constraint schedule_tasks_assigned_sub_id_fkey
  foreign key (assigned_sub_id) references project_subs(id) on delete set null;
