import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import staticTeams from '../src/data/teams.js';
import aliases from '../src/data/playerAliases.js';
import { MATCH_SEO_COLUMNS } from '../src/utils/matchSeo.js';
export function seoClient() {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const url = rawUrl ? new URL(rawUrl.trim()).origin : null;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Public Supabase SEO configuration is missing');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}});
}
export async function result(query) {
  const {data,error} = await query;
  if(error) throw error;
  return data;
}
export async function loadProfile(client,kind,key) {
  if (kind === 'match') {
    const entity = await result(client.from('matches').select(MATCH_SEO_COLUMNS).eq('id',key).maybeSingle());
    if (!entity) return null;
    const ids = [entity.team1_id, entity.team2_id].filter(Boolean);
    const catalog = ids.length ? await result(client.from('team_catalog').select('team_id,team').in('team_id',ids)) : [];
    const participants = await result(client.from('match_player_stats').select('faceit_player_id,nickname,team_id,kills,deaths,adr,rating').eq('match_id',key).limit(20))
      .catch(error => { console.warn('[seo-match-players]',error.message); return []; });
    return { entity, roster: participants, teams: catalog };
  }
  if (kind === 'team') {
    let row = await result(client.from('team_catalog').select('team_id,team,updated_at').eq('team->>slug',key).maybeSingle());
    if (!row) { const team=staticTeams.find(t=>t.slug===key);if(team) row={team_id:team.faceitTeamId,team}; }
    if (!row) return null;
    const [links, recentMatches] = await Promise.all([
      result(client.from('team_players').select('players!team_players_player_id_fkey(faceit_id,nickname)').eq('team_id',row.team_id).eq('is_active',true)),
      result(client.from('matches').select('id,team1_id,team1_name,team1_score,team2_id,team2_name,team2_score,competition_name,finished_at,scheduled_at,map_scores,veto_steps')
        .or(`team1_id.eq.${row.team_id},team2_id.eq.${row.team_id}`).in('status',['FINISHED','MATCH_STATUS_FINISHED'])
        .order('finished_at',{ascending:false,nullsFirst:false}).limit(8))
        .catch(error => { console.warn('[seo-matches]', error.message); return []; }),
    ]);
    return {entity:{...row.team,faceitTeamId:row.team_id},roster:links.map(l => Array.isArray(l.players)?l.players[0]:l.players).filter(Boolean),recentMatches};
  }
  const aliasEntry=Object.entries(aliases).find(([name,old])=>name.toLowerCase()===key.toLowerCase() || old.some(n=>n.toLowerCase()===key.toLowerCase()));
  if(aliasEntry) key=aliasEntry[0];
  if (!/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(key)) {
    const exact = await result(client.from('players').select('faceit_id')
      .ilike('nickname',key.replace(/[\\%_]/g,'\\$&')).limit(1).maybeSingle());
    if (exact) key=exact.faceit_id;
    else {
      const alias=await result(client.from('player_profile_aliases').select('player_id').eq('nickname',key.toLowerCase()).maybeSingle());
      if(alias) key=alias.player_id;
    }
  }
  key=key.replace(/[\\%_]/g,'\\$&');
  let query = client.from('players').select('id,faceit_id,nickname,avatar,country,faceit_elo,faceit_level,updated_at');
  const uuid = /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(key);
  const identity = await result((uuid?query.eq('faceit_id',key):query.ilike('nickname',key).limit(1)).maybeSingle());
  let rating = await result((uuid?client.from('player_ratings').select('*').eq('player_id',key):client.from('player_ratings').select('*').ilike('nickname',key).limit(1)).maybeSingle());
  if(!identity && !rating) return null;
  const playerId = identity?.faceit_id || rating.player_id;
  if(identity && !uuid) rating = await result(client.from('player_ratings').select('*').eq('player_id',playerId).maybeSingle());
  let team = null;
  if(identity) {
    const links = await result(client.from('team_players').select('team_id').eq('player_id',identity.id).eq('is_active',true).order('joined_at',{ascending:false,nullsFirst:false}).limit(1));
    if(links[0]) team = (await result(client.from('team_catalog').select('team').eq('team_id',links[0].team_id).maybeSingle()))?.team;
  }
  const appearances = await result(client.from('match_player_stats').select('match_id,kills,deaths,adr,rating').eq('faceit_player_id',playerId).order('created_at',{ascending:false}).limit(8))
    .catch(error => { console.warn('[seo-player-matches]',error.message); return []; });
  const recentMatches = appearances.length ? await result(client.from('matches').select(MATCH_SEO_COLUMNS).in('id',appearances.map(row=>row.match_id)).in('status',['FINISHED','MATCH_STATUS_FINISHED']).order('finished_at',{ascending:false})).catch(error => { console.warn('[seo-player-results]',error.message); return []; }) : [];
  return { recentMatches, entity:{playerId,nickname:identity?.nickname || rating?.nickname,avatar:identity?.avatar,country:identity?.country,
    faceitElo:identity?.faceit_elo,faceitLevel:identity?.faceit_level,teamName:team?.name,teamSlug:team?.slug,rating:rating?.rating,adr:rating?.adr,kd:rating?.kd,mapsPlayed:rating?.maps_played,matchesPlayed:rating?.matches_played},roster:[] };
}
