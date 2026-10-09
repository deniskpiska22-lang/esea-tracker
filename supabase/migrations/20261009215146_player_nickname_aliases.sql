-- Retain nickname URLs when FACEIT profiles are renamed; current names win.
create table public.player_profile_aliases (
 nickname text primary key,
 player_id text not null,
 created_at timestamptz not null default now()
);
alter table public.player_profile_aliases enable row level security;
grant select on public.player_profile_aliases to anon,authenticated;
grant all on public.player_profile_aliases to service_role;
create policy public_read on public.player_profile_aliases for select to anon,authenticated using(true);
insert into public.player_profile_aliases(nickname,player_id)
 select lower(nickname),faceit_id from public.players where nullif(nickname,'') is not null and faceit_id is not null
 on conflict do nothing;
insert into public.player_profile_aliases(nickname,player_id)
 select lower(r.nickname),r.player_id from public.player_ratings r join public.players p on p.faceit_id=r.player_id
 where nullif(r.nickname,'') is not null and lower(r.nickname)<>lower(p.nickname)
 on conflict do nothing;
create function public.remember_player_nickname() returns trigger
 language plpgsql security definer set search_path='' as $$
 begin
 if tg_op='UPDATE' and nullif(old.nickname,'') is not null then
 insert into public.player_profile_aliases(nickname,player_id) values(lower(old.nickname),old.faceit_id) on conflict do nothing;
 end if;
 if nullif(new.nickname,'') is not null and new.faceit_id is not null then
 insert into public.player_profile_aliases(nickname,player_id) values(lower(new.nickname),new.faceit_id) on conflict do nothing;
 end if;
 return new;
 end $$;
revoke all on function public.remember_player_nickname() from public,anon,authenticated;
create trigger remember_player_nickname after insert or update of nickname on public.players
 for each row execute function public.remember_player_nickname();
