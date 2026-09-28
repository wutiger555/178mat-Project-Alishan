// 智慧地墊模擬引擎：純邏輯，不碰 DOM/three.js。
// 時間單位：分鐘，t=0 為週一 00:00。所有參數都是「示意用假設」。

export const SIM_CONFIG = {
  // 每小時人流權重（平日），會自動正規化
  hourly: [0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.5, 5, 11, 7, 5, 6, 9, 7, 5, 5, 6, 9, 8, 4, 2.5, 1.5, 1, 0.5],
  weekendFactor: 0.45,
  dirtPerPersonDry: 0.35, // g／人（晴天，地墊攔截下來的量）
  dirtPerPersonRain: 1.0, // g／人（雨天）
  pitDepthUsableMm: 3, // 凹槽可容納的積砂厚度（超過會影響排水）
  sandDensity: 1.5, // g/cm³
  cleanAlertPct: 70, // 積砂達 70% 通知清潔
  moisturePerPersonRain: 0.2,
  moisturePerPersonDry: 0.004,
  moistureHalfLifeMin: 90,
  slipAlertAt: 45,
  slipClearAt: 30,
  insertRatedSteps: 3_000_000, // 毯條設計壽命（踩踏次數）
  insertAlertPct: 90,
  batteryPerDayPct: 0.06, // 約 4 年用完（示意）
  armedFrom: 23, // 夜間保全時段
  armedTo: 6,
  crewAcceptMin: 15, // 自動清潔人員：幾分鐘內接單
  crewCleanMin: 25, // 清潔作業時間
  summaryHour: 8, // 每日摘要推播時間
};

