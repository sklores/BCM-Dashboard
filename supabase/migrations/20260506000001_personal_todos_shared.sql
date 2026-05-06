-- Mobile↔Dashboard cross-app sync for the Work → To Do tab.
-- Adds a `shared` flag so users can flip a per-item toggle to expose
-- it across all browsers/devices on a project. Default is false so
-- existing rows keep the dashboard's current device-private behavior.
-- Both apps query "own device items ∪ shared items" within the project.

alter table personal_todos
  add column if not exists shared boolean not null default false;

create index if not exists personal_todos_shared_idx
  on personal_todos (project_id, shared);
