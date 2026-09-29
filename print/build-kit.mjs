// 產生「試行工具包」的可列印 PDF，並匯出採購清單資料給 XLSX 使用。
// 用法：cd print && npm run kit
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PHASES, phaseTotal } from '../web/src/calc/budget.js';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/opt/node22/lib/node_modules/')('playwright');
}

const here = import.meta.dirname;
const kitDir = resolve(here, '..', '試行工具包');
await mkdir(kitDir, { recursive: true });
await mkdir(resolve(here, 'tools'), { recursive: true });

// 採購清單資料（給 build_xlsx.py）
await writeFile(resolve(here, 'tools', 'budget.json'), JSON.stringify(PHASES, null, 2));

const p0 = phaseTotal(PHASES[0]);
const wan = (v) => (v / 10000).toFixed(1).replace(/\.0$/, '');
const p0Range = `NT$${wan(p0.lo)}–${wan(p0.hi)} 萬`;

const lines = (n) => Array.from({ length: n }, () => '<div class="line"></div>').join('');
const box = (h = 22) => `<div class="fill" style="height:${h}mm"></div>`;
const cb = '<span class="cb"></span>';
const head = (kicker, title, sub = '') =>
  `<header class="doc-head"><p class="kicker">${kicker}</p><h1>${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}</header>`;
const fields = (pairs) => `<div class="fields">${pairs.map((f) => `<div><span>${f}</span><i></i></div>`).join('')}</div>`;
const sign = (roles) => `<div class="signs">${roles.map((r) => `<div><span>${r}</span><i></i><small>日期：</small></div>`).join('')}</div>`;

