-- Follow-up to 0004: match_player_stats.kast is NOT NULL DEFAULT 0 on the
-- live table (documented in 0001_baseline_schema.sql — required: true,
-- default: 0), which 0004 missed when it dropped the coalesce(..., 0)
-- fallback to let genuine "unknown KAST" pass through as NULL. Since this
-- table has zero readers in the app (grep confirms no src/ or api/ file
-- references match_player_stats), the correct place for "null when
-- unknown" is matches.player_stats (jsonb, no such constraint, already
-- verified working) — not this derived, unused table. Reverting kast back
-- to its original 0-default here only; everything else from 0004 (the
-- match_maps column fix) is untouched.

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
            coalesce(nullif(v_player->>'kast', '')::numeric, 0),
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
        coalesce(nullif(v_player->>'kast', '')::numeric, 0),
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
