import { belongsToRatingPeriod } from "../scripts/lib/seasonParticipants.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchRating, normalizeDivisionName } from '../src/utils/teamRating.js';
import { isQualifierCompetition,rankToLeagueStrength,snapshotAt,findRankedCore,calibrateLeagueAnchor,describeQualifierOpponent } from '../src/utils/qualifierStrength.js';
import { parseRanking,parseFaceitIdentity } from '../scripts/lib/hltvRankings.js';
import { validatedForecastRow } from '../src/utils/qualifierForecast.js';
const league = points => ({source:'league',points});
const external = (rank,anchorPoints=700) => ({source:'hltv',points:rankToLeagueStrength(rank,anchorPoints),anchorPoints,rank});
const win = (own, opponent, extra={}) => calculateMatchRating({competitionName:'CCT Open Qualifier',winnerPoints:own,loserPoints:opponent.points,winnerScore:1,loserScore:0,winnerMatchesPlayed:20,loserMatchesPlayed:20,winnerStrength:league(own),loserStrength:opponent,...extra});
const snapshot = {ranking_date:'2026-11-16',source_url:'https://www.hltv.org/ranking/teams/2026/november/16',teams:[{id:12960,name:'Fire Flux',rank:116,players:['a','b','c','d','e'].map(faceitId=>({faceitId}))}]};

