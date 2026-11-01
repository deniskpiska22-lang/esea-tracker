import {readShareLogo} from '../server/teamShareLogo.js';
import {seoClient} from '../server/seoData.js';
import {shareSnapshot,shareResults} from '../src/utils/teamShare.js';
export function createTeamShareHandler(load,{loadLogo}={}){return async(req,res)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).end();
  const id=req.query?.teamId;
  if(typeof id!=='string'||! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return res.status(400).json({error:'Invalid team'});
  if(req.query.action&&req.query.action!=='logo')return res.status(400).json({error:'Invalid action'});
  if(req.query.action==='logo'){try{const logo=await loadLogo?.(id);if(!logo)return res.status(404).end();res.setHeader('Content-Type',logo.type);res.setHeader('Cache-Control','public, max-age=3600, s-maxage=3600');return res.status(200).send(logo.data);}catch{return res.status(404).end();}}
  try{const data=await load(id);res.setHeader('Cache-Control','public, max-age=60, s-maxage=60');return res.status(200).json({snapshot:data});}
  catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Share data unavailable'});}
};}
export default createTeamShareHandler(async id=>{
  const db=seoClient();
  const {data:history,error}=await db.from('team_rating_history').select('week_start,world_rank,points').eq('team_id',id).eq('snapshot_type','weekly').order('week_start',{ascending:false}).limit(2);
  if(error)throw error;
  const snapshot=shareSnapshot(history);
  if(!snapshot)return null;
  const {data:matches,error:matchError,count}=await db.from('matches').select('id,status,finished_at,scheduled_at,team1_id,team2_id,team1_score,team2_score,map_scores',{count:'exact'})
    .or(`and(or(team1_id.eq.${id},team2_id.eq.${id}),or(and(finished_at.gte.${snapshot.start}T00:00:00Z,finished_at.lt.${snapshot.end}T00:00:00Z),and(finished_at.is.null,scheduled_at.gte.${snapshot.start}T00:00:00Z,scheduled_at.lt.${snapshot.end}T00:00:00Z)))`).in('status',['FINISHED','MATCH_STATUS_FINISHED']).limit(1000);
  return {...snapshot,results:matchError||count>1000||matches?.some(match=>!match.finished_at)?null:shareResults(matches,id,snapshot.start,snapshot.end)};
}, {loadLogo:async id=>{
 const {data,error}=await seoClient().from('team_catalog').select('team,faceit_avatar_url').eq('team_id',id).maybeSingle();
 if(error||!data)return null;return readShareLogo(data.faceit_avatar_url||data.team?.logo);
}});
