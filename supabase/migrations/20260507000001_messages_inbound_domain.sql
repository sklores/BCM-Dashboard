-- Messages inbound domain: swap the placeholder @bcmdashboard.com domain
-- (which is not a real domain we own) for @projects.thejumpstreet.com
-- as the working placeholder. When BCM provisions brunoclay.com, this
-- becomes a 1-line update to @projects.brunoclay.com plus new MX
-- records — no schema changes.

-- 1. Rewrite the trigger to use the new domain.
create or replace function generate_project_inbound_email()
returns trigger as $$
begin
  if new.inbound_email is null and new.address is not null then
    new.inbound_email :=
      lower(regexp_replace(split_part(new.address, ',', 1), '[^a-zA-Z0-9]', '', 'g'))
      || '@projects.thejumpstreet.com';
  end if;
  return new;
end;
$$ language plpgsql;

-- 2. Migrate existing rows still on the old placeholder.
update projects
set inbound_email = replace(inbound_email, '@bcmdashboard.com', '@projects.thejumpstreet.com')
where inbound_email like '%@bcmdashboard.com';
