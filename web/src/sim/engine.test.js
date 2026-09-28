import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatSim, poisson, mulberry32, formatSimTime, isArmedHour } from './engine.js';

test('poisson mean is close to lambda', () => {
  const r = mulberry32(1);
  for (const lambda of [0.5, 5, 80]) {
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) s += poisson(lambda, r);
    assert.ok(Math.abs(s / n - lambda) < lambda * 0.05 + 0.05, `lambda ${lambda} mean ${s / n}`);
  }
});

test('time formatting and armed hours', () => {
  assert.equal(formatSimTime(0), '週一 00:00');
  assert.equal(formatSimTime(24 * 60 * 5 + 8 * 60 + 5), '週六 08:05');
  assert.ok(isArmedHour(23) && isArmedHour(2) && !isArmedHour(6) && !isArmedHour(12));
});

test('a weekday produces roughly the configured daily traffic', () => {
  const sim = new MatSim({ startT: 0, dailyTraffic: 2000, security: false, seed: 7 });
  sim.step(24 * 60);
  const day = sim.dailyHistory.at(-1).count;
  assert.ok(day > 1850 && day < 2150, `count ${day}`);
});

test('rain fills the pit faster and triggers a clean order, auto crew completes it', () => {
  const dry = new MatSim({ startT: 7 * 60, debrisPct: 50, autoCrew: false, seed: 3 });
  const wet = new MatSim({ startT: 7 * 60, debrisPct: 50, autoCrew: false, rainy: true, seed: 3 });
  dry.step(120);
  wet.step(120);
  assert.ok(wet.debrisPct > dry.debrisPct);

  const sim = new MatSim({ startT: 8 * 60, debrisPct: 69.5, rainy: true, seed: 5 });
  const messages = [];
  sim.on((ev) => ev.type === 'message' && messages.push(ev));
  sim.step(60);
  const clean = sim.orders.find((o) => o.type === 'clean');
  assert.ok(clean, 'clean order created');
  sim.step(60);
  assert.equal(clean.status, 'done');
  assert.ok(sim.debrisPct < 20);
  assert.ok(sim.log.some((l) => l.what.startsWith('凹槽清潔')));
  assert.equal(sim.weeklyCleanings(), 1);
  assert.ok(messages.some((m) => m.title.startsWith('工單完成')));
});

test('rainy rush hour raises slip risk and it clears after the rain stops', () => {
  const sim = new MatSim({ startT: 8 * 60, rainy: true, autoCrew: false, seed: 9 });
  sim.step(150);
  assert.ok(sim.slipActive, `moisture ${sim.moisture}`);
  sim.rainy = false;
  sim.step(240);
  assert.equal(sim.slipActive, false);
  assert.equal(sim.orders.find((o) => o.type === 'slip').status, 'done');
});

test('night hours suppress normal traffic; intrusion creates a critical alert', () => {
  const sim = new MatSim({ startT: 23 * 60 + 5, seed: 2 });
  const before = sim.countTotal;
  sim.step(60);
  assert.equal(sim.countTotal, before);
  assert.ok(sim.armed);
  let level = null;
  sim.on((ev) => ev.type === 'message' && (level = ev.level));
  sim.simulateIntrusion();
  assert.equal(level, 'critical');
});
