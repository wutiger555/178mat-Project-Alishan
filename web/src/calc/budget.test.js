import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseTotal, defaultSelection, withSubsidy } from './budget.js';

test('every item has a sane price range', () => {
  for (const p of PHASES) for (const it of p.items) assert.ok(it.lo >= 0 && it.hi >= it.lo, it.name);
});

test('default phase 0 stays within NT$1.5–2.5 萬 as promised in the deck', () => {
  const t = phaseTotal(PHASES[0]);
  assert.ok(t.lo >= 10000 && t.hi <= 25000, JSON.stringify(t));
});

test('phase 1 and 2 defaults match the roadmap ranges', () => {
  const p1 = phaseTotal(PHASES[1]);
  assert.ok(p1.lo >= 50000 && p1.hi <= 300000, JSON.stringify(p1));
  const p2 = phaseTotal(PHASES[2]);
  assert.ok(p2.lo >= 250000 && p2.hi <= 1000000, JSON.stringify(p2));
});

test('selection toggles optional items', () => {
  const sel = defaultSelection();
  const base = phaseTotal(PHASES[1], sel);
  const idx = PHASES[1].items.findIndex((i) => i.optional);
  sel.add(`p1:${idx}`);
  const more = phaseTotal(PHASES[1], sel);
  assert.equal(more.lo - base.lo, PHASES[1].items[idx].lo);
});

test('SBIR subsidy is 50% capped at 150 萬', () => {
  assert.deepEqual(withSubsidy(1000000), { grant: 500000, own: 500000 });
  assert.deepEqual(withSubsidy(4000000), { grant: 1500000, own: 2500000 });
});
