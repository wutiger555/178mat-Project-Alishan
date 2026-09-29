// 從互動版 dist/alishan-demo.html 截圖，給列印版 PDF 使用。
// 用法：npm run capture（需要 Playwright；Chromium 用軟體繪圖，比較慢）
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/opt/node22/lib/node_modules/')('playwright');
}

const root = resolve(import.meta.dirname, '..');
const out = resolve(import.meta.dirname, 'img');
await mkdir(out, { recursive: true });

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', deviceScaleFactor: 1.5 });
await ctx.route('http*://**', (r) => r.abort());
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('file://' + resolve(root, 'dist/alishan-demo.html'));
// 截圖時隱藏置頂列，避免蓋到內容
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}.topbar,.progress{display:none!important}.viewer-hint{display:none}' });

const shot = async (sel, name, wait = 0) => {
  if (wait) await page.waitForTimeout(wait);
  const loc = page.locator(sel).first();
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500); // 等 3D 在新位置重新渲染
  const b = await loc.boundingBox();
  if (b.height <= 1000) {
    await page.screenshot({ path: resolve(out, name + '.png'), clip: b, timeout: 120000 });
  } else {
    const sy = await page.evaluate(() => scrollY);
    await page.screenshot({ path: resolve(out, name + '.png'), fullPage: true, clip: { ...b, y: b.y + sy }, timeout: 120000 });
  }
  console.log('✓', name);
};
const until = async (fn, ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn)) return;
    await page.waitForTimeout(500);
  }
};

// 產品 3D
await page.locator('#productViewer').scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);
await shot('#productViewer', 'prod-assembled');
for (const m of ['explode', 'section', 'sectionB']) {
  await page.click(`[data-mode="${m}"]`);
  await shot('#productViewer', 'prod-' + m, 3000);
}
await page.click('[data-mode="assembled"]');

// 感測器實驗室
await page.locator('#labViewer').scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);
for (const id of ['piezo', 'ide', 'water', 'module']) {
  await page.click(`#labCards [data-id="${id}"]`);
  await shot('#labViewer', 'lab-' + id, 2800);
}
await page.click('[data-demo="walk"]');
await until(() => document.getElementById('labLog').textContent.includes('判定'));
await shot('#sensors .lab-stage', 'lab-demo-walk', 400);
await page.click('[data-demo="cart"]');
await until(() => document.getElementById('labLog').textContent.includes('推車（'));
await shot('#sensors .wave', 'lab-wave-cart', 300);
for (let i = 1; i <= 6; i++) {
  await page.click('#install [data-step="1"]');
  await page.waitForTimeout(2200);
  if (i === 1 || i === 3 || i === 6) await shot('#labViewer', 'install-' + i);
}

// 模擬與儀表板
await page.locator('#entranceViewer').scrollIntoViewIfNeeded();
await page.waitForTimeout(2000);
await page.click('[data-weather="rain"]');
await page.click('[data-speed="3600"]');
await until(() => document.getElementById('chat').children.length >= 4, 40000);
await shot('#sim .sim-grid', 'sim-grid', 1500);
await shot('#dash', 'dashboard');

// 其他章節
await shot('#how .flow', 'flow');
await page.locator('#start').scrollIntoViewIfNeeded();
await shot('.gantt-wrap', 'gantt', 300);
await page.locator('#roi').scrollIntoViewIfNeeded();
await shot('#roi .roi-out .chart', 'cash-chart', 500);
await shot('#sales .funnel', 'funnel', 200);

await browser.close();
