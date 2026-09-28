import { PHASES, phaseTotal, defaultSelection, withSubsidy } from '../calc/budget.js';

// 前 90 天：以 2026-10-05（週一）為第 1 週
const START = new Date(2026, 9, 5);
const WEEKS = 13;

export const TASKS = [
  { track: 'tech', w: [1, 1], t: '下單零件、樣品放進木框凹槽', who: '提案人' },
  { track: 'tech', w: [1, 2], t: '蓋上鋁框後測訊號：LoRa 920 MHz／BLE／4G', who: '提案人' },
  { track: 'tech', w: [2, 3], t: '壓電計步準確度；電容電極倒砂測試（50／100／200 g）', who: '提案人' },
  { track: 'tech', w: [3, 4], t: 'Cloudflare 後端＋LINE 官方帳號通知', who: '提案人＋AI' },
  { track: 'dp', w: [4, 4], t: '決定點①：公司門口實測一週、看影片，決定要不要進第 1 階段', who: '董事長' },
  { track: 'tech', w: [5, 8], t: '模組艙：鋁框端蓋＋灌膠；PCB Layout 與外包審查', who: '胎壓計工廠＋提案人' },
  { track: 'tech', w: [7, 9], t: '5 組模組組裝；浸水、沖洗、荷重測試', who: '胎壓計工廠' },
  { track: 'tech', w: [9, 13], t: '3 個試點安裝、儀表板、LINE 派工', who: '施工班＋提案人' },
  { track: 'biz', w: [1, 3], t: '整理既有安裝名單，挑 5–8 個試點；擬一頁試點協議', who: '提案人' },
  { track: 'biz', w: [2, 6], t: '約 1–2 家建商、物業公司（東京都物業、中保科等）談白牌／分潤', who: '董事長帶隊' },
  { track: 'biz', w: [4, 8], t: '規範範本（CSI 12 48 13＋性能條款）、WELL A09 合規包', who: '提案人' },
  { track: 'biz', w: [6, 10], t: '拜訪 2–3 家綠建築顧問；問 TABC 能不能算智慧建材加分', who: '提案人' },
  { track: 'biz', w: [10, 10], t: '台北建材展 12/10–13 參觀、約建築師見面', who: '全員' },
  { track: 'biz', w: [9, 13], t: '簽試點協議、3 個試點上線', who: '董事長＋提案人' },
  { track: 'fund', w: [1, 2], t: '確認 SBIR 資格（員工數、資本額），開始寫計畫書', who: '提案人' },
  { track: 'fund', w: [4, 4], t: '決定要不要報名智慧城市展（早鳥 10/30）', who: '董事長' },
  { track: 'fund', w: [3, 6], t: 'SBIR Phase 1 簡報制送件（補 50%、上限 150 萬）', who: '提案人' },
  { track: 'fund', w: [6, 8], t: '產品責任險、公共意外險詢價；律師審閱試點協議', who: '董事長' },
  { track: 'fund', w: [8, 13], t: '準備 CITD 研發聯盟（胎壓計工廠＋法人），2027 年初送件', who: '提案人' },
  { track: 'dp', w: [13, 13], t: '決定點②：看試點數據與 SBIR 結果，決定第 2 階段', who: '董事長' },
];

