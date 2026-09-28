import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoi, unitEconomics, customerSavings, monthlySurvival, ROI_DEFAULTS } from './roi.js';

test('monthly survival compounds back to annual renewal', () => {
  const s = monthlySurvival(0.9);
  assert.ok(Math.abs(Math.pow(s, 12) - 0.9) < 1e-12);
  assert.equal(monthlySurvival(0), 0);
});

test('with no churn and no fixed costs, entrances accumulate exactly', () => {
  const r = computeRoi({ renewal: 1, growth: 1, firstYearEntrances: 12, years: 2, fixedPerYear: 0, upfront: 0 });
  assert.equal(r.months.length, 24);
  assert.ok(Math.abs(r.totals.activeEnd - 24) < 1e-9);
  assert.ok(Math.abs(r.totals.entrancesAdded - 24) < 1e-9);
  assert.equal(r.breakevenMonth, 1);
});

test('default scenario is profitable and breaks even inside 3 years', () => {
  const r = computeRoi();
  assert.ok(r.totals.revenue > 0);
  assert.ok(r.breakevenMonth !== null && r.breakevenMonth <= 36, `breakeven ${r.breakevenMonth}`);
  assert.ok(r.totals.grossMargin > 0.4 && r.totals.grossMargin < 0.9);
  // 期末 ARR = 在線入口 × 月費 × 12
  assert.ok(Math.abs(r.arrEnd - r.totals.activeEnd * ROI_DEFAULTS.monthlyFee * 12) < 1e-6);
});

test('unprofitable pricing never breaks even', () => {
  const r = computeRoi({ monthlyFee: 500, serviceCost: 900, hwPrice: 0 });
  assert.equal(r.breakevenMonth, null);
  assert.ok(r.totals.net < 0);
});

test('unit economics: LTV exceeds a one-time sale at default assumptions', () => {
  const u = unitEconomics();
  assert.ok(u.expectedYears > 6 && u.expectedYears < 7); // 0.9 續約率、10 年封頂 ≈ 6.51 年
  assert.ok(u.ltv > ROI_DEFAULTS.legacyMargin * 5);
  assert.equal(u.paybackMonths, 0);
  const sub = unitEconomics({ hwPrice: 0, hwCost: 6500, monthlyFee: 2500, serviceCost: 900 });
  assert.equal(sub.paybackMonths, Math.ceil(6500 / 1600));
});

test('customer savings uses patrol minutes × wage', () => {
  const s = customerSavings({ wage: 200, patrolsPerDay: 16, minutesPerPatrol: 6, reduction: 0.5, monthlyFee: 2500 });
  assert.ok(Math.abs(s.hoursSaved - 292) < 1e-9);
  assert.equal(s.laborSaved, 58400);
  assert.equal(s.fee, 30000);
  assert.equal(s.net, 28400);
});
