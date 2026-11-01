import test from 'node:test';
import assert from 'node:assert/strict';
import {recentPrematchResults,prematchHeadToHead} from '../src/utils/prematchHistory.js';
import {buildHeadToHeadMapRows,countHeadToHeadMapWins} from '../src/utils/headToHead.js';
test('recent results exclude the current room, future/invalid dates, older games and duplicates',()=>{
 const rows=[{id:'current',date:'2026-11-01'},{id:'recent',date:'2026-10-30'},{id:'recent',date:'2026-10-30'},
 {id:'future',date:'2026-11-02'},{id:'old',date:'2026-07-01'},{id:'bad',date:'invalid'},{id:'first',date:'2026-09-01'}];
 assert.deepEqual(recentPrematchResults(rows,'current',new Date('2026-11-01T12:00:00Z')).map(r=>r.id),['recent','first']);
});
test('H2H uses opponent IDs across team renames, rejects namesakes and removes duplicate sides',()=>{
 const left={id:'left',name:'SPARX',slug:'sparx'},right={id:'right',name:'Aurora Young Blud',slug:'aurora'};
 const a={matchId:'meeting',date:'2026-10-20',opponentId:'right',opponentName:'Old Aurora name',boScore:'13 : 7'};
 const result=prematchHeadToHead([a,{...a,matchId:'namesake',opponentId:'other',opponentName:right.name}],
 [{...a,opponentId:'left',opponentName:left.name,boScore:'7 : 13'}],left,right,'current');
 assert.equal(result.matches.length,1);assert.equal(result.matches[0].teamSlug,'sparx');
 assert.deepEqual(countHeadToHeadMapWins(result.matches,result.leftSlug),{leftWins:1,rightWins:0});
});
test('H2H orientates a result loaded only from the right team and supports missing catalog slugs',()=>{
 const result=prematchHeadToHead([], [{matchId:'old',date:'2026-10-20',opponentId:'left',boScore:'7 : 13'}],{id:'left',name:'A'},{id:'right',name:'B'},'current');
 const rows=buildHeadToHeadMapRows(result.matches,result.leftSlug);
 assert.equal(rows[0].leftScore,13);assert.equal(rows[0].rightScore,7);
 assert.equal(prematchHeadToHead(result.matches,[],{id:'left',name:'A'},{id:'right',name:'B'},'old').matches.length,0);
});
test('legacy name-only meetings remain available, but an empty history never creates a meeting',()=>{
 const left={id:'left',name:'A'},right={id:'right',name:'B'};
 assert.equal(prematchHeadToHead([{id:'one',opponentName:'B',date:'2026-10-20'}],[],left,right,'current').matches.length,1);
 assert.equal(prematchHeadToHead([],[],left,right,'current').matches.length,0);
});
