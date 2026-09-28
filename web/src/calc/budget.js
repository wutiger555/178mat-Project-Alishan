// 分階段預算：每一項都附價格區間與來源等級（verified＝有查到原始頁面；estimate＝行情估算）。
// 研究日期 2026-09，實際下單前要再詢價。

export const PHASES = [
  {
    id: 'p0',
    name: '第 0 階段',
    title: '桌上原型',
    when: '第 1 個月（4 週）',
    goal: '一片 ES302 樣品：人踩上去，手機收到 LINE；能量到 50 g 的積砂變化',
    items: [
      { name: 'MCU 開發板：XIAO ESP32C6 ×2、ESP32-C6-DevKitC ×1', lo: 1209, hi: 1209, src: 'verified', ref: 'iCShop 649＋280×2' },
      { name: '50 kg 荷重元 ×8＋HX711 ×3', lo: 300, hi: 600, src: 'estimate', ref: 'HX711 iCShop NT$22' },
      { name: 'SHT40 溫濕度 ×2＋VL53L1X ToF ×2', lo: 1300, hi: 1700, src: 'verified', ref: 'Pololu VL53L1X NT$488' },
      { name: '壓電薄膜 TE LDT0-028K ×6', lo: 900, hi: 2100, src: 'estimate', ref: '台灣物聯科技有貨' },
      { name: 'ER14505 鋰亞電池 ×4＋超級電容（應付發射尖峰）', lo: 1000, hi: 1500, src: 'verified', ref: '百裕 EEMB NT$178' },
      { name: 'LoRa 920 MHz：Wio-SX1262 ×2＋Heltec V3（當簡易閘道）', lo: 1300, hi: 1800, src: 'estimate' },
      { name: '防水盒、PG7 接頭、灌封膠、線材、耗材', lo: 1500, hi: 3000, src: 'estimate' },
      { name: 'Nordic PPK2 功耗量測儀（可以一直用）', lo: 3500, hi: 4500, src: 'estimate', note: '推算電池壽命一定要用' },
      { name: '雲端 Cloudflare 免費方案＋LINE 官方帳號輕用量', lo: 0, hi: 0, src: 'verified' },
      { name: 'ES302 樣品、木框凹槽（公司庫存）', lo: 0, hi: 0, src: 'estimate' },
      { name: '（選用）4G 路由器 TL-MR100＋IoT SIM', lo: 1535, hi: 1735, src: 'verified', optional: true, ref: 'PChome 1,499 起；SIM 月租 35 起' },
    ],
  },
  {
    id: 'p1',
    name: '第 1 階段',
    title: '密封模組＋3 個試點',
    when: '第 2–4 個月',
    goal: '5 組灌膠模組、公司門口＋2 個友好案場，連續 60 天不斷線',
    items: [
      { name: 'PCB 線路與 Layout 外包審查', lo: 10000, hi: 20000, src: 'estimate', ref: 'Pro360 行情 3,000–15,000／件' },
      { name: 'PCB 打樣＋SMT 10 片 ×2 版次', lo: 5000, hi: 10000, src: 'verified', ref: 'JLCPCB 開機費 US$8 起' },
      { name: '模組零件 ×5 組（MCU、LoRa 模組、感測、電池）', lo: 7500, hi: 12500, src: 'estimate' },
      { name: '鋁框端蓋模組艙 CNC＋灌膠 ×5（胎壓計工廠協助）', lo: 2500, hi: 7500, src: 'estimate', note: '用自家鋁擠型，不用開塑膠模' },
      { name: '射頻／天線調校（胎壓計工廠協助；若外包）', lo: 0, hi: 30000, src: 'estimate' },
      { name: '閘道器 ×3 棟（LoRa 閘道＋4G 路由器）', lo: 7000, hi: 28000, src: 'verified', ref: 'RAK7268V2 US$154 起' },
      { name: 'IoT SIM ×3 × 3 個月', lo: 315, hi: 720, src: 'verified', ref: '中華電信 LTE-M 40／月、遠傳 IoT 4G 35／月' },
      { name: 'NCC 登錄（用已取得 NCC 的無線模組）', lo: 1500, hi: 2100, src: 'verified', ref: '登錄費 1,500＋證照費 600' },
      { name: '產品責任險＋公共意外責任險（一年）', lo: 10000, hi: 30000, src: 'estimate', note: '請保經報價' },
      { name: '試點協議、個資條款請律師審閱', lo: 5000, hi: 15000, src: 'estimate' },
      { name: '試點安裝工時與交通（自家施工班）', lo: 10000, hi: 20000, src: 'estimate' },
      { name: '雲端＋LINE 中用量（3 個月）', lo: 0, hi: 3000, src: 'verified', ref: 'LINE 中用量 2026/11 起 NT$1,000／月' },
      { name: '（選用）NCC 完整送測（如果模組沒有 NCC）', lo: 80000, hi: 150000, src: 'estimate', optional: true, ref: '審驗費 10,300＋實驗室測試費' },
    ],
  },
  {
    id: 'p2',
    name: '第 2 階段',
    title: '10–30 個入口付費試點',
    when: '第 5–12 個月',
    goal: '試點轉付費 ≥ 30%，每入口每月毛利 ≥ NT$1,000',
    items: [
      { name: '模組小量生產 ×30（零件＋PCBA＋灌膠）', lo: 60000, hi: 120000, src: 'estimate' },
      { name: '閘道器 ×10 棟', lo: 23000, hi: 92000, src: 'estimate' },
      { name: '韌體／硬體外包：低功耗、量產測試治具', lo: 80000, hi: 200000, src: 'estimate', ref: '低功耗節點設計行情 8–30 萬' },
      { name: '資安 code review（上線前一次）', lo: 10000, hi: 30000, src: 'estimate' },
      { name: '服務人力：清坑、換毯（由現有施工班兼任）', lo: 60000, hi: 150000, src: 'estimate' },
      { name: '行銷：案例影片、規範範本、WELL 合規包、型錄', lo: 30000, hi: 80000, src: 'estimate' },
      { name: '雲端＋LINE＋SIM（8 個月）', lo: 10000, hi: 30000, src: 'estimate' },
      { name: '（選用）智慧城市展 2027 小攤位', lo: 60000, hi: 150000, src: 'estimate', optional: true, note: '早鳥報名到 10/30' },
      { name: '（選用）NCC 完整型式認證', lo: 80000, hi: 150000, src: 'estimate', optional: true },
    ],
  },
];

export const SBIR_PHASE1 = { rate: 0.5, cap: 1500000 };

/** 階段小計；selected = Set(項目 key)，未提供時只算非選用項目 */
export function phaseTotal(phase, selected) {
  let lo = 0;
  let hi = 0;
  phase.items.forEach((it, i) => {
    const on = selected ? selected.has(`${phase.id}:${i}`) : !it.optional;
    if (!on) return;
    lo += it.lo;
    hi += it.hi;
  });
  return { lo, hi };
}

export function defaultSelection() {
  const s = new Set();
  for (const p of PHASES) p.items.forEach((it, i) => !it.optional && s.add(`${p.id}:${i}`));
  return s;
}

/** SBIR Phase 1：補助最多 50%，上限 150 萬（2026 年起）。回傳政府補助與公司自付。 */
export function withSubsidy(total, { rate, cap } = SBIR_PHASE1) {
  const grant = Math.min(cap, total * rate);
  return { grant, own: total - grant };
}
