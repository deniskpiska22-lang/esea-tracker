import { coreIds, isQualifierCompetition, rankingEffectiveAt } from './qualifierStrength.js';

export async function appendQualifierOpponents(db, leagueRows) {
  const all = [...leagueRows];
  const leagueIds = new Set(leagueRows.map(r => r.team_id));
  for(let from=0;;from+=500) {
    const {data,error} = await db.from('qualifier_opponent_ratings').select('*')
      .gte('updated_at', new Date(Date.now()-2*86400000).toISOString())
      .gte('observed_at', new Date(Date.now()-30*86400000).toISOString())
      .order('team_id').range(from,from+499);
    // League forecasts continue working if the optional evidence cache is down.
    if(error) { console.warn('Opponent strength unavailable:', error.message); break; }
    all.push(...data.filter(r => !leagueIds.has(r.team_id)).map(r => ({...r,is_external:true})));
    if(data.length<500)break;
  }
  return all;
}

export function validatedForecastRow(row, team, competitionName) {
  if (!row?.is_external) return row;
  if (!isQualifierCompetition(competitionName)) return null;
  const ids = coreIds(team?.matchRoster);
  const cached = new Set(row.roster_ids || []);
  // A new lineup cannot inherit another lineup's rank through the team ID.
  if(ids.length<3 || ids.length>5 || ids.filter(id=>cached.has(id)).length<3)return null;
  if(row.strength.source === 'hltv') {
    const age = Date.now()-rankingEffectiveAt(row.strength.rankingDate);
    if(age<0 || age>=14*86400000)return null;
  }
  return row;
}

export function forecastStrength(row) {
  return row?.is_external ? row.strength : {source:'league',points:row?.points};
}
