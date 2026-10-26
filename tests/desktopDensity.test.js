import test from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { desktopDensity } from '../scripts/desktopDensity.js';

const processCss = async css => (await postcss([desktopDensity()]).process(css, { from: undefined })).root;
const ancestors = node => {
  const conditions = [];
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'atrule') conditions.push(parent.params);
  return conditions.join(' ');
};

test('shell width thresholds track an 80% browser viewport, keeping mobile rules', async () => {
  const root = await processCss('@media (min-width: 1600px) { .shell { width: 1120px } }');
  const rules = [];
  root.walkRules(rule => rules.push({ condition: ancestors(rule), width: rule.first.value }));
  assert.deepEqual(rules, [
    { condition: '(min-width: 1600px) and (max-width: 1023.98px)', width: '1120px' },
    { condition: '(min-width: 1280px) and (min-width: 1024px)', width: '1120px' },
  ]);
});

test('Tailwind range syntax and nested media conditions are scaled once', async () => {
  const root = await processCss('@media (width >= 64rem) { @media (width < 90rem) { .grid { display: grid } } }');
  const conditions = [];
  root.walkRules(rule => conditions.push(ancestors(rule)));
  assert.ok(conditions.includes('(width < 72rem) and (min-width: 1024px) (width >= 51.2rem) and (min-width: 1024px)'));
  assert.ok(conditions.includes('(width < 90rem) and (max-width: 1023.98px) (width >= 64rem) and (max-width: 1023.98px)'));
  assert.equal(conditions.length, 4);
});

test('viewport height fills the screen after zoom; fixed dimensions stay scaled', async () => {
  const root = await processCss('.shell { min-height: calc(100dvh - 72px); padding: 24px; max-width: 90vw }');
  const rules = [];
  root.walkRules(rule => rules.push({ condition: ancestors(rule), declarations: rule.nodes.map(n => `${n.prop}:${n.value}`) }));
  assert.deepEqual(rules, [
    { condition: '', declarations: ['min-height:calc(100dvh - 72px)', 'padding:24px', 'max-width:90vw'] },
    { condition: 'screen and (min-width: 1024px)', declarations: ['min-height:calc(125dvh - 72px)', 'max-width:112.5vw'] },
  ]);
});

test('print, reduced motion and animations remain intact', async () => {
  const css = '@media print { .x { display: none } } @media (prefers-reduced-motion: reduce) { .x { animation: none } } @keyframes spin { to { transform: rotate(360deg) } }';
  assert.equal((await processCss(css)).toString(), css);
});


test('inline root zoom is not transformed a second time by Vite', async () => {
  const css = '/* esea-density-root */ @media screen and (min-width: 1024px) { html { zoom: .8 } body { min-height: 125vh } }';
  assert.equal((await processCss(css)).toString(), css);
});
