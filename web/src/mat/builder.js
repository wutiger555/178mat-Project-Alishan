import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from './materials.js';

// 易潔寶 玉山 ES302 尺寸（mm），來源：ES302 規格表、178mat-4-BLOCK 施工大樣圖
export const ES302 = {
  slatWidth: 30, // 鋁條寬
  aluTop: 18, // 鋁條高（含避震底座）
  matTop: 23, // 地墊高（含面材）
  pitDepth: 20, // 嵌入式凹槽深
  baseH: 3, // PVC 避震底座
  spacerOptions: [3, 4, 5], // 排砂縫墊圈
  cableSpacing: [300, 600], // 鋼索間隔
  frameH: 30, // 實心鋁合金邊框高
  frameT: 5,
  frameFlange: 6,
  maxUnit: 4500, // 單元最長
};

const mm = (v) => v / 1000;

function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

function cylX(x0, x1, y, z, r, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
}

function cylY(x, y0, y1, z, r, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}

function meshOf(geoms, material, name) {
  if (!geoms.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geoms, false), material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  geoms.forEach((g) => g.dispose());
  return m;
}

/**
 * 產生一組完整的嵌入式除泥地墊（含凹槽、邊框、感測器）。
 * 座標：公尺；X = 行進方向（深），Z = 鋁條長度方向（入口寬），y=0 為凹槽底。
 */
