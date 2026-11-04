-- Public readers must not be able to rewrite imported data or invoke maintenance.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from public, anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- The only browser writes allowed by current RLS policies are listed below.
do $$
declare relation record;
begin
  for relation in
    select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and c.relname not in ('match_comments', 'match_votes', 'news', 'profiles')
  loop
    execute format('revoke insert, update, delete on public.%I from authenticated', relation.relname);
  end loop;
end $$;
revoke update, delete on public.match_votes from authenticated;
revoke insert, delete on public.profiles from authenticated;

revoke execute on function
  public.rebuild_team_roster(text),
  public.sync_normalized_match_stats(text),
  public.claim_match_stat_jobs(integer),
  public.handle_new_user(),
  public.trigger_sync_normalized_match_stats(),
  public.set_updated_at()
from public, anon, authenticated;
grant execute on function
  public.rebuild_team_roster(text),
  public.sync_normalized_match_stats(text),
  public.claim_match_stat_jobs(integer)
to service_role;

-- These browser RPCs retain their internal administrator checks.
revoke execute on function public.upsert_team_profile(text,text),
  public.set_team_social_links(text,jsonb),
  public.set_official_team_photo(text,uuid,text,boolean)
from public, anon;
grant execute on function public.upsert_team_profile(text,text),
  public.set_team_social_links(text,jsonb),
  public.set_official_team_photo(text,uuid,text,boolean)
to authenticated;

alter function public.rebuild_team_roster(text) set search_path = '';
alter function public.sync_normalized_match_stats(text) set search_path = '';
alter function public.claim_match_stat_jobs(integer) set search_path = '';
alter function public.trigger_sync_normalized_match_stats() set search_path = '';
alter function public.upsert_team_profile(text,text) set search_path = '';
alter function public.set_team_social_links(text,jsonb) set search_path = '';
alter function public.set_official_team_photo(text,uuid,text,boolean) set search_path = '';

-- Abort the migration if role inheritance leaves unsafe access or breaks a worker.
do $$
begin
  if has_function_privilege('anon','public.rebuild_team_roster(text)','EXECUTE')
     or has_function_privilege('authenticated','public.sync_normalized_match_stats(text)','EXECUTE')
     or has_table_privilege('anon','public.matches','TRUNCATE')
     or not has_table_privilege('anon','public.matches','SELECT')
     or not has_table_privilege('service_role','public.matches','INSERT')
     or not has_table_privilege('service_role','public.matches','UPDATE')
     or not has_function_privilege('service_role','public.claim_match_stat_jobs(integer)','EXECUTE')
     or not has_table_privilege('authenticated','public.match_votes','INSERT')
     or not has_table_privilege('authenticated','public.match_comments','INSERT')
     or not has_table_privilege('authenticated','public.profiles','UPDATE')
  then raise exception 'Database permission regression'; end if;
end $$;
