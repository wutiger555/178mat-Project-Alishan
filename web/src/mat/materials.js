import * as THREE from 'three';
import { mulberry32 } from '../sim/engine.js';

// 面材配色：依使用者提供的樣品照片（荷蘭 VEBE 毯條與 PVC 膠條）
export const FINISHES = {
  carbon: { name: '碳黑色', kind: 'wave', base: '#1b1b1d', fleck: '#b9bcc2', mid: '#3a3b3f' },
  lightgray: { name: '淺灰色', kind: 'wave', base: '#6f7278', fleck: '#d6d8dc', mid: '#9a9da3' },
  darkgray: { name: '深灰色', kind: 'wave', base: '#34363a', fleck: '#a2a5ab', mid: '#55585d' },
  red: { name: '紅色', kind: 'wave', base: '#7d1418', fleck: '#e0484d', mid: '#b3242a' },
  stripeBlack: { name: '黑色（直條紋）', kind: 'stripe', base: '#18181a', fleck: '#9fa2a8', mid: '#2d2e31' },
  stripeGray: { name: '灰色（直條紋）', kind: 'stripe', base: '#5a5d62', fleck: '#c9ccd1', mid: '#7c7f84' },
  pvcBlack: { name: 'PVC 黑色', kind: 'pvc', base: '#1a1b1d', fleck: '#3a3c40', mid: '#26272a' },
  pvcGray: { name: 'PVC 灰色', kind: 'pvc', base: '#6c6f74', fleck: '#8e9196', mid: '#7a7d82' },
};

export const FINISH_GROUPS = [
  { title: '荷蘭毯・浪花紋', keys: ['carbon', 'lightgray', 'darkgray', 'red'] },
  { title: '荷蘭毯・直條紋', keys: ['stripeBlack', 'stripeGray'] },
  { title: 'PVC 止滑膠條', keys: ['pvcBlack', 'pvcGray'] },
];

// 配置方案（每條鋁條的面材依序重複）
export const LAYOUTS = {
  photo: { name: '樣品混搭', seq: ['pvcBlack', 'pvcGray', 'red', 'lightgray', 'carbon'] },
  lobby: { name: '大廳（碳黑）', seq: ['carbon'] },
  hotel: { name: '飯店（深灰＋紅）', seq: ['darkgray', 'darkgray', 'darkgray', 'red'] },
  outdoor: { name: '室外（PVC＋毯）', seq: ['pvcBlack', 'pvcBlack', 'carbon'] },
};

