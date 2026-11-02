-- A separate, empty history; legacy visitor data is never reclassified.
create schema site_active;
revoke all on schema site_active from public,anon,authenticated;
grant usage on schema site_active to service_role;
create table site_active.settings (like site_analytics.settings including all);
alter table site_active.settings enable row level security;
revoke all on site_active.settings from public,anon,authenticated;
create table site_active.daily_visitors (like site_analytics.daily_visitors including all);
alter table site_active.daily_visitors enable row level security;
revoke all on site_active.daily_visitors from public,anon,authenticated;
create table site_active.daily_page_visitors (like site_analytics.daily_page_visitors including all);
alter table site_active.daily_page_visitors enable row level security;
revoke all on site_active.daily_page_visitors from public,anon,authenticated;
create table site_active.page_views (like site_analytics.page_views including all);
alter table site_active.page_views enable row level security;
revoke all on site_active.page_views from public,anon,authenticated;
create table site_active.daily_entries (like site_analytics.daily_entries including all);
alter table site_active.daily_entries enable row level security;
revoke all on site_active.daily_entries from public,anon,authenticated;
insert into site_active.settings(id) values(true);
grant select on site_active.settings to service_role;
grant select,insert,update on site_active.daily_visitors to service_role;
grant select,insert on site_active.daily_page_visitors,site_active.page_views,site_active.daily_entries to service_role;
create function site_active.record_presence(p_visitor text,p_path text,p_country text,p_device text) returns void
language sql set search_path='' as $$
 insert into site_active.daily_visitors(day,visitor,last_path,country,device)
 values((now() at time zone 'Europe/Moscow')::date,p_visitor,p_path,p_country,p_device)
 on conflict(day,visitor) do update set last_seen=now(),last_path=excluded.last_path,country=excluded.country,device=excluded.device;
 insert into site_active.daily_page_visitors(day,path,visitor)
 values((now() at time zone 'Europe/Moscow')::date,p_path,p_visitor) on conflict do nothing;
$$;
create function site_active.record_activity(p_visitor text,p_path text,p_country text,p_device text,p_event jsonb) returns void
language plpgsql set search_path='' as $$
begin
 perform site_active.record_presence(p_visitor,p_path,p_country,p_device);
 insert into site_active.page_views(id,visitor,path) values((p_event->>'id')::uuid,p_visitor,p_path) on conflict do nothing;
 if found then
 insert into site_active.daily_entries(day,visitor,path,source,browser,os)
 values((now() at time zone 'Europe/Moscow')::date,p_visitor,p_path,left(coalesce(p_event->>'source',''),253),left(coalesce(p_event->>'browser','Other'),32),left(coalesce(p_event->>'os','Other'),32)) on conflict do nothing;
 end if;
end $$;
revoke all on function site_active.record_activity(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function site_active.record_activity(text,text,text,text,jsonb) to service_role;

create function forum_private.active_traffic_details(p_days integer) returns jsonb
language sql stable set search_path='' as $$
with bounds as (select (now() at time zone 'Europe/Moscow')::date as today),
current_views as (select v.* from site_active.page_views v,bounds b where v.day between b.today-p_days+1 and b.today),
entries as (select distinct on(visitor) e.* from site_active.daily_entries e,bounds b where e.day between b.today-p_days+1 and b.today order by visitor,e.created_at),
starts as (select (started_at at time zone 'Europe/Moscow')::date as visitors_start,(details_started_at at time zone 'Europe/Moscow')::date as details_start from site_active.settings where id)
select jsonb_build_object(
 'from',b.today-p_days+1,'to',b.today,'previous_from',b.today-2*p_days+1,'previous_to',b.today-p_days,
 'visitors',(select count(distinct visitor) from site_active.daily_visitors where day between b.today-p_days+1 and b.today),
 'previous_visitors',case when s.visitors_start < b.today-2*p_days+1 then (select count(distinct visitor) from site_active.daily_visitors where day between b.today-2*p_days+1 and b.today-p_days) else null end,
 'views',(select count(*) from current_views),
 'previous_views',case when s.details_start < b.today-2*p_days+1 then (select count(*) from site_active.page_views where day between b.today-2*p_days+1 and b.today-p_days) else null end,
 'partial',s.details_start >= b.today-p_days+1,
 'pages',(select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc,x.path),'[]'::jsonb) from (select path,count(*) as views,count(distinct visitor) as visitors from current_views group by path) x),
 'sources',(select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc,x.label),'[]'::jsonb) from (select source as label,count(*) as visitors from entries group by source) x),
 'entries',(select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc,x.label),'[]'::jsonb) from (select path as label,count(*) as visitors from entries group by path) x),
 'browsers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc,x.label),'[]'::jsonb) from (select browser as label,count(*) as visitors from entries group by browser) x),
 'systems',(select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc,x.label),'[]'::jsonb) from (select os as label,count(*) as visitors from entries group by os) x)
) from bounds b,starts s;
$$;
revoke all on function forum_private.active_traffic_details(integer) from public,anon,authenticated;

