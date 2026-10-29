import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVetoSteps, buildExpectedMapOrder, buildPickedTeamByMap, buildDisplayMaps } from '../src/utils/matchMapResults.js';
import { translateText } from '../src/i18n/translate.js';
const team1={name:'Spirit HU'},team2={name:'YOUNGLINGS'};
function payload(entities){return {payload:{tickets:[{entity_type:'map',entities}]}};}
test('BO1 map remains visible before scores arrive in all seven languages',()=>{
 const entities=['nuke','dust2','ancient','inferno','cache','anubis','mirage'].map((map,index)=>({guid:`de_${map}`,round:index+1,status:index===6?'pick':'drop',selected_by:'faction1'}));
 const steps=parseVetoSteps(payload(entities),team1,team2);
 for(const language of ['en','ru','de','pt','es','fr','it']){
  const rendered=steps.map(step=>translateText(step.action,language));
  assert.ok(rendered.every(Boolean));
  assert.deepEqual(buildExpectedMapOrder(steps),['Mirage']);
  assert.deepEqual(buildDisplayMaps([],buildExpectedMapOrder(steps)),[{map:'Mirage',pending:true}]);
  assert.equal(buildPickedTeamByMap(steps,team1,team2).get('mirage'),'decider');
  if(language!=='en') { assert.notEqual(rendered.at(-1),'Decider'); assert.notEqual(rendered[0],'Banned'); assert.notEqual(translateText('Picked',language),'Picked'); }
 }
 assert.equal(steps.at(-1).action,'Decider');
});
test('BO3 keeps picks and neutral decider ordered, with synced scores preserved',()=>{
 const steps=parseVetoSteps(payload([
 {guid:'de_mirage',round:5,status:'pick',selected_by:'faction2'},
 {guid:'de_nuke',round:1,status:'drop',selected_by:'faction1'},
 {guid:'de_inferno',round:3,status:'pick',selected_by:'faction1'},
 {guid:'de_cache',round:7,status:'pick',selected_by:'faction1'},
 ]),team1,team2);
 const order=buildExpectedMapOrder(steps);assert.deepEqual(order,['Inferno','Mirage','Cache']);
 const lookup=buildPickedTeamByMap(steps,team1,team2);assert.equal(lookup.get('inferno'),'team1');assert.equal(lookup.get('mirage'),'team2');assert.equal(lookup.get('cache'),'decider');
 const real={map:'de_inferno',teamScore:13,opponentScore:8};
 assert.equal(buildDisplayMaps([real],order)[0],real);assert.equal(buildDisplayMaps([real],order)[2].pending,true);
});
test('no veto invents no maps, and unmatched real results are retained',()=>{
 assert.deepEqual(parseVetoSteps(null,team1,team2),[]);
 assert.deepEqual(buildDisplayMaps([],[]),[]);
 assert.deepEqual(buildDisplayMaps([{map:'Nuke',teamScore:13}],['Mirage']).map(x=>x.map),['Mirage','Nuke']);
});
