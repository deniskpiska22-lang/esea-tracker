-- Presence is one anonymous browser per calendar day, never one row per tab.
create schema if not exists site_analytics;
revoke all on schema site_analytics from public, anon, authenticated;
grant usage on schema site_analytics to service_role;
create table site_analytics.settings (
 id boolean primary key default true check(id), started_at timestamptz not null default now()
);
insert into site_analytics.settings(id) values(true);
create table site_analytics.daily_visitors (
 day date not null, visitor text not null check(visitor ~ '^[0-9a-f]{64}$'),
 first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
 last_path text not null check(length(last_path) between 1 and 240),
 country text not null default '' check(country ~ '^([A-Z]{2})?$'),
 device text not null check(device in ('desktop','mobile','tablet')),
 primary key(day,visitor)
);
create index daily_visitors_last_seen on site_analytics.daily_visitors(last_seen);
alter table site_analytics.settings enable row level security;
alter table site_analytics.daily_visitors enable row level security;
revoke all on all tables in schema site_analytics from public, anon, authenticated;
grant select on site_analytics.settings to service_role;
grant select,insert,update on site_analytics.daily_visitors to service_role;

-- Only the same-origin server endpoint may write; no anonymous RPC access.
create function public.record_site_presence(p_visitor text,p_path text,p_country text,p_device text) returns void
language sql security invoker set search_path='' as $$
 insert into site_analytics.daily_visitors(day,visitor,last_path,country,device)
 values((now() at time zone 'Europe/Moscow')::date,p_visitor,p_path,p_country,p_device)
 on conflict(day,visitor) do update set last_seen=now(),last_path=excluded.last_path,
 country=excluded.country,device=excluded.device;
$$;
revoke all on function public.record_site_presence(text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_presence(text,text,text,text) to service_role;

-- Reuse the existing admin role guard in a non-exposed schema.
create function forum_private.site_traffic() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date := (now() at time zone 'Europe/Moscow')::date;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'generated_at',now(),'timezone','Europe/Moscow','online_window_seconds',60,
  'started_at',(select started_at from site_analytics.settings where id),
  'online',(select count(distinct visitor) from site_analytics.daily_visitors where last_seen>now()-interval '60 seconds'),
  'today',(select count(*) from site_analytics.daily_visitors where day=today),
  'yesterday',(case when today-1 >= (select (started_at at time zone 'Europe/Moscow')::date from site_analytics.settings where id) then (select count(*) from site_analytics.daily_visitors where day=today-1) else null end),
  'week',(select count(distinct visitor) from site_analytics.daily_visitors where day>=today-6),
  'days',(select coalesce(jsonb_agg(to_jsonb(s) order by s.day),'[]'::jsonb) from (
    select d::date as day,count(v.visitor) as visitors
    from generate_series(today-13,today,interval '1 day') d
    left join site_analytics.daily_visitors v on v.day=d::date
    where d::date >= (select (started_at at time zone 'Europe/Moscow')::date from site_analytics.settings where id)
    group by d::date
  ) s),
  'pages',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.path),'[]'::jsonb) from (
    select a.last_path as path,count(*) as visitors from (
      select distinct on(visitor) visitor,last_path from site_analytics.daily_visitors
      where last_seen>now()-interval '60 seconds' order by visitor,last_seen desc
    ) a group by a.last_path order by count(*) desc,a.last_path limit 20
  ) s),
  'countries',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.country),'[]'::jsonb) from (
    select country,count(*) as visitors from site_analytics.daily_visitors where day=today group by country order by count(*) desc,country limit 15
  ) s),
  'devices',(select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc),'[]'::jsonb) from (
    select device,count(*) as visitors from site_analytics.daily_visitors where day=today group by device
  ) s)
 );
end $$;
revoke all on function forum_private.site_traffic() from public,anon,authenticated;
grant execute on function forum_private.site_traffic() to authenticated;
create function public.admin_site_traffic() returns jsonb
language sql stable security invoker set search_path='' as $$ select forum_private.site_traffic(); $$;
revoke all on function public.admin_site_traffic() from public,anon,authenticated;
grant execute on function public.admin_site_traffic() to authenticated;