export function buildMat(opts = {}) {
  const o = {
    widthM: 0.6,
    depthM: 0.5,
    spacerMm: 5,
    layout: M.LAYOUTS.photo.seq,
    cableSpacingM: 0.3,
    floor: true,
    floorMargin: 0.18,
    floorTone: 'stone',
    sensors: 'new', // new（新案：壓電條＋荷重元）| retrofit（改裝：壓電條＋ToF）| none
    drain: true,
    ...opts,
  };
  const root = new THREE.Group();
  root.name = 'mat';

  const s = o.spacerMm;
  const pitch = ES302.slatWidth + s;
  const inner = o.depthM * 1000 - 8; // 扣掉邊框間隙
  const n = Math.max(3, Math.floor((inner + s) / pitch));
  const matDepth = n * ES302.slatWidth + (n - 1) * s; // mm
  const L = o.widthM * 1000 - 8; // 鋁條長 mm
  const x0 = -matDepth / 2;
  const centers = [];
  for (let i = 0; i < n; i++) centers.push(x0 + i * pitch + ES302.slatWidth / 2);

  const groups = {};
  const mk = (key) => {
    const g = new THREE.Group();
    g.name = key;
    root.add(g);
    groups[key] = g;
    return g;
  };
  const gInsert = mk('insert');
  const gAlu = mk('alu');
  const gLink = mk('link');
  const gBase = mk('base');
  const gSensor = mk('sensor');
  const gModule = mk('module');
  const gStatic = mk('static');

  const z0 = mm(-L / 2);
  const z1 = mm(L / 2);

  // 鋁擠型骨架（6063-T5）：面板、嵌槽側唇、立柱、雙腳底座
  const alu = [];
  const baseGeo = [];
  const retrofitIdx = new Set([1, n - 2]);
  for (const [i, c] of centers.entries()) {
    const X = (a) => mm(c + a);
    alu.push(box(X(-15), X(15), mm(12), mm(14.5), z0, z1));
    alu.push(box(X(-15), X(-13.5), mm(14.5), mm(18), z0, z1));
    alu.push(box(X(13.5), X(15), mm(14.5), mm(18), z0, z1));
    alu.push(box(X(-9.6), X(-8.4), mm(4.2), mm(12), z0, z1));
    alu.push(box(X(8.4), X(9.6), mm(4.2), mm(12), z0, z1));
    alu.push(box(X(-14), X(-4), mm(3), mm(4.2), z0, z1));
    alu.push(box(X(4), X(14), mm(3), mm(4.2), z0, z1));
    const isSensor = o.sensors !== 'none' && retrofitIdx.has(i);
    if (!isSensor) {
      baseGeo.push(box(X(-13), X(-5), 0, mm(3), z0, z1));
      baseGeo.push(box(X(5), X(13), 0, mm(3), z0, z1));
    }
  }
  const aluMat = M.aluminumMaterial();
  gAlu.add(meshOf(alu, aluMat, 'alu'));
  const baseMat = M.pvcBaseMaterial();
  gBase.add(meshOf(baseGeo, baseMat, 'pvcBase'));

  // 316 不銹鋼索＋橡膠墊圈（排砂縫）＋ 304 埋帽螺母
  const cableZ = [];
  const cableCount = Math.max(2, Math.round(o.widthM / o.cableSpacingM) );
  for (let k = 0; k < cableCount; k++) cableZ.push(z0 + ((k + 0.5) / cableCount) * (z1 - z0));
  const cable = [];
  const spacer = [];
  const nuts = [];
  for (const z of cableZ) {
    cable.push(cylX(mm(x0 - 6), mm(-x0 + 6), mm(8.5), z, mm(2)));
    nuts.push(cylX(mm(x0 - 14), mm(x0 - 4), mm(8.5), z, mm(5), 6));
    nuts.push(cylX(mm(-x0 + 4), mm(-x0 + 14), mm(8.5), z, mm(5), 6));
    for (let i = 0; i < n - 1; i++) {
      const gx = centers[i] + 15;
      spacer.push(box(mm(gx), mm(gx + s), mm(4.5), mm(13), z - mm(8), z + mm(8)));
    }
  }
  gLink.add(meshOf(cable, M.steelMaterial(), 'cable'));
  gLink.add(meshOf(spacer, M.rubberMaterial(), 'spacer'));
  gLink.add(meshOf(nuts, M.steelMaterial(), 'nut'));

  // 面材（依配置方案輪替）
  const insertMaterials = new Map();
  function buildInserts(seq) {
    for (const child of [...gInsert.children]) {
      if (!child.isMesh || child.name === 'cap') continue;
      child.geometry.dispose();
      gInsert.remove(child);
    }
    const byKey = new Map();
    centers.forEach((c, i) => {
      const key = seq[i % seq.length];
      if (!byKey.has(key)) byKey.set(key, []);
      const top = M.FINISHES[key].kind === 'pvc' ? 21.5 : 22.8;
      byKey.get(key).push(box(mm(c - 13.3), mm(c + 13.3), mm(14.5), mm(top), z0, z1));
    });
    for (const [key, geoms] of byKey) {
      let mat = insertMaterials.get(key);
      if (!mat) {
        mat = M.finishMaterial(key, o.widthM);
        mat.userData.baseColor = mat.color.clone();
        insertMaterials.set(key, mat);
      }
      gInsert.add(meshOf(geoms, mat, 'insert-' + key));
    }
  }
  buildInserts(o.layout);

  // 邊框、凹槽、地坪
  const hx = matDepth / 2 + 4; // 凹槽內緣（mm）
  const hz = L / 2 + 4;
  const T = ES302.frameT;
  const frame = [
    box(mm(-hx - T), mm(hx + T), mm(-10), mm(20), mm(-hz - T), mm(-hz)),
    box(mm(-hx - T), mm(hx + T), mm(-10), mm(20), mm(hz), mm(hz + T)),
    box(mm(-hx - T), mm(-hx), mm(-10), mm(20), mm(-hz), mm(hz)),
    box(mm(hx), mm(hx + T), mm(-10), mm(20), mm(-hz), mm(hz)),
  ];
  const frameMesh = meshOf(frame, M.frameMaterial(), 'frame');
  gStatic.add(frameMesh);

  const concrete = M.concreteMaterial();
  let floorMat = null;
  let floorOX = 0;
  if (o.floor) {
    const fm = o.floorMargin;
    const ox = mm(hx + T) + fm;
    floorOX = ox;
    const oz = mm(hz + T) + fm;
    const slabBottom = -0.09;
    gStatic.add(meshOf([box(-ox, ox, slabBottom, 0, -oz, oz)], concrete, 'slab'));
    const hxT = mm(hx + T);
    const hzT = mm(hz + T);
    floorMat = M.tileMaterial(o.floorTone, 0.6, Math.max(2, Math.round((ox * 2) / 0.6)));
    const tiles = [
      box(-ox, ox, 0, mm(20), -oz, -hzT),
      box(-ox, ox, 0, mm(20), hzT, oz),
      box(-ox, -hxT, 0, mm(20), -hzT, hzT),
      box(hxT, ox, 0, mm(20), -hzT, hzT),
    ];
    gStatic.add(meshOf(tiles, floorMat, 'tiles'));
  }

  // 落水頭
  const dx = centers[Math.floor(n / 2)] + 17.5;
  if (o.drain) {
    const drain = [cylY(mm(dx), mm(-60), mm(0.8), 0, mm(28), 24)];
    const dm = new THREE.MeshStandardMaterial({ color: '#4c5058', metalness: 0.8, roughness: 0.4 });
    gStatic.add(meshOf(drain, dm, 'drain'));
  }

  // 積砂層（X 光模式可見）
  const sand = new THREE.Mesh(new THREE.BoxGeometry(mm(hx * 2), 1, mm(hz * 2)), M.sandMaterial());
  sand.name = 'sand';
  sand.position.y = 0;
  sand.visible = false;
  gStatic.add(sand);

  // Alishan Sense 感測層
  const sensorMat = M.sensorMaterial();
  const sensors = [];
  const cornerX = mm(hx - 40);
  const cornerZ = mm(hz - 40);
  if (o.sensors === 'new') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) sensors.push(cylY(sx * cornerX, mm(-4), mm(0.5), sz * cornerZ, mm(16)));
  }
  if (o.sensors !== 'none') {
    for (const i of retrofitIdx) {
      const c = centers[i];
      sensors.push(box(mm(c - 13), mm(c - 5), 0, mm(3), z0, z1));
      sensors.push(box(mm(c + 5), mm(c + 13), 0, mm(3), z0, z1));
    }
  }
  let probes = [];
  if (o.sensors !== 'none') {
    // 溫濕度／積水電極、ToF 積砂高度感測、排線
    probes.push(box(mm(-hx + 2), mm(-hx + 22), 0, mm(10), mm(hz - 30), mm(hz - 10)));
    probes.push(box(mm(hx - 14), mm(hx - 2), mm(4), mm(12), mm(-hz + 10), mm(-hz + 26)));
    probes.push(box(mm(-hx + 1), mm(hx - 1), 0, mm(1.5), mm(hz - 3), mm(hz - 1.5)));
    probes.push(box(mm(hx - 3), mm(hx - 1.5), 0, mm(1.5), mm(-hz + 20), mm(hz - 2)));
  }
  const sensorMesh = meshOf([...sensors, ...probes], sensorMat, 'sensors');
  if (sensorMesh) gSensor.add(sensorMesh);

  // 智慧模組：嵌在邊框端部的模組艙（鋰電池＋MCU＋RF），上蓋為非金屬天線窗，與地坪齊平
  const modX = mm(hx + T + 4);
  const modBody = box(modX, modX + mm(34), mm(-6), mm(17), mm(hz - 130), mm(hz - 10));
  const modCover = box(modX - mm(2), modX + mm(36), mm(17), mm(20), mm(hz - 132), mm(hz - 8));
  gModule.add(meshOf([modBody], M.moduleMaterial(), 'moduleBody'));
  const coverMat = new THREE.MeshStandardMaterial({ color: '#0f1113', roughness: 0.3, metalness: 0 });
  gModule.add(meshOf([modCover], coverMat, 'moduleCover'));
  const ledMat = new THREE.MeshStandardMaterial({ color: '#34d399', emissive: '#34d399', emissiveIntensity: 2 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(mm(2.5), 12, 8), ledMat);
  led.position.set(modX + mm(17), mm(20.3), mm(hz - 22));
  led.name = 'led';
  gModule.add(led);

  // 剖面填色（z=0 切面），模擬施工大樣圖的實心斷面
  const CAP_Z = -0.0003;
  const capMats = new Map();
  const capMat = (color) => {
    if (!capMats.has(color)) capMats.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    return capMats.get(color);
  };
  const caps = [];
  function rect(x0, x1, y0, y1) {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, CAP_Z);
    return g;
  }
  function addCaps(group, rects, color) {
    if (!rects.length) return;
    const m = new THREE.Mesh(mergeGeometries(rects, false), capMat(color));
    rects.forEach((g) => g.dispose());
    m.name = 'cap';
    m.visible = api?._section || false;
    group.add(m);
    caps.push(m);
  }
  function buildCaps(seq) {
    for (const m of caps.splice(0)) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    const aluR = [];
    const baseR = [];
    const sensR = [];
    const insR = new Map();
    centers.forEach((c, i) => {
      const X = (a) => mm(c + a);
      aluR.push(rect(X(-15), X(15), mm(12), mm(14.5)), rect(X(-15), X(-13.5), mm(14.5), mm(18)), rect(X(13.5), X(15), mm(14.5), mm(18)));
      aluR.push(rect(X(-9.6), X(-8.4), mm(4.2), mm(12)), rect(X(8.4), X(9.6), mm(4.2), mm(12)));
      aluR.push(rect(X(-14), X(-4), mm(3), mm(4.2)), rect(X(4), X(14), mm(3), mm(4.2)));
      const sensor = o.sensors !== 'none' && retrofitIdx.has(i);
      (sensor ? sensR : baseR).push(rect(X(-13), X(-5), 0, mm(3)), rect(X(5), X(13), 0, mm(3)));
      const key = seq[i % seq.length];
      const top = M.FINISHES[key].kind === 'pvc' ? 21.5 : 22.8;
      if (!insR.has(key)) insR.set(key, []);
      insR.get(key).push(rect(X(-13.3), X(13.3), mm(14.5), mm(top)));
    });
    addCaps(gAlu, aluR, '#c3c8cf');
    addCaps(gBase, baseR, '#3a3e44');
    addCaps(gSensor, sensR, '#15b8a6');
    for (const [key, r] of insR) addCaps(gInsert, r, M.FINISHES[key].mid);
    const st = [rect(mm(-hx - T), mm(-hx), mm(-10), mm(20)), rect(mm(hx), mm(hx + T), mm(-10), mm(20))];
    addCaps(gStatic, st, '#9aa0a8');
    if (o.floor) {
      addCaps(gStatic, [rect(-floorOX, floorOX, -0.09, 0)], '#a19d95');
      addCaps(gStatic, [rect(-floorOX, mm(-hx - T), 0, mm(20)), rect(mm(hx + T), floorOX, 0, mm(20))], '#ddd6ca');
    }
    if (o.drain) addCaps(gStatic, [rect(mm(dx - 28), mm(dx + 28), mm(-60), mm(0.8))], '#4c5058');
  }

  const info = {
    n,
    matDepth,
    L,
    pitch,
    centers: centers.map(mm),
    innerHalfX: mm(hx),
    innerHalfZ: mm(hz),
    cableCount,
    top: mm(ES302.matTop),
  };

  // 零件標籤錨點（跟著各群組一起移動）
  const c0 = mm(centers[0]);
  const zL = z0 + 0.06;
  const anchors = [
    { group: 'insert', text: '① 表面墊片', sub: '荷蘭毯條／PVC 膠條・可更換', pos: [c0, mm(23), z1 - 0.04] },
    { group: 'alu', text: '② 鋁擠型骨架', sub: '6063-T5・寬 30・高 18 mm', pos: [mm(centers[Math.floor(n / 2)]), mm(18), mm(-hz * 0.1)] },
    { group: 'link', text: '③ 316 不銹鋼索＋排砂縫墊圈', sub: `墊圈 ${s} mm・鋼索 ${cableCount} 道`, pos: [mm(-x0 + 10), mm(10), cableZ[cableZ.length - 1]] },
    { group: 'base', text: '④ PVC 避震底座', sub: '緩衝消音・排水透氣', pos: [mm(centers[n - 1]), mm(2), z0 + 0.03] },
    { group: 'sensor', text: '⑤ Alishan Sense 感測層', sub: '壓電底座條／荷重元／濕度／ToF', pos: [mm(centers[1]), mm(2), z0 + 0.03] },
    { group: 'module', text: '⑥ 智慧模組艙', sub: '電池・MCU・無線・天線窗', pos: [modX + mm(17), mm(20), mm(hz - 70)] },
    { group: 'static', text: '⑦ 實心鋁邊框＋凹槽', sub: '凹槽深 20 mm・與地坪齊平', pos: [mm(-hx - T), mm(20), 0] },
  ];

  const explodeOffsets = {
    insert: [0, 0.11, 0],
    alu: [0, 0.075, 0],
    link: [0, 0.05, 0],
    base: [0, 0.03, 0],
    sensor: [0, 0.012, 0],
    module: [0.05, 0.06, 0],
    static: [0, 0, 0],
  };
  const scale = Math.max(1, Math.min(o.widthM, o.depthM) / 0.5);

  var api = {
    root,
    groups,
    info,
    anchors,
    insertMaterials,
    setLayout(seq) {
      buildInserts(seq);
      buildCaps(seq);
      api.setDirt(api._dirt || 0);
      api.setXray(api._xray || false);
    },
    setExplode(e) {
      for (const [k, off] of Object.entries(explodeOffsets)) {
        groups[k].position.set(off[0] * e * scale, off[1] * e * scale, off[2] * e * scale);
      }
    },
    /** 0..1：毯面變髒（顏色往泥沙色偏） */
    setDirt(d) {
      api._dirt = d;
      const dirt = new THREE.Color('#8a6d4a');
      for (const mat of insertMaterials.values()) {
        mat.color.copy(new THREE.Color('#ffffff')).lerp(dirt, Math.min(0.75, d * 0.75));
      }
    },
    /** 積砂高度 mm（X 光模式時可見） */
    setSand(heightMm) {
      const h = Math.max(0.2, heightMm);
      sand.scale.y = mm(h);
      sand.position.y = mm(h) / 2;
    },
    setXray(on) {
      api._xray = on;
      sand.visible = on;
      const targets = [aluMat, baseMat, ...insertMaterials.values()];
      for (const m of targets) {
        m.transparent = on;
        m.opacity = on ? 0.18 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
      }
    },
    setSection(on) {
      api._section = on;
      caps.forEach((m) => (m.visible = on));
    },
    setLed(on) {
      ledMat.emissiveIntensity = on ? 2.5 : 0.2;
    },
    sensorMaterial: sensorMat,
    floorMaterial: floorMat,
    dispose() {
      root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            m.map?.dispose();
            m.bumpMap?.dispose();
            m.dispose();
          });
        }
      });
    },
  };
  buildCaps(o.layout);
  api.setSand(0.5);
  return api;
}