const DOCS = {
  '00-第一週行動清單': `
    ${head('Project Alishan・試行工具包 00', '第一週行動清單', `目標：4 週內在一片 ES302 樣品上做出「人踩上去，手機就收到 LINE」的原型。第 0 階段預算 ${p0Range}。`)}
    ${fields(['開始日期', '負責人'])}
    <h2>第一週就做的 5 件事</h2>
    <table class="check"><thead><tr><th>✓</th><th>事項</th><th>誰</th><th>完成日</th><th>備註</th></tr></thead><tbody>
      ${[
        ['下單第 0 階段零件（見 01 採購清單）', '提案人'],
        ['拿一片 ES302 樣品，做 2 cm 深的木框當凹槽', '提案人＋施工班'],
        ['申請 LINE 官方帳號，開通 Messaging API（免費）', '提案人'],
        ['把既有安裝名單整理進 02 案場盤點表', '提案人＋業務'],
        ['打給親戚的胎壓計工廠，約參觀（帶 05 訪談單）', '董事長'],
      ]
        .map(([t, w]) => `<tr><td>${cb}</td><td>${t}</td><td>${w}</td><td></td><td></td></tr>`)
        .join('')}
    </tbody></table>
    <h2>第 2–4 週</h2>
    <table class="check"><thead><tr><th>✓</th><th>週</th><th>事項</th><th>誰</th><th>備註</th></tr></thead><tbody>
      ${[
        ['1–2', '蓋上鋁框後測訊號：LoRa 920 MHz／BLE／4G（大廳、地下室各測一次）', '提案人'],
        ['2–3', '壓電計步準確度（手動計數比對 200 步）；電容電極倒砂 50／100／200 g', '提案人'],
        ['2–3', '從盤點表挑 5–8 個試點點位；看一次 03 試點協議範本', '提案人'],
        ['2–4', '約 1–2 家往來最深的建商或物業公司（帶 04 一頁簡介）', '董事長'],
        ['3–4', '雲端後端＋LINE 通知；接中央氣象署雨量資料', '提案人'],
        ['3–4', '確認 SBIR 資格（員工數、資本額），開始寫計畫書', '提案人'],
        ['4', '公司門口實測一週、錄影人工計數；做一次「曬熱後冷水沖」測試', '提案人'],
        ['4', '<b>決定點①</b>：填 08 決定點檢核表，由董事長決定要不要進第 1 階段', '董事長'],
      ]
        .map(([w, t, who]) => `<tr><td>${cb}</td><td>${w}</td><td>${t}</td><td>${who}</td><td></td></tr>`)
        .join('')}
    </tbody></table>
    <p class="small">每週五用 07 每週進度報告範本回報一次。</p>`,

  '03-試點合作協議範本': `
    ${head('Project Alishan・試行工具包 03', '易潔寶 Alishan Care 試點合作協議（範本）', '一頁版。正式使用前請律師審閱。')}
    ${fields(['甲方（案場／管委會／公司）', '代表人', '乙方', '易潔寶®（必買企業有限公司）', '案場地址', '試點入口數'])}
    <ol class="terms">
      <li><b>試點範圍</b>：乙方在甲方指定入口的既有（或新設）除泥地墊內，加裝 Alishan Sense 感測設備（壓電感測底座條、凹槽電極、模組艙），並提供監測、LINE 通知與維護報表服務。踩踏面外觀不變。</li>
      <li><b>期間</b>：自 ______ 年 ___ 月 ___ 日起至 ______ 年 ___ 月 ___ 日止，共 ___ 個月（建議 3–6 個月）。</li>
      <li><b>費用</b>：試點期間，感測設備、安裝、雲端與服務<b>全部免費</b>。</li>
      <li><b>甲方配合事項</b>：提供施工時段（約 1 小時）；清潔人員在 LINE 上回報處理狀況；每次清坑時協助秤砂紀錄。<br>
        ${cb} 同意乙方以案場名稱、照片與數據作為案例對外說明　${cb} 只同意匿名使用</li>
      <li><b>成功指標</b>（試點開始前雙方先填基準）：
        <table><thead><tr><th>指標</th><th>試點前基準</th><th>目標</th><th>結果</th></tr></thead><tbody>
          <tr><td>大廳拖地／巡檢次數（次／日）</td><td></td><td>減少 ___%</td><td></td></tr>
          <tr><td>雨天濕滑警報的平均處理時間</td><td>—</td><td>___ 分鐘內</td><td></td></tr>
          <tr><td>入口滑倒事件數</td><td></td><td>不增加</td><td></td></tr>
          <tr><td>凹槽清潔紀錄（每週）</td><td></td><td>每週至少 1 次</td><td></td></tr>
        </tbody></table></li>
      <li><b>期滿</b>：甲方於期滿後 30 日內決定是否續用。續用時依下列方案計費（每入口每月，未稅）：<br>
        ${cb} 基本 NT$______　${cb} 標準 NT$______　${cb} 全責 NT$______<br>
        不續用時，乙方回收感測設備並恢復原狀，甲方不需負擔任何費用。</li>
      <li><b>資料與個資</b>：只收集環境數據（踩踏次數、積水、積砂估計），<b>不拍照、不錄影</b>。清潔人員的 LINE 帳號只用於派工通知，保存期限 2 年；甲方可以要求刪除。</li>
      <li><b>設備與責任</b>：設備所有權屬乙方。系統警報為輔助工具，不取代甲方既有的清潔與安全管理責任；乙方責任以試點期間實際收取之費用為上限（試點免費期間除外故意或重大過失）。</li>
    </ol>
    ${sign(['甲方簽章', '乙方簽章'])}`,

  '04-拜訪用一頁簡介': `
    <div class="flyer">
      <p class="kicker">易潔寶® 178mat・Alishan Care</p>
      <h1>讓入口自己開口：<br>「該清了」「會滑了」「有人來了」</h1>
      <div class="flyer-grid">
        <div>
          <h2>您的入口，現在是這樣</h2>
          <ul>
            <li>清潔人力難找、工資年年漲，還是要固定時間去巡</li>
            <li>下雨天大廳濕滑，有人跌倒就是糾紛</li>
            <li>地墊凹槽積砂、毯條磨損，通常要等到很髒才發現</li>
            <li>要拿維護紀錄給管委會、董事會、綠建築認證，卻沒有數據</li>
          </ul>
          <aside class="pitch"><b>一句話</b>下雨天有人在大廳滑倒，管委會可能要負責。Alishan Care 會自動提醒放警示牌、派人拖地，每一次都有紀錄。那份紀錄，就是「已盡注意義務」的證據。</aside>
        </div>
        <div><img src="img/prod-explode.png" alt=""><p class="small">感測器藏在鋁條底下，踩踏面外觀完全不變。</p></div>
      </div>
      <h2>我們做什麼</h2>
      <table><tbody>
        <tr><th>裝什麼</th><td>在易潔寶地墊裡換上幾條「壓電感測底座條」、放兩片凹槽電極、邊框旁加一個模組艙。<b>不用重新施工，既有案場約 1 小時完成。</b></td></tr>
        <tr><th>您得到</th><td>① LINE 即時通知：積砂該清、雨天濕滑、夜間有人進入　② 自動派工與完成回報　③ 每月維護報表（可用於 WELL／LEED／ESG）　④ 毯條快磨完前主動安排更換</td></tr>
        <tr><th>方案</th><td>基本 NT$1,500／標準 NT$2,500／全責 NT$4,500（每入口每月，試點後依實際情況報價）</td></tr>
      </tbody></table>
      <aside class="note"><b>試點邀請</b>我們正在找 5–8 個案場做 3–6 個月的<b>免費試點</b>：設備、安裝、服務全部免費，只請您同意提供數據、讓我們把成果當作案例。試點結束不續用，我們把設備收回、恢復原狀。</aside>
      <div class="contact">易潔寶® 除泥地墊・SINCE 2002　｜　電話 (02)2345-3467　｜　LINE ID：178mat　｜　www.178mat.com<br>聯絡人：____________　手機：____________</div>
    </div>`,

  '05-胎壓計工廠訪談單': `
    ${head('Project Alishan・試行工具包 05', '胎壓計工廠訪談單', '目的：確認能不能一起做「智慧地墊模組艙」的密封、無線與小量生產，以及明年一起申請 CITD 研發聯盟。')}
    ${fields(['日期', '工廠', '受訪者／職稱', '我方出席'])}
    <h2>帶去的東西</h2>
    <p>${cb} ES302 樣品一段　${cb} 列印版提案書（剖面 A／B 那兩頁）　${cb} 需求規格（下表）</p>
    <table><tbody>
      <tr><th>模組艙尺寸</th><td>約 200 × 34 × 23 mm，嵌在邊框端部、與地坪齊平；上蓋為 200 × 25 mm 非金屬天線窗</td></tr>
      <tr><th>防水</th><td>IP68（1.5 m、7 天）＋ IP69K（高壓熱水沖洗）</td></tr>
      <tr><th>溫度</th><td>以 85°C 設計（戶外地面曬到 70°C）</td></tr>
      <tr><th>無線</th><td>920–925 MHz LoRa（台灣 AS923）或 BLE；<b>不用 433 MHz</b></td></tr>
      <tr><th>電池</th><td>ER18505 鋰亞電池＋超級電容；平均約 6–10 µA；目標 ≥ 5 年</td></tr>
      <tr><th>感測輸入</th><td>4–6 條 PVDF 壓電膜（比較器喚醒）、1 組電容電極（FDC1004）、3 支積水電極</td></tr>
    </tbody></table>
    ${[
      '現在用哪一個晶片平台（例如 Infineon SP4x、NXP FXTH87）？能不能改寫韌體，讀外部的壓電膜和電容電極？',
      '有沒有 NCC、FCC 認證紀錄？配合哪一家實驗室？有沒有 920 MHz 的經驗？',
      '灌膠設備（真空灌膠、PU 或環氧）、烘烤、IP68／IP69K 測試能力？',
      '電池焊片組裝，以及電池壽命的驗證方法？',
      '小量代工條件：最低訂量、每組打件與灌膠報價、測試治具費用？（先問 5 組、30 組、300 組）',
      '有沒有工廠登記、IATF 品質體系？願不願意一起申請 CITD 研發聯盟？',
    ]
      .map((q, i) => `<div class="q"><b>${i + 1}. ${q}</b>${box(16)}</div>`)
      .join('')}
    <h2>結論與下一步</h2>
    ${box(18)}`,

  '07-每週進度報告範本': `
    ${head('Project Alishan・試行工具包 07', '每週進度報告', '每週五交給董事長，一頁就好。')}
    ${fields(['第幾週', '日期', '目前階段', '填寫人'])}
    <h2>本週完成</h2>${lines(3)}
    <h2>關鍵數字</h2>
    <table><thead><tr><th>項目</th><th>本週</th><th>目標</th><th>狀態</th></tr></thead><tbody>
      ${[
        ['計步誤差', '< 5%'],
        ['方向正確率', '> 95%'],
        ['蓋鋁框後訊號餘量（RSSI）', '≥ 10 dB'],
        ['模組平均電流', '< 15 µA'],
        ['已接觸的建商／物業公司', '—'],
        ['已簽試點數', '5–8'],
        ['累計花費／預算', `第 0 階段 ${p0Range}`],
      ]
        .map(([k, g]) => `<tr><td>${k}</td><td></td><td>${g}</td><td>${cb} 正常 ${cb} 注意</td></tr>`)
        .join('')}
    </tbody></table>
    <h2>遇到的問題</h2>${lines(2)}
    <h2>下週計畫</h2>${lines(2)}
    <h2>需要董事長決定或協助的事</h2>${lines(2)}`,

  '08-決定點檢核表': `
    ${head('Project Alishan・試行工具包 08', '決定點檢核表', '每個階段結束時，用實測數字決定要不要繼續。由董事長簽名。')}
    ${[
      [
        '決定點①　第 4 週：要不要進第 1 階段',
        [
          ['計步誤差（影片人工計數比對）', '< 5%'],
          ['方向正確率', '> 95%'],
          ['電容電極能分辨倒砂', '50 g'],
          ['蓋上鋁框後的訊號餘量', '≥ 10 dB'],
          ['實際花費', p0Range + ' 以內'],
        ],
      ],
      [
        '決定點②　第 13 週：要不要進第 2 階段',
        [
          ['3 個試點連續運作', '60 天不斷線'],
          ['推算電池壽命', '≥ 2 年'],
          ['願意談分潤或交屋包的物業公司／建商', '≥ 1 家'],
          ['SBIR 送件', '已送出'],
        ],
      ],
      [
        '決定點③　第 12 個月：要不要擴大',
        [
          ['試點轉付費率', '≥ 30%'],
          ['每入口每月毛利', '≥ NT$1,000'],
          ['積砂模型：清坑秤重與估計的誤差', '記錄至少 10 次'],
        ],
      ],
    ]
      .map(
        ([t, rows]) => `<div class="gate-block"><h2>${t}</h2>
      <table><thead><tr><th>條件</th><th>標準</th><th>實測</th><th>過關</th></tr></thead><tbody>
        ${rows.map(([k, s]) => `<tr><td>${k}</td><td>${s}</td><td></td><td>${cb}</td></tr>`).join('')}
      </tbody></table>
      <p>決定：${cb} 繼續　${cb} 調整後再測（______ 週）　${cb} 停止　　董事長簽名：__________________　日期：__________</p></div>`,
      )
      .join('')}`,
};

