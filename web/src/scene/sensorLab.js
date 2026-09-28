import * as THREE from 'three';
import { createViewer } from './viewer.js';
import { buildMat } from '../mat/builder.js';
import { LAYOUTS } from '../mat/materials.js';
import { SENSORS } from './sensorData.js';

const HPF_RC = 1 / (2 * Math.PI * 1.7); // 10 MΩ 偏壓電阻 → 1.7 Hz 高通
const THRESH = 0.15; // 喚醒門檻（相對單位，約 150 mV）
const WINDOW_S = 3.6;

// 安裝步驟（既有案場改裝；新案在工廠就先做好）
const STEPS = [
  { t: '起點：既有的玉山 ES302', cap: '這是一個已經施工好的案場：鋁條、面材、PVC 底座、凹槽，全部照舊。', lift: 0, pit: false, strips: false, module: false, wires: false, nfc: false },
  { t: '① 掀起地墊', cap: '鋼索串聯的地墊可以整片抬起或捲起，兩個人約 5 分鐘。這本來就是清坑的標準動作。', lift: 1, pit: false, strips: false, module: false, wires: false, nfc: false },
  { t: '② 清坑，放入凹槽電極', cap: '清掉積砂後，在鋁條兩腳之間的隧道位置，用背膠加 PU 固定電容電極條和積水電極針。約 15 分鐘。', lift: 1, pit: true, strips: false, module: false, wires: false, nfc: false },
  { t: '③ 換上壓電感測底座條', cap: 'PVC 避震底座本來就是可以拆換的零件。把其中幾條換成外形一樣的感測底座條，引線沿鋁條端頭拉出。', lift: 1, pit: true, strips: true, module: false, wires: false, nfc: false },
  { t: '④ 放回地墊', cap: '地墊放回凹槽，卡住不會移位，不用任何固定。踩踏面看起來跟原本一模一樣。', lift: 0, pit: true, strips: true, module: false, wires: false, nfc: false },
  { t: '⑤ 裝模組艙、接線', cap: '在邊框端部裝入模組艙（新案出廠就做好），接頭穿過邊框；感測線留 40 cm 維修迴圈、套不鏽鋼編織管。', lift: 0, pit: true, strips: true, module: true, wires: true, nfc: false },
  { t: '⑥ 貼 NFC、手機配對', cap: '在鋁條端頭和模組艙蓋貼上 NFC 標籤。技師用手機嗶一下完成配對，LED 閃三下就上線了。整個改裝約 1 小時。', lift: 0, pit: true, strips: true, module: true, wires: true, nfc: true, pair: true },
];

function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return { ink: v('--ink'), muted: v('--muted'), grid: v('--grid'), data: v('--data'), accent2: v('--accent-2'), surface: v('--surface'), font: v('--font'), critical: v('--critical') };
}