const texCache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// 毯條紋理：沿長度方向（v）重複。u = 條寬方向
function drawFinish(key) {
  const f = FINISHES[key];
  const W = 64;
  const H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = mulberry32(key.length * 97 + key.charCodeAt(0));
  g.fillStyle = f.base;
  g.fillRect(0, 0, W, H);
  const bump = makeCanvas(W, H);
  const b = bump.getContext('2d');
  b.fillStyle = '#404040';
  b.fillRect(0, 0, W, H);

  if (f.kind === 'pvc') {
    // 擠型肋條：沿長度方向的凸肋
    const ribs = 7;
    for (let i = 0; i < ribs; i++) {
      const x0 = (i / ribs) * W;
      const grd = g.createLinearGradient(x0, 0, x0 + W / ribs, 0);
      grd.addColorStop(0, f.base);
      grd.addColorStop(0.5, f.fleck);
      grd.addColorStop(1, f.base);
      g.globalAlpha = 0.55;
      g.fillStyle = grd;
      g.fillRect(x0, 0, W / ribs, H);
      const bg = b.createLinearGradient(x0, 0, x0 + W / ribs, 0);
      bg.addColorStop(0, '#101010');
      bg.addColorStop(0.5, '#f0f0f0');
      bg.addColorStop(1, '#101010');
      b.fillStyle = bg;
      b.fillRect(x0, 0, W / ribs, H);
    }
    g.globalAlpha = 1;
  } else {
    // 圈絨：小圈圈＋雜色毛絮
    const loops = f.kind === 'wave' ? 520 : 380;
    for (let i = 0; i < loops; i++) {
      let x = r() * W;
      let y = r() * H;
      if (f.kind === 'wave') {
        // 浪花紋：斜向波浪成簇
        const band = Math.floor(y / 22);
        x = (x + Math.sin((y / H) * Math.PI * 6 + band) * 10 + W) % W;
      } else {
        // 直條紋：集中在 5 道縱向條紋
        x = (Math.floor(r() * 5) + 0.5) * (W / 5) + (r() - 0.5) * 6;
      }
      const rad = 1.6 + r() * 3.2;
      const shade = r();
      g.strokeStyle = shade > 0.86 ? f.fleck : shade > 0.4 ? f.mid : f.base;
      g.lineWidth = 0.9 + r() * 0.8;
      g.beginPath();
      g.arc(x, y, rad, r() * 6, r() * 6 + 4.5);
      g.stroke();
      b.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
      b.lineWidth = 1.4;
      b.beginPath();
      b.arc(x, y, rad, 0, Math.PI * 2);
      b.stroke();
    }
    // 散落的白色纖維（照片中很明顯）
    for (let i = 0; i < 45; i++) {
      g.strokeStyle = f.fleck;
      g.globalAlpha = 0.35 + r() * 0.4;
      g.lineWidth = 0.6;
      const x = r() * W;
      const y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, x + (r() - 0.5) * 10, y + (r() - 0.5) * 10);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  return { color: c, bump };
}

function canvasTex(canvas, repeatV = 1, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, repeatV);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 面材材質；lengthM = 鋁條長度（決定紋理重複次數） */
export function finishMaterial(key, lengthM) {
  const cacheKey = key;
  let src = texCache.get(cacheKey);
  if (!src) {
    src = drawFinish(key);
    texCache.set(cacheKey, src);
  }
  const rep = Math.max(1, lengthM / 0.12);
  const f = FINISHES[key];
  return new THREE.MeshStandardMaterial({
    map: canvasTex(src.color, rep),
    bumpMap: canvasTex(src.bump, rep, false),
    bumpScale: f.kind === 'pvc' ? 2.2 : 3,
    roughness: f.kind === 'pvc' ? 0.55 : 1,
    metalness: 0,
    envMapIntensity: f.kind === 'pvc' ? 0.6 : 0.35,
    side: THREE.DoubleSide,
  });
}

export function aluminumMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.9, roughness: 0.32, side: THREE.DoubleSide });
}

export function frameMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#b8bcc3', metalness: 0.92, roughness: 0.25, side: THREE.DoubleSide });
}

export function rubberMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85, side: THREE.DoubleSide });
}

export function pvcBaseMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.7, side: THREE.DoubleSide });
}

export function steelMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 1, roughness: 0.2, transparent: true, opacity: 0.95 });
}

export function sensorMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#15b8a6', emissive: '#0b8f81', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2 });
}

export function concreteMaterial() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const r = mulberry32(11);
  g.fillStyle = '#8e8c87';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 110 + Math.floor(r() * 70);
    g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.25 + r() * 0.4})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
  }
  const t = canvasTex(c, 1);
  t.repeat.set(3, 3);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
}

export function tileMaterial(tone = 'stone', tileM = 0.6, repeat = 8) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const r = mulberry32(tone === 'stone' ? 5 : 8);
  const base = tone === 'stone' ? [214, 208, 198] : tone === 'paver' ? [158, 154, 147] : [236, 234, 230];
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const d = (r() - 0.5) * 26;
    g.fillStyle = `rgba(${base[0] + d},${base[1] + d},${base[2] + d},0.5)`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 2 + r() * 10, 1 + r() * 4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = tone === 'paver' ? 'rgba(40,40,40,0.55)' : 'rgba(120,112,100,0.45)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const t = canvasTex(c, 1);
  t.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({ map: t, roughness: tone === 'paver' ? 0.9 : 0.35, metalness: 0, side: THREE.DoubleSide });
}

export function sandMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#a8875c', roughness: 1 });
}

export function moduleMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.5, metalness: 0.3 });
}
