-- personal_todos: device_id stand-in for "user" until real auth lands.
-- Scopes To Do lists to the browser/localStorage UUID without faking
-- rows in users (which has a FK from personal_todos.user_id).

alter table personal_todos
  add column if not exists device_id text;

create index if not exists personal_todos_device_idx
  on personal_todos (project_id, device_id);
