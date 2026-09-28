import * as THREE from 'three';
import { createViewer } from './viewer.js';
import { buildMat, ES302 } from '../mat/builder.js';
import { FINISHES, FINISH_GROUPS, LAYOUTS } from '../mat/materials.js';

export function initProductViewer() {
  const el = document.getElementById('productViewer');
  const panel = document.getElementById('productPanel');
  const v = createViewer(el, { exposure: 0.95, envIntensity: 0.55, hemi: 0.35, sun: 1.7, cameraPos: [0.62, 0.5, 0.7], target: [0, 0.015, 0], shadowExtent: 0.8, maxDistance: 5 });
  v.renderer.localClippingEnabled = true;

  const state = { mode: 'assembled', layoutKey: 'photo', seq: LAYOUTS.photo.seq, w: 0.6, d: 0.5, explode: 0, target: 0 };
  let mat = null;
  let tags = [];
  let dimA = [];
  let dimB = [];
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.0905;
  ground.receiveShadow = true;
  v.scene.add(ground);

  function rebuild() {
    if (mat) {
      v.scene.remove(mat.root);
      mat.dispose();
    }
    mat = buildMat({ widthM: state.w, depthM: state.d, layout: state.seq, floorMargin: 0.12 });
    v.scene.add(mat.root);
    tags = mat.anchors.map((a) => {
      const obj = v.label(a.text, a.sub, ['sensor', 'pit', 'module'].includes(a.group) ? 'sensor' : '');
      obj.position.set(...a.pos);
      mat.groups[a.group].add(obj);
      return obj;
    });
    buildDimTags();
    mat.setExplode(state.explode);
    applyMode(false);
    updateSpecs();
  }

  function buildDimTags() {
    const i = mat.info;
    const c = i.centers;
    const mk = (text, sub, pos, cls = 'dim') => {
      const o = v.label(text, sub, cls);
      o.position.set(...pos);
      mat.root.add(o);
      return o;
    };
    const line = c[i.lineIdx[0]];
    dimA = [
      mk('鋁條寬 30 mm', '6063-T5 鋁擠型', [c[0] - 0.012, 0.032, 0]),
      mk('地墊高 23 mm', '含面材，與地坪齊平', [c[2] + 0.002, 0.032, 0]),
      mk('凹槽深 20 mm', '實心鋁邊框', [-i.innerHalfX - 0.03, -0.004, 0]),
      mk('壓電感測底座條', '中空 PVC 8×3 mm＋PVDF 膜 0.3 mm', [line - 0.004, -0.007, 0], 'sensor'),
      mk('電容電極條 8 mm', '在鋁條兩腳之間的隧道', [c[i.fpcIdx[0]] + 0.006, -0.012, 0], 'sensor'),
      mk('避震底座 3 mm', 'PVC・排水透氣', [c[3] + 0.004, -0.006, 0]),
    ];
    const m = i.module;
    const xm = (m.x0 + m.x1) / 2;
    dimB = [
      mk('非金屬天線窗 200×25 mm', 'ASA／UV 安定 PC-GF30，與地坪齊平', [xm - 0.01, 0.034, m.zc]),
      mk('灌膠電子艙', 'PU 灌封（-40～135°C）・LoRa 920 MHz', [m.x1 + 0.004, 0.012, m.zc], 'sensor'),
      mk('實心鋁邊框', '接頭穿框、電線走框內側', [i.innerHalfX - 0.01, -0.008, m.zc]),
      mk('鋁條與感測底座條', '地墊可以掀起，接頭不用拔', [c[c.length - 3], 0.03, m.zc]),
    ];
  }

  function applyMode(fly = true) {
    const secA = state.mode === 'section';
    const secB = state.mode === 'sectionB';
    state.target = state.mode === 'explode' ? 1 : 0;
    const zc = mat.info.module.zc;
    clip.constant = secB ? zc : 0;
    v.renderer.clippingPlanes = secA || secB ? [clip] : [];
    mat.setSection(secA ? 0 : secB ? zc : null);
    tags.forEach((t) => (t.visible = state.mode === 'explode'));
    dimA.forEach((t) => (t.visible = secA));
    dimB.forEach((t) => (t.visible = secB));
    if (!fly) return;
    const s = Math.max(state.w, state.d);
    if (secA) {
      const cx = -mat.info.innerHalfX + 0.06;
      v.flyTo([cx, 0.008, 0.22], [cx, 0.004, 0]);
    } else if (secB) {
      const cx = mat.info.innerHalfX + 0.005;
      v.flyTo([cx, 0.01, zc + 0.2], [cx, 0.006, zc]);
    } else if (state.mode === 'explode') v.flyTo([0.95 * s + 0.1, 0.8 * s + 0.12, 1.05 * s + 0.1], [0, 0.06, 0]);
    else v.flyTo([0.62 * s, 0.5 * s, 0.7 * s], [0, 0.015, 0]);
  }

  function updateSpecs() {
    const i = mat.info;
    const lenM = i.L / 1000;
    const weight = i.n * lenM * (0.389 + 0.2 + 0.05);
    const pieces = Math.max(Math.ceil(weight / 45), Math.ceil((lenM * 1000) / ES302.maxUnit));
    const rows = [
      ['鋁條', `${i.n} 條`],
      ['壓電感測線', `${i.lineIdx.length} 條（跨距 ${Math.round((i.centers[i.lineIdx.at(-1)] - i.centers[i.lineIdx[0]]) * 100)} cm）`],
      ['不銹鋼索', `${i.cableCount} 道`],
      ['面積', `${(state.w * state.d).toFixed(2)} m²`],
      ['預估重量', `${weight.toFixed(1)} kg`],
      ['分割', pieces > 1 ? `需分 ${pieces} 片（每片 ≤ 45 kg）` : '一片即可'],
      ['WELL／LEED 3 m', state.d >= 3 ? '符合' : `還差 ${(3 - state.d).toFixed(1)} m`],
    ];
    document.getElementById('matSpecs').innerHTML = rows.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('');
  }

  panel.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      panel.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
      state.mode = b.dataset.mode;
      applyMode();
    }),
  );

  const layoutBtns = document.getElementById('layoutBtns');
  const swatchBox = document.getElementById('finishSwatches');
  function markActive() {
    layoutBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layoutKey));
    swatchBox.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', state.layoutKey === 'single:' + b.dataset.finish));
  }
  for (const [key, l] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.dataset.layout = key;
    b.addEventListener('click', () => {
      state.layoutKey = key;
      state.seq = l.seq;
      mat.setLayout(state.seq);
      markActive();
    });
    layoutBtns.appendChild(b);
  }
  for (const g of FINISH_GROUPS) {
    const p = document.createElement('p');
    p.textContent = g.title;
    const row = document.createElement('div');
    row.className = 'swatches';
    for (const k of g.keys) {
      const f = FINISHES[k];
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.finish = k;
      b.title = f.name;
      b.setAttribute('aria-label', f.name);
      b.style.background =
        f.kind === 'pvc'
          ? `repeating-linear-gradient(90deg, ${f.base} 0 3px, ${f.fleck} 3px 5px)`
          : f.kind === 'stripe'
            ? `repeating-linear-gradient(90deg, ${f.base} 0 5px, ${f.mid} 5px 7px)`
            : `radial-gradient(circle at 30% 30%, ${f.fleck} 0 1.5px, transparent 2px) 0 0/7px 7px, ${f.base}`;
      b.addEventListener('click', () => {
        state.layoutKey = 'single:' + k;
        state.seq = [k];
        mat.setLayout(state.seq);
        markActive();
      });
      row.appendChild(b);
    }
    swatchBox.append(p, row);
  }
  markActive();

  const wIn = document.getElementById('wIn');
  const dIn = document.getElementById('dIn');
  let t;
  const onSize = () => {
    state.w = Number(wIn.value);
    state.d = Number(dIn.value);
    document.getElementById('wOut').textContent = state.w.toFixed(1) + ' m';
    document.getElementById('dOut').textContent = state.d.toFixed(1) + ' m';
    clearTimeout(t);
    t = setTimeout(() => {
      rebuild();
      applyMode();
    }, 120);
  };
  wIn.addEventListener('input', onSize);
  dIn.addEventListener('input', onSize);

  let idle = true;
  v.controls.addEventListener('start', () => (idle = false));
  v.onFrame((dt, now) => {
    const k = 1 - Math.pow(0.001, dt);
    state.explode += (state.target - state.explode) * k;
    if (Math.abs(state.target - state.explode) < 0.001) state.explode = state.target;
    mat.setExplode(state.explode);
    mat.setLed(Math.sin(now / 400) > 0.6);
    if (idle && !state.mode.startsWith('section')) {
      const p = v.camera.position;
      const a = dt * 0.12;
      const x = p.x * Math.cos(a) - p.z * Math.sin(a);
      p.z = p.x * Math.sin(a) + p.z * Math.cos(a);
      p.x = x;
    }
  });

  rebuild();
  return v;
}
