-- Store only deduplicated browser/page/day pairs, never raw navigation events.
create table site_analytics.daily_page_visitors (
 day date not null, path text not null, visitor text not null,
 primary key(day,path,visitor)
);
alter table site_analytics.daily_page_visitors enable row level security;
revoke all on site_analytics.daily_page_visitors from public,anon,authenticated;
grant select,insert on site_analytics.daily_page_visitors to service_role;
alter table site_analytics.settings add column page_history_started_at timestamptz not null default now();

create or replace function public.record_site_presence(p_visitor text,p_path text,p_country text,p_device text) returns void
language sql set search_path='' as $$
 insert into site_analytics.daily_visitors(day,visitor,last_path,country,device)
 values((now() at time zone 'Europe/Moscow')::date,p_visitor,p_path,p_country,p_device)
 on conflict(day,visitor) do update set last_seen=now(),last_path=excluded.last_path,
 country=excluded.country,device=excluded.device;
 insert into site_analytics.daily_page_visitors(day,path,visitor)
 values((now() at time zone 'Europe/Moscow')::date,p_path,p_visitor)
 on conflict do nothing;
$$;
revoke all on function public.record_site_presence(text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_presence(text,text,text,text) to service_role;

create or replace function forum_private.site_traffic() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date := (now() at time zone 'Europe/Moscow')::date;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'page_history_started_at',(select page_history_started_at from site_analytics.settings where id),
  'pages_today',(select coalesce(jsonb_agg(to_jsonb(p) order by p.visitors desc,p.path),'[]'::jsonb) from (select path,count(*) as visitors from site_analytics.daily_page_visitors where day=today group by path) p),
  'generated_at',now(),'timezone','Europe/Moscow','online_window_seconds',180,
  'started_at',(select started_at from site_analytics.settings where id),
  'online',(select count(distinct visitor) from site_analytics.daily_visitors where last_seen>now()-interval '180 seconds'),
  'today',(select count(*) from site_analytics.daily_visitors where day=today),
  'yesterday',(case when today-1 >= (select (started_at at time zone 'Europe/Moscow')::date from site_analytics.settings where id) then (select count(*) from site_analytics.daily_visitors where day=today-1) else null end),
  'week',(select count(distinct visitor) from site_analytics.daily_visitors where day>=today-6),
  'fortnight',(select count(distinct visitor) from site_analytics.daily_visitors where day between today-13 and today),
  'month',(select count(distinct visitor) from site_analytics.daily_visitors where day between today-29 and today),
  'days',(select coalesce(jsonb_agg(to_jsonb(s) order by s.day),'[]'::jsonb) from (
    select d::date as day,count(v.visitor) as visitors
    from generate_series(today-29,today,interval '1 day') d
    left join site_analytics.daily_visitors v on v.day=d::date
    where d::date >= (select (started_at at time zone 'Europe/Moscow')::date from site_analytics.settings where id)
    group by d::date
  ) s),
  'pages',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.path),'[]'::jsonb) from (
    select a.last_path as path,count(*) as visitors from (
      select distinct on(visitor) visitor,last_path from site_analytics.daily_visitors
      where last_seen>now()-interval '180 seconds' order by visitor,last_seen desc
    ) a group by a.last_path order by count(*) desc,a.last_path limit 20
  ) s),
  'countries',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.country),'[]'::jsonb) from (
    select country,count(*) as visitors from site_analytics.daily_visitors where day=today group by country order by count(*) desc,country limit 15
  ) s),
  'countries_by_period',(select jsonb_object_agg(w.days::text,(
    select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.country),'[]'::jsonb) from (
      select country,count(*) as visitors from (
        select distinct on(visitor) visitor,country from site_analytics.daily_visitors
        where day between today-(w.days-1) and today
        order by visitor,last_seen desc,day desc
      ) visitors_by_country group by country
    ) s
  )) from (values(1),(7),(30)) as w(days)),
  'devices',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc),'[]'::jsonb) from (
    select device,count(*) as visitors from site_analytics.daily_visitors where day=today group by device
  ) s)
 );
end $$;