create or replace function forum_private.active_site_traffic() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date := (now() at time zone 'Europe/Moscow')::date;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'page_history_started_at',(select page_history_started_at from site_active.settings where id),
  'pages_today',(select coalesce(jsonb_agg(to_jsonb(p) order by p.visitors desc,p.path),'[]'::jsonb) from (select path,count(*) as visitors from site_active.daily_page_visitors where day=today group by path) p),
  'details_started_at',(select details_started_at from site_active.settings where id),
  'details',(select jsonb_object_agg(n::text,forum_private.active_traffic_details(n)) from (values(1),(7),(30)) w(n)),
  'generated_at',now(),'timezone','Europe/Moscow','online_window_seconds',180,
  'started_at',(select started_at from site_active.settings where id),
  'online',(select count(distinct visitor) from site_active.daily_visitors where last_seen>now()-interval '180 seconds'),
  'today',(select count(*) from site_active.daily_visitors where day=today),
  'yesterday',(case when today-1 >= (select (started_at at time zone 'Europe/Moscow')::date from site_active.settings where id) then (select count(*) from site_active.daily_visitors where day=today-1) else null end),
  'week',(select count(distinct visitor) from site_active.daily_visitors where day>=today-6),
  'fortnight',(select count(distinct visitor) from site_active.daily_visitors where day between today-13 and today),
  'month',(select count(distinct visitor) from site_active.daily_visitors where day between today-29 and today),
  'days',(select coalesce(jsonb_agg(to_jsonb(s) order by s.day),'[]'::jsonb) from (
    select d::date as day,count(v.visitor) as visitors
    from generate_series(today-29,today,interval '1 day') d
    left join site_active.daily_visitors v on v.day=d::date
    where d::date >= (select (started_at at time zone 'Europe/Moscow')::date from site_active.settings where id)
    group by d::date
  ) s),
  'pages',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.path),'[]'::jsonb) from (
    select a.last_path as path,count(*) as visitors from (
      select distinct on(visitor) visitor,last_path from site_active.daily_visitors
      where last_seen>now()-interval '180 seconds' order by visitor,last_seen desc
    ) a group by a.last_path order by count(*) desc,a.last_path limit 20
  ) s),
  'countries',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.country),'[]'::jsonb) from (
    select country,count(*) as visitors from site_active.daily_visitors where day=today group by country order by count(*) desc,country limit 15
  ) s),
  'countries_by_period',(select jsonb_object_agg(w.days::text,(
    select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.country),'[]'::jsonb) from (
      select country,count(*) as visitors from (
        select distinct on(visitor) visitor,country from site_active.daily_visitors
        where day between today-(w.days-1) and today
        order by visitor,last_seen desc,day desc
      ) visitors_by_country group by country
    ) s
  )) from (values(1),(7),(30)) as w(days)),
  'devices',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc),'[]'::jsonb) from (
    select device,count(*) as visitors from site_active.daily_visitors where day=today group by device
  ) s)
 );
end $$;

revoke all on function site_active.record_presence(text,text,text,text) from public,anon,authenticated;
grant execute on function site_active.record_presence(text,text,text,text) to service_role;
revoke all on function forum_private.active_site_traffic() from public,anon,authenticated;
grant execute on function forum_private.active_site_traffic() to authenticated;
create function public.record_site_presence_v2(p_visitor text,p_path text,p_country text,p_device text,p_event jsonb,p_active_event jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if p_event is null then
  perform public.record_site_presence(p_visitor,p_path,p_country,p_device);
 else
  perform public.record_site_activity(p_visitor,p_path,p_country,p_device,p_event);
 end if;
 if p_active_event is not null then
  perform site_active.record_activity(p_visitor,p_path,p_country,p_device,p_active_event);
 end if;
end $$;
revoke all on function public.record_site_presence_v2(text,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_site_presence_v2(text,text,text,text,jsonb,jsonb) to service_role;
create or replace function public.admin_site_traffic() returns jsonb
language sql stable set search_path='' as $$
 select forum_private.site_traffic() || jsonb_build_object('active',forum_private.active_site_traffic());
$$;
