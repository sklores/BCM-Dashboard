-- Messages overhaul (Phase F): manual-entry messages can carry an
-- attachment URL — used by text-screenshot entries for the captured
-- image, and by field-note entries for an inline photo.

alter table messages
  add column if not exists attachment_url text;
