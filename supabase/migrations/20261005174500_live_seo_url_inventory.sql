-- Keep a small, indexed URL inventory. Sitemaps must not scan profile tables
-- or perform expensive counts under the anonymous API statement timeout.
create sequence public.seo_team_position_seq;
create sequence public.seo_player_position_seq;
create table public.seo_profile_urls (
 kind text not null check(kind in ('teams','players')),
 entity_id text not null,
 position bigint not null,
 url text not null,
 updated_at timestamptz,
 primary key(kind,entity_id),
 unique(kind,position)
);
alter table public.seo_profile_urls enable row level security;
create policy public_read on public.seo_profile_urls for select to anon,authenticated using(true);
grant select on public.seo_profile_urls to anon,authenticated;
grant all on public.seo_profile_urls to service_role;
insert into public.seo_profile_urls(kind,entity_id,position,url,updated_at)
 select 'teams',team_id,nextval('public.seo_team_position_seq'),'/teams/'||(team->>'slug'),updated_at
 from public.team_catalog where nullif(team->>'slug','') is not null order by team_id;
insert into public.seo_profile_urls(kind,entity_id,position,url,updated_at)
 select 'players',faceit_id,nextval('public.seo_player_position_seq'),'/players/'||faceit_id,updated_at
 from public.players where faceit_id is not null and nullif(nickname,'') is not null order by faceit_id;
create or replace function public.sync_seo_profile_url()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; eid text; route text; seq regclass;
begin
 if tg_op='DELETE' then
  if tg_table_name='team_catalog' then k:='teams';eid:=old.team_id;
  else k:='players';eid:=old.faceit_id;end if;
  delete from public.seo_profile_urls where kind=k and entity_id=eid;
  return old;
 end if;
 if tg_table_name='team_catalog' then
  k:='teams';eid:=new.team_id;route:='/teams/'||(new.team->>'slug');seq:='public.seo_team_position_seq';
 else
  k:='players';eid:=new.faceit_id;route:='/players/'||new.faceit_id;seq:='public.seo_player_position_seq';
 end if;
 if nullif(eid,'') is null or nullif(route,'') is null then return new; end if;
 -- Allocate a position only for a newly inserted URL. Repeated profile updates
 -- must not consume sequence values and leave empty sitemap pages.
 update public.seo_profile_urls set url=route,updated_at=new.updated_at where kind=k and entity_id=eid;
 if not found then
  insert into public.seo_profile_urls(kind,entity_id,position,url,updated_at)
   values(k,eid,nextval(seq),route,new.updated_at);
 end if;
 return new;
end $$;
revoke all on function public.sync_seo_profile_url() from public,anon,authenticated;
create trigger catalog_seo_url after insert or update of team on public.team_catalog
 for each row execute function public.sync_seo_profile_url();
create trigger catalog_seo_url_delete after delete on public.team_catalog
 for each row execute function public.sync_seo_profile_url();
create trigger player_seo_url_delete after delete on public.players
 for each row execute function public.sync_seo_profile_url();
create trigger player_seo_url after insert or update of nickname,avatar,country on public.players
 for each row execute function public.sync_seo_profile_url();
-- Bounds use the (kind,position) index rather than COUNT(*) on large profiles.
create or replace function public.seo_sitemap_counts()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('teams',coalesce((select position from public.seo_profile_urls where kind='teams' order by position desc limit 1),0),
 'players',coalesce((select position from public.seo_profile_urls where kind='players' order by position desc limit 1),0));
$$;
