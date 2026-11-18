import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';
import { coachAssignments, assignedCoach } from './coachAssignments.js';
import { coachRosterRows, coachTeamRegistrations, coachAssignmentHandoffs, loadCoachTeamMatches, loadCoachTeamLobbies, loadCoachLobbies } from './coachData.js';
import { resolveCoachAssignments } from './coachHandoff.js';
import { buildCoachTenures } from './coachTenures.js';
import { TEAM_MAP_COLUMNS } from '../src/utils/teamMapStats.js';
import { result } from './seoData.js';

export async function currentTeamTenureCoaches(db,teamId,now=Date.now()) {
  const [teamRooms,teamRegistrations,team] = await Promise.all([
    loadCoachTeamLobbies(db,[teamId]),
    coachTeamRegistrations(db,[teamId]),
    result(db.from('team_catalog').select('team').eq('team_id',teamId).maybeSingle()),
  ]);
  const candidates=[...new Set([...teamRegistrations.map(row=>row.coach_id),
    ...teamRooms.flatMap(room=>room.teams.filter(side=>side.id===teamId).flatMap(side=>side.coaches.map(person=>person.id))),
    ...coachAssignments.filter(assignment=>assignment.teamId===teamId).map(assignment=>assignment.coachId)]
    .map(id=>linkedPlayerProfile(id)?.id||id))];
  if(!candidates.length)return {coaches:[]};
  const identityIds=[...new Set(candidates.flatMap(id=>[id,...(linkedPlayerProfile(id)?.linkedIds||[])]))];
  const columns=`${TEAM_MAP_COLUMNS.replace('competition_id:raw_data->>competition_id,','')},started_at`;
  const [registrations,rooms,matches,handoffs] = await Promise.all([
    coachRosterRows(db,identityIds),loadCoachLobbies(db,identityIds,columns),
    loadCoachTeamMatches(db,teamId,columns),
    coachAssignmentHandoffs(db,candidates.filter(id=>coachAssignments.some(assignment=>assignment.coachId===id&&assignment.handoffOnCoachLobby))),
  ]);
  // Keep the explicit owner bootstrap exclusive until its saved lobby handoff.
  const editorial=resolveCoachAssignments(coachAssignments.filter(assignment=>assignment.teamId===teamId),[],handoffs,now)
    .filter(assignment=>assignment.current&&Date.parse(assignment.start)<=now);
  if(editorial.length)return {coaches:editorial.map(assignment=>assignedCoach(assignment.coachId)).filter(Boolean)
    .map(person=>({id:person.id,nickname:person.nickname,avatar:null})),observedAt:editorial[0].start,matchId:null};
  const catalog=new Map(registrations.map(row=>[row.team_id,row.team_catalog?.team]));
  if(team?.team)catalog.set(teamId,team.team);
  const coaches=[];
  let observedAt=null,matchId=null;
  for(const id of candidates) {
    const ids=new Set([id,...(linkedPlayerProfile(id)?.linkedIds||[])]);
    const ownRegistrations=registrations.filter(row=>ids.has(row.coach_id));
    const ownRooms=rooms.filter(room=>room.teams.some(side=>side.coaches.some(person=>ids.has(person.id))));
    const manual=coachAssignments.filter(assignment=>assignment.coachId===id);
    const seeds=resolveCoachAssignments(manual,ownRegistrations,handoffs,now,ownRooms);
    const periods=buildCoachTenures({coachId:id,seeds,rooms:ownRooms,teamMatches:new Map([[teamId,matches]]),teamRooms,teamRegistrations,now,catalog});
    const current=periods.find(period=>period.teamId===teamId&&period.current&&Date.parse(period.start)<=now);
    if(!current)continue;
    const identity=assignedCoach(id)||ownRooms.flatMap(room=>room.teams.flatMap(side=>side.coaches)).find(person=>ids.has(person.id))
      || {nickname:ownRegistrations[0]?.nickname};
    coaches.push({id,nickname:identity.nickname,avatar:identity.avatar||null});
    const seen=current.observedAt||current.start;
    if(!observedAt||Date.parse(seen)>Date.parse(observedAt)) {observedAt=seen;matchId=current.lastCoachMatchId||null;}
  }
  return {coaches,observedAt,matchId};
}
