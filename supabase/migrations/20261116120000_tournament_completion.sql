alter table public.tournaments add column if not exists completed_at timestamptz;

-- Repair the four qualifiers with an independently verified completed schedule.
with verified as (
  select championship_id, max(finished_at) as completed_at
  from public.matches
  where championship_id in (
    'bf478b03-383d-4d65-9a26-c83b3a78612c', '45e581f1-9f0c-40ec-8d65-e2d8888c739e',
    'caf0ec12-d4a6-4d35-8916-f2f3122b4c37', 'fcd2f11c-803c-4007-b79e-2a411c6cafb3'
  )
  group by championship_id
  having bool_and(coalesce(status in ('FINISHED','MATCH_STATUS_FINISHED'), false))
    and max(finished_at) <= now()
)
update public.tournaments t
set completed_at = v.completed_at, end_date = (v.completed_at at time zone 'UTC')::date, updated_at = now()
from verified v
where t.championship_id = v.championship_id and t.completed_at is null;
