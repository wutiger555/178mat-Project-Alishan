import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let sharedEnv = null;

/**
 * 共用 3D 檢視器：只有在畫面上看得到時才渲染（省電、平板不發燙）。
 */
export function createViewer(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });
  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.05;
  renderer.shadowMap.enabled = opts.shadows ?? true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'gl';
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  if (!sharedEnv) {
    const pm = new THREE.PMREMGenerator(renderer);
    sharedEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  scene.environment = sharedEnv;
  scene.environmentIntensity = opts.envIntensity ?? 0.9;

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.005, 200);
  camera.position.set(...(opts.cameraPos || [0.6, 0.5, 0.7]));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(...(opts.target || [0, 0.01, 0]));
  controls.minDistance = opts.minDistance ?? 0.1;
  controls.maxDistance = opts.maxDistance ?? 4;
  controls.maxPolarAngle = opts.maxPolar ?? Math.PI * 0.49;
  // 觸控：單指旋轉會卡住頁面捲動 → 需要兩指操作才接管（桌機不受影響）
  renderer.domElement.style.touchAction = 'pan-y';
  controls.update();

  const hemi = new THREE.HemisphereLight('#ffffff', '#8d8a84', opts.hemi ?? 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e6', opts.sun ?? 1.8);
  sun.position.set(1.2, 2.2, 1.4);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = opts.shadowExtent ?? 1;
  Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 0.1, far: 10 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const frameFns = new Set();
  let visible = false;
  let running = false;
  let last = performance.now();
  let needsRender = true;

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function loop(now) {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const fn of frameFns) fn(dt, now);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    needsRender = false;
    requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
    },
    { rootMargin: '120px' },
  );
  io.observe(container);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) start();
  });

  function label(text, sub, cls = '') {
    const el = document.createElement('div');
    el.className = 'tag ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    const obj = new CSS2DObject(el);
    obj.center.set(0, 1);
    return obj;
  }

  /** 平滑移動相機到指定位置 */
  function flyTo(pos, target, ms = 900) {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const p1 = new THREE.Vector3(...pos);
    const t1 = new THREE.Vector3(...target);
    const start = performance.now();
    const fn = (dt, now) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(p0, p1, e);
      controls.target.lerpVectors(t0, t1, e);
      if (k >= 1) frameFns.delete(fn);
    };
    frameFns.add(fn);
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    sun,
    hemi,
    label,
    flyTo,
    onFrame(fn) {
      frameFns.add(fn);
      return () => frameFns.delete(fn);
    },
    get needsRender() {
      return needsRender;
    },
  };
}
