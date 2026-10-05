-- Public aggregate of already public profile inventories; no private fields.
create or replace function public.seo_sitemap_counts()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('teams',(select count(*) from public.team_catalog),
                           'players',(select count(*) from public.players));
$$;
revoke all on function public.seo_sitemap_counts() from public;
grant execute on function public.seo_sitemap_counts() to anon,authenticated,service_role;

create or replace function public.on_discovered_player_profiles()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and old.raw_data is not distinct from new.raw_data then return new; end if;
 perform public.seed_discovered_player_profiles(new.raw_data);
 return new;
end $$;
revoke all on function public.on_discovered_player_profiles() from public,anon,authenticated;

-- Discovery upserts preserve existing statistics. Rebuilding all normalized
-- statistics for an unchanged record made large sync pages exceed API timeouts.
drop trigger if exists matches_sync_normalized_stats on public.matches;
create trigger matches_sync_normalized_stats
 after insert on public.matches for each row
 when (new.map_scores is not null or new.player_stats is not null)
 execute function public.trigger_sync_normalized_match_stats();
create trigger matches_update_normalized_stats
 after update of map_scores,player_stats on public.matches for each row
 when (old.map_scores is distinct from new.map_scores or old.player_stats is distinct from new.player_stats)
 execute function public.trigger_sync_normalized_match_stats();
