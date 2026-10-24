import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminSection, workerHealth, safeWebUrl, cleanSocialLinks, filterAdminTeams } from '../src/utils/adminWorkspace.js';
import adminCatalog from '../src/i18n/adminCatalog.json' with { type: 'json' };
import { translateText } from '../src/i18n/translate.js';
test('only current admin sections can be restored from the URL', () => {
  assert.equal(adminSection('users'), 'users');
  for (const value of ['verification', '__proto__', 'constructor', '', null]) assert.equal(adminSection(value), 'overview');
});
test('worker status distinguishes a fresh heartbeat, stalled updates, missing download access and rate limits', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const base = { last_ping: '2026-10-24T11:59:00Z', status: 'running' };
  assert.equal(workerHealth(base, now), 'online');
  assert.equal(workerHealth({ ...base, status: 'paused' }, now), 'paused');
  assert.equal(workerHealth({ ...base, status: 'rate-limited' }, now), 'error');
  assert.equal(workerHealth({ ...base, last_ping: '2026-10-24T11:40:00Z' }, now), 'stale');
  assert.equal(workerHealth({ status: 'online' }, now), 'unknown');
});
test('editor links reject executable URLs, broken URLs and embedded credentials', () => {
  assert.equal(safeWebUrl(' https://example.com/team '), 'https://example.com/team');
  for (const value of ['javascript:alert(1)', 'data:text/html,evil', 'file:///etc/passwd', 'https://user:password@example.com', 'not-a-url']) assert.equal(safeWebUrl(value), null);
  assert.equal(safeWebUrl(''), '');
  assert.deepEqual(cleanSocialLinks([{ platform: 'FACEIT', url: ' https://faceit.com/ ' }, { url: '' }]), [{ platform: 'FACEIT', url: 'https://faceit.com/' }]);
  assert.throws(() => cleanSocialLinks([{ url: 'javascript:alert(1)' }]));
});
test('team directory combines name and division without altering entity identities', () => {
  const rows = [{ name: 'Alpha', slug: 'alpha-id', division: 'Main' }, { name: 'Alpha Juniors', slug: 'juniors-id', division: 'Entry' }];
  assert.deepEqual(filterAdminTeams(rows, 'ALPHA', 'Main'), [rows[0]]);
  assert.deepEqual(filterAdminTeams(rows, 'juniors-id'), [rows[1]]);
  assert.equal(rows.length, 2);
});
test('admin copy translates in all six non-English locales', () => {
  for (const [key, row] of Object.entries(adminCatalog)) for (const language of ['ru', 'de', 'pt', 'es', 'fr', 'it']) {
    assert.ok(row[language]?.trim(), `${key}: ${language}`);
    assert.equal(translateText(key, language), row[language]);
  }
});
test('professional verification endpoints are retired while favorite team updates stay available', () => {
  const migration = readFileSync('supabase/migrations/20261024131436_admin_workspace_retire_player_verification.sql', 'utf8');
  assert.match(migration, /revoke all on function public\.submit_team_claim/);
  assert.match(migration, /revoke all on function public\.review_team_claim/);
  assert.match(migration, /Administrator access required/);
  assert.doesNotMatch(migration, /drop table|delete from public\.profiles|update public\.profiles/i);
  const edit = readFileSync('src/pages/EditProfilePage.jsx', 'utf8');
  assert.match(edit, /favorite_team_slug:/);
  assert.doesNotMatch(edit, /verification|PROFESSIONAL_PROFILES/);
});
