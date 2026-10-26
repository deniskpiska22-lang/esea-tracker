import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUserDateTime, getTimeZoneLabel, getUserTimeZone, getUserDateLocale } from '../src/utils/userTime.js';
const time = { hour: '2-digit', minute: '2-digit' };
test('Berlin follows daylight saving and shows CET/CEST for the event date', () => {
 assert.equal(formatUserDateTime('2026-10-09T13:00:00Z',time,{locale:'en-GB',timeZone:'Europe/Berlin'}),'15:00 CEST');
 assert.equal(formatUserDateTime('2026-12-09T13:00:00Z',time,{locale:'en-GB',timeZone:'Europe/Berlin'}),'14:00 CET');
});
test('visitor timezone is independent of chosen website language', () => {
 for(const locale of ['ru-RU','en-US','de-DE','pt-BR','es-ES','fr-FR','it-IT']) {
  assert.equal(formatUserDateTime('2026-10-09T13:00:00Z',time,{locale,timeZone:'Europe/Berlin'}),'15:00 CEST');
 }
 assert.equal(getUserTimeZone(),Intl.DateTimeFormat().resolvedOptions().timeZone);
});
test('American timezone abbreviations and offsets change with DST', () => {
 assert.equal(formatUserDateTime('2026-10-09T13:00:00Z',time,{locale:'en-GB',timeZone:'America/New_York'}),'09:00 EDT');
 assert.equal(formatUserDateTime('2026-12-09T13:00:00Z',time,{locale:'en-GB',timeZone:'America/New_York'}),'08:00 EST');
});
test('date changes across local midnight and fractional offsets are preserved', () => {
 assert.equal(formatUserDateTime('2026-10-09T23:30:00Z',{day:'2-digit',month:'2-digit',...time},{locale:'en-GB',timeZone:'Asia/Tokyo'}),'10/10, 08:30 GMT+9');
 assert.equal(formatUserDateTime('2026-10-09T13:00:00Z',time,{locale:'en-GB',timeZone:'Asia/Kolkata',showTimeZone:false}),'18:30');
 assert.equal(getTimeZoneLabel(new Date('2026-10-09T13:00:00Z'),'UTC'),'UTC');
});
test('unknown timestamps do not render made-up times',()=>{
 for(const value of [null,undefined,'','broken']) assert.equal(formatUserDateTime(value,time),'');
});

const calendar = { day: '2-digit', month: '2-digit', year: 'numeric' };
test('browser regional preferences preserve European and US date order', () => {
 for (const [language, expected] of [['en-GB','27/10/2026'],['en-US','10/27/2026'],['de-DE','27.10.2026'],['ru-RU','27.10.2026']]) {
  assert.equal(formatUserDateTime('2026-10-27T18:00:00Z',calendar,{locale:getUserDateLocale([language]),timeZone:'Europe/Moscow'}),expected);
 }
});
test('browser locale is the default even on the English site; timezone stays independent', () => {
 const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
 try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['ru-RU','en-US'], language: 'ru-RU' } });
  assert.equal(formatUserDateTime('2026-10-27T18:00:00Z',{...calendar,...time},{timeZone:'Europe/Moscow'}),'27.10.2026, 21:00 GMT+3');
  assert.equal(formatUserDateTime('2026-10-27T18:00:00Z',calendar,{locale:'en-US',timeZone:'Europe/Moscow'}),'10/27/2026');
 } finally {
  if (previous) Object.defineProperty(globalThis, 'navigator', previous);
  else delete globalThis.navigator;
 }
});
test('invalid preferences fall through without breaking match dates', () => {
 assert.equal(getUserDateLocale(['',null,'bad_locale','de-DE','en-US']),'de-DE');
 assert.equal(getUserDateLocale([]),Intl.DateTimeFormat().resolvedOptions().locale);
});
