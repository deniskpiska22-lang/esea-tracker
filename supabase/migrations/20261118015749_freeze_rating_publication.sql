create table public.rating_publication_control (
 id boolean primary key default true check(id), paused boolean not null default true,
 reason text not null, updated_at timestamptz not null default now()
);
alter table public.rating_publication_control enable row level security;
revoke all on public.rating_publication_control from public,anon,authenticated;
grant all on public.rating_publication_control to service_role;
insert into public.rating_publication_control(id,paused,reason) values(true,true,'Owner requested no live rating changes; rollback historical qualifier recalculation');
create function public.guard_rating_publication() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.rating_publication_control where id and paused)
 and not(current_user='postgres' and coalesce(current_setting('esea.allow_rating_restore',true),'')='on') then
  return old;
 end if;
 return new;
end; $$;
revoke all on function public.guard_rating_publication() from public,anon,authenticated;
create trigger freeze_rating_publication before update of points,previous_points,points_change,matches_played,ranking_status on public.team_ratings
for each row execute function public.guard_rating_publication();
