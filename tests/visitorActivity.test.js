import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActivityTracker, qualifiedActivity } from '../src/utils/visitorActivity.js';
import { createPresenceHandler } from '../api/site-presence.js';

test('only trusted interaction on a visible page qualifies after five seconds', () => {
 let time=1000;
 const tracker=createActivityTracker({now:()=>time});
 time+=10000;
 assert.equal(qualifiedActivity(tracker.snapshot()),false);
 tracker.interact({isTrusted:false});
 assert.equal(tracker.snapshot(),null);
 tracker.interact({isTrusted:true});
 assert.equal(qualifiedActivity(tracker.snapshot()),true);
 tracker.visibility(false);
 tracker.interact({isTrusted:true});
 assert.equal(tracker.snapshot(),null);
 tracker.visibility(true);
 time+=4999;
 assert.equal(qualifiedActivity(tracker.snapshot()),false);
 time++;
 assert.equal(qualifiedActivity(tracker.snapshot()),true);
 time+=180001;
 assert.equal(qualifiedActivity(tracker.snapshot()),false);
});
test('malformed, negative and expired activity never qualifies', () => {
 for (const item of [null,{}, {visibleMs:10000,interactionAgeMs:-1},{visibleMs:Infinity,interactionAgeMs:1},{visibleMs:10000,interactionAgeMs:180001},{visibleMs:'10000',interactionAgeMs:1}]) assert.equal(qualifiedActivity(item),false);
});
const response=()=>({setHeader(){return this;},status(n){this.code=n;return this;},end(){return this;}});
test('a raw pulse can upgrade to active without being swallowed by raw deduplication; bots stay excluded',async()=>{
 const rows=[];
 const handler=createPresenceHandler({record:async row=>rows.push(row),now:()=>10000});
 const req={method:'POST',headers:{host:'eseatracker.ru',origin:'https://eseatracker.ru','x-site-presence':'1','user-agent':'Mozilla/5.0'},body:{visitorId:randomUUID(),path:'/en/rankings'}};
 await handler(req,response());
 req.body.activity={visibleMs:6000,interactionAgeMs:100,event:{id:randomUUID(),referrer:'https://google.com/'}};
 await handler(req,response());
 await handler(req,response());
 assert.equal(rows.length,2);
 assert.equal(rows[0].p_active_event,undefined);
 assert.equal(rows[1].p_active_event.source,'google.com');
 assert.equal(rows[1].p_visitor,rows[0].p_visitor);
 req.headers['user-agent']='Googlebot';
 req.body.visitorId=randomUUID();
 await handler(req,response());
 assert.equal(rows.length,2);
});
test('excessive fresh event IDs from one browser are rate limited',async()=>{
 let records=0;
 const handler=createPresenceHandler({record:async()=>records++,now:()=>10000});
 const visitorId=randomUUID();
 for(let n=0;n<61;n++) {
  const req={method:'POST',headers:{host:'eseatracker.ru',origin:'https://eseatracker.ru','x-site-presence':'1','user-agent':'Mozilla/5.0'},body:{visitorId,path:'/rankings',viewEvent:{id:randomUUID()}}};
  assert.equal((await handler(req,response())).code,n<60?204:429);
 }
 assert.equal(records,60);
});
test('active-mode labels are translated in all six non-English languages',async()=>{
 const {translateText}=await import('../src/i18n/translate.js');
 for(const lang of ['ru','de','pt','es','fr','it']) for(const key of ['Active visitors','All browser visits','Visitor counting mode']) assert.notEqual(translateText(key,lang),key);
});
