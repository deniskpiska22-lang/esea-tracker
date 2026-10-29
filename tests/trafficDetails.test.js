import test from 'node:test';
import assert from 'node:assert/strict';
import { trafficMetadata } from '../server/trafficMetadata.js';
import { createPresenceHandler } from '../api/site-presence.js';
import { pulsePresence } from '../src/lib/sitePresence.js';
import { randomUUID } from 'node:crypto';
test('metadata contains only coarse categories and external hostnames',()=>{
 assert.deepEqual(trafficMetadata('Mozilla Windows Chrome/150 Safari/537 Edg/150','https://google.com/search?q=private#secret','eseatracker.ru'),{browser:'Edge',os:'Windows',source:'google.com'});
 for(const ref of ['https://eseatracker.ru/secret?token=private','javascript:alert(1)','https://user:password@evil.test/','bad']) assert.equal(trafficMetadata('',ref,'eseatracker.ru').source,'');
 assert.equal(trafficMetadata('iPhone CriOS/1').os,'iOS');
 assert.equal(trafficMetadata('Android SamsungBrowser/1 Chrome/2').browser,'Samsung Internet');
});
function res(){return {setHeader(){return this;},status(n){this.code=n;return this;},end(){return this;}};}
test('page openings bypass heartbeat coalescing, retries deduplicate and invalid events fail',async()=>{
 const records=[];const handler=createPresenceHandler({record:async x=>records.push(x),now:()=>100000});
 const req={method:'POST',headers:{host:'eseatracker.ru',origin:'https://eseatracker.ru','x-site-presence':'1','user-agent':'Windows Chrome/150'},body:{visitorId:randomUUID(),path:'/rankings'}};
 await handler(req,res());
 req.body.viewEvent={id:randomUUID(),referrer:'https://google.com/?secret=yes'};
 await handler(req,res());await handler(req,res());
 assert.equal(records.length,2);assert.equal(records[1].p_event.source,'google.com');assert.equal(records[0].p_visitor,records[1].p_visitor);
 req.body.viewEvent={id:randomUUID()};await handler(req,res());assert.equal(records.length,3);
 req.body.viewEvent={id:'bad'};assert.equal((await handler(req,res())).code,400);
});
test('client sends a page event even inside the heartbeat interval',async()=>{
 const values=new Map();const requests=[];
 const browser={document:{hidden:false},crypto:{randomUUID},AbortSignal,navigator:{},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},fetch:async(_,o)=>{requests.push(JSON.parse(o.body));return {ok:true};}};
 await pulsePresence({browser,path:'/',now:()=>100000});
 await pulsePresence({browser,path:'/',now:()=>100001,viewEvent:{id:randomUUID(),referrer:''}});
 assert.equal(requests.length,2);assert.equal(requests[0].visitorId,requests[1].visitorId);assert.ok(requests[1].viewEvent);
});
