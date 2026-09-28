import * as THREE from 'three';
import { createViewer } from './viewer.js';
import { buildMat } from '../mat/builder.js';
import { LAYOUTS, tileMaterial } from '../mat/materials.js';
import { mulberry32 } from '../sim/engine.js';

const MAT_W = 2.4; // 入口寬（Z）
const MAT_D = 1.5; // 行進方向（X）
const FACADE_X = 1.15;
const DOOR_HALF = 1.3;

function ringFloor(material, hole, outer, y0, y1) {
  // hole/outer: {x0,x1,z0,z1}
  const parts = [
    [outer.x0, outer.x1, outer.z0, hole.z0],
    [outer.x0, outer.x1, hole.z1, outer.z1],
    [outer.x0, hole.x0, hole.z0, hole.z1],
    [hole.x1, outer.x1, hole.z0, hole.z1],
  ];
  const g = new THREE.Group();
  for (const [x0, x1, z0, z1] of parts) {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2226';
  g.fillRect(0, 0, 1024, 192);
  g.fillStyle = '#ffffff';
  g.font = '700 84px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.textBaseline = 'middle';
  g.fillText('A 棟商辦', 48, 96);
  g.fillStyle = '#34b28a';
  g.font = '600 40px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.fillText('易潔寶 Smart Entrance', 520, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CLOTHES = ['#2f4858', '#6b4f3a', '#3d5a80', '#8d99ae', '#5c677d', '#7a4e6b', '#33415c', '#9c6644', '#495057', '#2b9348'];

function makePerson(color, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  body.position.y = 1.1;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: opts.skin || '#d9b49a', roughness: 0.7 }));
  head.position.y = 1.62;
  head.castShadow = true;
  const legMat = new THREE.MeshStandardMaterial({ color: opts.legs || '#2a2d33', roughness: 0.8 });
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.82, s * 0.08);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.62, 4, 8), legMat);
    leg.position.y = -0.4;
    leg.castShadow = true;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  g.add(body, head);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), new THREE.MeshStandardMaterial({ color: opts.cap }));
    cap.position.y = 1.72;
    g.add(cap);
  }
  g.userData = { legs, body };
  return g;
}

