// 產生列印版 PDF：dist/阿里山計畫提案書.pdf
// 內容的數字直接讀網頁用的同一份資料（預算、財務模型、感測器說明），確保兩邊一致。
// 用法：npm run capture（先截圖，一次即可）→ npm run pdf
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PHASES, phaseTotal, withSubsidy } from '../web/src/calc/budget.js';
import { computeRoi, customerSavings, ROI_DEFAULTS } from '../web/src/calc/roi.js';
import { SENSORS } from '../web/src/scene/sensorData.js';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/opt/node22/lib/node_modules/')('playwright');
}

const here = import.meta.dirname;
const root = resolve(here, '..');
const img = (n) => `img/${n}.png`;

// ---------- 數字格式 ----------
const wan = (v) => (v >= 10000 ? (v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') : Math.round(v).toLocaleString());
const unit = (v) => (v >= 10000 ? ' 萬' : '');
const range = (t) => (Math.abs(t.hi - t.lo) < 1 ? `NT$${wan(t.lo)}${unit(t.lo)}` : `NT$${wan(t.lo)}${t.lo >= 10000 === t.hi >= 10000 ? '' : unit(t.lo)}–${wan(t.hi)}${unit(t.hi)}`);
const nt = (v) => (v < 0 ? '−' : '') + 'NT$' + (Math.abs(v) >= 10000 ? (Math.abs(v) / 10000).toFixed(0) + ' 萬' : Math.round(Math.abs(v)).toLocaleString());
const num = (v) => v.toLocaleString();

// ---------- 預算與財務（計算） ----------
const totals = PHASES.map((p) => phaseTotal(p));
const all = { lo: totals.reduce((a, t) => a + t.lo, 0), hi: totals.reduce((a, t) => a + t.hi, 0) };
const rd = { lo: totals[1].lo + totals[2].lo, hi: totals[1].hi + totals[2].hi };
const own = { lo: withSubsidy(rd.lo).own, hi: withSubsidy(rd.hi).own };
const base = computeRoi();
const sens = [
  ['預設（通路分潤 10%）', {}],
  ['全部直銷（分潤 0%）', { partnerCut: 0 }],
  ['月費降到 NT$1,800', { monthlyFee: 1800 }],
  ['續約率降到 75%', { renewal: 0.75 }],
  ['第一年只有 10 個入口', { firstYearEntrances: 10 }],
].map(([name, p]) => {
  const r = computeRoi(p);
  return [name, r.breakevenMonth ? `第 ${r.breakevenMonth} 個月` : '<b>三年內未回本</b>', nt(r.arrEnd), nt(r.totals.net)];
});
const cust = customerSavings();

// ---------- 小元件 ----------
const table = (head, rows, cls = '') =>
  `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
const fig = (name, cap, cls = '') => `<figure class="${cls}"><img src="${img(name)}" alt=""><figcaption>${cap}</figcaption></figure>`;
const box = (title, body, cls = 'note') => `<aside class="${cls}"><b>${title}</b>${body}</aside>`;
let chapterNo = 0;
const toc = [];
const chapter = (title, sub, body) => {
  chapterNo++;
  toc.push([chapterNo, title]);
  return `<section class="chapter"><p class="kicker">第 ${chapterNo} 章</p><h1>${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}${body}</section>`;
};
const appendix = (id, title, body) => {
  toc.push([id, title]);
  return `<section class="chapter"><p class="kicker">附錄 ${id}</p><h1>${title}</h1>${body}</section>`;
};

// ---------- 內容 ----------
const chapters = [];

chapters.push(
  chapter(
    '我們是誰',
    '易潔寶是台灣最早自製鋁合金除泥地墊的廠商之一。產品用台灣的山命名；這次的轉型，我們叫它「阿里山」。',
    `${table(
      ['年份', '事件'],
      [
        ['2002', '引進鋁合金除泥地墊，同年第一塊自製產品出廠'],
        ['2004', '設廠量產，跟設計師、建築師一起推廣'],
        ['2005', '註冊「易潔寶®」商標'],
        ['2019', '玉山 ES302 通過 SGS 試驗（HK-19-04861），抗壓 15,000 kgf'],
        ['2026', 'Project Alishan：智慧化、服務化'],
      ],
      'narrow',
    )}
    <h2>產品系列</h2>
    ${table(
      ['系列', '說明'],
      [
        ['玉山 ES302', '主力產品。6063-T5 鋁擠型，鋁條寬 30 mm、高 18 mm；墊高 23 mm、凹槽 20 mm；重量級，適合每日 2,000 人次以上'],
        ['雪山 SM305', '豪宅、廠辦案例'],
        ['象山 SS103', '1 cm 平鋪式，不用開挖'],
        ['下一座山：阿里山', '不是新的鋁條，而是讓每一座山都「會說話」：感測、雲端、服務'],
      ],
    )}
    <h2>做過的地方（節錄自官網案例）</h2>
    <p>桃園機場第一、二航廈、林口長庚質子治療中心、中國醫大附醫、奇美博物館、海洋科技博物館、台中科博館、台南／路竹／中科的科技廠辦、阿里山飯店、中和環球購物中心；建商有遠雄、冠德、國建、鄉林、總太、麗寶等。官網上有 400 多篇施工案例。</p>
    <h2>老實說，我們的弱點</h2>
    <ul>
      <li>營收幾乎都是<b>一次性工程款</b>，做完就結束，每年都要從零開始接案。</li>
      <li>客戶用了 10 年、15 年才想到換毯條，<b>中間跟客戶完全沒有聯繫</b>。</li>
      <li>數位能見度低：官網是 Blogger，沒有經營電商和社群，價格也不公開。</li>
      <li>鋁條地墊很容易被拿來比價。</li>
    </ul>
    ${box('關鍵發現', '我們已經有訂閱業務的種子：「舊毯換新」（大甲糕餅店 15 年更新、中和環球購物中心更換毯面）。只是現在都是客戶想到才打電話來。阿里山計畫要做的，是讓數據告訴我們「什麼時候該去」。')}`,
  ),
);

chapters.push(
  chapter(
    '市場在變',
    '客戶要買的不再只是一塊地墊，而是一個「交代得過去」的入口：物管要報表，ESG 要紀錄，業主怕有人滑倒要理賠，清潔人力又越來越難找。',
    `<div class="stats">
      <div><b>85%</b><span>室內的髒污是從鞋底帶進來的（ISSA 等產業研究常引用）</span></div>
      <div><b>NT$200–250</b><span>清潔人員時薪；都會區全職月薪約 2.8–4 萬，越來越難找人（104／1111）</span></div>
      <div><b>≥ 3 m</b><span>WELL、LEED 對入口防塵系統的最短長度；WELL 另外要求維護計畫</span></div>
      <div><b>2024</b><span>智慧建築標章新版評估手冊：維運管理、智慧創新等指標都能加分</span></div>
    </div>
    ${table(
      ['', '買家會問的問題'],
      [
        ['以前', '「一米多少錢？」「多厚？」「要多久可以做好？」'],
        ['現在', '「能不能證明有每週維護？」「下雨天會不會有人滑倒？」「能不能少派一個人巡邏？」「有沒有報表可以給董事會看？」'],
      ],
    )}`,
  ),
);

chapters.push(
  chapter(
    '產品：易潔寶 Smart',
    '同一塊玉山 ES302，把感測器藏進我們本來就有的結構裡。以下 3D 圖依 ES302 規格表和 4-BLOCK 施工大樣圖的真實尺寸建模。',
    `<div class="grid2">${fig('prod-assembled', '組合完成：踩踏面上沒有任何電子零件')}${fig('prod-explode', '爆炸圖：由上到下是面材、鋁骨架、鋼索與墊圈、PVC 底座、感測底座條、凹槽電極、模組艙')}</div>
    <h2>三個原則</h2>
    <ol>
      <li><b>不動鋁條、不動施工</b>：鋁擠型、面材、鋼索、施工四步驟全部照舊，客人看不出差別。</li>
      <li><b>只多三樣東西</b>：幾條「壓電感測底座條」（外形跟原本的 PVC 底座一樣）、凹槽底的電極條、邊框端的模組艙。舊案改裝也是換這三樣，約 1 小時。</li>
      <li><b>每一種做法都有別的領域已經用了很多年</b>（見第 4 章）。</li>
    </ol>`,
  ),
);

const sensorPages = SENSORS.map(
  (s) => `<div class="sensor">
    <h3>${s.name}<small>${s.short}</small></h3>
    <p class="what">${s.what}</p>
    <div class="diagram">${s.diagram}</div>
    <dl>
      <dt>原理</dt><dd>${s.how}</dd>
      <dt>放在哪裡</dt><dd>${s.where}</dd>
      <dt>怎麼使用</dt><dd><ul>${s.use.map((u) => `<li>${u}</li>`).join('')}</ul></dd>
      <dt>怎麼撐過戶外、髒污</dt><dd>${s.rugged}</dd>
      <dt>別的領域怎麼做</dt><dd>${s.prior}</dd>
      <dt>成本</dt><dd>${s.cost}</dd>
      <dt>還要驗證</dt><dd>${s.verify}</dd>
    </dl>
  </div>`,
).join('');

chapters.push(
  chapter(
    '感測器怎麼放進去',
    '感測器是什麼、放在哪裡、怎麼用、為什麼撐得住。這一章是整份提案技術上最關鍵的部分。',
    `${box(
      '先修正一個錯誤：不能用荷重元秤積砂',
      '先前的構想是在凹槽四角放荷重元秤積砂，研究後確認不可行：<br>① ES302 是用鋼索串起來、可以捲的軟性地墊，四個角撐不起整片；② 地墊底下只剩約 2 mm，放不下秤重托盤；③ 荷重元的溫度漂移比積砂重量還大。<br>英國 Suffolk 郡 2022 年試驗雨水溝泥沙感測器，準確度約 70%，20 支只有 5 支撐到結束。所以積砂量改用「模型推估＋清坑秤重校正」為主，電極為輔。',
      'warn',
    )}
    ${table(
      ['感測器', '量什麼', '放在哪', '成熟度'],
      [
        ['① 壓電感測底座條', '踩踏、方向、人或推車、沖洗', '入口側底座，每 3–4 支鋁條一條', '成熟（道路、步道都有前例）'],
        ['② 積砂模型＋清坑秤重', '凹槽積砂量（主力）', '雲端', '第 0 階段就能上線'],
        ['③ 叉指電容電極條', '0–5 mm 薄層積砂（輔助）', '鋁條兩腳之間的隧道', '第 1 階段驗證'],
        ['④ 積水電極', '積水、排水堵塞、濕滑', '凹槽中段', '簡單、成熟'],
        ['⑤ NFC 標籤', '毯條更換、到場紀錄', '鋁條端頭、模組艙蓋', '成熟'],
        ['⑥ 模組艙', '電池、電路、無線', '邊框端部、走道外側', '參考停車格感測器'],
        ['＋ 氣象署雨量', '有沒有下雨', '雲端（免費開放資料）', '每 10 分鐘更新'],
      ],
    )}
    <h2>剖面圖</h2>
    <div class="grid2">${fig('prod-section', '剖面 A：橫切鋁條。綠色是壓電感測底座條，中間金色是 PVDF 膜；橘色是鋁條兩腳之間的電容電極條')}${fig('prod-sectionB', '剖面 B：切過邊框端部的模組艙。上方是非金屬天線窗，橘色是灌膠電子艙，綠色是電路板')}</div>
    <h2>每一種感測器</h2>
    ${sensorPages}
    <h2>線距的道理：為什麼每 3–4 支鋁條放一條</h2>
    <ul>
      <li>腳印長約 26 cm（兒童約 18 cm），步長約 65–75 cm。只放一條線的話，被踩到的機率只有 35–43%。</li>
      <li>要保證每次通過都被偵測到：<b>線距 ≤ 腳印長</b>（取 17–20 cm 以內），而且<b>總跨距 ≥ 步長 − 腳印長 ≈ 50 cm</b>（常有人跑步的入口要 ≥ 100 cm）。</li>
      <li>鋁條間距 35 mm，所以交替每 3、4 支放一條（約 10.5／14 cm），兩條一組。1.5 m 深的地墊約 6 條，跨距約 60 cm。</li>
      <li>方向：腳跟會先壓到後面那條線，兩條相差約 100–300 ms，看順序就知道是進還是出。</li>
    </ul>
    <h2>它實際怎麼產生訊號（示範畫面）</h2>
    <div class="grid2">${fig('lab-demo-walk', '人走過：線 1 → 線 2 依序超過門檻，模組各醒來 3 ms 記一筆；判定「1 人，方向＝進入」')}${fig('lab-wave-cart', '推車經過：每條線都是 20–50 ms 的短脈衝、前後輪成對出現；判定「推車」，不計入人次')}</div>
    <p class="small">波形是依物理特性模擬的示意，實際電壓要在第 0 階段量測。</p>
    <h2>既有案場怎麼改裝（約 1 小時）</h2>
    <div class="grid3">${fig('install-1', '① 掀起地墊（鋼索串聯，可以整片抬起，約 5 分鐘）')}${fig('install-3', '③ 把幾條 PVC 底座換成外形一樣的感測底座條')}${fig('install-6', '⑥ 裝模組艙、接線、貼 NFC，手機嗶一下完成配對')}</div>
    <ol class="small">
      <li>掀起地墊（本來就是清坑的標準動作）</li>
      <li>清坑，在隧道位置用背膠＋PU 固定電容電極條和積水電極（約 15 分鐘）</li>
      <li>換上壓電感測底座條，引線沿鋁條端頭拉出</li>
      <li>放回地墊，不用任何固定</li>
      <li>裝模組艙（新案出廠就做好），接頭穿過邊框；感測線留 40 cm 維修迴圈、套不鏽鋼編織管</li>
      <li>貼 NFC、手機配對，LED 閃三下就上線</li>
    </ol>
    <h2>戶外、髒污、日曬的對策</h2>
    ${table(
      ['情況', '對策'],
      [
        ['泥沙堆積', '積砂以模型為主；電極只在乾燥時取值；清坑時擦拭'],
        ['積水、颱風淹水', 'IP68（1.5 m、7 天）；電池艙獨立；接頭在乾區'],
        ['高壓沖洗', 'IP69K；壓電判斷為「清洗模式」，不計數'],
        ['清潔劑、酸鹼', '316 不鏽鋼、PU 灌膠、聚醯亞胺；陽極處理 ≥ 18 µm 並封孔'],
        ['日曬 70°C、UV', '全部以 85°C 設計；天線窗用 ASA 或 UV 安定 PC'],
        ['曬熱後突然下雨', '壓電熱電效應會產生假訊號 → 1.7 Hz 高通濾波＋溫度變化率判斷'],
        ['海邊鹽分', '316 螺絲加尼龍墊隔開鋁，避免電蝕'],
        ['推車、車輛重壓', '感測條在鋁條下面受保護，只承受底座原本就承受的力'],
        ['掀地墊清坑', '40 cm 維修迴圈；IP68 快拆接頭'],
        ['老鼠、昆蟲', '全程不鏽鋼編織套管'],
        ['偷竊、破壞', 'A4 不鏽鋼防盜螺絲；模組與地坪齊平、不顯眼'],
        ['靜電、突波', 'TVS＋限流電阻；壓電膜外層接地，形成自屏蔽'],
      ],
    )}
    <h2>別的領域早就這樣做了</h2>
    ${table(
      ['領域', '他們怎麼做', '關鍵數字', '我們學到什麼'],
      [
        ['道路車軸計數', 'TE RoadTrax BL 壓電線埋進路面溝槽，環氧樹脂灌封', '1.6 × 6.6 mm；壽命 4,000 萬軸次', '細長壓電條可以灌封埋在重壓下；要處理熱電效應'],
        ['步道人流計數', 'Eco-Counter SLAB 壓力板埋在步道下，兩排判方向', 'IP68；電池 10 年；成群通過會少算', '兩排判方向是成熟做法；要用影片校正'],
        ['停車格感測器', 'Nedap、Bosch 密封圓餅平埋在地面，被車壓過', '鋰亞電池 5–10 年；IPx9K；耐溫 85°C', '模組艙照抄：密封、耐溫 85°C、自動校正基線'],
        ['人孔、水表井', '金屬蓋下的無線感測器', '金屬蓋讓訊號掉 25–30 dB', '一定要開非金屬天線窗，用 920 MHz'],
        ['智慧地板研究', 'Georgia Tech Smart Floor 量腳踩的力量曲線', '15 人、辨識率 93%', '人和推車可以用訊號形狀分開'],
        ['秤重貨架', 'Amazon 貨架下 4 顆荷重元，要搭配影像', '荷重元有潛變、溫漂', '不直接秤砂'],
        ['雨水溝泥沙', '英國 Suffolk 郡試驗（2022）', '準確度約 70%；20 支剩 5 支', '模型為主、電極為輔'],
        ['地墊專利', 'US5946368、US6406549（1997，已過期）', '—', '計步、判方向是公知技術；凹槽積砂估算目前沒查到前案'],
      ],
      'small-t',
    )}
    <h2>老實說：哪些已經確定、哪些要實測</h2>
    ${table(
      ['項目', '狀態'],
      [
        ['壓電計步、兩排判方向', '<b>成熟</b>：道路、步道、專利都有前例；要實測每一步的電壓'],
        ['分辨人和推車', '<b>研究可行</b>：要收集自己的訊號資料'],
        ['積水、濕滑', '<b>簡單成熟</b>：電極加上氣象署雨量'],
        ['積砂量', '<b>最難</b>：模型＋清坑秤重先上線；電容電極在第 1 階段驗證；不直接秤重'],
        ['天線穿出鋁框', '<b>要實測</b>：第 0 階段第一週量訊號強度'],
        ['電池 5 年', '<b>理論足夠</b>：平均約 6–10 µA；要用功耗儀實測，並考慮 70°C 降額'],
      ],
    )}
    ${table(
      ['耗電項目（估算）', '平均電流'],
      [
        ['6 顆奈安級比較器（等待踩踏）', '0.45 µA'],
        ['MCU 深度睡眠', '2–5 µA'],
        ['每天 2,000 步 × 醒來 3 ms', '約 0.35 µA'],
        ['LoRa 每 15 分鐘上傳一次', '約 3 µA'],
        ['電極每小時量一次', '< 0.1 µA'],
        ['<b>合計 → ER18505（4 Ah）</b>', '<b>約 6–10 µA → 理論 > 10 年</b>'],
      ],
      'narrow',
    )}`,
  ),
);

chapters.push(
  chapter(
    '它怎麼工作',
    '人走過、下雨、積砂、通知、派工、結案，全部自動完成。以下是互動版的模擬畫面（一棟商辦、3 個入口）。',
    `${fig('sim-grid', '雨天的東側大門：人流、積砂、LINE 官方帳號通知、清潔人員接單；濕滑時自動提醒放警示牌', 'wide')}
    ${fig('dashboard', '管理儀表板：今日人次、凹槽積砂、濕滑風險、毯條壽命、電量；所有入口、工單與維護紀錄（可匯出 WELL／ESG 報表）', 'wide')}
    ${fig('flow', '系統架構：感測 → 模組艙 → 閘道器 → 雲端 → LINE／儀表板／報表 → 人到場處理', 'wide')}
    <ul>
      <li><b>不靠大樓 Wi-Fi</b>：大廳的 Wi-Fi 常常不能用，鋁框和混凝土又會擋訊號。所以用 920 MHz LoRa 傳到一台插電的閘道器，一棟樓一台就夠。</li>
      <li><b>LINE 官方帳號</b>：原提案用的 LINE Notify 已在 2025/3/31 停止服務。改用 Messaging API：只有重要警報才一對一推播；查詢用免費的回覆訊息；另有 Email 備援。2026/11/1 起中用量方案為 NT$1,000，而且不能加購。</li>
    </ul>`,
  ),
);

chapters.push(
  chapter(
    '怎麼開始：前 90 天',
    '先花約 NT$1.5 萬、用 4 週，證明它真的會動，再決定下一步。技術、業務、資金三條線一起走；第 4 週和第 13 週各有一次由董事長做的決定點。',
    `<h2>第一週就可以做的 5 件事</h2>
    <ol>
      <li><b>下單零件</b>（${range(totals[0])}，iCShop、台灣物聯科技都有現貨）</li>
      <li><b>拿一片 ES302 樣品</b>放進 2 cm 深的木框，當作凹槽</li>
      <li><b>申請 LINE 官方帳號</b>，開通 Messaging API（免費）</li>
      <li><b>把既有安裝名單整理成表格</b>：案名、年份、物業公司、聯絡人</li>
      <li><b>打給親戚的胎壓計工廠</b>，約一次參觀</li>
    </ol>
    ${fig('gantt', '前 90 天甘特圖（第 1 週 = 2026-10-05）。藍色：技術；綠色：業務；橘色：資金與行政；◆：決定點', 'wide')}
    <h2>決定點的過關條件</h2>
    ${table(
      ['決定點', '過關條件', '沒過關時'],
      [
        ['① 第 4 週', '計步誤差 < 5%；方向正確率 > 95%；電容電極能分辨 50 g 倒砂；蓋上鋁框後訊號穩定', `停下來，損失約 ${range(totals[0])}；或只換無線方案再測 2 週`],
        ['② 第 13 週', '3 個試點連續運作；推算電池壽命 ≥ 2 年；至少 1 家物業公司或建商願意談分潤或交屋包', '縮小成只做改裝套件，或等 SBIR 結果'],
        ['③ 第 12 個月', '試點轉付費 ≥ 30%；每入口每月毛利 ≥ NT$1,000', '暫停擴張，改善產品或價格'],
      ],
    )}`,
  ),
);

const phaseTables = PHASES.map(
  (p, i) => `<h2>${p.name}：${p.title}<small>${p.when}・${range(totals[i])}</small></h2>
  <p class="small">目標：${p.goal}</p>
  ${table(
    ['項目', '價格（NT$）', '來源'],
    p.items.map((it) => [it.name + (it.note ? `<br><small>${it.note}</small>` : ''), it.lo === it.hi ? num(it.lo) : `${num(it.lo)}–${num(it.hi)}`, (it.src === 'verified' ? '查證' : '估計') + (it.ref ? `<br><small>${it.ref}</small>` : '')]),
    'budget',
  )}
  <p class="small">「（選用）」項目不計入小計。</p>`,
).join('');

chapters.push(
  chapter(
    '要花多少錢',
    `每一筆都列出來。最壞的情況，就是停在第 0 階段，損失 ${range(totals[0])}。價格是 2026 年 9 月查到的台灣通路價和行情；標「查證」的有原始頁面，標「估計」的下單前要再詢價。`,
    `${table(
      ['情況', '金額'],
      [
        ['<b>最壞情況：只做第 0 階段就停</b>', `<b>${range(totals[0])}</b>`],
        ['三個階段合計（第一年）', range(all)],
        ['第 1＋2 階段（研發，可申請 SBIR）', range(rd)],
        ['申請 SBIR Phase 1 後，第 1＋2 階段公司自付', range(own)],
      ],
      'narrow',
    )}
    ${phaseTables}
    <h2>政府補助</h2>
    ${table(
      ['計畫', '內容', '時機'],
      [
        ['SBIR Phase 1', '2026 年起上限 150 萬，最多補 50%；約 6 個月；簡報制、隨到隨審；送件到撥款約 4–6 個月，要先墊款', '現在：用公司名義送件'],
        ['CITD 研發聯盟', '每案上限 1,000 萬（主導廠 500 萬）；易潔寶主導＋胎壓計工廠＋法人（金屬中心或工研院）；自籌 50% 以上；要有工廠登記', '116 年度預計 2026/12–2027/1 公告'],
        ['地方型 SBIR', '多數縣市單一 100 萬、聯合 200 萬', '通常每年 3–7 月'],
      ],
    )}
    <p class="small">同一個研發內容不能重複請領補助，SBIR 和 CITD 的題目要切開。</p>
    <h2>上線後每個月的營運成本</h2>
    ${table(
      ['', '10 入口', '100 入口'],
      [
        ['雲端＋LINE＋Email', '約 700', '約 2,100'],
        ['4G SIM（一棟一台閘道器）', '約 150–550', '約 1,500–5,500'],
        ['對照：月費收入', '25,000', '250,000'],
      ],
      'narrow',
    )}
    <p class="small">雲端幾乎不花錢；真正會累積的是 SIM 月租，所以一棟樓共用一台閘道器。</p>`,
  ),
);

chapters.push(
  chapter(
    '找誰來做',
    '原則：軟體用 AI 自己寫（便宜、改得快）；密封、無線、量產交給胎壓計工廠（最難、出錯代價最高）；法規和保險花小錢請專家看一次。',
    `${table(
      ['要做的事', '找誰', '大概多少錢', '什麼時候'],
      [
        ['韌體、雲端後端、儀表板、LINE 機器人', '提案人＋AI 開發工具', 'AI 工具每月約 NT$600', '第 1 週起'],
        ['模組艙密封、灌膠、IP68 測試', '親戚的胎壓計工廠', '小量每組約 NT$500–1,500', '第 5 週起'],
        ['無線與天線調校、量產測試治具', '胎壓計工廠；不夠時找接案射頻工程師', '0–3 萬', '第 6–9 週'],
        ['電路圖與 PCB Layout 審查', '接案工程師（Pro360、Tasker）', '1–2 萬', '第 5–6 週'],
        ['PCB 打樣與焊接', 'JLCPCB；台灣沅橡（1 片也做）、嵌揚', '每版 NT$2,500–5,000', '第 6 週'],
        ['NCC 認證', '先用已取得 NCC 的無線模組只做登錄；需要時找 SGS、耕興、ETC', '登錄 NT$1,500；完整送測 8–15 萬', '第 2 階段前'],
        ['4G 上網', '中華電信、遠傳 IoT SIM', '每張每月 NT$35–80', '第 9 週'],
        ['保險', '保險經紀人：產品責任險＋公共意外責任險', '每年約 1–3 萬', '試點前'],
        ['試點合約、個資條款', '往來的律師', '0.5–1.5 萬', '第 6–8 週'],
        ['研發法人（CITD 聯盟）', '金屬中心（鋁材、結構）或工研院、資策會', '依計畫', '2027 年初'],
      ],
    )}
    ${box('為什麼胎壓計工廠是關鍵', '胎壓計和智慧地墊要解決的是同一件事：壓力感測、電池撐 5–10 年、灌膠密封、無線要穿過金屬、車規量產。注意：胎壓計常用 315／433 MHz，但台灣法規對 433 MHz 限制很嚴，我們的主要鏈路要改用 920–925 MHz 或 BLE。')}
    <h2>去胎壓計工廠要問的 6 個問題</h2>
    <ol>
      <li>現在用哪一個晶片平台？能不能改寫韌體，讀外部的壓電膜和電容電極？</li>
      <li>有沒有 NCC、FCC 認證紀錄？配合哪一家實驗室？</li>
      <li>灌膠設備（真空灌膠、PU 或環氧）、烘烤、IP68 測試能力？</li>
      <li>電池焊片組裝，以及電池壽命的驗證方法？</li>
      <li>小量代工條件：最低訂量、打件與灌膠報價、測試治具費用？</li>
      <li>有沒有工廠登記、IATF 品質體系？能不能當 CITD 研發聯盟的成員？</li>
    </ol>`,
  ),
);

chapters.push(
  chapter(
    '怎麼賣出去',
    '地墊沒有法規強制保養（電梯有），所以 Alishan Care 不能單獨賣，要綁進原本就存在的合約：物業管理合約、清潔外包合約、交屋點交文件。',
    `${box('最有力的一句話', '「下雨天有人在大廳滑倒，管委會可能要負責。Alishan Care 會自動提醒放警示牌、派人拖地，每一次都有紀錄。那份紀錄，就是管委會『已盡注意義務』的證據。」<br><small>依據：雨天公共區域濕滑、沒有防滑措施時，管委會或物業公司可能依民法 §184 負賠償責任。</small>', 'pitch')}
    ${fig('funnel', '第一年銷售漏斗（規劃目標）：從官網上 400 多個既有安裝案場開始', 'mid')}
    ${table(
      ['客群', '誰決定', '他在乎什麼', '我們怎麼進去', '多久'],
      [
        ['既有住宅社區', '管委會、總幹事', '管理費不漲、滑倒責任', '透過物業公司；換算成「每戶每月約 NT$25」', '1–3 個月'],
        ['大型物業公司', '事業開發、商品部', '「有市場沒有人」、用科技省人力', '白牌或共同品牌，分潤 15–30%；東京都物業一家就駐點超過 1,000 個社區', '3–6 個月'],
        ['建商（新案）', '產品企劃、工務、客服', '交屋品質、客訴、行銷亮點', '交屋包附「首年免費」，第 2 年轉月費', '6–18 個月'],
        ['建築師', '設計部、規範工程師', '沒時間寫小項規範', '提供可以直接貼上的規範範本（CSI 12 48 13、性能條款、「或同等品」）', '寫進規範後 2–4 年'],
        ['醫院', '總務室、感控室', '跌倒是病安指標、評鑑', '總務室的廠商試用程序', '3–12 個月'],
        ['科技廠', '廠務、EHS', '帶塵、工安、供應商資格', '從既有廠區的施工窗口切入', '6–12 個月'],
        ['商辦、WELL／LEED 案', '工務、FM、綠建築顧問', 'WELL A09 入口系統、LEED 外包每週維護', '給顧問一份「WELL A09／LEED 合規包」', '3–9 個月'],
      ],
      'small-t',
    )}
    <h2>照抄電梯業</h2>
    <p>崇友電梯的保養約占營收 5 成，<b>保養毛利約 46%，新梯只有約 12%</b>。做法是新梯附免費保固，期滿轉成保養月費。電梯保養分半責（NT$2,500–3,500／月）和全責（NT$5,000–6,500／月），Alishan Care 也照這樣分級。</p>
    <h2>一頁試點協議</h2>
    <ul>
      <li>3–6 個月免費；對方要同意提供數據、具名當案例</li>
      <li>事先講好成功指標：拖地次數與工時減少多少、警報多久有人處理、滑倒事件數</li>
      <li>期滿以事先講好的價格轉付費；不續約的話，感測器回收</li>
      <li>只收環境數據，不拍照、不錄影</li>
    </ul>
    <h2>近期的行銷時間點</h2>
    <ul>
      <li><b>10/30</b>：智慧城市展 2027 早鳥報名截止</li>
      <li><b>12/10–13</b>：台北建材展（南港）；今年攤位已額滿，先去參觀、約建築師見面</li>
      <li><b>2027 年 1 月</b>：建材展前屆廠商優先報名</li>
    </ul>`,
  ),
);

const p = ROI_DEFAULTS;
chapters.push(
  chapter(
    '商業模式與財務',
    '地墊照樣賣，只是多了一層服務。從一次性工程款，變成「一次＋每個月」。',
    `${table(
      ['方案', '內容', '建議價（試點時驗證）'],
      [
        ['易潔寶 Smart（產品）', '新案出貨內建感測；舊案用改裝套件；含閘道器與第一年雲端', '每個入口加價 NT$18,000 起'],
        ['Alishan Care 基本', '監測、LINE 警報、每季清坑', 'NT$1,500／入口／月'],
        ['<b>Alishan Care 標準（主力）</b>', '依積砂量派工、反應時間承諾、ESG／WELL 月報', '<b>NT$2,500／入口／月</b>'],
        ['Alishan Care 全責', '再加上毯條依磨耗更換、年度稽核資料', 'NT$4,500／入口／月'],
        ['Alishan Data', '人流報表／API，給商場、物管、場館', '依案場報價'],
      ],
    )}
    ${table(
      ['', '現在（傳統）', '阿里山之後'],
      [
        ['營收', '一次性工程款', '工程款＋每月經常性收入'],
        ['跟客戶的關係', '完工就結束', '每個月都有接觸'],
        ['換毯條', '客戶想到才打來（10–15 年）', '系統依磨耗預測，自動排程'],
        ['競爭方式', '很容易被比價', '比的是服務和數據'],
        ['公司價值', '看今年接了多少案', '看年經常性收入（ARR）'],
      ],
    )}
    <h2>三年財務試算（保守預設值）</h2>
    <p class="small">假設：第一年新增 ${p.firstYearEntrances} 個入口、每年 ×${p.growth}；月費 NT$${num(p.monthlyFee)}；平均通路分潤 ${p.partnerCut * 100}%；服務成本 NT$${num(p.serviceCost)}／月；模組加價 NT$${num(p.hwPrice)}、成本 NT$${num(p.hwCost)}；年續約率 ${p.renewal * 100}%；一次性投入 ${nt(p.upfront)}；年固定成本 ${nt(p.fixedPerYear)}。</p>
    <div class="stats">
      <div><b>第 ${base.breakevenMonth} 個月</b><span>回本（含一次性投入與固定成本）</span></div>
      <div><b>${nt(base.totals.revenue)}</b><span>三年累計營收</span></div>
      <div><b>${nt(base.arrEnd)}</b><span>第三年底年經常性收入（在線約 ${Math.round(base.totals.activeEnd)} 個入口）</span></div>
      <div><b>${nt(base.unit.ltv)}</b><span>每個入口的終身價值，約傳統一次銷售毛利的 ${base.unit.ltvVsLegacy.toFixed(1)} 倍</span></div>
    </div>
    ${fig('cash-chart', '累計現金流：低於 0 表示還在投資期，越過 0 的那個月就是回本', 'mid')}
    <h2>敏感度（其他參數不變，只改一項）</h2>
    ${table(['情境', '回本', '第三年底 ARR', '三年累計淨現金'], sens)}
    <p class="small">月費和入口數量是影響最大的兩個參數，所以第 2 階段一定要驗證客戶的付費意願，並先從既有案場累積入口數。</p>
    <h2>客戶那邊，省了多少？</h2>
    <p>每天巡檢入口 16 次、每次 6 分鐘，改成「有需要才去」後減少一半：一年省下約 ${Math.round(cust.hoursSaved)} 小時、${nt(cust.laborSaved)} 人力；扣掉年訂閱費 ${nt(cust.fee)}，客戶還省約 ${nt(cust.net)}。這還沒算滑倒理賠、WELL／LEED 維護紀錄，以及智慧建築標章加分的價值。</p>`,
  ),
);

chapters.push(
  chapter(
    '可行性與風險',
    '每一個風險都有對策，也都有辦法先用小錢驗證。',
    table(
      ['風險', '對策', '怎麼驗證'],
      [
        ['訊號被鋁框、混凝土擋住', '非金屬天線窗；920 MHz LoRa 穿透力好；閘道器放在大廳', '第 0 階段第一週實測訊號強度'],
        ['泥水、清潔劑、踩踏', '胎壓計等級灌膠，IP68＋IP69K；模組放在邊框端、不在踩踏面', '浸水、沖洗、荷重測試各做一輪'],
        ['電池撐不久', '平常睡眠，壓電被踩到才喚醒；數據累積後批次上傳', '實測平均電流，推算電池壽命'],
        ['積砂量很難直接量', '地墊是軟的、底下只剩約 2 mm，不能秤重；改用模型為主、清坑秤重校正、電容電極輔助', '試點時每次清坑秤砂，跟模型比對'],
        ['客戶不買單', '先找既有的好客戶免費試用 3 個月，用數據說服', '試點轉付費率 ≥ 30%'],
        ['地墊沒有法規強制保養', '綁進物業、清潔、交屋合約；主打滑倒責任的舉證紀錄', '跟 2 家物業公司談出分潤條件'],
        ['無線頻段與 NCC', '用 920–925 MHz 或 BLE，不用 433 MHz；選已取得 NCC 的模組', '下單前查 NCC 型號'],
        ['補助時程', 'SBIR 送件到撥款約 4–6 個月，要先墊款；第 0 階段不依賴補助', '第 3–6 週送件'],
        ['影響本業', '分階段、小額投入；每階段都用數字決定要不要繼續', '每月一次進度報告'],
        ['LINE 訊息費用', '只推播重要警報給負責的人；查詢用免費回覆；Email 備援', '每入口每月推播 < 20 則'],
      ],
    ),
  ),
);

chapters.push(
  chapter(
    '今天想請爸爸決定的事',
    '不用一次押大注，只要讓我們先走第一步。',
    `<ol class="asks">
      <li><b>同意啟動第 0 階段</b><span>4 週、${range(totals[0])}，做出一片會發 LINE 的原型。最壞的情況就是損失這筆錢。</span></li>
      <li><b>給我一片 ES302 樣品和公司門口</b><span>當作第一個試點。</span></li>
      <li><b>幫忙牽線親戚的胎壓計工廠</b><span>第 5 週開始談模組艙的密封；之後可以一起申請 CITD。</span></li>
      <li><b>爸爸出面約 1–2 家往來最深的建商或物業公司</b><span>從既有安裝名單裡挑 5–8 個免費試點。</span></li>
      <li><b>同意用公司名義申請 SBIR Phase 1</b><span>政府最多補一半（上限 150 萬）。</span></li>
    </ol>
    <p class="promise">我負責的：每週五一頁進度，每月一次報告，用數字說話；第 4 週和第 13 週的決定點，都由爸爸決定要不要繼續。</p>
    <p class="signoff">阿里山的日出，要先爬上去才看得到。</p>
    <div class="sign"><div>董事長意見：</div><div>簽名／日期：</div></div>`,
  ),
);

const appendices = [
  appendix(
    'A',
    '對原提案的主要修正',
    table(
      ['原提案', '修正', '原因'],
      [
        ['LINE Notify 推播', 'LINE 官方帳號 Messaging API', 'LINE Notify 已在 2025/3/31 停止服務'],
        ['Cintas 式「租地墊＋每週換洗物流」', '「監測＋凹槽清潔＋毯條更換」訂閱', '易潔寶是固定安裝的鋁合金地墊，會消耗的是毯條和凹槽積砂'],
        ['FSR402 單點壓力感測', '壓電感測底座條＋凹槽電極＋積砂模型', 'FSR402 直徑只有 12.7 mm，蓋不住鋁條'],
        ['（初版）四角荷重元秤積砂', '模型＋清坑秤重校正，電容電極輔助', '地墊是軟的、底下只剩約 2 mm；溫漂比積砂重量大'],
        ['ESP32 直接連大樓 Wi-Fi', '920 MHz LoRa／BLE 傳到閘道器', '大廳 Wi-Fi 常常不能用；鋁框會擋訊號'],
        ['財務段有缺字與矛盾', '重新建立可調整的試算模型（第 10 章）', '數字必須經得起推敲'],
      ],
    ),
  ),
  appendix(
    'B',
    '品牌與競品研究摘要',
    `${table(
      ['項目', '內容'],
      [
        ['公司', '必買企業有限公司（易潔寶®），SINCE 2002'],
        ['網路', '官網 178mat.com（Blogger，約 404 篇案例，2026/9 仍在更新）；YouTube @178mat 約 65 支影片；主要用 LINE、電話接洽'],
        ['面料', '荷蘭 VEBE：Calypso 浪花紋、Metal 直條紋、Novanop 防焰；PVC 止滑膠條（台灣製）'],
        ['收邊框', 'AL-620、FL-620、AR-502、AI319 等；佈局代碼 A–D 系列'],
        ['數位／IoT／訂閱', '目前沒有'],
      ],
    )}
    ${table(
      ['台灣同業', '重點'],
      [
        ['甜心牌', '單元高 20 mm；案例有台北 101、台中高鐵站'],
        ['麗合企業', '3M 地墊特約代理，自製 3M 鋁框地墊'],
        ['東強、喬城、地墊達人、梅雅、安達利', '都有鋁合金地墊產品'],
        ['結論', '以上同業目前都沒有做 IoT'],
      ],
    )}
    ${table(
      ['國際前例', '做法'],
      [
        ['SensFloor（德）', '地板下的電容式感測織物；照護套房約 €3,000–3,500'],
        ['Scanalytics（美）', '壓力感測墊人流分析；已被 East West 併購'],
        ['Tarkett FloorInMotion', '地板下的壓電感測，偵測跌倒'],
        ['Sensing Tex（西）', '入口織物壓力墊，匿名計算人數'],
        ['Cintas、Lindström', '地墊租洗訂閱，沒有 IoT'],
      ],
    )}`,
  ),
  appendix(
    'C',
    '驗證計畫與過關標準',
    table(
      ['項目', '方法', '過關標準'],
      [
        ['每步電壓', '示波器量 PVDF 膜在 ES302 底座條內的輸出', '大於比較器門檻的 3 倍'],
        ['計步準確度', '公司門口放一週，錄影人工計數', '單排通過誤差 < 5%'],
        ['方向', '同上', '正確率 > 95%'],
        ['推車辨識', '推車、輪椅、手推車各 50 次', '誤計人次 < 5%'],
        ['熱電誤觸發', '鋁條加熱到 70°C 後用冷水沖', '清洗模式判斷成功'],
        ['電容電極', '倒入 50／100／200 g 乾砂', '可以分辨'],
        ['積水電極', '注水到 1／5／10 mm', '三段都正確'],
        ['無線', '蓋上鋁框，在大廳、地下室量 RSSI', '閘道器收得到，有 ≥ 10 dB 餘量'],
        ['電池', '功耗儀量一整天的平均電流', '< 15 µA'],
        ['密封', '浸水 1.5 m、7 天；高壓沖洗', '模組內濕度沒有上升'],
      ],
    ),
  ),
  appendix(
    'D',
    '資料來源',
    `<ul class="src">
      <li>易潔寶官網 178mat.com（施工百科全書、公司介紹、ES302 規格表、SGS 報告 HK-19-04861）；ES302 規格表（20260501 版）、178mat-4-BLOCK 施工大樣圖、嵌入式鋁合金除泥地墊施工流程（公司內部資料）</li>
      <li>WELL Standard：Entryway Walk-Off Systems、Healthy Entrance；USGBC LEED-WELL Crosswalk</li>
      <li>內政部建築研究所：智慧建築評估手冊 2024 年版</li>
      <li>LINE Notify 終止服務公告；LINE 官方帳號 2026 年方案（tw.linebiz.com）；LINE Messaging API pricing</li>
      <li>TE Connectivity RoadTrax BL、Piezo Film Sensors Technical Manual；Kistler Lineas 9195G 規格書</li>
      <li>Eco-Counter SLAB；TRAFx；USDA Forest Service Trail Traffic Counters Update；ODOT SPR772</li>
      <li>Nedap SENSIT、Bosch PLS 規格；Milesight EM41x-RDL；Suffolk Gully Sensors Final Report（ADEPT, 2022）</li>
      <li>Orr &amp; Abowd, The Smart Floor (CHI 2000)；Addlesee et al., The ORL Active Floor (1997)；Amazon US10466095B1；US5946368、US6406549、US11573628B2</li>
      <li>TI TLV3691、FDC1004；Sensirion SHT4x；Tadiran TL-4903；Electrolube UR5608</li>
      <li>中央氣象署開放資料 O-A0002-001；中華電信、遠傳 IoT 資費；NCC LP0002；SBIR 與 CITD 115 年度申請須知</li>
      <li>崇友電梯財報報導；電梯保養行情（945.com.tw、pro360）；公寓大廈管理條例；政府採購法第 26 條</li>
      <li>104／1111 清潔人員薪資；ISSA、Milliken、BST Laboratory 入口地墊攔截數據</li>
    </ul>
    <p class="small">財務與模擬數字都是示意假設，不代表實際營運數據。估算值在第 0、1 階段要換成實測數字。</p>`,
  ),
];

// ---------- 組版 ----------
const summary = `<section class="summary">
  <p class="kicker">一頁摘要</p>
  <h1>一句話</h1>
  <p class="big">把 IoT 感測做進我們最熟悉的玉山 ES302，再加上每月收費的 Alishan Care 服務。地墊照樣賣，從此每個月都有經常性收入，而且每個月都跟客戶保持接觸。</p>
  <div class="stats">
    <div><b>${range(totals[0])}</b><span>第一步：4 週的原型。最壞的情況就是損失這筆錢</span></div>
    <div><b>${range(own)}</b><span>第 1、2 階段申請 SBIR 後公司自付</span></div>
    <div><b>第 ${base.breakevenMonth} 個月</b><span>保守情境下回本</span></div>
    <div><b>0 家</b><span>台灣同業做 IoT（目前查不到）</span></div>
  </div>
  <h2>為什麼是我們</h2>
  <ul>
    <li>24 年施工經驗、官網上 400 多個案場，就是第一批改裝客戶</li>
    <li>親戚的胎壓計工廠：壓力感測、低功耗無線、灌膠密封、量產，正好是地墊模組最難的部分</li>
    <li>國外已經證明感測地板可行，但沒有人做在重型鋁合金刮泥地墊裡</li>
  </ul>
  <h2>今天想請爸爸決定的 5 件事</h2>
  <ol>
    <li>同意啟動第 0 階段（4 週、${range(totals[0])}）</li>
    <li>給一片 ES302 樣品和公司門口當試點</li>
    <li>牽線親戚的胎壓計工廠</li>
    <li>出面約 1–2 家往來最深的建商或物業公司</li>
    <li>同意用公司名義申請 SBIR Phase 1</li>
  </ol>
</section>`;

const cover = `<section class="cover">
  <svg class="ridges" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice"><circle cx="1030" cy="250" r="54" fill="#e0702f"/>
    <path fill="#c9d6cf" d="M0 330 C120 300 190 250 290 262 C380 272 430 210 540 196 C650 182 700 240 800 226 C900 212 960 150 1080 170 C1190 188 1260 250 1440 232 L1440 560 L0 560Z"/>
    <path fill="#9fb8ab" d="M0 390 C140 360 230 320 340 334 C450 348 520 290 640 286 C760 282 820 340 930 330 C1050 318 1120 276 1240 290 C1330 300 1390 330 1440 320 L1440 560 L0 560Z"/>
    <path fill="#6f9585" d="M0 450 C160 420 260 396 380 410 C500 424 580 380 700 384 C820 388 900 430 1020 420 C1150 408 1250 380 1440 400 L1440 560 L0 560Z"/>
    <path fill="#3f6b5b" d="M0 510 C200 486 320 470 480 482 C640 494 760 468 900 474 C1060 480 1200 500 1440 488 L1440 560 L0 560Z"/></svg>
  <p class="kicker">易潔寶® 178mat・內部轉型提案</p>
  <h1>Project Alishan<br><span>阿里山計畫</span></h1>
  <p class="lede">從「賣一塊地墊」，走向「賣一個永遠乾淨、安全、有數據可以證明的入口」。</p>
  <dl class="meta"><dt>給</dt><dd>董事長</dd><dt>日期</dt><dd>2026 年 9 月</dd><dt>互動版</dt><dd>alishan-demo.html（3D 模型、感測器示範、財務試算）</dd></dl>
</section>`;

const tocHtml = `<section class="toc"><h1>目錄</h1><ol>${toc.map(([n, t]) => `<li><span>${typeof n === 'number' ? '第 ' + n + ' 章' : '附錄 ' + n}</span>${t}</li>`).join('')}</ol></section>`;

const html = `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><title>Project Alishan 阿里山計畫提案書</title>
<link rel="stylesheet" href="node_modules/@fontsource/noto-sans-tc/400.css">
<link rel="stylesheet" href="node_modules/@fontsource/noto-sans-tc/700.css">
<link rel="stylesheet" href="print.css"></head><body>
${cover}${summary}${tocHtml}${chapters.join('')}${appendices.join('')}
</body></html>`;

const htmlPath = resolve(here, 'proposal.html');
await writeFile(htmlPath, html);

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const pdfPath = resolve(root, 'dist', '阿里山計畫提案書.pdf');
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#7d8088;padding:0 15mm;display:flex;justify-content:space-between;font-family:'Noto Sans TC','WenQuanYi Zen Hei',sans-serif"><span>Project Alishan 阿里山計畫｜內部提案</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
});
await browser.close();
console.log('PDF:', pdfPath);
