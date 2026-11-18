import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';
import { assignmentMatches, rosterCoachAssignments } from './coachAssignments.js';
import { coachAssignmentKey } from './coachHandoff.js';
import { finished, upcoming } from './coachLobby.js';
import { normalizeTeamMapHistory } from '../src/utils/teamMapStats.js';

export const COACH_ABSENCE_LIMIT = 5;
const at = match => Date.parse([match.started_at,match.scheduled_at,match.finished_at]
  .find(value => Date.parse(value) > Date.UTC(2000,0)));
const instant = value => new Date(value).toISOString();
const played = (match,teamId) => finished(match.status) && (
  normalizeTeamMapHistory([match],teamId)[0]?.mapScores.length > 0
  || Math.max(Number(match.team1_score),Number(match.team2_score)) >= 13);
const validRoom = (room,now) => room.terminal && finished(room.matches.status)
  || !room.terminal && upcoming(room.matches.status) && Date.parse(room.checked_at) >= now-8*3600000;

// Coaching is a tenure, not attendance. Only complete, played team games advance
// the absence streak; unknown room data breaks consecutiveness without ending it.
export function buildCoachTenures({coachId,seeds=[],rooms=[],teamMatches=new Map(),teamRooms=[],teamRegistrations=[],now=Date.now(),catalog=new Map()}) {
  const linked=linkedPlayerProfile(coachId), ids=new Set([coachId,linked?.id,...(linked?.linkedIds||[])].filter(Boolean));
  const manual=seeds.filter(seed=>seed.source!=='league_roster');
  const protectedMatch = match => manual.some(seed=>assignmentMatches(seed,match));
  const events=[];
  for(const seed of manual) {
    const first=Date.parse(seed.start) || Math.min(Infinity,...(teamMatches.get(seed.teamId)||[]).filter(match=>assignmentMatches(seed,match)).map(at));
    if(Number.isFinite(first)&&first<=now) events.push({at:first,kind:'manual',team:seed.teamId});
  }
  for(const seed of seeds.filter(seed=>seed.source==='league_roster')) {
    const start=Date.parse(seed.start);
    if(Number.isFinite(start)&&start<=now) events.push({at:start,kind:'positive',team:seed.teamId,seed});
    const confirmed=Date.parse(seed.confirmedAt);
    if(seed.current&&Number.isFinite(confirmed)&&confirmed>start&&confirmed<=now)
      events.push({at:confirmed,kind:'positive',team:seed.teamId,seed,confirmation:true});
  }
  // Official registration intervals prove replacements independently of room
  // attendance. Preserve historical handoffs even after the replacement leaves.
  const replacements=rosterCoachAssignments(teamRegistrations,[],now);
  for(const seed of replacements) {
    const id=linkedPlayerProfile(seed.coachId)?.id||seed.coachId;
    if(ids.has(id))continue;
    const start=Date.parse(seed.start);
    const concurrent=new Set(replacements.filter(other=>other.teamId===seed.teamId
      && Date.parse(other.start)<=start && (!other.end || Date.parse(other.end)>start))
      .map(other=>linkedPlayerProfile(other.coachId)?.id||other.coachId));
    // Explicit concurrent coaching staff is not a confirmed replacement.
    if(concurrent.size!==1)continue;
    events.push({at:start,kind:'replacement',team:seed.teamId,replacementCoachIds:[id]});
    const confirmed=Date.parse(seed.confirmedAt);
    if(seed.current&&Number.isFinite(confirmed)&&confirmed>start&&confirmed<=now)
      events.push({at:confirmed,kind:'replacement',team:seed.teamId,replacementCoachIds:[id]});
  }
  const roomByMatch=new Map(teamRooms.map(room=>[room.match_id||room.matches?.id,room]));
  for(const room of rooms) {
    roomByMatch.set(room.match_id||room.matches?.id,room);
    if(!room.matches || !validRoom(room,now) || protectedMatch(room.matches)) continue;
    const when=Math.min(at(room.matches),Date.parse(room.checked_at));
    if(!Number.isFinite(when)||when>now) continue;
    for(const side of room.teams) if(side.coaches?.some(person=>ids.has(person.id)))
      events.push({at:when,kind:'positive',team:side.id,matchId:room.matches.id,staff:side.coaches.map(person=>linkedPlayerProfile(person.id)?.id||person.id)});
  }
  // Explicit coaching slots are confirmation, not a guess from player names.
  // A different solo coach closes the former tenure; an empty/unknown room
  // still uses the five-game fallback. Repeated staff are handled below.
  const teamMatchById=new Map([...teamMatches.values()].flat().map(match=>[match.id,match]));
  for(const room of teamRooms) {
    const match=room.matches||teamMatchById.get(room.match_id);
    if(!match||!validRoom({...room,matches:match},now)||protectedMatch(match))continue;
    const when=Math.min(at(match),Date.parse(room.checked_at));
    if(!Number.isFinite(when)||when>now)continue;
    for(const side of room.teams) {
      const present=[...new Set((side.coaches||[]).map(p=>linkedPlayerProfile(p.id)?.id||p.id).filter(Boolean))];
      if(!present.length||present.some(id=>ids.has(id)))continue;
      const registered=new Set(replacements.filter(seed=>seed.teamId===side.id
        &&Date.parse(seed.start)<=when&&(!seed.end||Date.parse(seed.end)>when))
        .map(seed=>linkedPlayerProfile(seed.coachId)?.id||seed.coachId));
      if(registered.size>1&&[...ids].some(id=>registered.has(id)))continue;
      events.push({at:when,kind:'replacement',team:side.id,replacementCoachIds:present});
    }
  }
  for(const [team,matches] of teamMatches) for(const match of matches) {
    const when=at(match);
    if(!Number.isFinite(when)||when>now||!played(match,team)||protectedMatch(match)) continue;
    const room=roomByMatch.get(match.id),side=room?.teams.find(side=>side.id===team);
    const known=room?.terminal && Array.isArray(side?.coaches);
    const present=known&&side.coaches.some(person=>ids.has(person.id));
    events.push({at:when,kind:'game',team,id:match.id,known:Boolean(known),present,staff:present?side.coaches.map(person=>linkedPlayerProfile(person.id)?.id||person.id):[]});
  }
  const priority={manual:0,positive:1,game:2,replacement:3};
  events.sort((a,b)=>a.at-b.at||priority[a.kind]-priority[b.kind]||String(a.id||a.matchId||a.team).localeCompare(String(b.id||b.matchId||b.team)));
  const periods=[];
  let current=null;
  function close(end,reason) {
    if(!current)return;
    current.end=instant(end);current.endExclusive=true;current.current=false;
    current.endReason=reason;current.absentMatches=0;current=null;
  }
  function positive(event) {
    if(current?.teamId===event.team) {
      for(const id of event.staff||[])if(!ids.has(id))current.coStaffIds.add(id);
      current.observedAt=instant(event.at);
      if(!event.seed){current.absences=[];current.absentMatches=0;}
      if(event.matchId)current.lastCoachMatchId=event.matchId;
      if(event.seed?.source==='league_roster') {
        current.source='league_roster';current.registeredSeason=event.seed.registeredSeason;
      }
      return;
    }
    if(event.confirmation&&current&&current.teamId!==event.team)return;
    const previous=periods.filter(period=>period.teamId===event.team).at(-1);
    const prior=Boolean(previous);
    // A fresh role confirmation can prove return after a replacement, but
    // cannot resurrect a tenure closed by five absences or a real transfer.
    if(event.confirmation&&prior&&previous.endReason!=='confirmed_replacement')return;
    // A late first roster observation is not a return to a match coach slot.
    if(event.seed?.startSource==='first_observed'&&prior&&current?.teamId!==event.team)return;
    close(event.at,'transfer');
    const ownerContinuation=!prior&&manual.find(seed=>seed.handoff?.confirmed_team_id===event.team
      && seed.teamId===event.team && event.at>=Date.parse(seed.end));
    const seed=event.seed||{};
    current={...seed,coachId,teamId:event.team,start:instant(event.at),end:null,current:true,
      source:seed.source||'match_rooms',tenureKey:seed.tenureKey||`${event.team}:tenure:${instant(event.at)}`,
      observedAt:instant(event.at),lastCoachMatchId:event.matchId||null,absences:[],absentMatches:0,coStaffIds:new Set((event.staff||[]).filter(id=>!ids.has(id)))};
    if(ownerContinuation) {
      current.tenureKey=coachAssignmentKey(event.team,ownerContinuation);
      current.tenureStart=ownerContinuation.start;
    } else if(prior) {
      // A return cannot inherit an earlier manually confirmed start or roster key.
      current.tenureKey=`${event.team}:tenure:${instant(event.at)}`;
      delete current.tenureStart;
    }
    periods.push(current);
  }
  for(const event of events) {
    if(event.kind==='manual'){close(event.at,'confirmed_assignment');continue;}
    if(event.kind==='positive'){positive(event);continue;}
    if(event.kind==='replacement'){
      if(current?.teamId===event.team&&!(event.replacementCoachIds||[]).some(id=>current.coStaffIds.has(id)))
        close(event.at,'confirmed_replacement');
      continue;
    }
    if(event.present){positive({...event,matchId:event.id});continue;}
    if(!current||current.teamId!==event.team)continue;
    if(!event.known){current.absences=[];current.absentMatches=0;continue;}
    current.absences.push(event.at);current.absentMatches=current.absences.length;
    if(current.absences.length===COACH_ABSENCE_LIMIT)close(current.absences[0],'five_absences');
  }
  return [...manual,...periods.map(({absences,coStaffIds,...period})=>{
    void absences;void coStaffIds;
    const team=catalog.get(period.teamId);
    // An inactive archived team has no current badge; the unresolved tenure still
    // covers its known games and can continue if the team becomes active again.
    if(period.current&&team?.activeSeasonParticipant===false) {
      const last=Math.max(Date.parse(period.observedAt),...(teamMatches.get(period.teamId)||[])
        .filter(match=>finished(match.status)&&at(match)<=now).map(at));
      return {...period,current:false,end:instant(last+1),endExclusive:true,endReason:'last_known_team_match',open:true};
    }
    return period;
  })];
}
