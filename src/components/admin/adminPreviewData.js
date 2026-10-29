// Synthetic fixtures only. This module has no Supabase client or live API.
const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
export const PREVIEW_TEAMS = ['Northstar', 'Aurora Five', 'Redline', 'Vertex', 'Horizon', 'Frost Academy', 'Afterlight', 'Monolith', 'Solaris', 'Waypoint'].map((name, index) => ({ name, slug: `sample-team-${index}`, faceitTeamId: `sample-${index}`, division: ['Advanced', 'Main', 'Intermediate', 'Entry', 'Open10'][index % 5] }));
const users = Array.from({ length: 32 }, (_, index) => ({ id: `sample-user-${index}`, username: `player_${index + 1}`, display_name: ['Alex', 'Max', 'Victor', 'Leon', 'Niko', 'Robin'][index % 6] + ` ${index + 1}`, avatar_url: null, country_code: ['DE','PL','RU','US','BR','GB'][index % 6], favorite_team_slug: index % 4 ? PREVIEW_TEAMS[index % 10].slug : null, is_admin: index === 0, created_at: ago(index * 800) }));
const news = [{ id:'sample-article', title:'A new season starts here', slug:'new-season', summary:'Everything you need to follow the next chapter of ESEA.', body:'The next season brings new teams, new rivalries and a fresh start.\n\nFollow upcoming matches, explore map statistics and keep an eye on the rankings.\n\nThis is a sample article for the admin preview.', category:'general', image_url:'', is_published:false,is_featured:false,updated_at:ago(120),published_at:null }, { id:'sample-article-2',title:'Community update: October',slug:'community-october',summary:'',body:'Sample article.',category:'general',image_url:'',is_published:true,is_featured:true,updated_at:ago(520),published_at:ago(1000) }];
const topics = [{ id:'sample-topic', title:'What would make your match preparation easier?', category:'feedback',language:'en',pinned:true,locked:false,hidden:false,created_at:ago(90),reply_count:18 }];
const reports = [{id:'sample-report',topic_id:'sample-topic',post_id:null,topic:topics[0],reason:'Sample moderation report for preview.',created_at:ago(30)}];
const readOnly = async () => { throw new Error('Preview only. Nothing was saved.'); };
const countryPeriods = {
  1: [{country:'DE',visitors:186},{country:'PL',visitors:154},{country:'US',visitors:121},{country:'BR',visitors:98},{country:'RU',visitors:79}],
  7: [{country:'DE',visitors:750},{country:'US',visitors:695},{country:'PL',visitors:610},{country:'BR',visitors:460},{country:'RU',visitors:332}],
  30: [{country:'US',visitors:1920},{country:'DE',visitors:1520},{country:'PL',visitors:1350},{country:'BR',visitors:1130},{country:'RU',visitors:800}],
};
const trafficDetails = Object.fromEntries([1,7,30].map(n => [n, {
 from:new Date(Date.now()-(n-1)*86400000).toISOString().slice(0,10),to:new Date().toISOString().slice(0,10),
 previous_from:new Date(Date.now()-(n*2-1)*86400000).toISOString().slice(0,10),previous_to:new Date(Date.now()-n*86400000).toISOString().slice(0,10),
 visitors:638*n,previous_visitors:591*n,views:1452*n,previous_views:1260*n,partial:false,
 pages:[{path:'/',visitors:350*n,views:724*n},{path:'/rankings',visitors:240*n,views:402*n},{path:'/calendar',visitors:190*n,views:326*n}],
 sources:[{label:'google.com',visitors:302*n},{label:'',visitors:210*n},{label:'youtube.com',visitors:126*n}],
 entries:[{label:'/',visitors:420*n},{label:'/rankings',visitors:218*n}],
 browsers:[{label:'Chrome',visitors:410*n},{label:'Safari',visitors:146*n},{label:'Firefox',visitors:82*n}],
 systems:[{label:'Windows',visitors:420*n},{label:'Android',visitors:140*n},{label:'iOS',visitors:78*n}],
}]));
export const PREVIEW_API = Object.freeze({
  preview:true,
  loadDemoMatch: async () => ({match:{id:'1-11111111-1111-4111-8111-111111111111',status:'FINISHED',team1_name:'Northstar',team2_name:'Aurora Five',map_scores:[{map:'Nuke',team1_score:13,team2_score:10}],demo_round_stats:[]},uploads:[{id:'sample-upload',file_name:'sample-nuke.dem.zst',size_bytes:22020096,status:'pending',updated_at:ago(2),last_error:null}]}),
  uploadDemo:readOnly,
  loadOverview:async () => ({generated_at:ago(0),users:32,new_users:12,favorites:24,teams:10,matches:48210,upcoming:247,live:12,reports:1,topics:1,published_news:1,latest_match_update:ago(1),workers:[{worker_name:'match-sync',status:'running',last_ping:ago(0),detail:'Sample worker status.'},{worker_name:'statistics',status:'running',last_ping:ago(1),detail:'Sample worker status.'},{worker_name:'tournaments',status:'running',last_ping:ago(2),detail:'Sample worker status.'},{worker_name:'demo-analysis',status:'paused',last_ping:ago(2),detail:'Sample paused worker.'}],stat_jobs:[{status:'completed',count:1840},{status:'queued',count:12}],demo_jobs:[{status:'paused',count:7}]}),
  loadTraffic:async () => ({ details_started_at:ago(61*1440),details:trafficDetails,generated_at:ago(0),started_at:ago(29*1440),online_window_seconds:180,online:24,today:638,yesterday:591,week:2847,fortnight:4190,month:6720,days:[96,124,89,156,143,178,135,191,160,182,205,173,216,198,220,188,128,195,176,203,234,285,310,294,402,358,529,476,591,638].map((visitors,index)=>({day:new Date(Date.now()-(29-index)*86400000).toISOString().slice(0,10),visitors})),pages:[{path:'/rankings',visitors:8},{path:'/',visitors:6},{path:'/calendar',visitors:5},{path:'/forum',visitors:3},{path:'/matches',visitors:2}],countries:countryPeriods[1],countries_by_period:countryPeriods,devices:[{device:'desktop',visitors:428},{device:'mobile',visitors:182},{device:'tablet',visitors:28}]}),
  loadUsers:async ({page,filter,search}) => { const rows=users.filter(row=>(!search || `${row.username} ${row.display_name}`.toLowerCase().includes(search.toLowerCase())) && (filter==='all'||filter==='admins'&&row.is_admin||filter==='favorites'&&row.favorite_team_slug||filter==='none'&&!row.favorite_team_slug));return {rows:rows.slice(page*25,page*25+25),count:rows.length}; },
  loadTeam:async () => ({description:'An ambitious roster with a focus on teamwork and consistent development.',links:[{platform:'Website',url:'https://example.com'}],players:['pulse','nova','echo','atlas','frost'].map((nickname,index)=>({id:`sample-player-${index}`,nickname,url:'',official:false}))}),
  loadForum:async ({filter,page}) => ({rows:page?[]:filter==='reports'?reports:topics,count:1}),
  loadNews:async ({page}) => ({rows:page?[]:news,count:news.length}),
  loadArticle:async ({id}) => news.find(row=>row.id===id),
  saveTeam:readOnly,writeForum:readOnly,saveArticle:readOnly,
});
