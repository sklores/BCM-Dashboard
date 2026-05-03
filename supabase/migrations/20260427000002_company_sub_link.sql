-- Bidirectional bridge between Contacts companies and Subs subs.
-- A company in Subs-Trade or Subs-MEP category gets a 1:1 link to a row
-- in `subs`. Adding a sub auto-creates the matching company; adding a
-- subs-Trade or subs-MEP company auto-creates the matching sub.

alter table companies
  add column if not exists sub_id uuid references subs(id) on delete set null;

create index if not exists companies_sub_id_idx on companies (sub_id);

-- Backfill: for any company in a sub category whose name matches a sub
-- row exactly (case-insensitive), set the link.
update companies c
   set sub_id = s.id
  from subs s
 where c.sub_id is null
   and c.category in ('subs_trade', 'subs_mep')
   and lower(trim(c.company_name)) = lower(trim(s.name));