test('HLTV strength has the same scale as our league; stronger opponents earn progressively more',()=>{
 assert.equal(rankToLeagueStrength(110),700);
 assert.equal(win(250,league(700)).winnerChange,win(250,external(110)).winnerChange);
 const gains=[110,70,40,31].map(r=>win(250,external(r)).winnerChange);
 assert.deepEqual(gains,[26,31,39,43]);
 assert.ok(win(600,external(40)).winnerChange<win(250,external(40)).winnerChange);
 assert.equal(rankToLeagueStrength(null),null);
});
test('qualifiers do not depend on winner division, region or new-team multiplier',()=>{
 for(const division of ['Entry','Main','Advanced'])for(const region of ['EU','NA','ASIA'])
 assert.equal(win(250,external(40),{division,region,winnerMatchesPlayed:0}).winnerChange,39);
});
test('no flat bonus: favourite farms almost nothing; losses to elite opponents are small; series capped',()=>{
 assert.equal(win(950,league(85)).winnerChange,0);
 assert.ok(win(900,league(250)).loserChange===0);
 assert.equal(win(250,external(40)).loserChange,-39);
 const eliteWins=calculateMatchRating({competitionName:'Open Qualifier',winnerPoints:900,loserPoints:250,winnerStrength:external(40),loserStrength:league(250),winnerScore:1,loserScore:0});
 assert.equal(eliteWins.loserChange,0);
 assert.ok(win(250,external(1),{winnerScore:3,loserScore:0}).winnerChange<=60);
 assert.ok(win(250,external(40),{winnerScore:2,loserScore:0}).winnerChange>39);
});
test('unknown opponent uncertainty reduces both gains and losses, without inventing an HLTV rank',()=>{
 const unknown=describeQualifierOpponent({points:85,matchesPlayed:0},[],snapshot,700);
 assert.deepEqual(unknown,{source:'unrated',points:275});
 assert.ok(win(250,unknown).winnerChange<win(250,league(275)).winnerChange);
 assert.equal(describeQualifierOpponent({points:500,isCurrentTeam:true},['a','b','c'],snapshot,700).source,'league');
});
test('weekly rankings cannot leak backwards or survive a two-week gap',()=>{
 assert.equal(snapshotAt([snapshot],'2026-11-16T23:59:59Z'),null);
 assert.equal(snapshotAt([snapshot],'2026-11-17T00:00:00Z'),snapshot);
 assert.equal(snapshotAt([snapshot],'2026-12-01T00:00:00Z'),null);
});
test('three distinct actual roster accounts are required; ambiguous cores are rejected',()=>{
 assert.equal(findRankedCore(['a','b','c'],snapshot)?.id,12960);
 assert.equal(findRankedCore(['a','a','b'],snapshot),null);
 assert.equal(findRankedCore(['x','y','z'],snapshot),null);
 assert.equal(findRankedCore(['a','b','c','x','y','z'],snapshot),null);
 assert.equal(findRankedCore(['a','b','c'],{...snapshot,teams:[...snapshot.teams,...snapshot.teams]}),null);
});
test('calibration uses internal points of confirmed overlapping cores, not the HLTV order',()=>{
 const teams=[{teamId:'fire',points:699,matchesPlayed:52,isCurrentTeam:true},{teamId:'lag',points:697,matchesPlayed:27,isCurrentTeam:true}];
 const snap={...snapshot,teams:[snapshot.teams[0],{id:11955,rank:102,players:['f','g','h'].map(faceitId=>({faceitId}))}]};
 const anchor=calibrateLeagueAnchor(teams,new Map([['fire',['a','b','c']],['lag',['f','g','h']]]),snap);
 assert.ok(anchor>680&&anchor<710);
 assert.equal(teams[0].points,699);
 assert.equal(calibrateLeagueAnchor([],new Map(),snap),700);
});
test('HLTV account parser accepts only unique explicit account links, ignores FPL links and ambiguous profiles',()=>{
 const id='029f74f1-c3c3-43dc-a600-0c22d6fce7ad';
 assert.equal(parseFaceitIdentity(`<a href="https://www.faceit.com/users/${id}">FACEIT</a>`),id);
 assert.equal(parseFaceitIdentity('<a href="https://www.faceit.com/en/hub/abc">FPL</a>'),null);
 assert.equal(parseFaceitIdentity(`<a href="https://www.faceit.com/users/${id}"></a><a href="https://www.faceit.com/users/0871c9f5-cacc-460e-a44a-c85bb414ad5b"></a>`),null);
 assert.throws(()=>parseRanking('<h1>Blocked</h1>','2026-11-16','x'));
});
test('a cached external team cannot inherit an old cores strength in the forecast',()=>{
 const row={is_external:true,strength:{source:'results'},roster_ids:['a','b','c','d','e']};
 assert.equal(validatedForecastRow(row,{matchRoster:['x','y','z']},'Open Qualifier'),null);
 assert.equal(validatedForecastRow(row,{matchRoster:['a','b','c']},'S59 EU Main'),null);
 assert.equal(validatedForecastRow(row,{matchRoster:['a','b','c']},'Open Qualifier'),row);
});
test('common qualifier titles are detected without interpreting an ESEA season as a qualifier',()=>{
 for(const name of ['XPrime Championship S2 | 5x5 - Qual 3','Elisa avoin karsinta','BLAST Open Qualifier','Open qualification 1'])assert.equal(isQualifierCompetition(name),true);
 assert.equal(isQualifierCompetition('S59 EU Main A - Regular Season'),false);
});

test('independent event season numbers are not mistaken for ESEA seasons',()=>{
 const season={season:59,rating_from:'2026-10-02T00:00:00Z'};
 for(const competition_name of ['CyberClash Season 3 LAN | Open Qualifier 1','XPrime Championship S2 | 5x5 - Qual 3']) {
  assert.equal(belongsToRatingPeriod({competition_name,finished_at:'2026-11-01T00:00:00Z'},season),true);
  assert.equal(belongsToRatingPeriod({competition_name,finished_at:'2026-09-01T00:00:00Z'},season),false);
 }
 assert.equal(belongsToRatingPeriod({competition_name:'S58 EU Advanced',finished_at:'2026-11-01T00:00:00Z'},season),false);
});

test('Open Qualifier is not the ESEA Open division and cannot mask external strength',()=>{
 assert.equal(normalizeDivisionName('CCT 2026 Contenders Europe 11 - Open Qualifier 1'),'Unknown');
 assert.equal(normalizeDivisionName('S59 EU Open10'),'Open10');
 const outside={points:85,matchesPlayed:0,isLeagueTeam:normalizeDivisionName('Open Qualifier')!=='Unknown'};
 assert.equal(describeQualifierOpponent(outside,['a','b','c'],snapshot,700).source,'hltv');
});
