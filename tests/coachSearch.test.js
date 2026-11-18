import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePeopleSearch, searchPlayerRating } from '../src/utils/siteSearch.js';
import { playerRolePath } from '../src/utils/profileRoles.js';
import { getCoachSeo } from '../src/utils/coachSeo.js';

test('search merges coach and player by FACEIT identity, never just by nickname', () => {
  const players = [{ faceit_id: 'shared', nickname: 'gameNick', rating: 1.12 }, { faceit_id: 'other', nickname: 'coachNick' }];
  const [coach, other] = mergePeopleSearch(players, [{ id: 'shared', nickname: 'coachNick', playerNickname: 'gameNick' }], 'coachnick');
  assert.equal(coach.faceit_id, 'shared');
  assert.equal(coach.playerNickname, 'gameNick');
  assert.equal(coach.rating, 1.12);
  assert.equal(other.faceit_id, 'other');
  assert.equal(other.isCoach, undefined);
});

test('role views share the player canonical URL and keep the teams tab', () => {
  assert.equal(playerRolePath('gameNick', 'coach', 'teams'), '/players/gameNick?role=coach&tab=teams');
  assert.equal(playerRolePath('gameNick', 'player', 'teams'), '/players/gameNick?tab=teams');
  assert.equal(getCoachSeo('id', { nickname: 'coachNick', playerNickname: 'gameNick' }, 'en').canonicalPath, '/en/players/gameNick');
  assert.equal(getCoachSeo('id', { nickname: 'onlyCoach' }, 'en').canonicalPath, '/en/coach/onlyCoach');
});

test('search skips absent and invalid ratings', () => {
  for (const input of [undefined, null, '', NaN, 'invalid']) assert.equal(searchPlayerRating(input), null);
  assert.equal(searchPlayerRating('0.89'), '0.89');
});
