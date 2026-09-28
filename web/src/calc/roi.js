// 財務試算：純函式，不碰 DOM，方便測試。
// 所有預設值都是「保守示意假設」，會在網頁與 docs/04 標註。

export const ROI_DEFAULTS = {
  firstYearEntrances: 20, // 第一年新增的 Smart 入口數
  growth: 2, // 每年新增入口數成長倍數
  hwPrice: 18000, // 每入口 Smart 感測模組加價（一次性，含安裝）
  hwCost: 6500, // 每入口模組＋閘道分攤＋安裝工時成本
  monthlyFee: 2500, // Alishan Care 月費／入口
  serviceCost: 900, // 每入口每月服務成本（凹槽清潔攤提、換毯攤提、雲端、LINE 訊息）
  renewal: 0.9, // 年續約率
  upfront: 300000, // 一次性投入（POC、原型、模具、開發）
  fixedPerYear: 600000, // 年固定成本（雲端、客服、部分人力）
  legacyMargin: 15000, // 傳統一次銷售每入口毛利（對照用）
  years: 3,
};

// 年續約率換算成月存活率
export function monthlySurvival(renewal) {
  if (renewal <= 0) return 0;
  return Math.pow(renewal, 1 / 12);
}

export function newEntrancesInYear(p, yearIndex) {
  return p.firstYearEntrances * Math.pow(p.growth, yearIndex);
}

/**
 * 逐月模擬現金流。
 * 新增入口在一年內平均分配到每個月；已上線的入口依月存活率流失。
 */
export function computeRoi(input = {}) {
  const p = { ...ROI_DEFAULTS, ...input };
  const months = [];
  const survive = monthlySurvival(p.renewal);
  let active = 0;
  let cash = -p.upfront;
  let revenue = 0;
  let gross = 0;
  let breakevenMonth = null;
  let totalNew = 0;

  for (let m = 1; m <= p.years * 12; m++) {
    const y = Math.floor((m - 1) / 12);
    const adds = newEntrancesInYear(p, y) / 12;
    active = active * survive + adds;
    totalNew += adds;
    const rev = active * p.monthlyFee + adds * p.hwPrice;
    const cogs = active * p.serviceCost + adds * p.hwCost;
    const fixed = p.fixedPerYear / 12;
    revenue += rev;
    gross += rev - cogs;
    cash += rev - cogs - fixed;
    if (breakevenMonth === null && cash >= 0) breakevenMonth = m;
    months.push({ m, active, adds, revenue: rev, cost: cogs + fixed, cash });
  }

  const unit = unitEconomics(p);
  return {
    params: p,
    months,
    totals: {
      revenue,
      gross,
      net: cash,
      grossMargin: revenue > 0 ? gross / revenue : 0,
      entrancesAdded: totalNew,
      activeEnd: active,
    },
    arrEnd: active * p.monthlyFee * 12,
    breakevenMonth,
    unit,
  };
}

/**
 * 單一入口的經濟效益：訂閱制 vs 傳統一次銷售。
 * 預期客戶壽命採幾何級數並以 10 年封頂（保守）。
 */
export function unitEconomics(input = {}) {
  const p = { ...ROI_DEFAULTS, ...input };
  let expectedYears = 0;
  for (let k = 0; k < 10; k++) expectedYears += Math.pow(p.renewal, k);
  const monthlyContribution = p.monthlyFee - p.serviceCost;
  const hwContribution = p.hwPrice - p.hwCost;
  const ltv = hwContribution + monthlyContribution * 12 * expectedYears;
  const paybackMonths = hwContribution >= 0 ? 0 : Math.ceil(-hwContribution / Math.max(1, monthlyContribution));
  return {
    expectedYears,
    monthlyContribution,
    hwContribution,
    ltv,
    ltvVsLegacy: p.legacyMargin > 0 ? ltv / p.legacyMargin : null,
    paybackMonths,
  };
}

export const SAVINGS_DEFAULTS = {
  wage: 200, // 清潔人員時薪（NT$，參考 104／1111 職缺行情 200–250）
  patrolsPerDay: 16, // 目前每天固定巡檢次數（例：8:00–24:00 每小時一次）
  minutesPerPatrol: 6,
  reduction: 0.5, // 改成「有需要才去」後可減少的巡檢比例
  monthlyFee: ROI_DEFAULTS.monthlyFee,
};

// 客戶端：一年可以省下多少巡檢工時成本（只算看得到的人力，不含滑倒理賠與認證價值）
export function customerSavings(input = {}) {
  const p = { ...SAVINGS_DEFAULTS, ...input };
  const hoursSaved = (p.patrolsPerDay * p.minutesPerPatrol * p.reduction * 365) / 60;
  const laborSaved = hoursSaved * p.wage;
  const fee = p.monthlyFee * 12;
  return { hoursSaved, laborSaved, fee, net: laborSaved - fee };
}