export function initSensorLab() {
  const el = document.getElementById('labViewer');
  const v = createViewer(el, { exposure: 0.95, envIntensity: 0.55, hemi: 0.35, sun: 1.7, cameraPos: [0.55, 0.45, 0.62], target: [0, 0.012, 0], shadowExtent: 0.8, maxDistance: 3, minDistance: 0.05 });
  const mat = buildMat({ widthM: 0.6, depthM: 0.5, layout: LAYOUTS.hotel.seq, floorMargin: 0.12 });
  v.scene.add(mat.root);
  const info = mat.info;
  const c = info.centers;
  const lines = mat.lines;

  const state = { sel: null, explode: 0, target: 0, lift: 0, liftT: 0, modY: 0, modT: 0, step: -1, demo: null, demoT: 0, pairUntil: 0 };

  // ---------- 卡片與說明 ----------
  const cards = document.getElementById('labCards');
  const detail = document.getElementById('labDetail');
  cards.innerHTML = SENSORS.map((s) => `<button data-id="${s.id}"><i aria-hidden="true">${s.icon}</i><b>${s.name}</b><span>${s.short}</span></button>`).join('');
  function renderDetail(s) {
    detail.innerHTML = `
      <h3>${s.name}</h3>
      <p class="d-what">${s.what}</p>
      <div class="d-diagram">${s.diagram}</div>
      <h4>原理</h4><p>${s.how}</p>
      <h4>放在哪裡</h4><p>${s.where}</p>
      <h4>怎麼使用</h4><ul>${s.use.map((u) => `<li>${u}</li>`).join('')}</ul>
      <h4>怎麼撐過戶外、髒污</h4><p>${s.rugged}</p>
      <h4>別的領域怎麼做</h4><p>${s.prior}</p>
      <dl class="d-meta"><dt>成本</dt><dd>${s.cost}</dd><dt>還要驗證</dt><dd>${s.verify}</dd></dl>`;
  }
  function camFor(s) {
    const m = info.module;
    switch (s.id) {
      case 'piezo':
        return { t: [lines[0].x + 0.06, 0.03, 0.08], p: [lines[0].x + 0.34, 0.2, 0.44] };
      case 'ide':
        return { t: [c[info.fpcIdx[0]] + 0.04, 0.01, 0], p: [c[info.fpcIdx[0]] + 0.3, 0.22, 0.34] };
      case 'water':
        return { t: [c[info.pinIdx], 0.006, info.pinZ], p: [c[info.pinIdx] + 0.14, 0.1, info.pinZ + 0.18] };
      case 'nfc':
        return { t: [c[Math.floor(c.length / 2)], 0.01, info.innerHalfZ], p: [c[Math.floor(c.length / 2)] + 0.2, 0.14, info.innerHalfZ + 0.3] };
      case 'module':
        return { t: [(m.x0 + m.x1) / 2, 0.004, m.zc], p: [(m.x0 + m.x1) / 2 + 0.2, 0.18, m.zc + 0.26] };
      default:
        return { t: [0, 0.012, 0], p: [0.55, 0.45, 0.62] };
    }
  }
  function select(id, fly = true) {
    const s = SENSORS.find((x) => x.id === id);
    state.sel = s;
    cards.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    renderDetail(s);
    endInstall();
    mat.setXray(!!s.xray);
    mat.focus(s.focus);
    mat.setSand(s.xray ? 4 : 0.5);
    state.target = s.explode;
    if (fly) {
      const cam = camFor(s);
      v.flyTo(cam.p, cam.t, 1000);
    }
  }
  cards.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) select(b.dataset.id);
  });

  // ---------- 示範：人走過／推車／沖洗 ----------
  // 鞋子：鞋底＋鞋面（原點在腳跟下緣）
  const shoe = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.265, 0.012, 0.095), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.8 }));
  sole.position.set(0.1325, 0.006, 0);
  const upperGeo = new THREE.CapsuleGeometry(0.038, 0.16, 6, 12);
  upperGeo.rotateZ(Math.PI / 2);
  upperGeo.scale(1, 0.75, 1.1);
  const upper = new THREE.Mesh(upperGeo, new THREE.MeshStandardMaterial({ color: '#2f4f7a', roughness: 0.6 }));
  upper.position.set(0.13, 0.04, 0);
  const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 16), upper.material);
  ankle.position.set(0.06, 0.085, 0);
  shoe.add(sole, upper, ankle);
  shoe.traverse((m) => m.isMesh && (m.castShadow = true));
  shoe.visible = false;
  v.scene.add(shoe);
  const cart = new THREE.Group();
  const cartBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.36), new THREE.MeshStandardMaterial({ color: '#8a929c', metalness: 0.6, roughness: 0.4 }));
  cartBody.position.set(0.225, 0.075, 0);
  cart.add(cartBody);
  const wheelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.025, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.8 });
  for (const wx of [0, 0.45]) for (const wz of [-0.14, 0.14]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.063, wz);
    cart.add(w);
  }
  cart.visible = false;
  v.scene.add(cart);
  const spray = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshBasicMaterial({ color: '#7cc4ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  spray.rotation.x = -Math.PI / 2.4;
  spray.visible = false;
  v.scene.add(spray);

  const DEMOS = { walk: 3.2, cart: 2.6, wash: 3.0 };
  const lineX = lines.map((l) => l.x);
  const matTop = 0.0228;
  function forces(kind, t) {
    const f = new Array(lines.length).fill(0);
    if (kind === 'walk') {
      const heel = lineX[0] - 0.035; // 腳跟落點
      const t0 = 0.5;
      const T = 0.85; // 站立期
      const p = (t - t0) / T;
      if (p >= 0 && p <= 1) {
        const amp = 0.55 + 0.45 * (Math.exp(-(((p - 0.2) / 0.13) ** 2)) + Math.exp(-(((p - 0.78) / 0.13) ** 2)));
        const cop = heel + 0.04 + p * 0.18; // 壓力中心從腳跟移到前掌
        lineX.forEach((x, i) => {
          if (x < heel || x > heel + 0.26) return;
          f[i] = amp * Math.exp(-(((x - cop) / 0.07) ** 2)) * Math.sin(Math.PI * Math.min(1, p * 1.2));
        });
      }
    } else if (kind === 'cart') {
      const x0 = lineX[0] - 0.35;
      const vx = 0.75;
      for (const wb of [0, 0.45]) {
        const xw = x0 + vx * t - wb + 0.45;
        lineX.forEach((x, i) => (f[i] += 1.3 * Math.exp(-(((x - xw) / 0.012) ** 2))));
      }
    } else if (kind === 'wash') {
      const on = t > 0.4 && t < 2.4;
      if (on) lineX.forEach((x, i) => (f[i] = 0.35 + 0.25 * Math.sin(t * 40 + i * 1.7) + 0.2 * Math.sin(t * 13 + i)));
      // 冷水沖到曬熱的鋁條：熱電效應造成緩慢漂移
      lineX.forEach((x, i) => (f[i] += t > 0.4 ? -Math.min(1, (t - 0.4) * 0.6) : 0));
    }
    return f;
  }

  // 波形紀錄
  const wave = document.getElementById('waveCanvas');
  const wctx = wave.getContext('2d');
  const hist = lines.map(() => []);
  const vState = lines.map(() => ({ v: 0, f: 0, above: false, since: 0 }));
  const log = document.getElementById('labLog');
  let events = [];
  function addLog(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'll ' + cls;
    d.textContent = text;
    log.appendChild(d);
    while (log.children.length > 6) log.removeChild(log.firstChild);
  }
  function stamp(t) {
    return `10:24:${String(5 + Math.floor(t)).padStart(2, '0')}.${String(Math.floor((t % 1) * 1000)).padStart(3, '0')}`;
  }

  function startDemo(kind) {
    endInstall();
    state.demo = kind;
    state.demoT = 0;
    events = [];
    log.innerHTML = '';
    hist.forEach((h) => (h.length = 0));
    vState.forEach((s) => Object.assign(s, { v: 0, f: 0, above: false, since: 0 }));
    mat.setXray(false);
    mat.focus(['sensor']);
    state.target = 0;
    v.flyTo([lineX[0] + 0.14, 0.26, 0.58], [lineX[0] + 0.14, 0.012, 0], 700);
    document.querySelectorAll('[data-demo]').forEach((b) => b.classList.toggle('on', b.dataset.demo === kind));
    addLog(kind === 'walk' ? '模組睡眠中（約 10 µA）…有人走過來' : kind === 'cart' ? '模組睡眠中…一台推車經過' : '模組睡眠中…清潔人員開始高壓沖洗', 'muted');
  }
  function classify(kind) {
    const byLine = new Map();
    for (const e of events) if (!byLine.has(e.line)) byLine.set(e.line, e);
    const firsts = [...byLine.values()].sort((a, b) => a.t - b.t);
    const dwell = events.length ? events.reduce((a, e) => a + (e.dur || 0), 0) / events.length : 0;
    const spread = firsts.length > 1 ? firsts.at(-1).t - firsts[0].t : 0;
    if (!events.length) return addLog('沒有超過門檻，不計數', 'muted');
    if (firsts.length >= lines.length - 1 && spread < 0.15) return addLog(`判定：清洗模式（${firsts.length} 條線同時長時間有訊號）→ 不計入人次`, 'warn');
    if (dwell < 0.08) {
      const pairs = Math.round(events.length / Math.max(1, byLine.size));
      return addLog(`判定：推車（每條線 ${pairs} 個 ${Math.round(dwell * 1000)} ms 短脈衝，成對出現）→ 不計入人次`, 'warn');
    }
    const order = firsts.map((e) => '線' + (e.line + 1)).join(' → ');
    addLog(`判定：1 人（停留約 ${Math.round(dwell * 1000)} ms），方向＝進入（${order}）→ 人次 +1`, 'ok');
  }
  document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => startDemo(b.dataset.demo)));

  function drawWave() {
    const tk = tokens();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = wave.clientWidth || 600;
    const H = 170;
    if (wave.width !== Math.round(W * dpr)) wave.width = Math.round(W * dpr);
    wave.height = Math.round(H * dpr);
    wave.style.height = H + 'px';
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, W, H);
    const n = lines.length;
    const rowH = (H - 16) / n;
    const pad = 44;
    wctx.font = `11px ${tk.font}`;
    wctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const y0 = 8 + rowH * (i + 0.5);
      wctx.strokeStyle = tk.grid;
      wctx.lineWidth = 1;
      wctx.beginPath();
      wctx.moveTo(pad, y0);
      wctx.lineTo(W - 6, y0);
      wctx.stroke();
      wctx.fillStyle = tk.muted;
      wctx.textAlign = 'right';
      wctx.fillText('線' + (i + 1), pad - 8, y0);
      // 門檻
      wctx.save();
      wctx.setLineDash([4, 4]);
      wctx.strokeStyle = tk.accent2;
      wctx.globalAlpha = 0.6;
      wctx.beginPath();
      const yt = y0 - THRESH * rowH * 0.9;
      wctx.moveTo(pad, yt);
      wctx.lineTo(W - 6, yt);
      wctx.stroke();
      wctx.restore();
      const h = hist[i];
      if (h.length < 2) continue;
      const tEnd = state.demoT;
      wctx.strokeStyle = tk.data;
      wctx.lineWidth = 2;
      wctx.lineJoin = 'round';
      wctx.beginPath();
      h.forEach(([t, val], k) => {
        const x = pad + ((t - (tEnd - WINDOW_S)) / WINDOW_S) * (W - pad - 6);
        const y = y0 - Math.max(-1, Math.min(1.2, val)) * rowH * 0.9;
        k ? wctx.lineTo(x, y) : wctx.moveTo(x, y);
      });
      wctx.stroke();
    }
    for (const e of events) {
      const x = pad + ((e.t - (state.demoT - WINDOW_S)) / WINDOW_S) * (W - pad - 6);
      if (x < pad) continue;
      const y0 = 8 + rowH * (e.line + 0.5);
      wctx.fillStyle = tk.accent2;
      wctx.beginPath();
      wctx.arc(x, y0 - THRESH * rowH * 0.9, 4, 0, Math.PI * 2);
      wctx.fill();
    }
  }
  new ResizeObserver(drawWave).observe(wave);
  addEventListener('themechange', drawWave);

  function stepDemo(dt) {
    const kind = state.demo;
    const t0 = state.demoT;
    state.demoT += dt;
    const sub = 4;
    for (let k = 1; k <= sub; k++) {
      const t = t0 + (dt * k) / sub;
      const f = forces(kind, t);
      const a = HPF_RC / (HPF_RC + dt / sub);
      f.forEach((fv, i) => {
        const s = vState[i];
        s.v = a * (s.v + fv - s.f);
        s.f = fv;
        // 沖洗：水柱持續衝擊＋熱電漂移 → 所有線同時出現長時間的高訊號
        const vv = kind === 'wash' ? (t > 0.4 && t < 2.4 ? 0.34 + 0.08 * Math.sin(t * 37 + i * 2) : 0) + s.v * 0.3 : s.v;
        hist[i].push([t, vv]);
        if (!s.above && vv > THRESH) {
          s.above = true;
          s.since = t;
          events.push({ line: i, t });
          addLog(`${stamp(t)}  線${i + 1} 超過門檻 → 模組醒來 3 ms，記一筆`);
        } else if (s.above && vv < THRESH * 0.4) {
          s.above = false;
          const e = [...events].reverse().find((x) => x.line === i && x.dur === undefined);
          if (e) e.dur = t - s.since;
        }
        mat.setLineGlow(i, Math.max(0, Math.min(1, vv)));
      });
    }
    for (const h of hist) while (h.length && h[0][0] < state.demoT - WINDOW_S) h.shift();
    // 視覺
    shoe.visible = kind === 'walk';
    cart.visible = kind === 'cart';
    spray.visible = kind === 'wash' && state.demoT > 0.4 && state.demoT < 2.4;
    const T = state.demoT;
    if (kind === 'walk') {
      const heel = lineX[0] - 0.035;
      const p = (T - 0.5) / 0.85;
      const down = T < 0.5 ? 0.12 * (1 - T / 0.5) : p > 1 ? Math.min(0.12, (p - 1) * 0.5) : 0;
      shoe.position.set(heel, matTop + down, 0.02);
      shoe.rotation.z = T < 0.5 ? 0.25 * (1 - T / 0.5) : p > 0.75 ? -Math.min(0.5, (p - 0.75) * 1.2) : 0;
      if (p > 0.75) shoe.position.x = heel + Math.min(0.2, (p - 0.75) * 0.3);
    } else if (kind === 'cart') {
      cart.position.set(lineX[0] - 0.35 + 0.75 * T, matTop - 0.023, 0);
    } else if (kind === 'wash') {
      spray.position.set(lineX[0] + 0.1 + Math.sin(T * 3) * 0.05, matTop + 0.05, 0.05);
    }
    if (state.demoT >= DEMOS[kind]) {
      events.forEach((e) => e.dur === undefined && (e.dur = state.demoT - e.t));
      classify(kind);
      state.demo = null;
      shoe.visible = cart.visible = spray.visible = false;
      lines.forEach((_, i) => mat.setLineGlow(i, 0));
      document.querySelectorAll('[data-demo]').forEach((b) => b.classList.remove('on'));
    }
    drawWave();
  }

  // ---------- 安裝步驟 ----------
  const stepLabel = document.getElementById('stepLabel');
  const stepCap = document.getElementById('stepCap');
  function applyStep(i) {
    if (state.step < 0) log.innerHTML = '';
    state.step = i;
    const s = STEPS[i];
    mat.setXray(false);
    mat.focus(null);
    state.target = 0;
    state.liftT = s.lift;
    state.modT = s.module ? 0 : -0.07;
    mat.groups.pit.visible = s.pit;
    mat.groups.wire.visible = s.wires;
    mat.groups.nfc.visible = s.nfc;
    for (const ln of lines) {
      ln.carrier.material = s.strips ? mat.mats.carrier : mat.mats.base;
      ln.film.visible = s.strips;
    }
    if (s.pair) state.pairUntil = performance.now() + 2400;
    stepLabel.textContent = `安裝步驟 ${i + 1}／${STEPS.length}　${s.t}`;
    stepCap.textContent = s.cap;
    cards.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
    const lifted = s.lift > 0;
    v.flyTo(lifted ? [0.5, 0.42, 0.55] : s.module ? [info.module.x1 + 0.3, 0.3, info.module.zc + 0.42] : [0.55, 0.45, 0.62], lifted ? [0, 0.06, 0] : s.module ? [info.module.x0, 0.01, info.module.zc - 0.05] : [0, 0.012, 0], 900);
  }
  function endInstall() {
    if (state.step < 0) return;
    state.step = -1;
    state.liftT = 0;
    state.modT = 0;
    for (const k of ['pit', 'wire', 'nfc']) mat.groups[k].visible = true;
    for (const ln of lines) {
      ln.carrier.material = mat.mats.carrier;
      ln.film.visible = true;
    }
    stepLabel.textContent = '安裝步驟';
    stepCap.textContent = '按 ▶ 看一個既有案場怎麼改裝（新案在工廠就先做好）。';
  }
  document.getElementById('install').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const next = Math.max(0, Math.min(STEPS.length - 1, (state.step < 0 ? -1 : state.step) + Number(b.dataset.step)));
    applyStep(next);
  });

  const bodyGroups = ['insert', 'alu', 'link', 'base', 'sensor', 'nfc'];
  v.onFrame((dt, now) => {
    const k = 1 - Math.pow(0.002, dt);
    state.explode += (state.target - state.explode) * k;
    state.lift += (state.liftT - state.lift) * k;
    state.modY += (state.modT - state.modY) * k;
    mat.setExplode(state.explode);
    if (state.lift > 0.001 || state.step >= 0) for (const g of bodyGroups) mat.groups[g].position.y += state.lift * 0.14;
    mat.groups.module.position.y += state.modY;
    mat.groups.module.visible = state.step < 0 || state.modY > -0.065;
    const pairing = now < state.pairUntil;
    mat.setLed(pairing ? Math.sin(now / 90) > 0 : Math.sin(now / 450) > 0.7);
    if (state.demo) stepDemo(dt);
  });

  select('piezo', false);
  drawWave();
}
