export async function cacheDiscoveryCoachRoles(db, rows) {
  const payloads=rows.filter(row=>['FINISHED','MATCH_STATUS_FINISHED'].includes(row.status)
    && row.raw_data?.id===row.id && row.raw_data.game==='cs2' && Array.isArray(row.raw_data.factions))
    .map(row=>({id:row.id,payload:{id:row.id,game:'cs2',status:row.status,
      championship_id:row.raw_data.championship_id,factions:row.raw_data.factions}}));
  for(let offset=0;offset<payloads.length;offset+=200){
    const {error}=await db.rpc('capture_esea_discovery_coach_roles',{p_rows:payloads.slice(offset,offset+200)});
    if(error)throw error;
  }
}
