import { MatSim, formatSimTime, hourOf } from './engine.js';
import { initEntranceScene } from '../scene/entranceScene.js';
import { createDashboard } from '../ui/dashboard.js';
import { createPhone } from '../ui/phone.js';

export function initSimSection() {
  const sims = [
    new MatSim({ id: 'east', name: '東側大門', dailyTraffic: 2000, seed: 11, debrisPct: 66, wearSteps: 1_300_000, battery: 87 }),
    new MatSim({ id: 'west', name: '西側門', dailyTraffic: 700, seed: 23, debrisPct: 38, wearSteps: 2_550_000, battery: 91, areaM2: 1.8 * 1.2 }),
    new MatSim({ id: 'b1', name: 'B1 停車場梯廳', dailyTraffic: 1100, seed: 37, debrisPct: 52, wearSteps: 900_000, battery: 64, areaM2: 1.6 * 1.2 }),
  ];
  const east = sims[0];
  const scene = initEntranceScene();

  const accept = (sim, id) => sim.acceptOrder(id, '你（物管主任）');
  const complete = (sim, id) => sim.completeOrder(id);

  const dash = createDashboard(sims, {
    onAccept: accept,
    onComplete: complete,
  });

  const phone = createPhone({
    onAccept: accept,
    onComplete: complete,
    onQuery(q) {
      const s = dash.selected;
      const body =
        q === 'status'
          ? `${s.name}｜今日 ${s.countToday.toLocaleString()} 人次｜積砂 ${Math.round(s.debrisPct)}%｜毯條 ${Math.round(s.insertLifePct)}%｜電量 ${Math.round(s.battery)}%`
          : q === 'report'
            ? `本週清潔 ${sims.reduce((a, x) => a + x.weeklyCleanings(), 0)} 次・${sims.filter((x) => x.weeklyCleanings() > 0).length}／${sims.length} 個入口有清潔紀錄。完整報表已寄到物管信箱（WELL／ESG 可用）。`
            : null;
      if (q === 'call') {
        s.createOrder('clean', '手動叫修：' + s.name, '物管從 LINE 圖文選單發起清潔需求');
        return;
      }
      phone.push({ level: 'info', title: q === 'status' ? '即時狀態' : '本週報表', body }, s, { reply: true });
    },
  });

  for (const s of sims) {
    s.on((ev, sim) => {
      if (ev.type === 'message') phone.push(ev, sim);
      if (ev.type === 'order') phone.syncOrder(ev.order);
    });
  }

  // 歡迎訊息
  phone.push(
    { level: 'info', title: '已連線 3 個入口', body: '東側大門、西側門、B1 停車場梯廳的感測模組都在線上。積砂達 70%、濕滑、入侵時會通知你。' },
    east,
    { reply: true },
  );

  // --- 控制 ---
  const ctl = document.getElementById('simControls');
  let speed = 600; // 模擬秒／真實秒
  let paused = false;
  let xray = false;
  ctl.querySelectorAll('[data-weather]').forEach((b) =>
    b.addEventListener('click', () => {
      ctl.querySelectorAll('[data-weather]').forEach((x) => x.classList.toggle('on', x === b));
      const rain = b.dataset.weather === 'rain';
      sims.forEach((s) => (s.rainy = rain));
      scene.setRain(rain);
    }),
  );
  ctl.querySelectorAll('[data-speed]').forEach((b) =>
    b.addEventListener('click', () => {
      ctl.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b));
      speed = Number(b.dataset.speed);
    }),
  );
  const pauseBtn = ctl.querySelector('[data-act="pause"]');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ 繼續' : '⏸ 暫停';
  });
  const xrayBtn = ctl.querySelector('[data-act="xray"]');
  xrayBtn.addEventListener('click', () => {
    xray = !xray;
    scene.setXray(xray);
    xrayBtn.classList.toggle('on', xray);
  });
  const nightBtn = ctl.querySelector('[data-act="night"]');
  nightBtn.addEventListener('click', () => {
    // 跳到今晚 23:05（或已在夜間則跳到隔天 07:00）
    for (const s of sims) {
      const day = Math.floor(s.t / 1440);
      const h = hourOf(s.t);
      const target = h >= 23 || h < 6 ? (h >= 23 ? day + 1 : day) * 1440 + 7 * 60 : day * 1440 + 23 * 60 + 5;
      s.step(target - s.t);
    }
    scene.clearCrowd();
  });
  ctl.querySelector('[data-act="intrude"]').addEventListener('click', () => {
    if (!east.armed) {
      phone.push({ level: 'info', title: '保全模式尚未啟動', body: '保全時段是 23:00–06:00。先按「跳到今晚 23:05」，再模擬入侵。' }, east, { reply: true });
      return;
    }
    east.simulateIntrusion();
    scene.intruder();
  });
  const autoCrew = document.getElementById('autoCrew');
  autoCrew.addEventListener('change', () => sims.forEach((s) => (s.autoCrew = autoCrew.checked)));

  const clock = document.getElementById('simClock');
  const mode = document.getElementById('simMode');

  // --- 主迴圈：只有這一章在畫面上時才跑 ---
  const section = document.getElementById('sim');
  let active = false;
  let last = 0;
  function frame(now) {
    if (!active) return;
    const dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (!paused && !document.hidden) {
      const simMin = (dt * speed) / 60;
      for (const s of sims) {
        const n = s.step(simMin);
        if (s === east) scene.addArrivals(n);
      }
    }
    clock.textContent = formatSimTime(east.t);
    mode.textContent = east.armed ? '保全模式' : east.rainy ? '營業中・雨天' : '營業中';
    mode.classList.toggle('armed', east.armed);
    scene.setHour((east.t % 1440) / 60);
    const h = hourOf(east.t);
    nightBtn.textContent = h >= 23 || h < 6 ? '☀ 跳到早上 07:00' : '☾ 跳到今晚 23:05';
    scene.setDirt(east.debrisPct);
    const clean = east.openOrder('clean');
    scene.setCleaner(!!clean && clean.status === 'accepted');
    const slip = east.openOrder('slip');
    scene.setWetSign(!!slip && slip.status === 'accepted');
    const intr = east.openOrder('intrusion');
    scene.setAlarm(!!intr && intr.status !== 'done');
    dash.render();
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(
    (entries) => {
      const was = active;
      active = entries[0].isIntersecting;
      if (active && !was) {
        last = performance.now();
        requestAnimationFrame(frame);
      }
    },
    { threshold: 0.05 },
  ).observe(section);

  dash.render(true);
  return { sims };
}
