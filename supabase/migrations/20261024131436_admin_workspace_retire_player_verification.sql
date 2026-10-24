-- Retire player self-verification without discarding profile favorites or historic requests.
revoke all on function public.submit_team_claim(text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
revoke all on function public.review_team_claim(uuid,text,text) from public, anon, authenticated;
revoke all on table public.team_claim_requests from public, anon, authenticated;

-- Keep the existing administrator guard and freeze obsolete professional fields for API users.
create or replace function forum_private.protect_admin_flag() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','service_role','supabase_admin') then
  if new.is_admin is distinct from old.is_admin then
   raise exception 'Administrator permissions are managed by the server' using errcode='42501';
  end if;
  if row(new.verification_status,new.account_type,new.team_slug,new.team_role,new.team_id,new.birth_date)
     is distinct from row(old.verification_status,old.account_type,old.team_slug,old.team_role,old.team_id,old.birth_date) then
   raise exception 'Player verification is no longer available' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function forum_private.protect_admin_flag() from public, anon, authenticated;

-- Internal tables stay private. Only this authenticated, administrator-checked snapshot is exposed.
create function forum_private.admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'generated_at',now(),
  'users',(select count(*) from public.profiles),
  'new_users',(select count(*) from public.profiles where created_at>=now()-interval '7 days'),
  'favorites',(select count(*) from public.profiles where nullif(favorite_team_slug,'') is not null),
  'teams',(select count(*) from public.team_catalog),
  'matches',(select count(*) from public.matches),
  'upcoming',(select count(*) from public.matches where status in ('SCHEDULED','READY','VOTING','CONFIGURING','CHECK_IN','MATCH_STATUS_SCHEDULED','MATCH_STATUS_READY','MATCH_STATUS_VOTING','MATCH_STATUS_CONFIGURING','MATCH_STATUS_CHECK_IN') and scheduled_at >= now()),
  'live',(select count(*) from public.matches where status in ('LIVE','ONGOING','MATCH_STATUS_LIVE','MATCH_STATUS_ONGOING')),
  'latest_match_update',(select max(updated_at) from public.matches),
  'topics',(select count(*) from public.forum_topics),
  'reports',(select count(*) from public.forum_reports where not resolved),
  'published_news',(select count(*) from public.news where is_published),
  'workers',coalesce((select jsonb_agg(to_jsonb(w) order by worker_name) from public.worker_status w),'[]'::jsonb),
  'stat_jobs',coalesce((select jsonb_agg(to_jsonb(j) order by status) from (select status,count(*) as count from public.match_stat_jobs group by status) j),'[]'::jsonb),
  'demo_jobs',coalesce((select jsonb_agg(to_jsonb(j) order by status) from (select status,count(*) as count from public.match_demo_analysis_jobs group by status) j),'[]'::jsonb)
 );
end $$;
revoke all on function forum_private.admin_overview() from public, anon, authenticated;
grant execute on function forum_private.admin_overview() to authenticated;
create function public.admin_overview() returns jsonb language sql stable security invoker set search_path='' as $$
 select forum_private.admin_overview();
$$;
revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to authenticated;
