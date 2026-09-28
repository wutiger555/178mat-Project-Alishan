// 輕量 canvas 圖表（不引入圖表庫）。顏色全部讀 CSS 變數，跟著深淺色主題走。

function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return {
    data: v('--data'),
    dataSoft: v('--data-soft'),
    grid: v('--grid'),
    axis: v('--axis'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    surface: v('--surface'),
    accent2: v('--accent-2'),
    critical: v('--critical'),
    good: v('--good'),
    font: v('--font'),
  };
}

function niceStep(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + ' 億';
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + ' 萬';
  return Math.round(n).toLocaleString();
}

class BaseChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hover = -1;
    this.tip = document.createElement('div');
    this.tip.className = 'tip';
    canvas.parentElement.appendChild(this.tip);
    this.cssH = Number(canvas.getAttribute('height')) || 200;
    canvas.addEventListener('mousemove', (e) => this._move(e));
    canvas.addEventListener('mouseleave', () => {
      this.hover = -1;
      this.tip.classList.remove('show');
      this.draw(this.data);
    });
    new ResizeObserver(() => this.data && this.draw(this.data)).observe(canvas);
  }
  _setup() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 300;
    const h = this.cssH;
    if (this.canvas.width !== Math.round(w * dpr)) this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    return { w, h, t: tokens() };
  }
  _move(e) {
    if (!this.hits) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = -1;
    let bd = Infinity;
    this.hits.forEach((hx, i) => {
      const d = Math.abs(hx - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best !== this.hover) {
      this.hover = best;
      this.draw(this.data);
    }
    if (best >= 0 && this.tipAt) {
      const { x: tx, y: ty, text } = this.tipAt(best);
      this.tip.textContent = text;
      this.tip.style.left = tx + this.canvas.offsetLeft + 'px';
      this.tip.style.top = ty + this.canvas.offsetTop + 'px';
      this.tip.classList.add('show');
    }
  }
}

/** 單一數列柱狀圖 */
export class BarChart extends BaseChart {
  draw(data) {
    this.data = data;
    const { w, h, t } = this._setup();
    const c = this.ctx;
    const pad = { l: 40, r: 8, t: 12, b: 24 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const max = niceStep(Math.max(4, ...data.values) / 4) * 4;
    c.font = `11px ${t.font}`;
    c.textBaseline = 'middle';
    // 格線
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ih - (i / 4) * ih;
      c.strokeStyle = i === 0 ? t.axis : t.grid;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(pad.l, Math.round(y) + 0.5);
      c.lineTo(w - pad.r, Math.round(y) + 0.5);
      c.stroke();
      c.fillStyle = t.muted;
      c.textAlign = 'right';
      c.fillText(compact((max * i) / 4), pad.l - 6, y);
    }
    const n = data.values.length;
    const band = iw / n;
    const bw = Math.min(24, band - 2);
    this.hits = [];
    data.values.forEach((v, i) => {
      const x = pad.l + i * band + (band - bw) / 2;
      const bh = (v / max) * ih;
      const y = pad.t + ih - bh;
      this.hits.push(x + bw / 2);
      const active = i === data.highlight;
      c.globalAlpha = this.hover === -1 || this.hover === i ? 1 : 0.55;
      c.fillStyle = active ? t.accent2 : t.data;
      if (bh > 0.5) {
        const r = Math.min(4, bw / 2, bh);
        c.beginPath();
        c.moveTo(x, pad.t + ih);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.lineTo(x + bw - r, y);
        c.quadraticCurveTo(x + bw, y, x + bw, y + r);
        c.lineTo(x + bw, pad.t + ih);
        c.closePath();
        c.fill();
      }
      c.globalAlpha = 1;
      if (i % (n > 12 ? 3 : 1) === 0) {
        c.fillStyle = t.muted;
        c.textAlign = 'center';
        c.fillText(data.labels[i], x + bw / 2, h - 10);
      }
    });
    this.tipAt = (i) => ({
      x: this.hits[i],
      y: pad.t + ih - (data.values[i] / max) * ih,
      text: `${data.tipLabels ? data.tipLabels[i] : data.labels[i]}：${data.values[i].toLocaleString()} ${data.unit || ''}`,
    });
  }
}

/** 單一數列折線圖（可加門檻線、零線、標記點） */
export class LineChart extends BaseChart {
  draw(data) {
    this.data = data;
    const { w, h, t } = this._setup();
    const c = this.ctx;
    const pad = { l: 52, r: 14, t: 14, b: 24 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const ys = data.points.map((p) => p.y);
    let yMin = data.yMin;
    let yMax = data.yMax;
    let ticks = 4;
    if (yMin === undefined || yMax === undefined) {
      const lo = Math.min(0, ...ys);
      const hi = Math.max(1, ...ys);
      const step = niceStep((hi - lo) / 4);
      yMin = Math.floor(lo / step) * step;
      yMax = Math.ceil(hi / step) * step;
      ticks = Math.round((yMax - yMin) / step);
    }
    const n = Math.max(1, data.points.length - 1);
    const X = (i) => pad.l + (i / n) * iw;
    const Y = (v) => pad.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
    c.font = `11px ${t.font}`;
    c.textBaseline = 'middle';
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + ((yMax - yMin) * i) / ticks;
      const y = Y(v);
      c.strokeStyle = Math.abs(v) < 1e-9 ? t.axis : t.grid;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(pad.l, Math.round(y) + 0.5);
      c.lineTo(w - pad.r, Math.round(y) + 0.5);
      c.stroke();
      c.fillStyle = t.muted;
      c.textAlign = 'right';
      c.fillText((data.fmtY || compact)(v), pad.l - 6, y);
    }
    // x 標籤
    c.textAlign = 'center';
    (data.xTicks || []).forEach(({ i, label }) => {
      c.fillStyle = t.muted;
      const x = X(i);
      c.textAlign = x > w - pad.r - 24 ? 'right' : x < pad.l + 24 ? 'left' : 'center';
      c.fillText(label, x, h - 10);
    });
    // 門檻線
    if (data.threshold !== undefined) {
      const y = Y(data.threshold);
      c.save();
      c.strokeStyle = t.accent2;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(pad.l, y);
      c.lineTo(w - pad.r, y);
      c.stroke();
      c.restore();
    }
    if (!data.points.length) return;
    // 面積（淡）
    c.beginPath();
    data.points.forEach((p, i) => (i ? c.lineTo(X(i), Y(p.y)) : c.moveTo(X(i), Y(p.y))));
    c.lineTo(X(data.points.length - 1), Y(Math.max(yMin, 0)));
    c.lineTo(X(0), Y(Math.max(yMin, 0)));
    c.closePath();
    c.fillStyle = t.dataSoft;
    c.fill();
    // 線
    c.beginPath();
    data.points.forEach((p, i) => (i ? c.lineTo(X(i), Y(p.y)) : c.moveTo(X(i), Y(p.y))));
    c.strokeStyle = t.data;
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
    const dot = (i, color) => {
      c.beginPath();
      c.arc(X(i), Y(data.points[i].y), 5, 0, Math.PI * 2);
      c.fillStyle = t.surface;
      c.fill();
      c.beginPath();
      c.arc(X(i), Y(data.points[i].y), 4, 0, Math.PI * 2);
      c.fillStyle = color;
      c.fill();
    };
    // 標記點（例如回本月份）
    if (data.marker !== undefined && data.marker !== null && data.points[data.marker]) {
      dot(data.marker, t.accent2);
      if (data.markerLabel) {
        c.fillStyle = t.ink;
        c.font = `600 12px ${t.font}`;
        const mx = X(data.marker);
        c.textAlign = mx > w - 120 ? 'right' : 'left';
        c.fillText(data.markerLabel, mx + (c.textAlign === 'left' ? 8 : -8), Y(data.points[data.marker].y) - 14);
      }
    }
    dot(data.points.length - 1, t.data);
    this.hits = data.points.map((p, i) => X(i));
    if (this.hover >= 0 && this.hover < data.points.length) {
      c.strokeStyle = t.axis;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(X(this.hover) + 0.5, pad.t);
      c.lineTo(X(this.hover) + 0.5, pad.t + ih);
      c.stroke();
      dot(this.hover, t.data);
    }
    this.tipAt = (i) => ({ x: X(i), y: Y(data.points[i].y), text: data.points[i].label });
  }
}
