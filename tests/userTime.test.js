import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getUserDateLocale, parseUserDate } from '../src/utils/userTime.js';

// Fresh processes exercise real Intl device zones, rather than formatter overrides.
function device(zone, language, expression) {
  const module = new URL('../src/utils/userTime.js', import.meta.url).href;
  const script = `import * as t from ${JSON.stringify(module)};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{languages:[${JSON.stringify(language)}]}});
    console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: zone }, encoding: 'utf8',
  }));
}
const time = "{hour:'2-digit',minute:'2-digit'}";
test('device timezone and event-date daylight saving apply everywhere', () => {
  for (const [zone, summer, winter] of [
    ['Europe/Berlin','15:00 CEST','14:00 CET'],
    ['America/New_York','09:00 EDT','08:00 EST'],
    ['Asia/Kolkata','18:30 GMT+5:30','18:30 GMT+5:30'],
    ['UTC','13:00 UTC','13:00 UTC'],
  ]) {
    assert.deepEqual(device(zone,'en-GB',`['2026-10-09','2026-12-09'].map(day=>t.formatUserDateTime(day+'T13:00:00Z',${time}))`),[summer,winter]);
  }
});
test('midnight and New Year roll into the device calendar', () => {
  assert.equal(device('Asia/Tokyo','en-GB',`t.formatUserDateTime('2026-12-31T23:30:00Z',{year:'numeric',month:'2-digit',day:'2-digit',...${time}})`),'01/01/2027, 08:30 GMT+9');
  assert.equal(device('America/Los_Angeles','en-US',`t.formatUserDateTime('2026-01-01T01:30:00Z',{year:'numeric',month:'2-digit',day:'2-digit'})`),'12/31/2025');
});
test('regional browser preferences control date order and 12/24-hour convention', () => {
  assert.equal(device('America/New_York','en-US',`t.formatUserDateTime('2026-10-27T18:00:00Z',${time},{showTimeZone:false})`),'02:00 PM');
  assert.equal(device('America/New_York','en-GB',`t.formatUserDateTime('2026-10-27T18:00:00Z',${time},{showTimeZone:false})`),'14:00');
  for(const [locale,expected] of [['en-US','10/27/2026'],['en-GB','27/10/2026'],['ru-RU','27.10.2026']])
    assert.equal(device('Europe/Moscow',locale,"t.formatUserDateTime('2026-10-27T18:00:00Z',{year:'numeric',month:'2-digit',day:'2-digit'})"),expected);
});
test('site language, country and partner cannot override device settings', () => {
  assert.deepEqual(device('Europe/Berlin','en-GB',`[
    t.formatUserDateTime('2026-10-09T13:00:00Z',{...${time},timeZone:'Europe/Moscow',hour12:true},{locale:'ru-RU',timeZone:'UTC'}),
    t.formatOddsDateTime('2026-10-09T13:00:00Z',${time},{pari:true,locale:'ru-RU'})
  ]`),['15:00 CEST','15:00 CEST']);
});
test('calendar-only dates preserve their day in all zones and never invent a clock', () => {
  for(const zone of ['Pacific/Kiritimati','America/Los_Angeles','Asia/Tokyo'])
    assert.equal(device(zone,'en-GB',"t.formatUserDateTime('2026-01-01',{year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric'})"),'01/01/2026');
});
test('unknown dates stay empty; UTC server timestamps and epoch seconds are parsed', () => {
  assert.deepEqual(device('Asia/Tokyo','en-GB',`[null,undefined,'','broken','2026-02-30'].map(value=>t.formatUserDateTime(value,${time}))`),['','','','','']);
  for(const value of ['2026-10-09T13:00:00','2026-10-09 13:00:00+00','2026-10-09T13:00:00Z'])
    assert.equal(parseUserDate(value).toISOString(),'2026-10-09T13:00:00.000Z');
  assert.equal(parseUserDate(1791550800).getTime(),1791550800000);
});
test('timezone changes update existing subscribers, which can unsubscribe', () => {
  assert.deepEqual(device('Europe/Berlin','en-GB',`(()=>{
    let updates=0;const off=t.subscribeUserTime(()=>updates++);updates=0;
    const before=t.formatUserDateTime('2026-10-09T13:00:00Z',${time});
    process.env.TZ='Asia/Tokyo';t.refreshUserTimeSettings();
    const after=t.formatUserDateTime('2026-10-09T13:00:00Z',${time});
    const notified=updates;off();process.env.TZ='UTC';t.refreshUserTimeSettings();
    return {before,after,notified,unsubscribed:updates===notified};
  })()`),{before:'15:00 CEST',after:'22:00 GMT+9',notified:1,unsubscribed:true});
});
test('invalid locale preferences fall through', () => {
  assert.equal(getUserDateLocale(['',null,'bad_locale','de-DE','en-US']),'de-DE');
});
