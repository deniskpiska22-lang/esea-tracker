create table public.team_profile_urls (
  team_id text primary key,
  slug text not null unique
);
create table public.team_profile_aliases (
  slug text primary key,
  team_id text not null references public.team_profile_urls(team_id)
);
alter table public.team_profile_urls enable row level security;
alter table public.team_profile_aliases enable row level security;
grant select on public.team_profile_urls,public.team_profile_aliases to anon,authenticated;
grant all on public.team_profile_urls,public.team_profile_aliases to service_role;
create policy public_read on public.team_profile_urls for select to anon,authenticated using(true);
create policy public_read on public.team_profile_aliases for select to anon,authenticated using(true);

create function public.assign_team_profile_url(p_team_id text,p_name text,p_legacy text)
returns void language plpgsql security definer set search_path='' as $$
declare base text; candidate text; owner text; suffix integer:=1;
begin
 -- Serialize allocation so two equal names cannot claim the same address.
 perform pg_catalog.pg_advisory_xact_lock(7091001);
 base:=trim(both '-' from pg_catalog.regexp_replace(pg_catalog.lower(p_name),'[^[:alnum:]]+','-','g'));
 if base='' or base is null then base:='team'; end if;
 candidate:=base;
 loop
  select a.team_id into owner from public.team_profile_aliases a where a.slug=candidate;
  exit when owner is null or owner=p_team_id;
  suffix:=suffix+1; candidate:=base||'-'||suffix;
 end loop;
 insert into public.team_profile_urls(team_id,slug) values(p_team_id,candidate)
 on conflict(team_id) do update set slug=excluded.slug;
 insert into public.team_profile_aliases(slug,team_id) values(candidate,p_team_id) on conflict do nothing;
 if nullif(p_legacy,'') is not null then
  insert into public.team_profile_aliases(slug,team_id) values(p_legacy,p_team_id) on conflict do nothing;
 end if;
end $$;
revoke all on function public.assign_team_profile_url(text,text,text) from public,anon,authenticated;
grant execute on function public.assign_team_profile_url(text,text,text) to service_role;
create function public.remember_team_profile_url()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.assign_team_profile_url(new.team_id,new.team->>'name',new.team->>'slug');
 return new;
end $$;
revoke all on function public.remember_team_profile_url() from public,anon,authenticated;
create trigger team_name_url after insert or update of team on public.team_catalog
 for each row execute function public.remember_team_profile_url();
select public.assign_team_profile_url(team_id,team->>'name',team->>'slug')
 from public.team_catalog order by team_id;
