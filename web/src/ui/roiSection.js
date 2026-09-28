import { computeRoi, customerSavings, ROI_DEFAULTS, SAVINGS_DEFAULTS } from '../calc/roi.js';
import { LineChart, compact } from './charts.js';

const nt = (v) => 'NT$' + compact(v);
const FIELDS = [
  { k: 'firstYearEntrances', label: '第一年新增入口數', min: 5, max: 100, step: 5, fmt: (v) => v + ' 個' },
  { k: 'growth', label: '每年新增數成長', min: 1, max: 3, step: 0.1, fmt: (v) => '× ' + v.toFixed(1) },
  { k: 'monthlyFee', label: 'Alishan Care 月費／入口', min: 1000, max: 5000, step: 100, fmt: (v) => 'NT$' + v.toLocaleString() },
  { k: 'serviceCost', label: '服務成本／入口／月', min: 300, max: 2000, step: 50, fmt: (v) => 'NT$' + v.toLocaleString(), hint: '凹槽清潔、換毯攤提、雲端、LINE' },
  { k: 'hwPrice', label: 'Smart 模組加價／入口', min: 0, max: 40000, step: 1000, fmt: (v) => 'NT$' + v.toLocaleString() },
  { k: 'hwCost', label: '模組＋閘道＋安裝成本', min: 2000, max: 15000, step: 500, fmt: (v) => 'NT$' + v.toLocaleString() },
  { k: 'renewal', label: '年續約率', min: 0.6, max: 0.98, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
  { k: 'upfront', label: '一次性投入（原型、模具、開發）', min: 100000, max: 2000000, step: 50000, fmt: nt },
  { k: 'fixedPerYear', label: '每年固定成本', min: 0, max: 3000000, step: 100000, fmt: nt, hint: '雲端、客服、部分人力' },
  { k: 'legacyMargin', label: '對照：傳統一次銷售毛利／入口', min: 5000, max: 50000, step: 1000, fmt: (v) => 'NT$' + v.toLocaleString() },
];
const CUST = [
  { k: 'wage', label: '清潔人員時薪', min: 180, max: 300, step: 10, fmt: (v) => 'NT$' + v },
  { k: 'patrolsPerDay', label: '現在每天巡檢入口次數', min: 4, max: 24, step: 1, fmt: (v) => v + ' 次' },
  { k: 'minutesPerPatrol', label: '每次巡檢花幾分鐘', min: 2, max: 15, step: 1, fmt: (v) => v + ' 分' },
  { k: 'reduction', label: '改成「有需要才去」後減少', min: 0.2, max: 0.8, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
];

function rangeRow(f, value) {
  return `<label class="range">${f.label}<output data-o="${f.k}">${f.fmt(value)}</output>
    <input type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${value}" aria-label="${f.label}" />
    ${f.hint ? `<small>${f.hint}</small>` : ''}</label>`;
}

export function initRoiSection() {
  const form = document.getElementById('roiInputs');
  const p = { ...ROI_DEFAULTS };
  form.innerHTML = FIELDS.map((f) => rangeRow(f, p[f.k])).join('') + '<button type="button" class="btn small reset">恢復保守預設值</button>';
  const chart = new LineChart(document.getElementById('cashChart'));
  const kpis = document.getElementById('roiKpis');
  const unitBox = document.getElementById('unitBox');

  function render() {
    const r = computeRoi(p);
    const be = r.breakevenMonth;
    kpis.innerHTML = `
      <div class="kpi"><p class="l">回本時間</p><p class="v">${be ? `第 ${be} 個月` : '三年內未回本'}</p><p class="d">含一次性投入與固定成本</p></div>
      <div class="kpi"><p class="l">三年累計營收</p><p class="v">${nt(r.totals.revenue)}</p><p class="d">三年新增 ${Math.round(r.totals.entrancesAdded)} 個入口</p></div>
      <div class="kpi"><p class="l">第三年底年經常性收入</p><p class="v">${nt(r.arrEnd)}</p><p class="d">在線 ${Math.round(r.totals.activeEnd)} 個入口</p></div>
      <div class="kpi"><p class="l">三年毛利率</p><p class="v">${Math.round(r.totals.grossMargin * 100)}%</p><p class="d">累計淨現金 ${nt(r.totals.net)}</p></div>`;
    const pts = [{ y: -p.upfront, label: '第 0 個月：投入 ' + nt(p.upfront) }].concat(
      r.months.map((m) => ({ y: m.cash, label: `第 ${m.m} 個月：累計 ${nt(m.cash)}・在線 ${Math.round(m.active)} 個入口` })),
    );
    chart.draw({
      points: pts,
      fmtY: compact,
      marker: be ?? undefined,
      markerLabel: be ? `第 ${be} 個月回本` : undefined,
      xTicks: [0, 12, 24, 36].map((i) => ({ i, label: i === 0 ? '開始' : `第 ${i / 12} 年` })),
    });
    const u = r.unit;
    unitBox.innerHTML = `
      <div class="kpi"><p class="l">每個入口的終身價值</p><p class="v">${nt(u.ltv)}</p><p class="d">預期合作 ${u.expectedYears.toFixed(1)} 年（10 年封頂）</p></div>
      <div class="kpi"><p class="l">相當於傳統一次銷售的</p><p class="v">${u.ltvVsLegacy ? u.ltvVsLegacy.toFixed(1) + ' 倍' : '—'}</p><p class="d">傳統毛利 NT$${p.legacyMargin.toLocaleString()}</p></div>
      <div class="kpi"><p class="l">每入口每月毛利貢獻</p><p class="v">NT$${u.monthlyContribution.toLocaleString()}</p><p class="d">${u.paybackMonths ? `模組成本 ${u.paybackMonths} 個月回收` : '模組加價已經先回收成本'}</p></div>`;
  }

  form.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    p[k] = Number(e.target.value);
    form.querySelector(`[data-o="${k}"]`).textContent = FIELDS.find((f) => f.k === k).fmt(p[k]);
    render();
  });
  form.querySelector('.reset').addEventListener('click', () => {
    Object.assign(p, ROI_DEFAULTS);
    for (const f of FIELDS) {
      form.querySelector(`[data-k="${f.k}"]`).value = p[f.k];
      form.querySelector(`[data-o="${f.k}"]`).textContent = f.fmt(p[f.k]);
    }
    render();
  });
  render();
  addEventListener('themechange', render);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  // 客戶端省下的巡檢工時
  const cust = document.getElementById('custBox');
  const c = { ...SAVINGS_DEFAULTS };
  cust.innerHTML = `<div class="ranges">${CUST.map((f) => rangeRow(f, c[f.k])).join('')}</div><div class="result"></div>`;
  const res = cust.querySelector('.result');
  function renderCust() {
    c.monthlyFee = p.monthlyFee;
    const s = customerSavings(c);
    res.innerHTML = `
      <div class="kpi"><p class="l">每年省下工時</p><p class="v">${Math.round(s.hoursSaved)} 小時</p></div>
      <div class="kpi"><p class="l">省下的人力成本</p><p class="v">${nt(s.laborSaved)}</p></div>
      <div class="kpi"><p class="l">扣掉年訂閱費後</p><p class="v" style="color:${s.net >= 0 ? 'var(--good-ink)' : 'var(--critical)'}">${s.net >= 0 ? '+' : ''}${nt(s.net)}</p><p class="d">訂閱 NT$${s.fee.toLocaleString()}／年</p></div>`;
  }
  cust.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    c[k] = Number(e.target.value);
    cust.querySelector(`[data-o="${k}"]`).textContent = CUST.find((f) => f.k === k).fmt(c[k]);
    renderCust();
  });
  form.addEventListener('input', renderCust);
  renderCust();
}
