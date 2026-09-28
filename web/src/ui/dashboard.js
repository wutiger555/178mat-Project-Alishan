import { BarChart, LineChart } from './charts.js';
import { formatSimTime, hourOf } from '../sim/engine.js';

function levelFor(sim) {
  if (sim.armed && sim.openOrder('intrusion')) return ['critical', '入侵警報'];
  if (sim.openOrder('clean')) return ['serious', '待清潔'];
  if (sim.slipActive) return ['warning', '濕滑'];
  if (sim.armed) return ['good', '保全中'];
  return ['good', '正常'];
}

function meterColor(pct, warnAt, badAt, invert = false) {
  const v = invert ? 100 - pct : pct;
  if (v >= badAt) return 'var(--serious)';
  if (v >= warnAt) return 'var(--warning)';
  return 'var(--data)';
}

export function createDashboard(sims, { onSelect, onAccept, onComplete }) {
  let selected = sims[0];
  const tabs = document.getElementById('siteTabs');
  sims.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.name;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => {
      selected = s;
      onSelect?.(s);
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      render(true);
    });
    tabs.appendChild(b);
  });
  tabs.firstChild.classList.add('on');

  const hourly = new BarChart(document.getElementById('hourlyChart'));
  const debris = new LineChart(document.getElementById('debrisChart'));
  const kpis = document.getElementById('kpis');
  const tbody = document.querySelector('#sitesTable tbody');
  const ordersEl = document.getElementById('orders');
  const logEl = document.getElementById('log');
  const compliance = document.getElementById('compliance');

  kpis.innerHTML = `
    <div class="kpi hero"><p class="l">今日人次</p><p class="v" data-k="count">0</p><p class="d" data-k="countSub"></p></div>
    <div class="kpi"><p class="l">凹槽積砂</p><p class="v" data-k="debris">0%</p><div class="meter"><i data-k="debrisBar"></i></div><p class="d" data-k="debrisSub"></p></div>
    <div class="kpi"><p class="l">濕滑風險</p><p class="v" data-k="moist">低</p><div class="meter"><i data-k="moistBar"></i></div><p class="d">由濕度＋人流推估</p></div>
    <div class="kpi"><p class="l">毯條壽命</p><p class="v" data-k="life">0%</p><div class="meter"><i data-k="lifeBar"></i></div><p class="d">依累計踩踏次數</p></div>
    <div class="kpi"><p class="l">模組電量</p><p class="v" data-k="batt">0%</p><div class="meter"><i data-k="battBar"></i></div><p class="d" data-k="battSub">預估還能用 4 年</p></div>
    <div class="kpi"><p class="l">連線</p><p class="v" data-k="link"><span class="status">正常</span></p><p class="d" data-k="linkSub">920 MHz LoRa → 閘道器</p></div>`;
  const K = {};
  kpis.querySelectorAll('[data-k]').forEach((n) => (K[n.dataset.k] = n));

  let lastHeavy = 0;
  function render(force = false) {
    const s = selected;
    K.count.textContent = s.countToday.toLocaleString();
    K.countSub.textContent = `累計 ${s.countTotal.toLocaleString()} 人次・${formatSimTime(s.t)}`;
    const dp = s.debrisPct;
    K.debris.textContent = Math.round(dp) + '%';
    K.debrisBar.style.width = dp + '%';
    K.debrisBar.style.background = meterColor(dp, 50, 70);
    K.debrisSub.textContent = `約 ${(s.debrisG / 1000).toFixed(1)} kg・70% 自動派工`;
    const m = s.moisture;
    K.moist.textContent = m >= s.cfg.slipAlertAt ? '高' : m >= 20 ? '中' : '低';
    K.moistBar.style.width = Math.min(100, m) + '%';
    K.moistBar.style.background = meterColor(m, 20, s.cfg.slipAlertAt);
    const life = s.insertLifePct;
    K.life.textContent = Math.round(life) + '%';
    K.lifeBar.style.width = life + '%';
    K.lifeBar.style.background = meterColor(life, 70, 90, true);
    K.batt.textContent = Math.round(s.battery) + '%';
    K.battBar.style.width = s.battery + '%';
    K.battSub.textContent = `預估還能用 ${(s.battery / (s.cfg.batteryPerDayPct * 365)).toFixed(1)} 年`;

    const now = performance.now();
    if (!force && now - lastHeavy < 400) return;
    lastHeavy = now;

    const h = hourOf(s.t);
    hourly.draw({
      values: s.hourlyToday,
      labels: s.hourlyToday.map((_, i) => String(i)),
      tipLabels: s.hourlyToday.map((_, i) => `${i}:00–${i + 1}:00`),
      highlight: h,
      unit: '人次',
    });
    const pts = s.debrisHistory.map((d) => ({ y: d.pct, label: `${formatSimTime(d.t)}・積砂 ${d.pct.toFixed(1)}%` }));
    const ticks = [];
    s.debrisHistory.forEach((d, i) => {
      if (hourOf(d.t) === 0) ticks.push({ i, label: formatSimTime(d.t).split(' ')[0] });
    });
    debris.draw({ points: pts, yMin: 0, yMax: 100, threshold: s.cfg.cleanAlertPct, fmtY: (v) => Math.round(v) + '%', xTicks: ticks });

    tbody.innerHTML = sims
      .map((x) => {
        const [lv, txt] = levelFor(x);
        return `<tr class="${x === s ? 'sel' : ''}"><td>${x.name}</td><td class="num">${x.countToday.toLocaleString()}</td><td class="num">${Math.round(x.debrisPct)}%</td><td class="num">${Math.round(x.insertLifePct)}%</td><td><span class="status ${lv}">${txt}</span></td></tr>`;
      })
      .join('');

    const all = sims.flatMap((x) => x.orders.map((o) => ({ o, sim: x }))).sort((a, b) => b.o.created - a.o.created).slice(0, 8);
    ordersEl.innerHTML = all.length
      ? all
          .map(({ o }) => {
            const st = o.status === 'open' ? '待接單' : o.status === 'accepted' ? `處理中・${o.who || ''}` : '已結案';
            const btn = o.status === 'open' ? `<button data-a="accept" data-id="${o.id}">接單</button>` : o.status === 'accepted' && o.type !== 'insert' ? `<button data-a="done" data-id="${o.id}">完成</button>` : '';
            return `<li><div class="row"><b>${o.title}</b>${btn}</div><div class="meta">${o.id}・${o.site}・${formatSimTime(o.created)}・${st}</div></li>`;
          })
          .join('')
      : '<li class="empty">目前沒有工單</li>';

    const logs = sims.flatMap((x) => x.log).sort((a, b) => b.t - a.t).slice(0, 10);
    logEl.innerHTML = logs.length ? logs.map((l) => `<li>${l.what}<div class="meta">${l.site}・${formatSimTime(l.t)}・${l.who}</div></li>`).join('') : '<li class="empty">尚無紀錄</li>';
    const wk = s.weeklyCleanings();
    compliance.innerHTML = wk > 0 ? `<span class="status">本週已清潔 ${wk} 次，有紀錄可查</span>` : `<span class="status warning">本週尚未清潔（WELL 要求要有維護紀錄）</span>`;
  }

  ordersEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const sim = sims.find((x) => x.orders.some((o) => o.id === b.dataset.id));
    if (!sim) return;
    if (b.dataset.a === 'accept') onAccept(sim, b.dataset.id);
    else onComplete(sim, b.dataset.id);
    render(true);
  });

  return {
    render,
    get selected() {
      return selected;
    },
  };
}
