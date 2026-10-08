import { localizeSeo } from '../src/i18n/seo.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import teams from '../src/data/teams.generated.js';
import { getTeamContext, getTeamSeoMetadata, teamSitemapEntries } from '../src/utils/teamSeo.js';
import { profileMetadata, renderProfile, sitemapXml, escapeHtml } from '../server/profileSeo.js';

const entry = { name:'Nexora', slug:'nexora-4c564484', faceitTeamId:'4c564484-363c-4147-b599-15f0dc538616', division:'Entry', country:'PL', season:59, sources:[{region:'Europe',season:59}] };
const roster = [{faceit_id:'6002683f-7f9d-40c5-b1bd-cf4619cd363a',nickname:'-sK-_'}];
const match = {id:'match-1',team1_id:entry.faceitTeamId,team1_name:'Nexora',team1_score:20,team2_id:'other',team2_name:'Adepts Esport',team2_score:22,finished_at:new Date().toISOString(),map_scores:[{map:'de_dust2'}],veto_steps:[{map:'de_nuke',action:'ban',selectedBy:'faction1'}]};
const template = '<html lang="ru"><head><title>Generic</title><meta name="description" content="generic" /><meta property="og:image" content="https://example.com/generic.png" /></head><body><div id="root"></div></body></html>';

test('all bundled teams have English metadata and record-specific canonical/schema', () => {
  for (const team of teams) {
    for (const section of ['', 'matches', 'stats', 'veto']) {
      const metadata = getTeamSeoMetadata(team,section);
      assert.equal(metadata.language,'en');
      assert.ok(metadata.title.startsWith(team.name));
      assert.ok(metadata.description.includes(team.name));
      assert.equal(metadata.canonicalPath,`/teams/${encodeURIComponent(team.slug)}${section?`/${section}`:''}`);
      assert.equal(metadata.schema['@graph'][0].identifier,team.faceitTeamId);
    }
  }
});

test('region comes from current league participation rather than country guess', () => {
  const foreign = {...entry,country:'US',sources:[{region:'North America',season:58},{region:'Europe',season:59}]};
  assert.equal(getTeamContext(foreign).region,'Europe');
  assert.equal(getTeamContext(foreign).country,'United States');
  const sa = {...entry,country:'AR',sources:[{region:'South America',season:59}]};
  assert.match(getTeamSeoMetadata(sa).description,/South America.*Argentina/);
});

test('same-name teams keep their own identity and division', () => {
  const advanced = {...entry,slug:'nexora-33255748',faceitTeamId:'33255748-269c-4731-bfab-dffeaca491f2',division:'Advanced',country:'RU'};
  assert.notEqual(getTeamSeoMetadata(entry).title,getTeamSeoMetadata(advanced).title);
  assert.notEqual(getTeamSeoMetadata(entry).schema['@graph'][0]['@id'],getTeamSeoMetadata(advanced).schema['@graph'][0]['@id']);
});

test('HTML without JavaScript includes roster, score, internal links and valid JSON-LD', () => {
  const metadata = profileMetadata('team',entry,roster,'',[match,{...match,id:'wrong-team',team1_id:'unrelated'}]);
  const html = renderProfile(template,metadata);
  assert.match(html,/<html lang="en">/);
  assert.equal((html.match(/<h1[ >]/g) || []).length,1);
  assert.doesNotMatch(html,/<div id="app-boot-shell"/);
  assert.match(html,/20–22/);
  assert.match(html,/players\/6002683f/);
  assert.match(html,/match\/match-1/);
  assert.doesNotMatch(html,/wrong-team/);
  assert.match(html,/rel="canonical"/);
  assert.match(html,/SportsTeam/);
  assert.match(html,/BreadcrumbList/);
  assert.doesNotMatch(html,/example.com\/generic.png/);
  const schema = JSON.parse(html.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema['@graph'][0].athlete[0].name,'-sK-_');
});

test('section HTML describes the tracked sample and correct team veto decisions', () => {
  assert.match(profileMetadata('team',entry,roster,'stats',[match]).body,/dust2/);
  assert.match(profileMetadata('team',entry,roster,'stats',[match]).body,/latest 1 completed matches/);
  const body = profileMetadata('team',entry,roster,'veto',[match]).body;
  assert.match(body,/nuke: 0 picks, 1 bans/);
  assert.equal(getTeamSeoMetadata(entry,'analytics').robots,'noindex,follow');
});

test('unsafe names are escaped in HTML and structured data', () => {
  const entity = {...entry,name:'A </script><img src=x onerror=alert(1)> & B'};
  const html = renderProfile(template,profileMetadata('team',entity));
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/\\u003c/);
  assert.match(html,/&amp;/);
});

test('sitemap discovers the three real sections with no placeholder analytics page', () => {
  const entries = teamSitemapEntries('https://eseatracker.ru/teams/nexora-4c564484','2026-10-07T00:00:00Z');
  assert.equal(entries.length,4);
  const xml = sitemapXml(entries);
  assert.match(xml,/\/matches<\/loc>/);
  assert.match(xml,/\/stats<\/loc>/);
  assert.match(xml,/\/veto<\/loc>/);
  assert.doesNotMatch(xml,/analytics/);
});

test('static build and live renderer use the same localized Russian team metadata', async () => {
  const team = teams[0];
  const html = await readFile(`dist/teams/${team.slug}.html`,'utf8');
  assert.ok(html.includes(`<title>${escapeHtml(localizeSeo(getTeamSeoMetadata(team),'ru',{kind:'team',entity:team}).title)}</title>`));
  assert.match(html,/<html lang="ru">/);
  assert.equal((html.match(/<h1[ >]/g) || []).length,1);
  assert.doesNotMatch(html,/<div id="app-boot-shell"/);
  const stats = await readFile(`dist/teams/${team.slug}/stats.html`,'utf8');
  assert.match(stats,/Статистика карт/);
});
