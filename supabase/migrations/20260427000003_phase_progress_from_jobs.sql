-- Job completion drives Schedule phase progress.
-- A phase's progress_pct = round(done_jobs / total_jobs * 100) where the
-- jobs are the ones with parent_phase_id pointing at this phase. If no
-- jobs are linked, progress is null (UI hides the indicator).

alter table schedule_phases
  add column if not exists progress_pct integer;

create or replace function recompute_phase_progress(p_phase_id uuid)
returns void
language plpgsql
as $fn$
declare
  total_jobs integer;
  done_jobs integer;
  pct integer;
begin
  if p_phase_id is null then return; end if;

  select count(*) into total_jobs
    from jobs
   where parent_phase_id = p_phase_id;

  if total_jobs = 0 then
    update schedule_phases set progress_pct = null where id = p_phase_id;
    return;
  end if;

  select count(*) into done_jobs
    from jobs
   where parent_phase_id = p_phase_id
     and status = 'complete';

  pct := round((done_jobs::numeric / total_jobs::numeric) * 100);
  update schedule_phases set progress_pct = pct where id = p_phase_id;
end
$fn$;

create or replace function trigger_jobs_phase_progress()
returns trigger
language plpgsql
as $tg$
begin
  if tg_op = 'INSERT' then
    perform recompute_phase_progress(new.parent_phase_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.parent_phase_id is distinct from old.parent_phase_id then
      perform recompute_phase_progress(old.parent_phase_id);
      perform recompute_phase_progress(new.parent_phase_id);
    elsif new.status is distinct from old.status then
      perform recompute_phase_progress(new.parent_phase_id);
    end if;
    return new;
  else
    perform recompute_phase_progress(old.parent_phase_id);
    return old;
  end if;
end
$tg$;

drop trigger if exists jobs_phase_progress_trigger on jobs;
create trigger jobs_phase_progress_trigger
after insert or update or delete on jobs
for each row execute function trigger_jobs_phase_progress();

-- Backfill: re-run the recompute for every phase that already has jobs.
do $$
declare
  p_id uuid;
begin
  for p_id in select distinct parent_phase_id from jobs where parent_phase_id is not null
  loop
    perform recompute_phase_progress(p_id);
  end loop;
end $$;
