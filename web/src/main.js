import { initRoiSection } from './ui/roiSection.js';
import { initPlanSection } from './ui/planSection.js';

const $ = (s) => document.querySelector(s);
const slides = [...document.querySelectorAll('section.slide')];

// ---------- 深淺色 ----------
const THEME_KEY = 'alishan-theme';
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  window.dispatchEvent(new Event('themechange'));
}
try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);
} catch {}
$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
});

// ---------- 目錄與進度 ----------
const toc = $('#toc');
slides.forEach((s, i) => {
  if (i === 0) return;
  const a = document.createElement('a');
  a.href = '#' + s.id;
  a.textContent = s.dataset.title;
  toc.appendChild(a);
});
const tocLinks = [...toc.querySelectorAll('a')];
let current = 0;
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      current = slides.indexOf(e.target);
      tocLinks.forEach((a) => a.classList.toggle('on', a.hash === '#' + e.target.id));
      const on = toc.querySelector('.on');
      on?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  },
  { rootMargin: '-45% 0px -50% 0px' },
);
slides.forEach((s) => io.observe(s));
const progress = $('#progress');
addEventListener(
  'scroll',
  () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%';
  },
  { passive: true },
);

// ---------- 簡報模式 ----------
const presentBtn = $('#presentBtn');
presentBtn.addEventListener('click', () => {
  const on = !document.body.classList.contains('present');
  document.body.classList.toggle('present', on);
  presentBtn.textContent = on ? '■ 結束簡報' : '▶ 簡報模式';
  if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  slides[current].scrollIntoView({ behavior: 'smooth' });
});
function go(delta) {
  const i = Math.max(0, Math.min(slides.length - 1, current + delta));
  slides[i].scrollIntoView({ behavior: 'smooth' });
}
addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && document.body.classList.contains('present'))) {
    e.preventDefault();
    go(1);
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    go(-1);
  } else if (e.key === 'f' || e.key === 'F') {
    presentBtn.click();
  }
});

// ---------- 3D：捲動到附近才初始化 ----------
function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
function lazy(el, init) {
  const ob = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      ob.disconnect();
      if (!webglOk()) {
        el.insertAdjacentHTML('beforeend', '<p style="padding:24px">這台裝置不支援 WebGL，無法顯示 3D。請改用新版 Chrome、Edge 或 Safari 開啟。</p>');
        return;
      }
      init().catch((err) => {
        console.error(err);
        el.insertAdjacentHTML('beforeend', `<p style="padding:24px">3D 載入失敗：${err.message}</p>`);
      });
    },
    { rootMargin: '600px' },
  );
  ob.observe(el);
}
lazy($('#productViewer'), async () => {
  const { initProductViewer } = await import('./scene/productViewer.js');
  initProductViewer();
});
lazy($('#entranceViewer'), async () => {
  const { initSimSection } = await import('./sim/section.js');
  initSimSection();
});

initRoiSection();
initPlanSection();
addEventListener('themechange', () => dispatchEvent(new Event('resize')));
