import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRatingHistory,filterRatingHistory,ratingHistoryChange} from '../src/utils/ratingHistory.js';
import {ratingHistoryLabels} from '../src/components/ratingHistoryLabels.js';
test('historical rank movement uses stored weekly positions, including flat points and rising rank',()=>{
 const rows=normalizeRatingHistory([{date:'2026-10-26',rating:602,rank:23},{date:'2026-10-05',rating:550,rank:58},{date:'2026-10-12',rating:577,rank:38},{date:'2026-10-19',rating:602,rank:24}]);
 assert.deepEqual(rows.map(r=>r.rankChange),[null,20,14,1]);
 assert.equal(rows.at(-1).pointsChange,0);
 assert.equal(ratingHistoryChange(rows,'rating'),52);
 assert.equal(ratingHistoryChange(rows,'rank'),35);
});
test('missing ranks and scores remain missing and never generate invented changes',()=>{
 const rows=normalizeRatingHistory([{date:'2026-10-05',rating:null,rank:8},{date:'2026-10-12',rating:0,rank:null},{date:'2026-10-19',rating:25,rank:0},{date:'2026-10-26',rating:30,rank:12}]);
 assert.equal(rows[0].rating,null);assert.equal(rows[1].rating,0);
 assert.deepEqual(rows.map(r=>r.rank),[8,null,null,12]);
 assert.deepEqual(rows.map(r=>r.rankChange),[null,null,null,null]);
 assert.equal(ratingHistoryChange(rows,'rank'),-4);
 assert.equal(ratingHistoryChange(rows,'rating'),null);
 assert.equal(ratingHistoryChange(rows.slice(-1),'rank'),null);
});
test('period uses snapshot dates rather than today and handles month ends and invalid dates',()=>{
 const rows=normalizeRatingHistory([{date:'bad',rating:999},{date:'2026-01-01',rating:1},{date:'2026-02-28',rating:2},{date:'2026-03-31',rating:3}]);
 assert.equal(rows.length,3);
 assert.deepEqual(filterRatingHistory(rows,1).map(r=>r.rating),[2,3]);
 assert.equal(filterRatingHistory(rows,0),rows);
 assert.deepEqual(filterRatingHistory([],3),[]);
});
test('all seven languages provide complete rating chart labels',()=>{
 const en=Object.keys(ratingHistoryLabels('en'));
 for(const language of ['ru','en','de','pt','es','fr','it']){
  const labels=ratingHistoryLabels(language);assert.deepEqual(Object.keys(labels),en);
  for(const text of Object.values(labels))assert.ok(typeof text==='string'&&text.length);
 }
});