export function initEntranceScene() {
  const el = document.getElementById('entranceViewer');
  const v = createViewer(el, {
    cameraPos: [-4.6, 3.0, 2.5],
    target: [0.3, 0.35, 0],
    fov: 38,
    maxDistance: 14,
    minDistance: 1.2,
    shadowExtent: 5,
    maxPolar: Math.PI * 0.47,
  });
  const scene = v.scene;
  v.sun.position.set(-3, 6, 3);
  const rand = mulberry32(99);

  // --- 地墊 ---
  const mat = buildMat({ widthM: MAT_W, depthM: MAT_D, layout: LAYOUTS.hotel.seq, floor: false, sensors: 'new', drain: false, cableSpacingM: 0.45 });
  scene.add(mat.root);
  const hx = mat.info.innerHalfX + 0.005;
  const hz = mat.info.innerHalfZ + 0.005;

  // --- 地坪：室外騎樓石材、室內拋光磚 ---
  const outside = tileMaterial('paver', 0.4, 36);
  const inside = tileMaterial('polished', 0.8, 18);
  scene.add(ringFloor(outside, { x0: -hx, x1: hx, z0: -hz, z1: hz }, { x0: -9, x1: FACADE_X, z0: -8, z1: 8 }, -0.08, 0.02));
  const inFloor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 16), inside);
  inFloor.position.set(FACADE_X + 4, -0.03, 0);
  inFloor.receiveShadow = true;
  scene.add(inFloor);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 0.08, hz * 2), new THREE.MeshStandardMaterial({ color: '#6d6b66', roughness: 1 }));
  pit.position.y = -0.04;
  scene.add(pit);

  // --- 建築立面 ---
  const wallMat = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2b3036', roughness: 0.5, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a9c7d6', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
  const add = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.25, 4, 8 - DOOR_HALF), wallMat, FACADE_X + 0.12, 2, -(DOOR_HALF + (8 - DOOR_HALF) / 2));
  add(new THREE.BoxGeometry(0.25, 4, 8 - DOOR_HALF), wallMat, FACADE_X + 0.12, 2, DOOR_HALF + (8 - DOOR_HALF) / 2);
  add(new THREE.BoxGeometry(0.25, 1.4, DOOR_HALF * 2), wallMat, FACADE_X + 0.12, 3.3, 0);
  // 招牌
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.4 }));
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(FACADE_X - 0.01, 3.1, 0);
  scene.add(sign);
  // 玻璃門（半開）
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 2.55, 0.05), darkMat, FACADE_X, 1.28, s * DOOR_HALF);
    const panel = add(new THREE.BoxGeometry(0.03, 2.5, 1.0), glassMat, FACADE_X + 0.05, 1.27, s * 1.55);
    panel.castShadow = false;
  }
  add(new THREE.BoxGeometry(0.05, 0.06, DOOR_HALF * 2), darkMat, FACADE_X, 2.57, 0);
  // 雨遮
  const canopy = add(new THREE.BoxGeometry(1.4, 0.1, DOOR_HALF * 2 + 1.2), darkMat, FACADE_X - 0.7, 3.95, 0);
  canopy.castShadow = false;
  // 室內燈
  const lobby = new THREE.PointLight('#ffd9a8', 0, 12, 1.6);
  lobby.position.set(FACADE_X + 2.5, 3, 0);
  scene.add(lobby);
  const canopyLight = new THREE.PointLight('#fff1d6', 0, 8, 1.8);
  canopyLight.position.set(-0.2, 3.8, 0);
  scene.add(canopyLight);
  // 警報燈
  const alarm = new THREE.PointLight('#ff2d2d', 0, 9, 1.5);
  alarm.position.set(FACADE_X - 0.3, 2.9, 0);
  scene.add(alarm);
  const alarmBulb = add(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshStandardMaterial({ color: '#661111', emissive: '#ff2d2d', emissiveIntensity: 0 }), FACADE_X - 0.05, 2.75, -0.9);

  // 小心地滑 A 字警示牌
  const wc = document.createElement('canvas');
  wc.width = 128;
  wc.height = 224;
  const wg = wc.getContext('2d');
  wg.fillStyle = '#f5c518';
  wg.fillRect(0, 0, 128, 224);
  wg.fillStyle = '#111';
  wg.beginPath();
  wg.moveTo(64, 26);
  wg.lineTo(112, 110);
  wg.lineTo(16, 110);
  wg.closePath();
  wg.fill();
  wg.fillStyle = '#f5c518';
  wg.font = '700 54px sans-serif';
  wg.textAlign = 'center';
  wg.fillText('!', 64, 102);
  wg.fillStyle = '#111';
  wg.font = '700 26px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  wg.fillText('小心', 64, 150);
  wg.fillText('地滑', 64, 184);
  const wTex = new THREE.CanvasTexture(wc);
  wTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.5 });
  const wetSign = new THREE.Group();
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.62, 0.34), [edgeMat, edgeMat, edgeMat, edgeMat, edgeMat, edgeMat]);
    panel.material[s > 0 ? 0 : 1] = signMat;
    panel.position.set(s * 0.1, 0.3, 0);
    panel.rotation.z = s * 0.32;
    panel.castShadow = true;
    wetSign.add(panel);
  }
  wetSign.position.set(-hx - 0.35, 0.02, 0.8);
  wetSign.visible = false;
  scene.add(wetSign);

  // 清潔人員（接單後出現在地墊旁）
  const cleaner = makePerson('#0f6e56', { cap: '#0f6e56', legs: '#1f2a2e' });
  cleaner.position.set(0.1, 0, hz + 0.35);
  cleaner.visible = false;
  scene.add(cleaner);

  // --- 壓力熱圖（踩踏時亮起） ---
  const HC = document.createElement('canvas');
  HC.width = 192;
  HC.height = Math.round((192 * hz) / hx);
  const hg = HC.getContext('2d');
  hg.fillStyle = '#000';
  hg.fillRect(0, 0, HC.width, HC.height);
  const heatTex = new THREE.CanvasTexture(HC);
  const heat = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2, hz * 2),
    new THREE.MeshBasicMaterial({ map: heatTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  heat.rotation.x = -Math.PI / 2;
  heat.position.y = 0.0245;
  scene.add(heat);
  function stamp(x, z, strength = 1) {
    const u = ((x + hx) / (2 * hx)) * HC.width;
    const vv = ((z + hz) / (2 * hz)) * HC.height;
    const r = 11;
    const grd = hg.createRadialGradient(u, vv, 0, u, vv, r);
    grd.addColorStop(0, `rgba(255,170,60,${0.95 * strength})`);
    grd.addColorStop(0.5, `rgba(240,90,30,${0.5 * strength})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    hg.globalCompositeOperation = 'lighter';
    hg.fillStyle = grd;
    hg.beginPath();
    hg.ellipse(u, vv, r, r * 0.6, 0, 0, Math.PI * 2);
    hg.fill();
    hg.globalCompositeOperation = 'source-over';
  }

  // --- 雨 ---
  const DROPS = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(DROPS * 6);
  for (let i = 0; i < DROPS; i++) {
    const x = -9 + rand() * 7.3;
    const y = rand() * 6;
    const z = -8 + rand() * 16;
    rp.set([x, y, z, x + 0.02, y + 0.28, z], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b8c9d9', transparent: true, opacity: 0.55 }));
  rain.visible = false;
  scene.add(rain);

  // --- 行人 ---
  const walkers = [];
  const pool = [];
  function spawn(kind = 'normal') {
    let p = pool.pop();
    const color = kind === 'intruder' ? '#3a0d0d' : CLOTHES[Math.floor(rand() * CLOTHES.length)];
    if (!p) p = makePerson(color);
    else p.userData.body.material.color.set(color);
    const enter = kind === 'intruder' ? true : rand() < 0.62;
    const dir = enter ? 1 : -1;
    const lane = (rand() - 0.5) * 1.8;
    const zStart = enter ? lane + (rand() - 0.5) * 3 : lane;
    p.position.set(kind === 'intruder' ? -3.2 : enter ? -7 : FACADE_X + 5, 0.02, kind === 'intruder' ? 0.2 : zStart);
    const w = {
      obj: p,
      dir,
      lane,
      speed: kind === 'intruder' ? 0.7 : 1.15 + rand() * 0.4,
      phase: rand() * 6,
      lastStep: 0,
      foot: 1,
      kind,
    };
    p.visible = true;
    scene.add(p);
    walkers.push(w);
  }

  let pending = 0;
  let sinceSpawn = 0;
  const MAX_WALKERS = 14;
  let rainy = false;
  let dayLevel = 1;
  let xray = false;
  let alarmOn = false;

  const skyDay = new THREE.Color('#dfe9f0');
  const skyRain = new THREE.Color('#9aa8b3');
  const skyNight = new THREE.Color('#0c1320');
  const bg = new THREE.Color();
  scene.fog = new THREE.Fog('#dfe9f0', 12, 30);

  v.onFrame((dt, now) => {
    // 熱圖衰減
    hg.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 2.2)})`;
    hg.fillRect(0, 0, HC.width, HC.height);

    // 生成行人
    sinceSpawn += dt;
    if (pending > 0 && walkers.length < MAX_WALKERS && sinceSpawn > 0.28) {
      spawn();
      pending--;
      sinceSpawn = 0;
    }

    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i];
      const p = w.obj.position;
      p.x += w.dir * w.speed * dt;
      // 走向門口：z 逐漸收斂到走道內
      const toDoor = Math.max(0, Math.min(1, (p.x + 3) / 2.5));
      const targetZ = w.dir > 0 ? w.lane : w.lane;
      p.z += (targetZ - p.z) * Math.min(1, dt * (0.6 + toDoor));
      w.phase += dt * w.speed * 5.2;
      const swing = Math.sin(w.phase) * 0.42;
      w.obj.userData.legs[0].rotation.z = swing * w.dir * -1;
      w.obj.userData.legs[1].rotation.z = -swing * w.dir * -1;
      w.obj.userData.body.position.y = 1.1 + Math.abs(Math.cos(w.phase)) * 0.025;
      // 腳步落地
      const stepIdx = Math.floor(w.phase / Math.PI);
      if (stepIdx !== w.lastStep) {
        w.lastStep = stepIdx;
        w.foot *= -1;
        if (Math.abs(p.x) < hx && Math.abs(p.z) < hz) stamp(p.x + w.dir * 0.12, p.z + w.foot * 0.09, w.kind === 'intruder' ? 1.3 : 1);
      }
      const gone = w.dir > 0 ? p.x > FACADE_X + 5.5 : p.x < -7.5;
      if (gone) {
        scene.remove(w.obj);
        pool.push(w.obj);
        walkers.splice(i, 1);
      }
    }
    heatTex.needsUpdate = true;

    // 雨
    if (rain.visible) {
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < DROPS; i++) {
        const o = i * 6;
        let y = a[o + 1] - dt * 9;
        if (y < 0) y += 6;
        a[o + 1] = y;
        a[o + 4] = y + 0.28;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // 警報燈閃爍
    const blink = alarmOn && Math.sin(now / 110) > 0;
    alarm.intensity = blink ? 18 : 0;
    alarmBulb.material.emissiveIntensity = blink ? 3 : 0;
    mat.setLed(Math.sin(now / 500) > 0.7);
  });

  function applyLight() {
    const d = dayLevel * (rainy ? 0.72 : 1);
    v.sun.intensity = 0.15 + 2.3 * d;
    v.hemi.intensity = 0.15 + 0.6 * d;
    scene.environmentIntensity = 0.2 + 0.7 * dayLevel;
    lobby.intensity = (1 - dayLevel) * 25 + 4;
    canopyLight.intensity = (1 - dayLevel) * 8;
    bg.copy(rainy ? skyRain : skyDay).lerp(skyNight, 1 - dayLevel);
    scene.background = bg;
    scene.fog.color.copy(bg);
    outside.roughness = rainy ? 0.25 : 0.9;
  }
  applyLight();

  return {
    viewer: v,
    /** 模擬引擎回報新進人次 */
    addArrivals(n) {
      pending = Math.min(24, pending + n);
    },
    intruder() {
      spawn('intruder');
    },
    clearCrowd() {
      pending = 0;
    },
    setRain(on) {
      rainy = on;
      rain.visible = on;
      applyLight();
    },
    /** hour 0..24 */
    setHour(h) {
      const up = THREE.MathUtils.smoothstep(h, 5.5, 7);
      const down = 1 - THREE.MathUtils.smoothstep(h, 17.5, 19);
      const lvl = Math.min(up, down);
      if (Math.abs(lvl - dayLevel) > 0.01) {
        dayLevel = lvl;
        applyLight();
      }
    },
    setDirt(pct) {
      mat.setDirt(Math.min(1, pct / 100));
      mat.setSand(Math.max(0.3, (pct / 100) * 12));
    },
    setXray(on) {
      xray = on;
      mat.setXray(on);
      return xray;
    },
    setAlarm(on) {
      alarmOn = on;
    },
    setCleaner(on) {
      cleaner.visible = on;
    },
    setWetSign(on) {
      wetSign.visible = on;
    },
  };
}
