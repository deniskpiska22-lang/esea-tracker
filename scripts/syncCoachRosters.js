import 'dotenv/config';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from 'playwright';
import { coachClient } from '../server/coachData.js';
import { uuid } from '../server/coachLobby.js';
import { coachNicknameFromRoster } from './lib/faceitCoachRoster.js';

const { values: { apply, after, limit, team } } = parseArgs({ options: {
  apply: { type: 'boolean' }, after: { type: 'string' }, limit: { type: 'string', default: '40' },
  team: { type: 'string' },
} });
const count = Number(limit);
if (!Number.isInteger(count) || count < 1 || count > 100 || (after && !uuid(after)) || (team && !uuid(team))
  || (team && after)) throw new Error('Use --limit 1–100 and either --team or --after with a FACEIT team ID.');

const db = coachClient();
async function read(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

const { active_season: season } = await read(db.from('rating_season_settings').select('active_season').single());
let query = db.from('team_catalog').select('team_id').eq('team->>activeSeasonParticipant', 'true')
  .eq('team->>season', String(season)).order('team_id').limit(count + 1);
if (after) query = query.gt('team_id', after);
if (team) query = query.eq('team_id', team);
const teams = await read(query);
if (team && !teams.length) throw new Error('This team is outside the active ESEA season in ESEA Tracker.');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'en-US' });
  const session = await page.context().newCDPSession(page);
  let cursor = after || null, found = 0, stored = 0, unconfirmed = 0, stopped = false;
  for (const { team_id: id } of teams.slice(0, count)) {
    const observedAt = new Date().toISOString();
    let writing = false;
    try {
      const url = `https://www.faceit.com/en/teams/${id}`;
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if ([403, 429].includes(response?.status())) {
        console.warn(`FACEIT team page HTTP ${response.status()}. Batch stopped at ${id}.`);
        stopped = true;
        break;
      }
      if (!response?.ok()) throw new Error(`Team page HTTP ${response?.status()}`);
      if (!await page.getByRole('heading', { name: 'Active League Roster', exact: true })
        .waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        if (/verify you are human|checking your browser|just a moment/i.test(await page.title())) {
          console.warn(`FACEIT verification page. Batch stopped at ${id}.`);
          stopped = true;
          break;
        }
        throw new Error('Active ESEA roster unavailable');
      }
      // The roster and season card load independently.
      await page.getByRole('button', { name: `Season ${season}`, exact: true }).waitFor({ state: 'visible', timeout: 8000 });
      const { nodes } = await session.send('Accessibility.getFullAXTree');
      const nickname = coachNicknameFromRoster(nodes, id, season);
      if (!nickname) {
        unconfirmed++;
      } else {
        const key = process.env.FACEIT_API_KEY;
        if (!key) throw new Error('FACEIT_API_KEY is required');
        const lookup = new URL('https://open.faceit.com/data/v4/players');
        lookup.searchParams.set('nickname', nickname);
        const player = await fetch(lookup, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(12000) });
        if ([401, 403, 429].includes(player.status)) {
          console.warn(`FACEIT Data API HTTP ${player.status}. Batch stopped at ${id}.`);
          stopped = true;
          break;
        }
        if (!player.ok) throw new Error(`Player lookup HTTP ${player.status}`);
        const { player_id: coachId, nickname: verifiedName, country } = await player.json();
        if (!uuid(coachId) || verifiedName?.toLowerCase() !== nickname.toLowerCase()) throw new Error('Coach identity mismatch');
        found++;
        console.log(id, coachId, verifiedName);
        if (apply) {
          writing = true;
          if (await read(db.rpc('record_esea_coach_roster', {
            p_team_id: id, p_season: season, p_observed_at: observedAt, p_coach_id: coachId,
            p_nickname: verifiedName, p_country: /^[a-z]{2}$/i.test(country || '') ? country.toUpperCase() : null,
          }))) stored++;
        }
      }
    } catch (error) {
      console.warn(id, error.message.split('\n')[0]);
      if (writing || team) {
        stopped = true;
        break;
      }
      unconfirmed++;
    }
    cursor = id;
    await pause(1500);
  }
  console.log(JSON.stringify({ season, found, stored, unconfirmed, stopped, nextAfter: stopped || teams.length > count ? cursor : null }));
  if (stopped) process.exitCode = 1;
} finally {
  await browser.close();
}
