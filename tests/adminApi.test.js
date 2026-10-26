import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminApi, newsPatch } from '../src/components/admin/adminApi.js';
import { PREVIEW_API } from '../src/components/admin/adminPreviewData.js';
import { pageIndex } from '../src/components/admin/useAdminQuery.js';
import { workerHealth } from '../src/utils/adminWorkspace.js';
function fixture(response = {data:{id:'article'},error:null}) {
  const calls=[];
  const query={then:(yes,no)=>Promise.resolve(response).then(yes,no)};
  for(const method of ['select','eq','insert','update','order','range','or','not','neq','maybeSingle','single','abortSignal']) query[method]=(...args)=>{calls.push([method,...args]);return query;};
  return {calls,api:createAdminApi({from:table=>{calls.push(['from',table]);return query;},rpc:(name,args)=>{calls.push(['rpc',name,args]);return query;}})};
}
const draft={title:' Article ',slug:'article',summary:' Summary ',body:' Body ',category:'general',image_url:'',is_published:false,is_featured:false};
test('news update keeps the optimistic concurrency guard and never invents a publish date for drafts',async()=>{
 const {api,calls}=fixture(); await api.saveArticle({id:'article',updated_at:'2026-10-27T00:00:00Z'},draft);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='2026-10-27T00:00:00Z'));
 const patch=calls.find(c=>c[0]==='update')[1]; assert.equal(patch.published_at,null); assert.equal(patch.title,'Article'); assert.equal(draft.title,' Article ');
});
test('conflicting article update is reported instead of overwriting another editor',async()=>{
 const {api}=fixture({data:null,error:null}); await assert.rejects(api.saveArticle({id:'article',updated_at:'older'},draft),/article changed/);
});
test('publication sets first publish time and preserves it on later edits',()=>{
 const first=newsPatch({...draft,is_published:true},'2026-10-27T12:00:00Z'); assert.equal(first.published_at,'2026-10-27T12:00:00Z');
 assert.equal(newsPatch({...first,body:'Updated'},'2026-10-28T12:00:00Z').published_at,first.published_at);
});
test('invalid URLs and slugs cannot reach admin writes',async()=>{
 const {api,calls}=fixture(); await assert.rejects(api.saveTeam({kind:'photo',teamId:'team',player:{id:'player',url:'javascript:alert(1)'}}),/valid HTTP/);
 await assert.rejects(api.saveArticle({}, {...draft,slug:'../admin'}),/title and URL/);
 assert.equal(calls.length,0);
});
test('user query stays bounded, sanitizes filters and forwards cancellation',async()=>{
 const {api,calls}=fixture({data:[],count:0,error:null}); const controller=new AbortController();
 await api.loadUsers({page:2,filter:'admins',search:'alpha_%,role.eq.admin',signal:controller.signal});
 assert.ok(calls.some(c=>c[0]==='range'&&c[1]===50&&c[2]===74));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='is_admin'&&c[2]===true));
 assert.ok(calls.some(c=>c[0]==='abortSignal'&&c[1]===controller.signal));
 assert.ok(!calls.find(c=>c[0]==='or')[1].includes(',role.eq.admin'));
});
test('preview reads use fixtures and every write path rejects',async()=>{
 const snapshot=await PREVIEW_API.loadOverview(); assert.equal(PREVIEW_API.preview,true); assert.equal(snapshot.users,32);
 for(const name of ['saveTeam','writeForum','saveArticle']) await assert.rejects(PREVIEW_API[name](),/Preview only/);
 const users=await PREVIEW_API.loadUsers({page:0,filter:'admins',search:''}); assert.equal(users.count,1);
 assert.equal(Object.isFrozen(PREVIEW_API),true);
});
test('invalid page URLs and paused workers have explicit safe states',()=>{
 for(const value of [null,'-1','Infinity','2e3','999999','x']) assert.equal(pageIndex(value),0);
 assert.equal(pageIndex('12'),12);
 assert.equal(workerHealth({status:'disabled'}),'paused');
 assert.equal(workerHealth({status:'paused',last_ping:'2020-01-01'}),'paused');
});
