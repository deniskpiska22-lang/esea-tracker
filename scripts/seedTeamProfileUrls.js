import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import teams from '../src/data/teams.js';
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const known=new Set();
for(let offset=0;;offset+=1000){
 const {data,error}=await client.from('team_profile_urls').select('team_id').range(offset,offset+999);
 if(error)throw error; for(const row of data)known.add(row.team_id); if(data.length<1000)break;
}
let seeded=0;
for(const team of [...teams].sort((a,b)=>a.faceitTeamId.localeCompare(b.faceitTeamId))){
 if(known.has(team.faceitTeamId))continue;
 const {error}=await client.rpc('assign_team_profile_url',{p_team_id:team.faceitTeamId,p_name:team.name,p_legacy:team.slug});
 if(error)throw error; seeded++;
}
for(let offset=0;offset<teams.length;offset+=200){
 const {error}=await client.from('team_profile_aliases').upsert(teams.slice(offset,offset+200).map(t=>({slug:t.slug,team_id:t.faceitTeamId})),{onConflict:'slug',ignoreDuplicates:true});
 if(error)throw error;
}
console.log(`Registered ${seeded} archived team profiles; retained all static aliases.`);
