-- Fix public.sync_normalized_match_stats(text) — this function predates
-- version control (not captured by any prior migration, per the known gap
-- noted in 0001_baseline_schema.sql: RPC bodies aren't visible via REST
-- introspection). Pulled via `select pg_get_functiondef(oid) from pg_proc
-- where proname = 'sync_normalized_match_stats'` in SQL Editor.
--
-- Bug found: the match_maps INSERT referenced columns that don't exist on
-- the real table (map_order instead of map_index; team1_id/team1_name/
-- team2_id/team2_name/winner_id don't exist on match_maps at all — only
-- team1_score/team2_score plus a raw_data jsonb escape hatch). Postgres
-- fails the whole statement on the first invalid column, which — because
-- this runs inside an AFTER UPDATE trigger on matches (see
-- matches_sync_normalized_stats) — rolled back the *entire* matches UPDATE
-- any time map_scores/player_stats changed. This is why matches.stats_synced
-- essentially never reached true in production: the trigger failure aborted
-- the update before stats_synced could be committed.
--
-- Also fixed: match_player_stats.kast used `coalesce(nullif(...), 0)`,
-- silently turning a genuine JSON null (no KAST data — see
-- normalizePlayer() in scripts/autoSyncMatches.js) back into 0. Dropped the
-- `, 0` fallback so null passes through as SQL NULL, consistent with the
-- "kast optional, null when unknown" rule.
--
-- Everything else (variable names, map/winner computation, all other
-- player fields) is unchanged from the live function — only the two column
-- mismatches above are touched.

CREATE OR REPLACE FUNCTION public.sync_normalized_match_stats(p_match_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_match public.matches%rowtype;
  v_maps jsonb;
  v_stats jsonb;
  v_map jsonb;
  v_team jsonb;
  v_player jsonb;
  v_map_order integer := 0;
  v_map_count integer := 0;
  v_player_count integer := 0;
  v_team1 jsonb;
  v_team2 jsonb;
  v_team_id text;
  v_team_name text;
begin
  select * into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  delete from public.match_maps where match_id = p_match_id;
  delete from public.match_player_stats where match_id = p_match_id;

  v_maps := coalesce(v_match.map_scores::jsonb, '[]'::jsonb);
  v_stats := coalesce(v_match.player_stats::jsonb, '{}'::jsonb);

  -- Some importers also keep maps inside player_stats.maps.
  if jsonb_typeof(v_maps) <> 'array' or jsonb_array_length(v_maps) = 0 then
    if jsonb_typeof(v_stats->'maps') = 'array' then
      v_maps := v_stats->'maps';
    else
      v_maps := '[]'::jsonb;
    end if;
  end if;

  for v_map in select value from jsonb_array_elements(v_maps)
  loop
    v_map_order := v_map_order + 1;
    v_team1 := coalesce(v_map->'team1', (v_map->'teams')->0, '{}'::jsonb);
    v_team2 := coalesce(v_map->'team2', (v_map->'teams')->1, '{}'::jsonb);

    -- match_maps has no team1_id/team1_name/team2_id/team2_name/winner_id
    -- columns — only map_index/map_name/team1_score/team2_score/raw_data.
    -- The full computed map object (including team identity/winner) is
    -- kept in raw_data instead of being silently dropped.
    insert into public.match_maps (
      match_id, map_index, map_name,
      team1_score, team2_score,
      raw_data, updated_at
    ) values (
      p_match_id,
      coalesce(nullif(v_map->>'order', '')::integer, v_map_order),
      coalesce(v_map->>'map', v_map->>'mapName', 'Unknown'),
      coalesce(nullif(v_map->>'team1_score', '')::integer, nullif(v_team1->>'score', '')::integer, 0),
      coalesce(nullif(v_map->>'team2_score', '')::integer, nullif(v_team2->>'score', '')::integer, 0),
      v_map,
      now()
    );
    v_map_count := v_map_count + 1;
  end loop;

  if jsonb_typeof(v_stats->'teams') = 'array' then
    for v_team in select value from jsonb_array_elements(v_stats->'teams')
    loop
      v_team_id := coalesce(v_team->>'teamId', v_team->>'team_id');
      v_team_name := coalesce(v_team->>'teamName', v_team->>'team_name', 'Unknown');

      if jsonb_typeof(v_team->'players') = 'array' then
        for v_player in select value from jsonb_array_elements(v_team->'players')
        loop
          insert into public.match_player_stats (
            match_id, team_id, team_name, faceit_player_id, nickname,
            kills, deaths, assists, adr, kd, hs_rate, kast, mvps, rating, updated_at
          ) values (
            p_match_id,
            v_team_id,
            v_team_name,
            coalesce(v_player->>'playerId', v_player->>'player_id', v_player->>'faceit_id'),
            coalesce(nullif(v_player->>'nickname', ''), nullif(v_player->>'playerName', ''), 'Unknown'),
            coalesce(nullif(v_player->>'kills', '')::integer, 0),
            coalesce(nullif(v_player->>'deaths', '')::integer, 0),
            coalesce(nullif(v_player->>'assists', '')::integer, 0),
            coalesce(nullif(v_player->>'adr', '')::numeric, 0),
            coalesce(nullif(v_player->>'kd', '')::numeric, 0),
            coalesce(nullif(v_player->>'hsRate', '')::numeric, nullif(v_player->>'hs_rate', '')::numeric, 0),
            nullif(v_player->>'kast', '')::numeric,
            coalesce(nullif(v_player->>'mvps', '')::integer, 0),
            nullif(coalesce(v_player->>'rating', v_player->>'faceitRating'), '')::numeric,
            now()
          );
          v_player_count := v_player_count + 1;
        end loop;
      end if;
    end loop;
  elsif jsonb_typeof(v_stats->'players') = 'array' then
    for v_player in select value from jsonb_array_elements(v_stats->'players')
    loop
      insert into public.match_player_stats (
        match_id, team_id, team_name, faceit_player_id, nickname,
        kills, deaths, assists, adr, kd, hs_rate, kast, mvps, rating, updated_at
      ) values (
        p_match_id,
        coalesce(v_player->>'teamId', v_player->>'team_id'),
        coalesce(v_player->>'teamName', v_player->>'team_name', 'Unknown'),
        coalesce(v_player->>'playerId', v_player->>'player_id', v_player->>'faceit_id'),
        coalesce(nullif(v_player->>'nickname', ''), nullif(v_player->>'playerName', ''), 'Unknown'),
        coalesce(nullif(v_player->>'kills', '')::integer, 0),
        coalesce(nullif(v_player->>'deaths', '')::integer, 0),
        coalesce(nullif(v_player->>'assists', '')::integer, 0),
        coalesce(nullif(v_player->>'adr', '')::numeric, 0),
        coalesce(nullif(v_player->>'kd', '')::numeric, 0),
        coalesce(nullif(v_player->>'hsRate', '')::numeric, nullif(v_player->>'hs_rate', '')::numeric, 0),
        nullif(v_player->>'kast', '')::numeric,
        coalesce(nullif(v_player->>'mvps', '')::integer, 0),
        nullif(coalesce(v_player->>'rating', v_player->>'faceitRating'), '')::numeric,
        now()
      );
      v_player_count := v_player_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'matchId', p_match_id,
    'maps', v_map_count,
    'players', v_player_count
  );
end;
$function$
;