function weekLabel(i) {
  const d = new Date(START);
  d.setDate(d.getDate() + (i - 1) * 7);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderGantt() {
  const g = document.getElementById('gantt');
  const head = ['<div class="gh task">工作項目</div>'];
  for (let i = 1; i <= WEEKS; i++) head.push(`<div class="gh">W${i}<small>${weekLabel(i)}</small></div>`);
  const rows = TASKS.map((t) => {
    const cells = [`<div class="gt ${t.track}" role="rowheader"><b>${t.t}</b><small>${t.who}</small></div>`];
    cells.push(
      `<div class="gb ${t.track}" style="grid-column:${t.w[0] + 1} / ${t.w[1] + 2}" title="第 ${t.w[0]}${t.w[1] !== t.w[0] ? '–' + t.w[1] : ''} 週">${t.track === 'dp' ? '◆' : ''}</div>`,
    );
    return `<div class="grow" role="row">${cells.join('')}</div>`;
  });
  g.innerHTML = `<div class="grow head" role="row">${head.join('')}</div>${rows.join('')}`;
}

// 總額以「萬」顯示（小於 1 萬時顯示整數），避免精確到個位數給人錯誤的精準感
const wan = (v) => (v >= 10000 ? (v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') : Math.round(v).toLocaleString());
const unit = (v) => (v >= 10000 ? ' 萬' : '');
const range = (t) => (Math.abs(t.hi - t.lo) < 1 ? `NT$${wan(t.lo)}${unit(t.lo)}` : `NT$${wan(t.lo)}${t.lo >= 10000 === t.hi >= 10000 ? '' : unit(t.lo)}–${wan(t.hi)}${unit(t.hi)}`);

function renderBudget() {
  const box = document.getElementById('budget');
  const sel = defaultSelection();
  let tab = 'p0';
  let sbir = false;

  function draw() {
    const p = PHASES.find((x) => x.id === tab);
    const totals = PHASES.map((x) => phaseTotal(x, sel));
    const cumLo = totals.reduce((a, t) => a + t.lo, 0);
    const cumHi = totals.reduce((a, t) => a + t.hi, 0);
    const rd = { lo: totals[1].lo + totals[2].lo, hi: totals[1].hi + totals[2].hi };
    const sLo = withSubsidy(rd.lo);
    const sHi = withSubsidy(rd.hi);
    const t = totals[PHASES.indexOf(p)];
    box.innerHTML = `
      <div class="btabs" role="tablist">${PHASES.map((x, i) => `<button role="tab" data-t="${x.id}" class="${x.id === tab ? 'on' : ''}"><b>${x.name}</b><span>${x.title}</span><em>${range(totals[i])}</em></button>`).join('')}</div>
      <div class="bgoal"><b>${p.when}</b>　目標：${p.goal}</div>
      <table class="tbl btable">
        <thead><tr><th></th><th>項目</th><th class="num">價格（NT$）</th><th>來源</th></tr></thead>
        <tbody>${p.items
          .map((it, i) => {
            const k = `${p.id}:${i}`;
            return `<tr class="${sel.has(k) ? '' : 'off'}"><td><input type="checkbox" data-k="${k}" ${sel.has(k) ? 'checked' : ''} aria-label="計入 ${it.name}"></td>
              <td>${it.name}${it.note ? `<small>${it.note}</small>` : ''}</td>
              <td class="num">${it.lo === it.hi ? it.lo.toLocaleString() : `${it.lo.toLocaleString()}–${it.hi.toLocaleString()}`}</td>
              <td><span class="src ${it.src}">${it.src === 'verified' ? '查證' : '估計'}</span>${it.ref ? `<small>${it.ref}</small>` : ''}</td></tr>`;
          })
          .join('')}</tbody>
        <tfoot><tr><td></td><th>${p.name}小計</th><th class="num">${range(t)}</th><td></td></tr></tfoot>
      </table>
      <div class="bsum">
        <div class="kpi"><p class="l">最壞情況（只做第 0 階段就停）</p><p class="v">${range(totals[0])}</p></div>
        <div class="kpi"><p class="l">三個階段合計（第一年）</p><p class="v">${range({ lo: cumLo, hi: cumHi })}</p></div>
        <div class="kpi"><p class="l">${sbir ? '申請 SBIR 後，第 1＋2 階段公司自付' : '第 1＋2 階段（研發，可申請 SBIR）'}</p><p class="v">${sbir ? range({ lo: sLo.own, hi: sHi.own }) : range(rd)}</p>
          <label class="toggle"><input type="checkbox" id="sbirToggle" ${sbir ? 'checked' : ''}> 申請 SBIR Phase 1（補 50%）</label></div>
      </div>`;
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) {
      tab = b.dataset.t;
      draw();
    }
  });
  box.addEventListener('change', (e) => {
    if (e.target.id === 'sbirToggle') sbir = e.target.checked;
    else if (e.target.dataset.k) {
      const k = e.target.dataset.k;
      if (e.target.checked) sel.add(k);
      else sel.delete(k);
    }
    draw();
  });
  draw();
}

export function initPlanSection() {
  renderGantt();
  renderBudget();
}