const kitCss = `
.doc-head { margin-bottom: 8pt; }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 16pt; margin: 6pt 0 10pt; }
.fields div { display: flex; align-items: flex-end; gap: 6pt; }
.fields span { white-space: nowrap; font-weight: 700; font-size: 9.5pt; }
.fields i { flex: 1; border-bottom: 1px solid #7d8088; height: 14pt; }
.line { border-bottom: 1px solid #b9b7b0; height: 20pt; }
.fill { border: 1px solid #b9b7b0; border-radius: 4pt; margin: 4pt 0 8pt; }
.cb { display: inline-block; width: 10pt; height: 10pt; border: 1.2px solid #16181b; border-radius: 2pt; vertical-align: -1pt; }
table.check td:first-child { width: 18pt; text-align: center; }
table.check td:nth-child(4), table.check td:nth-child(5) { width: 22mm; }
.terms { padding-left: 1.2em; font-size: 9.8pt; }
.terms li { margin-bottom: 5pt; }
.terms table { margin-top: 4pt; font-size: 9pt; }
.signs { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; margin-top: 16pt; }
.signs div { display: grid; gap: 4pt; }
.signs i { border-bottom: 1px solid #16181b; height: 30pt; }
.q { margin: 6pt 0; break-inside: avoid; }
.q b { font-size: 10pt; }
.gate-block { break-inside: avoid; margin-bottom: 10pt; }
.flyer h1 { font-size: 22pt; }
.flyer-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 12pt; align-items: start; }
.flyer-grid img { width: 100%; border: 1px solid #d9d7d0; border-radius: 4pt; margin-top: 18pt; }
.contact { margin-top: 12pt; padding-top: 8pt; border-top: 2px solid #0f6e56; font-size: 9.5pt; text-align: center; }
`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const [name, body] of Object.entries(DOCS)) {
  const html = `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><title>${name}</title>
<link rel="stylesheet" href="node_modules/@fontsource/noto-sans-tc/400.css">
<link rel="stylesheet" href="node_modules/@fontsource/noto-sans-tc/700.css">
<link rel="stylesheet" href="print.css"><style>${kitCss}</style></head><body>${body}</body></html>`;
  const htmlPath = resolve(here, `.kit-${name}.html`);
  await writeFile(htmlPath, html);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: resolve(kitDir, name + '.pdf'),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:8px;color:#7d8088;padding:0 15mm;display:flex;justify-content:space-between;font-family:'Noto Sans TC','WenQuanYi Zen Hei',sans-serif"><span>Project Alishan｜試行工具包</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' },
  });
  console.log('✓', name);
}
await browser.close();