const DAY = 24 * 60;
const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Poisson 抽樣：λ 小時用 Knuth，大時用常態近似
export function poisson(lambda, rand) {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    const u = 1 - rand();
    const v = rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

export function formatSimTime(t) {
  const day = Math.floor(t / DAY);
  const m = Math.floor(t - day * DAY);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${WEEKDAYS[day % 7]} ${hh}:${mm}`;
}

export function hourOf(t) {
  return Math.floor((t % DAY) / 60);
}

export function isWeekend(t) {
  return Math.floor(t / DAY) % 7 >= 5;
}

export function isArmedHour(h, cfg = SIM_CONFIG) {
  return cfg.armedFrom > cfg.armedTo ? h >= cfg.armedFrom || h < cfg.armedTo : h >= cfg.armedFrom && h < cfg.armedTo;
}

let orderSeq = 1000;

export class MatSim {
  constructor(opts = {}) {
    this.cfg = { ...SIM_CONFIG, ...(opts.config || {}) };
    this.id = opts.id || 'east';
    this.name = opts.name || '東側大門';
    this.dailyTraffic = opts.dailyTraffic ?? 2000;
    this.areaM2 = opts.areaM2 ?? 2.4 * 1.5;
    this.rand = mulberry32(opts.seed ?? 42);
    this.t = opts.startT ?? 7.5 * 60;
    this.rainy = !!opts.rainy;
    this.autoCrew = opts.autoCrew ?? true;
    this.security = opts.security ?? true;
    const w = this.cfg.hourly;
    const sum = w.reduce((a, b) => a + b, 0);
    this.hourShare = w.map((x) => x / sum);

    this.capacityG = this.areaM2 * 10000 * (this.cfg.pitDepthUsableMm / 10) * this.cfg.sandDensity;
    this.debrisG = this.capacityG * ((opts.debrisPct ?? 55) / 100);
    this.moisture = 0;
    this.wearSteps = opts.wearSteps ?? 1_300_000;
    this.battery = opts.battery ?? 87;
    this.countTotal = 0;
    this.countToday = 0;
    this.hourlyToday = new Array(24).fill(0);
    this.dailyHistory = []; // [{day, count}]
    this.debrisHistory = []; // 每小時取樣 {t, pct}
    this.orders = [];
    this.log = []; // 維護紀錄（WELL／ESG 報表用）
    this.slipActive = false;
    this.insertAlerted = false;
    this._carry = 0;
    this._lastSampleHour = Math.floor(this.t / 60);
    this._lastDay = Math.floor(this.t / DAY);
    this._lastSummaryDay = -1;
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(ev) {
    for (const fn of this.listeners) fn(ev, this);
  }

  get debrisPct() {
    return Math.min(100, (this.debrisG / this.capacityG) * 100);
  }

  get insertLifePct() {
    return Math.max(0, 100 - (this.wearSteps / this.cfg.insertRatedSteps) * 100);
  }

  get armed() {
    return this.security && isArmedHour(hourOf(this.t), this.cfg);
  }

  // 每分鐘預期人流
  rateAt(t) {
    const h = hourOf(t);
    const f = isWeekend(t) ? this.cfg.weekendFactor : 1;
    return (this.dailyTraffic * this.hourShare[h] * f) / 60;
  }

  /** 推進 dtMin 分鐘，回傳這段時間新增的人次 */
  step(dtMin) {
    let arrivals = 0;
    let remaining = dtMin;
    while (remaining > 0) {
      const toNextMinute = Math.min(remaining, 1 - (this.t % 1) || 1);
      const dt = Math.min(remaining, toNextMinute);
      arrivals += this._advance(dt);
      remaining -= dt;
    }
    return arrivals;
  }

  _advance(dt) {
    const armed = this.armed;
    // 保全時段大樓關閉：自然人流壓到 0（入侵事件由 simulateIntrusion 觸發）
    const lambda = armed ? 0 : this.rateAt(this.t) * dt;
    const n = poisson(lambda, this.rand);
    if (n > 0) this._people(n);

    // 濕度自然衰減
    this.moisture *= Math.pow(0.5, dt / this.cfg.moistureHalfLifeMin);
    this.battery = Math.max(0, this.battery - (this.cfg.batteryPerDayPct * dt) / DAY);

    this.t += dt;
    this._tick();
    return n;
  }

  _people(n) {
    const c = this.cfg;
    this.countTotal += n;
    this.countToday += n;
    this.hourlyToday[hourOf(this.t)] += n;
    this.wearSteps += n * 2; // 平均每人在地墊上踩 2 步
    this.debrisG = Math.min(this.capacityG * 1.1, this.debrisG + n * (this.rainy ? c.dirtPerPersonRain : c.dirtPerPersonDry));
    this.moisture = Math.min(100, this.moisture + n * (this.rainy ? c.moisturePerPersonRain : c.moisturePerPersonDry));
  }

  _tick() {
    const c = this.cfg;
    const day = Math.floor(this.t / DAY);
    const hourIdx = Math.floor(this.t / 60);

    if (hourIdx !== this._lastSampleHour) {
      this._lastSampleHour = hourIdx;
      this.debrisHistory.push({ t: this.t, pct: this.debrisPct, moisture: this.moisture });
      if (this.debrisHistory.length > 24 * 7) this.debrisHistory.shift();
    }

    if (day !== this._lastDay) {
      this.dailyHistory.push({ day: this._lastDay, count: this.countToday });
      if (this.dailyHistory.length > 14) this.dailyHistory.shift();
      this._yesterday = this.countToday;
      this.countToday = 0;
      this.hourlyToday = new Array(24).fill(0);
      this._lastDay = day;
    }

    // 每日摘要
    if (hourOf(this.t) === c.summaryHour && this._lastSummaryDay !== day && this._yesterday !== undefined) {
      this._lastSummaryDay = day;
      this.emit({
        type: 'message',
        level: 'info',
        title: '每日入口報告',
        body: `昨日人次 ${this._yesterday.toLocaleString()}｜積砂 ${Math.round(this.debrisPct)}%｜毯條壽命 ${Math.round(this.insertLifePct)}%｜電量 ${Math.round(this.battery)}%`,
      });
    }

    // 積砂門檻 → 清潔工單
    if (this.debrisPct >= c.cleanAlertPct && !this.openOrder('clean')) {
      this.createOrder('clean', '凹槽積砂達 ' + Math.round(this.debrisPct) + '%', '請派員掀起地墊清除凹槽積砂（約 20 分鐘）');
    }

    // 濕滑風險 → 放置警示牌
    if (!this.slipActive && this.moisture >= c.slipAlertAt) {
      this.slipActive = true;
      this.createOrder('slip', '入口濕滑風險升高', '雨天人流大、鞋底含水量高，請放置「小心地滑」警示牌並加強拖地');
    } else if (this.slipActive && this.moisture <= c.slipClearAt) {
      this.slipActive = false;
      const o = this.openOrder('slip');
      if (o) this.completeOrder(o.id, '濕度恢復正常，系統自動結案');
    }

    // 毯條壽命
    if (!this.insertAlerted && this.insertLifePct <= 100 - c.insertAlertPct) {
      this.insertAlerted = true;
      this.createOrder('insert', '毯條壽命剩 ' + Math.round(this.insertLifePct) + '%', 'Alishan Care 已排程下次到場更換毯條');
    }

    // 自動清潔人員
    if (this.autoCrew) {
      for (const o of this.orders) {
        if (o.type === 'intrusion') {
          if (o.status === 'open' && this.t - o.created >= 3) this.acceptOrder(o.id, '保全 王先生');
          else if (o.status === 'accepted' && this.t - o.acceptedAt >= 12) this.completeOrder(o.id, '保全已到場確認，警報解除');
        } else if (o.type === 'insert') {
          if (o.status === 'open') this.acceptOrder(o.id, 'Alishan Care');
        } else if (o.status === 'open' && this.t - o.created >= c.crewAcceptMin) this.acceptOrder(o.id, '清潔組 阿美');
        else if (o.status === 'accepted' && o.type === 'clean' && this.t - o.acceptedAt >= c.crewCleanMin) this.completeOrder(o.id);
      }
    }
  }

  openOrder(type) {
    return this.orders.find((o) => o.type === type && o.status !== 'done');
  }

  createOrder(type, title, body) {
    const o = { id: 'WO-' + orderSeq++, type, title, body, created: this.t, status: 'open', site: this.name };
    this.orders.unshift(o);
    if (this.orders.length > 30) this.orders.pop();
    this.emit({ type: 'order', order: o });
    this.emit({
      type: 'message',
      level: type === 'intrusion' ? 'critical' : type === 'slip' ? 'warning' : 'serious',
      title,
      body,
      orderId: o.id,
    });
    return o;
  }

  acceptOrder(id, who = '清潔組') {
    const o = this.orders.find((x) => x.id === id);
    if (!o || o.status !== 'open') return;
    o.status = 'accepted';
    o.acceptedAt = this.t;
    o.who = who;
    this.emit({ type: 'order', order: o });
  }

  completeOrder(id, note) {
    const o = this.orders.find((x) => x.id === id);
    if (!o || o.status === 'done') return;
    o.status = 'done';
    o.doneAt = this.t;
    if (o.type === 'clean') {
      const before = this.debrisPct;
      this.debrisG = this.capacityG * 0.03;
      this.log.unshift({ t: this.t, what: `凹槽清潔（清除前 ${Math.round(before)}%）`, who: o.who || '清潔組', site: this.name });
    } else if (o.type === 'insert') {
      this.wearSteps = 0;
      this.log.unshift({ t: this.t, what: '毯條更換', who: 'Alishan Care', site: this.name });
    } else if (o.type === 'slip') {
      this.log.unshift({ t: this.t, what: '濕滑警示處理', who: o.who || '系統', site: this.name });
    } else if (o.type === 'intrusion') {
      this.log.unshift({ t: this.t, what: '夜間入侵警報處理', who: o.who || '保全', site: this.name });
    }
    if (this.log.length > 50) this.log.pop();
    this.emit({ type: 'order', order: o });
    this.emit({
      type: 'message',
      level: 'good',
      title: '工單完成 ' + o.id,
      body: note || `${o.title} → 已處理（${o.who || '清潔組'}），已寫入維護紀錄`,
    });
  }

  simulateIntrusion() {
    this.countTotal += 1;
    this.hourlyToday[hourOf(this.t)] += 1;
    const o = this.createOrder('intrusion', '夜間入侵警報', `保全時段偵測到踩踏（${formatSimTime(this.t)}），已通知保全並連動攝影機`);
    return o;
  }

  /** 這週（最近 7 天）完成的清潔次數，WELL 要求入口系統定期維護 */
  weeklyCleanings() {
    return this.log.filter((l) => l.what.startsWith('凹槽清潔') && this.t - l.t <= 7 * DAY).length;
  }

  snapshot() {
    return {
      t: this.t,
      time: formatSimTime(this.t),
      countToday: this.countToday,
      countTotal: this.countTotal,
      debrisPct: this.debrisPct,
      debrisG: this.debrisG,
      moisture: this.moisture,
      insertLifePct: this.insertLifePct,
      battery: this.battery,
      armed: this.armed,
      rainy: this.rainy,
    };
  }
}
