-- Tasks: simplify status set to Not Started / In Progress / Delayed / Complete.
-- "blocked" → "delayed" (rename), "cancelled" → "complete" (consolidate
-- finished states).
update tasks set status = 'delayed' where status = 'blocked';
update tasks set status = 'complete' where status = 'cancelled';
