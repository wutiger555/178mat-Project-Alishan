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

// Alishan Sense 感測配置（mm），依研究結論：見 docs/07-感測器設計說明.md
export const SENSE = {
  filmMm: 0.3, // PVDF 壓電膜（28 µm）＋PET 層壓後總厚
  fpcW: 8, // 叉指電容電極條寬（放在鋁條兩腳之間的隧道）
  fpcL: 300,
  pinHeights: [1, 5, 10], // 積水電極針高度
  module: { w: 34, len: 200, bottom: -6, top: 17 }, // 模組艙（沿 Z 方向 200 mm）
  window: { len: 200, w: 25 }, // 非金屬天線窗
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

function cylZ(x, y, z0, z1, r, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
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
 * 哪幾支鋁條裝壓電感測底座條：
 * 線距交替 3、4 支（約 10.5／14 cm）→ 任何一步（腳印約 26 cm）都至少踩到一條；
 * 兩條一組可判斷方向（腳跟先到後線）。
 */
export function sensorLineIndices(n) {
  const out = [];
  let i = 1;
  let k = 0;
  while (i <= n - 2) {
    out.push(i);
    i += k++ % 2 === 0 ? 3 : 4;
  }
  return out;
}

function idePattern() {
  // 叉指電極（聚醯亞胺基材上的銅指）紋理
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b87a22';
  g.fillRect(0, 0, 32, 128);
  g.fillStyle = '#e9b86a';
  g.fillRect(2, 0, 3, 128);
  g.fillRect(27, 0, 3, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillRect(y % 16 === 0 ? 2 : 8, y, 22, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 產生一組完整的嵌入式除泥地墊（含凹槽、邊框、Alishan Sense 感測器）。
 * 座標：公尺；X = 行進方向（深，入口在 -X 側），Z = 鋁條長度方向（入口寬），y=0 為凹槽底。
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
    sensors: true,
    drain: true,
    ...opts,
  };
  const root = new THREE.Group();
  root.name = 'mat';

  const s = o.spacerMm;
  const pitch = ES302.slatWidth + s;
  const inner = o.depthM * 1000 - 8;
  const n = Math.max(3, Math.floor((inner + s) / pitch));
  const matDepth = n * ES302.slatWidth + (n - 1) * s; // mm
  const L = o.widthM * 1000 - 8; // 鋁條長 mm
  const x0 = -matDepth / 2;
  const centers = [];
  for (let i = 0; i < n; i++) centers.push(x0 + i * pitch + ES302.slatWidth / 2);
  const lineIdx = o.sensors ? sensorLineIndices(n) : [];
  const lineSet = new Set(lineIdx);
  const fpcIdx = o.sensors ? [Math.min(n - 1, 2), Math.min(n - 1, 6)].filter((v, i, a) => a.indexOf(v) === i) : [];
  const pinIdx = o.sensors ? Math.min(n - 1, Math.max(0, Math.floor(n / 2))) : -1;

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
  const gSensor = mk('sensor'); // 壓電感測底座條
  const gPit = mk('pit'); // 凹槽內：電容電極、積水電極
  const gWire = mk('wire');
  const gNfc = mk('nfc');
  const gModule = mk('module');
  const gStatic = mk('static');

  const z0 = mm(-L / 2);
  const z1 = mm(L / 2);

  // 鋁擠型骨架（6063-T5）：面板、嵌槽側唇、立柱、雙腳底座
  const alu = [];
  const baseGeo = [];
  for (const [i, c] of centers.entries()) {
    const X = (a) => mm(c + a);
    alu.push(box(X(-15), X(15), mm(12), mm(14.5), z0, z1));
    alu.push(box(X(-15), X(-13.5), mm(14.5), mm(18), z0, z1));
    alu.push(box(X(13.5), X(15), mm(14.5), mm(18), z0, z1));
    alu.push(box(X(-9.6), X(-8.4), mm(4.2), mm(12), z0, z1));
    alu.push(box(X(8.4), X(9.6), mm(4.2), mm(12), z0, z1));
    alu.push(box(X(-14), X(-4), mm(3), mm(4.2), z0, z1));
    alu.push(box(X(4), X(14), mm(3), mm(4.2), z0, z1));
    // 入口側（-X）底座：有裝感測線的鋁條，這條換成感測底座條
    if (!lineSet.has(i)) baseGeo.push(box(X(-13), X(-5), 0, mm(3), z0, z1));
    baseGeo.push(box(X(5), X(13), 0, mm(3), z0, z1));
  }
  const aluMat = M.aluminumMaterial();
  gAlu.add(meshOf(alu, aluMat, 'alu'));
  const baseMat = M.pvcBaseMaterial();
  gBase.add(meshOf(baseGeo, baseMat, 'pvcBase'));
  const mats = { base: baseMat };

  // 316 不銹鋼索＋橡膠墊圈（排砂縫）＋ 304 埋帽螺母
  const cableZ = [];
  const cableCount = Math.max(2, Math.round(o.widthM / o.cableSpacingM));
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
  const steelMat = M.steelMaterial();
  gLink.add(meshOf(cable, steelMat, 'cable'));
  gLink.add(meshOf(spacer, M.rubberMaterial(), 'spacer'));
  gLink.add(meshOf(nuts, steelMat, 'nut'));

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
  const frameMat = M.frameMaterial();
  gStatic.add(meshOf(frame, frameMat, 'frame'));

  // 模組艙位置：+X 側邊框外、靠 +Z 端，上蓋與地坪齊平
  const MD = SENSE.module;
  const modLen = Math.min(MD.len, L - 40);
  const mx0 = hx + T + 3;
  const mx1 = mx0 + MD.w;
  const mz1 = hz - 10;
  const mz0 = mz1 - modLen;
  const modInfo = { x0: mm(mx0), x1: mm(mx1), z0: mm(mz0), z1: mm(mz1), zc: mm((mz0 + mz1) / 2) };

  const concrete = M.concreteMaterial();
  let floorMat = null;
  let floorOX = 0;
  const hxT = mm(hx + T);
  const hzT = mm(hz + T);
  if (o.floor) {
    const ox = hxT + o.floorMargin;
    const oz = hzT + o.floorMargin;
    floorOX = ox;
    gStatic.add(meshOf([box(-ox, ox, -0.09, 0, -oz, oz)], concrete, 'slab'));
    floorMat = M.tileMaterial(o.floorTone, 0.6, Math.max(2, Math.round((ox * 2) / 0.6)));
    const tiles = [
      box(-ox, ox, 0, mm(20), -oz, -hzT),
      box(-ox, ox, 0, mm(20), hzT, oz),
      box(-ox, -hxT, 0, mm(20), -hzT, hzT),
    ];
    if (o.sensors) {
      // +X 側地磚挖出模組艙的位置
      tiles.push(box(hxT, modInfo.x0, 0, mm(20), -hzT, hzT));
      tiles.push(box(modInfo.x1, ox, 0, mm(20), -hzT, hzT));
      tiles.push(box(modInfo.x0, modInfo.x1, 0, mm(20), -hzT, modInfo.z0));
      tiles.push(box(modInfo.x0, modInfo.x1, 0, mm(20), modInfo.z1, hzT));
    } else tiles.push(box(hxT, ox, 0, mm(20), -hzT, hzT));
    gStatic.add(meshOf(tiles, floorMat, 'tiles'));
  }

  // 落水頭
  const dx = centers[Math.floor(n / 2)] + 17.5;
  if (o.drain) {
    const dm = new THREE.MeshStandardMaterial({ color: '#4c5058', metalness: 0.8, roughness: 0.4 });
    gStatic.add(meshOf([cylY(mm(dx), mm(-60), mm(0.8), mm(-hz * 0.45), mm(28), 24)], dm, 'drain'));
  }

  // 積砂層（X 光模式可見）
  const sand = new THREE.Mesh(new THREE.BoxGeometry(mm(hx * 2), 1, mm(hz * 2)), M.sandMaterial());
  sand.name = 'sand';
  sand.visible = false;
  gStatic.add(sand);

  // ---------------- Alishan Sense ----------------
  const lines = [];
  if (o.sensors) {
    // ① 壓電感測底座條：中空 PVC 擠型（外形與原底座相同 8×3 mm），內槽滑入 PVDF 膜
    mats.carrier = new THREE.MeshStandardMaterial({ color: '#2e7d74', roughness: 0.6 });
    for (const i of lineIdx) {
      const c = centers[i];
      const film = new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.6, roughness: 0.35, emissive: '#ff8a1f', emissiveIntensity: 0 });
      const carrier = new THREE.Mesh(box(mm(c - 13), mm(c - 5), 0, mm(3), z0, z1), mats.carrier);
      carrier.name = 'carrier';
      const filmMesh = new THREE.Mesh(box(mm(c - 12.6), mm(c - 5.4), mm(1.2), mm(1.2 + 0.6), z0 + 0.004, z1 - 0.004), film);
      filmMesh.name = 'film';
      // 引線：沿鋁條端頭拉到 +Z 端
      gSensor.add(carrier, filmMesh);
      lines.push({ index: i, x: mm(c - 9), film, carrier });
    }

    // ② 叉指電容電極條（FPC）：放在鋁條兩腳之間的隧道，量 0–5 mm 薄層積砂
    const ideTex = idePattern();
    ideTex.repeat.set(1, SENSE.fpcL / 30);
    mats.fpc = new THREE.MeshStandardMaterial({ map: ideTex, roughness: 0.5, metalness: 0.3 });
    const fpcLen = Math.min(SENSE.fpcL, L - 40);
    const fpc = fpcIdx.map((i) => box(mm(centers[i] - SENSE.fpcW / 2), mm(centers[i] + SENSE.fpcW / 2), 0, mm(0.5), mm(-fpcLen / 2), mm(fpcLen / 2)));
    gPit.add(meshOf(fpc, mats.fpc, 'fpc'));

    // ③ 積水電極：316 不鏽鋼針，1／5／10 mm 三段高度
    mats.pin = new THREE.MeshStandardMaterial({ color: '#e6ebf0', metalness: 1, roughness: 0.18 });
    mats.pinBase = new THREE.MeshStandardMaterial({ color: '#b87a22', roughness: 0.5 });
    const pc = centers[pinIdx];
    const pz = mm(fpcLen / 2 + 25);
    const pins = SENSE.pinHeights.map((h, k) => cylY(mm(pc), 0, mm(h), pz + mm((k - 1) * 12), mm(0.9), 12));
    gPit.add(meshOf(pins, mats.pin, 'pins'));
    gPit.add(meshOf([box(mm(pc - 4), mm(pc + 4), 0, mm(0.5), pz - mm(20), pz + mm(20))], mats.pinBase, 'pinBase'));

    // ④ NFC 金屬面標籤：鋁條端頭（列 ID）
    mats.nfc = new THREE.MeshStandardMaterial({ color: '#1f5fbf', roughness: 0.4, emissive: '#1f5fbf', emissiveIntensity: 0.25 });
    const nfc = [0, Math.floor(n / 2), n - 1].map((i) => {
      const g = new THREE.CylinderGeometry(mm(6), mm(6), mm(1), 20);
      g.rotateX(Math.PI / 2);
      g.translate(mm(centers[i]), mm(8), z1 + mm(0.6));
      return g;
    });
    gNfc.add(meshOf(nfc, mats.nfc, 'nfcRow'));

    // 排線：每條感測線 → 沿 +Z 端走到模組艙接頭（不鏽鋼編織套管）
    mats.wire = new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.7, roughness: 0.4 });
    const wireGeo = [];
    const zw = z1 + mm(2.5);
    const connX = mm(hx - 2);
    const connZ = modInfo.zc;
    lines.forEach((ln, k) => {
      const y = mm(1.2 + k * 0.25);
      const pts = [new THREE.Vector3(ln.x, y, z1 - 0.01), new THREE.Vector3(ln.x, y, zw), new THREE.Vector3(connX - mm(4), y, zw), new THREE.Vector3(connX - mm(2), y, zw - 0.02), new THREE.Vector3(connX, y, connZ)];
      wireGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, mm(0.9), 6, false));
    });
    fpcIdx.forEach((i, k) => {
      const x = mm(centers[i]);
      const y = mm(0.6);
      const pts = [new THREE.Vector3(x, y, mm(fpcLen / 2)), new THREE.Vector3(x + mm(3), y, zw - mm(6)), new THREE.Vector3(connX - mm(6 + k), y, zw - mm(6)), new THREE.Vector3(connX, y, connZ - mm(8))];
      wireGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, mm(0.7), 6, false));
    });
    {
      const pts = [new THREE.Vector3(mm(pc), mm(0.6), pz + mm(20)), new THREE.Vector3(connX - mm(8), mm(0.6), pz + mm(30)), new THREE.Vector3(connX, mm(0.6), connZ - mm(14))];
      wireGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, mm(0.7), 6, false));
    }
    // 維修迴圈（讓地墊可以部分捲起不必拔線）
    const loop = [];
    for (let a = 0; a <= 1; a += 0.05) loop.push(new THREE.Vector3(connX - mm(3) - Math.sin(a * Math.PI * 4) * mm(3), mm(1.5 + a * 2), connZ - mm(20) + a * mm(30)));
    wireGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop), 40, mm(1.1), 6, false));
    gWire.add(meshOf(wireGeo, mats.wire, 'wires'));
    // 穿框的 IP68 接頭
    mats.conn = new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.4, metalness: 0.5 });
    gWire.add(meshOf([cylX(mm(hx - 3), mm(mx0 + 6), mm(8), connZ, mm(4.5), 16)], mats.conn, 'connector'));

    // ⑤ 模組艙：外殼、灌膠電子艙、獨立電池艙、天線窗
    mats.modBody = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
    mats.window = new THREE.MeshStandardMaterial({ color: '#1a1d21', roughness: 0.35, metalness: 0 });
    mats.pcb = new THREE.MeshStandardMaterial({ color: '#1f7a3f', roughness: 0.5 });
    mats.battery = new THREE.MeshStandardMaterial({ color: '#4d6fb3', roughness: 0.4, metalness: 0.4 });
    mats.cap = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4, metalness: 0.3 });
    mats.potting = new THREE.MeshStandardMaterial({ color: '#d59a3a', roughness: 0.3, transparent: true, opacity: 0.45, depthWrite: false });
    mats.antenna = new THREE.MeshStandardMaterial({ color: '#c58b2a', roughness: 0.4, metalness: 0.6 });
    const X0 = mm(mx0);
    const X1 = mm(mx1);
    const Y0 = mm(MD.bottom);
    const Y1 = mm(MD.top);
    const Z0 = mm(mz0);
    const Z1 = mm(mz1);
    const w = mm(1.5);
    const body = [box(X0, X1, Y0, Y0 + w, Z0, Z1), box(X0, X0 + w, Y0, Y1, Z0, Z1), box(X1 - w, X1, Y0, Y1, Z0, Z1), box(X0, X1, Y0, Y1, Z0, Z0 + w), box(X0, X1, Y0, Y1, Z1 - w, Z1)];
    // 隔板：電子艙（靠 +Z）與電池艙（靠 -Z）
    const zSplit = Z0 + mm(modLen * 0.42);
    body.push(box(X0, X1, Y0, Y1, zSplit, zSplit + w));
    gModule.add(meshOf(body, mats.modBody, 'moduleBody'));
    gModule.add(meshOf([box(X0 - mm(2), X1 + mm(2), Y1, mm(20), Z0 - mm(2), Z1 + mm(2))], mats.window, 'window'));
    const xm = (X0 + X1) / 2;
    const batLen = Math.min(mm(50), zSplit - Z0 - mm(8));
    gModule.add(meshOf([cylZ(xm, mm(4), Z0 + mm(4), Z0 + mm(4) + batLen, mm(9))], mats.battery, 'battery'));
    gModule.add(meshOf([cylZ(xm + mm(6), mm(13), Z0 + mm(6), Z0 + mm(26), mm(4))], mats.cap, 'supercap'));
    const pcbZ0 = zSplit + mm(8);
    const pcbZ1 = Math.min(Z1 - mm(6), pcbZ0 + mm(70));
    gModule.add(meshOf([box(X0 + mm(4), X1 - mm(4), mm(2), mm(3.6), pcbZ0, pcbZ1)], mats.pcb, 'pcb'));
    gModule.add(meshOf([box(X0 + mm(5), X1 - mm(5), mm(14), mm(14.4), zSplit + mm(4), Z1 - mm(4))], mats.antenna, 'antenna'));
    gModule.add(meshOf([box(X0 + w, X1 - w, Y0 + w, mm(12), zSplit + w, Z1 - w)], mats.potting, 'potting'));
    // 模組艙蓋上的站點 NFC 標籤
    const siteTag = new THREE.CylinderGeometry(mm(14.5), mm(14.5), mm(0.8), 28);
    siteTag.translate(xm, mm(20.2), Z1 - mm(24));
    gModule.add(meshOf([siteTag], mats.nfc, 'nfcSite'));
    const ledMat = new THREE.MeshStandardMaterial({ color: '#34d399', emissive: '#34d399', emissiveIntensity: 2 });
    mats.led = ledMat;
    const led = new THREE.Mesh(new THREE.SphereGeometry(mm(2.5), 12, 8), ledMat);
    led.position.set(xm, mm(20.3), Z1 - mm(50));
    gModule.add(led);
  }

  // ---------------- 剖面填色 ----------------
  // 在任意 z 切面產生實心斷面（模擬施工大樣圖）
  const capMats = new Map();
  const capMat = (color) => {
    if (!capMats.has(color)) capMats.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    return capMats.get(color);
  };
  const caps = [];
  let capZ = 0;
  let capSeq = o.layout;
  function rect(xa, xb, ya, yb, dz = 0) {
    const g = new THREE.PlaneGeometry(xb - xa, yb - ya);
    g.translate((xa + xb) / 2, (ya + yb) / 2, capZ - 0.0003 + dz);
    return g;
  }
  function disc(x, y, r, dz = 0) {
    const g = new THREE.CircleGeometry(r, 28);
    g.translate(x, y, capZ - 0.0003 + dz);
    return g;
  }
  function addCaps(group, geoms, color) {
    if (!geoms.length) return;
    const m = new THREE.Mesh(mergeGeometries(geoms, false), capMat(color));
    geoms.forEach((g) => g.dispose());
    m.name = 'cap';
    m.visible = !!api._section;
    group.add(m);
    caps.push(m);
  }
  function buildCaps() {
    for (const m of caps.splice(0)) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    const z = capZ;
    const aluR = [];
    const baseR = [];
    const carR = [];
    const filmR = [];
    const insR = new Map();
    centers.forEach((c, i) => {
      const X = (a) => mm(c + a);
      aluR.push(rect(X(-15), X(15), mm(12), mm(14.5)), rect(X(-15), X(-13.5), mm(14.5), mm(18)), rect(X(13.5), X(15), mm(14.5), mm(18)));
      aluR.push(rect(X(-9.6), X(-8.4), mm(4.2), mm(12)), rect(X(8.4), X(9.6), mm(4.2), mm(12)));
      aluR.push(rect(X(-14), X(-4), mm(3), mm(4.2)), rect(X(4), X(14), mm(3), mm(4.2)));
      if (lineSet.has(i)) {
        carR.push(rect(X(-13), X(-5), 0, mm(3)));
        filmR.push(rect(X(-12.6), X(-5.4), mm(1.2), mm(1.8), 0.00005));
      } else baseR.push(rect(X(-13), X(-5), 0, mm(3)));
      baseR.push(rect(X(5), X(13), 0, mm(3)));
      const key = capSeq[i % capSeq.length];
      const top = M.FINISHES[key].kind === 'pvc' ? 21.5 : 22.8;
      if (!insR.has(key)) insR.set(key, []);
      insR.get(key).push(rect(X(-13.3), X(13.3), mm(14.5), mm(top)));
    });
    addCaps(gAlu, aluR, '#c3c8cf');
    addCaps(gBase, baseR, '#3a3e44');
    addCaps(gSensor, carR, '#2e7d74');
    addCaps(gSensor, filmR, '#e0a53c');
    for (const [key, r] of insR) addCaps(gInsert, r, M.FINISHES[key].mid);
    if (o.sensors) {
      const fpcLen = Math.min(SENSE.fpcL, L - 40);
      if (Math.abs(z) < mm(fpcLen / 2)) addCaps(gPit, fpcIdx.map((i) => rect(mm(centers[i] - 4), mm(centers[i] + 4), 0, mm(0.5), 0.00005)), '#c98a2b');
    }
    addCaps(gStatic, [rect(mm(-hx - T), mm(-hx), mm(-10), mm(20)), rect(mm(hx), mm(hx + T), mm(-10), mm(20))], '#9aa0a8');
    const inModule = o.sensors && z > modInfo.z0 && z < modInfo.z1;
    if (o.floor) {
      addCaps(gStatic, [rect(-floorOX, floorOX, -0.09, 0)], '#a19d95');
      const tr = [rect(-floorOX, mm(-hx - T), 0, mm(20))];
      if (inModule) tr.push(rect(mm(hx + T), modInfo.x0, 0, mm(20)), rect(modInfo.x1, floorOX, 0, mm(20)));
      else tr.push(rect(mm(hx + T), floorOX, 0, mm(20)));
      addCaps(gStatic, tr, '#ddd6ca');
    }
    if (inModule) {
      const X0 = modInfo.x0;
      const X1 = modInfo.x1;
      const Y0 = mm(MD.bottom);
      const Y1 = mm(MD.top);
      const w = mm(1.5);
      const xm = (X0 + X1) / 2;
      const zSplit = modInfo.z0 + mm(modLen * 0.42);
      addCaps(gModule, [rect(X0, X1, Y0, Y1, 0.00004)], '#3a3f46');
      addCaps(gModule, [rect(X0 - mm(2), X1 + mm(2), Y1, mm(20), 0.00006)], '#15181b');
      if (z > zSplit) {
        addCaps(gModule, [rect(X0 + w, X1 - w, Y0 + w, mm(12), 0.00006)], '#d59a3a');
        addCaps(gModule, [rect(X0 + w, X1 - w, mm(12), Y1, 0.00006)], '#5a6069');
        addCaps(gModule, [rect(X0 + mm(4), X1 - mm(4), mm(2), mm(3.6), 0.00008)], '#1f7a3f');
        addCaps(gModule, [rect(X0 + mm(5), X1 - mm(5), mm(14), mm(14.6), 0.00008)], '#e0a53c');
      } else {
        addCaps(gModule, [rect(X0 + w, X1 - w, Y0 + w, Y1, 0.00006)], '#5a6069');
        addCaps(gModule, [disc(xm, mm(4), mm(9), 0.00008)], '#4d6fb3');
        addCaps(gModule, [disc(xm + mm(6), mm(13), mm(4), 0.00008)], '#2a2a2a');
      }
    }
    if (o.drain && Math.abs(z - mm(-hz * 0.45)) < mm(28)) addCaps(gStatic, [rect(mm(dx - 28), mm(dx + 28), mm(-60), mm(0.8), 0.00002)], '#4c5058');
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
    lineIdx,
    fpcIdx,
    pinIdx,
    module: modInfo,
    pinZ: mm(Math.min(SENSE.fpcL, L - 40) / 2 + 25),
  };

  // 零件標籤錨點（跟著各群組一起移動）
  const c0 = mm(centers[0]);
  const anchors = [
    { group: 'insert', text: '① 表面墊片', sub: '荷蘭毯條／PVC 膠條・可更換', pos: [c0, mm(23), z1 - 0.04] },
    { group: 'alu', text: '② 鋁擠型骨架', sub: '6063-T5・寬 30・高 18 mm', pos: [mm(centers[Math.floor(n / 2)]), mm(18), mm(-hz * 0.1)] },
    { group: 'link', text: '③ 316 不銹鋼索＋排砂縫墊圈', sub: `墊圈 ${s} mm・鋼索 ${cableCount} 道`, pos: [mm(-x0 + 10), mm(10), cableZ[cableZ.length - 1]] },
    { group: 'base', text: '④ PVC 避震底座', sub: '緩衝消音・排水透氣', pos: [mm(centers[n - 1]), mm(2), z0 + 0.03] },
  ];
  if (o.sensors) {
    anchors.push(
      { group: 'sensor', text: '⑤ 壓電感測底座條', sub: `${lineIdx.length} 條・踩踏、方向、人或推車`, pos: [lines[0].x, mm(2), z0 + 0.04] },
      { group: 'pit', text: '⑥ 凹槽電極', sub: '電容電極量積砂・不鏽鋼針量積水', pos: [mm(centers[fpcIdx[0]]), 0, mm(-40)] },
      { group: 'module', text: '⑦ 智慧模組艙', sub: '灌膠電子艙・電池艙・天線窗', pos: [(modInfo.x0 + modInfo.x1) / 2, mm(20), modInfo.zc] },
    );
  }
  anchors.push({ group: 'static', text: '⑧ 實心鋁邊框＋凹槽', sub: '凹槽深 20 mm・與地坪齊平', pos: [mm(-hx - T), mm(20), 0] });

  const explodeOffsets = {
    insert: [0, 0.13, 0],
    alu: [0, 0.095, 0],
    link: [0, 0.07, 0],
    base: [0, 0.045, 0],
    sensor: [0, 0.028, 0],
    pit: [0, 0.008, 0],
    wire: [0, 0.008, 0],
    nfc: [0, 0.095, 0],
    module: [0.06, 0.05, 0],
    static: [0, 0, 0],
  };
  const scale = Math.max(1, Math.min(o.widthM, o.depthM) / 0.5);

  // 聚焦模式：非焦點零件變半透明
  const allMeshes = () => {
    const list = [];
    root.traverse((m) => m.isMesh && m.name !== 'cap' && list.push(m));
    return list;
  };
  const saved = new Map();

  var api = {
    root,
    groups,
    info,
    anchors,
    lines,
    mats,
    insertMaterials,
    setLayout(seq) {
      capSeq = seq;
      buildInserts(seq);
      buildCaps();
      api.setDirt(api._dirt || 0);
      if (api._xray) api.setXray(true);
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
      for (const mat of insertMaterials.values()) mat.color.set('#ffffff').lerp(dirt, Math.min(0.75, d * 0.75));
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
      for (const m of [aluMat, baseMat, ...insertMaterials.values()]) {
        m.transparent = on;
        m.opacity = on ? 0.18 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
      }
    },
    /** 剖面：null 關閉；否則在 z 位置產生實心斷面 */
    setSection(z) {
      api._section = z !== null && z !== undefined;
      if (api._section) {
        capZ = z;
        buildCaps();
      }
      caps.forEach((m) => (m.visible = api._section));
    },
    /** 只凸顯某些群組（例如 ['sensor']）；null 還原 */
    focus(keys) {
      const keep = new Set();
      if (keys) for (const k of keys) groups[k]?.traverse((m) => m.isMesh && keep.add(m));
      for (const m of allMeshes()) {
        const mat = m.material;
        if (!saved.has(mat)) saved.set(mat, { t: mat.transparent, o: mat.opacity, d: mat.depthWrite });
      }
      const seen = new Set();
      for (const m of allMeshes()) {
        const mat = m.material;
        if (seen.has(mat)) continue;
        seen.add(mat);
        const s0 = saved.get(mat);
        const ghost = keys && !keep.has(m);
        mat.transparent = ghost ? true : s0.t;
        mat.opacity = ghost ? 0.08 : s0.o;
        mat.depthWrite = ghost ? false : s0.d;
        mat.needsUpdate = true;
      }
      // 模組艙聚焦時，外殼與天線窗半透明，才看得到內部
      if (mats.modBody && keys && keys.includes('module')) {
        for (const [mat, op] of [[mats.modBody, 0.22], [mats.window, 0.28]]) {
          mat.transparent = true;
          mat.opacity = op;
          mat.depthWrite = false;
          mat.needsUpdate = true;
        }
      }
    },
    /** 感測線發光（0..1），用於「踩一下」示範 */
    setLineGlow(i, v) {
      const ln = lines[i];
      if (ln) ln.film.emissiveIntensity = v * 3;
    },
    setLed(on) {
      if (mats.led) mats.led.emissiveIntensity = on ? 2.5 : 0.2;
    },
    sensorMaterial: mats.carrier,
    floorMaterial: floorMat,
    dispose() {
      root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const list = Array.isArray(obj.material) ? obj.material : [obj.material];
          list.forEach((m) => {
            m.map?.dispose();
            m.bumpMap?.dispose();
            m.dispose();
          });
        }
      });
    },
  };
  api.setSand(0.5);
  return api;
}
