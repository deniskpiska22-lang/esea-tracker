-- Concurrent importers or temporary source regressions cannot reopen a verified event.
create function public.preserve_tournament_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.completed_at is not null and new.completed_at is null then
    new.completed_at=old.completed_at;
    new.end_date=(old.completed_at at time zone 'UTC')::date;
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_tournament_completion() from public,anon,authenticated;
grant execute on function public.preserve_tournament_completion() to service_role;
create trigger preserve_tournament_completion before update on public.tournaments
for each row execute function public.preserve_tournament_completion();
