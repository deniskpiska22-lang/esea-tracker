import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVetoSteps } from '../scripts/lib/veto.js';

test('stored veto retains order and faction ownership, with a neutral decider', () => {
  const steps = parseVetoSteps({ payload: { tickets: [{ entity_type: 'map', entities: [
    { guid: 'de_nuke', round: 3, status: 'pick', selected_by: 'faction2' },
    { guid: 'de_mirage', round: 1, status: 'drop', selected_by: 'faction1' },
    { guid: 'de_inferno', round: 2, status: 'pick', selected_by: 'faction2' },
  ] }] } });
  assert.deepEqual(steps, [
    { map: 'de_mirage', round: 1, action: 'Banned', selectedBy: 'faction1' },
    { map: 'de_inferno', round: 2, action: 'Picked', selectedBy: 'faction2' },
    { map: 'de_nuke', round: 3, action: 'Decider', selectedBy: null },
  ]);
});
test('missing map history stays unavailable rather than producing made-up picks', () => {
  for (const data of [null, {}, {tickets: []}, {tickets:[{entity_type:'map',entities:[]}]}]) {
    assert.equal(parseVetoSteps(data), null);
  }
});
