// 感測器實驗室的內容：每一種感測器的說明、原理圖、放置位置、耐候對策、前例與待驗證事項。
// 來源整理於 docs/07-感測器設計說明.md（估算值都有標註）。

const svg = (body) => `<svg viewBox="0 0 320 150" class="dg" role="img">${body}</svg>`;

export const SENSORS = [
  {
    id: 'piezo',
    icon: '〰',
    name: '壓電感測底座條',
    short: '踩踏、方向、人或推車',
    focus: ['sensor'],
    explode: 0.5,
    what: '外形跟原本的 PVC 避震底座一樣（8 × 3 mm）的中空 PVC 條，中間滑入一片約 0.3 mm 的 PVDF 壓電膜（28 µm 膜加上 PET 保護層）。',
    how: '壓電材料被壓時，<strong>自己就會產生電荷，不需要供電</strong>。人踩上去，鋁條把力量傳到底座條，膜被壓縮約 15–60 µm，產生約 1 V 的電壓脈衝（估算值），這個電壓直接叫醒睡眠中的模組。',
    diagram: svg(`
      <rect x="40" y="18" width="240" height="26" rx="3" class="dg-alu"/><text x="160" y="36" class="dg-t">鋁條（剛性，把力量分散）</text>
      <path d="M160 2 v12" class="dg-arrow"/><text x="178" y="12" class="dg-s">踩踏力 ≈ 300 N／支</text>
      <rect x="60" y="48" width="200" height="22" rx="3" class="dg-carrier"/>
      <rect x="66" y="56" width="188" height="6" class="dg-film"/>
      <text x="160" y="84" class="dg-s">中空 PVC 底座條＋PVDF 膜：被壓 → 產生電荷</text>
      <path d="M254 59 H288 V104" class="dg-wire"/>
      <path d="M270 104 l18 14 l18 -14 z" class="dg-comp"/><text x="226" y="126" class="dg-s">比較器 75 nA</text>
      <rect x="236" y="130" width="70" height="16" rx="4" class="dg-mcu"/><text x="271" y="142" class="dg-t sm">醒來 +1 步</text>
      <text x="16" y="120" class="dg-s">+ + + +</text><text x="16" y="136" class="dg-s">− − − −</text>`),
    where: '<strong>入口側那一條底座</strong>，每 3–4 支鋁條換一條（約 10.5／14 cm），總跨距 ≥ 50 cm。腳印約 26 cm 長，所以任何一步都至少會踩到一條；兩條一組，看哪條先被踩到，就知道是進還是出。',
    use: [
      '腳跟先壓到後面的線 → 判斷「進」或「出」',
      '人：停 0.2–0.7 秒、有腳跟和前掌兩個峰',
      '推車輪：20–50 ms 對稱的短脈衝，而且前後輪成對出現',
      '高壓沖洗：所有線同時長時間有訊號 → 判定清洗模式，不計數',
    ],
    rugged: 'PVDF 吸水率 < 0.02%、耐溫 80–100°C；兩端用 PU 灌封；PVC 擠出溫度會破壞壓電膜，所以<strong>不共擠，而是擠好中空條後再滑入</strong>。曬熱後被冷水沖，會產生熱電假訊號 → 用 1.7 Hz 高通濾波＋清洗模式辨識。',
    prior: '道路車軸計數用的 TE RoadTrax BL 壓電線（1.6 × 6.6 mm、壽命 4,000 萬軸次）；步道計數 Eco-Counter SLAB（兩排判方向）；1997 年的地墊計人專利 US5946368。',
    cost: '打樣每條約 NT$300–800（估計）；每條線 1 顆比較器約 NT$30',
    verify: '每一步實際的電壓大小、70°C 下被冷水沖時的誤觸發率、10 萬步之後的衰減。',
  },
  {
    id: 'ide',
    icon: '▥',
    name: '叉指電容電極條',
    short: '凹槽薄層積砂（輔助）',
    focus: ['pit'],
    explode: 0.55,
    what: '8 mm 寬、300 mm 長、0.2 mm 厚的軟性電路板（聚醯亞胺），上面有兩組像梳子一樣交錯的銅指，背面有一層屏蔽。',
    how: '兩組銅指之間有電場，會穿透上方約 0–5 mm。乾砂的介電常數約 3–5（空氣是 1），<strong>砂越多，電容越大</strong>。TI FDC1004 這類晶片可以量到非常小的電容變化。',
    diagram: svg(`
      <rect x="20" y="96" width="280" height="12" rx="2" class="dg-fpc"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${34 + i * 30}" y="${i % 2 ? 90 : 90}" width="14" height="6" class="dg-cu"/>`).join('')}
      ${Array.from({ length: 8 }, (_, i) => `<path d="M${41 + i * 30} 90 q15 -34 30 0" class="dg-field"/>`).join('')}
      ${Array.from({ length: 26 }, (_, i) => `<circle cx="${30 + ((i * 37) % 260)}" cy="${78 + ((i * 13) % 10)}" r="${2 + (i % 3)}" class="dg-sand"/>`).join('')}
      <text x="160" y="30" class="dg-t">電場穿透 0–5 mm；砂 ε ≈ 3–5，水 ε ≈ 78</text>
      <text x="160" y="50" class="dg-s">砂越多 → 電容越大；濕的時候讀數會暴衝，所以只在乾燥時取值</text>
      <text x="160" y="130" class="dg-s">聚醯亞胺軟板（背面屏蔽，隔開上方的鋁條）</text>`),
    where: '<strong>鋁條兩條腳之間的「隧道」</strong>（凹槽底，寬約 8 mm），入口側 30–60 cm 內放 2–3 條，因為砂大多在入口先掉下來。',
    use: ['每小時量一次', '只在「24 小時沒下雨＋積水電極乾」的時段取值', '跟模型的估算互相校正（卡爾曼濾波）'],
    rugged: '聚醯亞胺耐溫、耐化學；表面覆 PU；背面屏蔽層避免鋁條干擾。<strong>缺點：濕砂和水會讓讀數失真</strong>，所以只當輔助。',
    prior: '穀倉料位、土壤水分的電容探棒（用介電常數分辨乾砂和水）。英國 Suffolk 郡的雨水溝泥沙感測試驗，準確度只有約 70%，所以我們不單靠它。',
    cost: '打樣約 NT$3,000–6,000／批',
    verify: '0–5 mm 砂層的解析度、泥砂乾掉後殘留的影響。第 1 階段驗證。',
  },
  {
    id: 'model',
    icon: 'Σ',
    name: '積砂模型＋清坑秤重',
    short: '積砂量（主力，軟體）',
    focus: null,
    explode: 0,
    xray: true,
    what: '不是硬體，是一條公式：<strong>積砂 ≈ 人次 × 天候係數 × 地墊攔截率 × 案場係數 k</strong>。',
    how: '產業數據：乾天每 1,000 人約 113 g、雨天約 12 倍；地墊越長攔得越多（約 3 m 攔 52%）。人次由壓電條量到，雨量用<strong>中央氣象署免費開放資料</strong>（每 10 分鐘更新）。',
    diagram: svg(`
      ${[
        ['人次', 16],
        ['天候', 88],
        ['攔截率', 160],
        ['k', 232],
      ]
        .map(([t, x]) => `<rect x="${x}" y="24" width="64" height="30" rx="6" class="dg-box"/><text x="${x + 32}" y="44" class="dg-t sm">${t}</text>`)
        .join('')}
      <text x="84" y="44" class="dg-op">×</text><text x="156" y="44" class="dg-op">×</text><text x="228" y="44" class="dg-op">×</text>
      <path d="M160 58 v20" class="dg-arrow"/>
      <rect x="110" y="80" width="100" height="26" rx="6" class="dg-mcu"/><text x="160" y="97" class="dg-t sm">估計積砂量</text>
      <path d="M264 58 V128 H214" class="dg-wire"/>
      <rect x="104" y="116" width="110" height="26" rx="6" class="dg-box"/><text x="159" y="133" class="dg-t sm">清坑時秤重校正 k</text>`),
    where: '在雲端計算。第 0 階段就能上線，不需要額外硬體。',
    use: ['每次清坑，清潔人員把收到的砂用吊秤秤重', '手機 NFC 感應，把重量回填到系統', '系統自動校正 k 值，越用越準；這份數據別人沒有'],
    rugged: '不受髒污、積水影響，是最可靠的一層。',
    prior: '英國市政府的泥沙感測試驗結論：直接量泥沙還不成熟，「量到表面的距離」最可靠。所以積砂量用模型為主、電極為輔。',
    cost: '吊秤 NT$300–800',
    verify: '各案場係數 k 的差異，以及需要幾次清坑紀錄才能收斂。',
  },
  {
    id: 'water',
    icon: '💧',
    name: '積水電極（三段高度）',
    short: '積水、排水堵塞、濕滑',
    focus: ['pit'],
    explode: 0.55,
    what: '三根 316 不鏽鋼針，高度分別是 1、5、10 mm，立在凹槽中段。',
    how: '水會導電、空氣不會。水淹到哪一根針，那一根就導通；三根高度不同，就知道積水有多深。用<strong>交流方波</strong>量（每 10 分鐘量一次、每次 1 ms），電極才不會電解腐蝕。',
    diagram: svg(`
      <rect x="40" y="120" width="240" height="10" class="dg-fpc"/>
      <rect x="40" y="96" width="240" height="24" class="dg-water"/>
      ${[
        [100, 1, 116],
        [160, 5, 96],
        [220, 10, 70],
      ]
        .map(([x, h, top]) => `<rect x="${x - 3}" y="${top}" width="6" height="${120 - top}" class="dg-pin"/><text x="${x}" y="${top - 6}" class="dg-s">${h} mm</text>`)
        .join('')}
      <text x="160" y="30" class="dg-t">被水淹到的針會導通</text>
      <text x="160" y="50" class="dg-s">1 mm＝潮濕；5 mm＝排水變慢；10 mm＝快淹到鋁條</text>`),
    where: '凹槽中段、遠離落水頭，放在鋁條兩腳之間的隧道裡（10 mm 高放得下）。',
    use: ['1 mm 導通：潮濕，搭配雨量和人流算出「濕滑風險」', '5 mm 導通：排水變慢，可能是落水頭堵住了', '10 mm 導通：快淹到鋁條，立刻通知'],
    rugged: '316 不鏽鋼耐鹽霧；交流激勵不會電解；泥漿乾掉的殘留在清坑時順便擦掉。',
    prior: '漏水偵測墊（專利 US6639517）、導電度計。',
    cost: '約 NT$100–300',
    verify: '泥水導電度的變化範圍、長期結垢的影響。',
  },
  {
    id: 'nfc',
    icon: '◎',
    name: 'NFC 標籤',
    short: '毯條磨耗、到場紀錄',
    focus: ['nfc'],
    explode: 0,
    what: '硬幣大小、可以貼在金屬上的 NFC 標籤（NTAG216，一顆約 NT$45）。模組艙蓋上一顆（代表案場），鋁條端頭各一顆（代表哪一列）。',
    how: '手機靠近 1–3 cm 就能讀，<strong>標籤本身不需要電池</strong>。',
    diagram: svg(`
      <rect x="40" y="70" width="140" height="30" rx="3" class="dg-alu"/><circle cx="172" cy="85" r="10" class="dg-nfc"/>
      <rect x="220" y="30" width="56" height="96" rx="10" class="dg-phone"/><rect x="228" y="42" width="40" height="64" rx="3" class="dg-screen"/>
      <path d="M190 85 q8 -8 0 -16 M198 90 q14 -14 0 -30 M206 95 q20 -20 0 -44" class="dg-field"/>
      <text x="110" y="124" class="dg-s">鋁條端頭的列 ID 標籤</text><text x="248" y="142" class="dg-s">技師「嗶」一下</text>`),
    where: '模組艙蓋（案場 ID）、每一列鋁條的端頭（列 ID）。做法是鑽一個 30 × 3 mm 的沉孔，再用環氧樹脂封平。',
    use: ['換毯條、清坑時，技師用手機嗶一下 → 記錄日期、哪一列、秤到多少砂', '毯條壽命＝累計踩踏次數 × 磨耗係數；到 90% 就排程更換', '要防止假打卡，可以改用 NTAG 424 DNA'],
    rugged: '環氧封平、IP68；工業級標籤耐溫到 230°C。',
    prior: '工廠設備巡檢、保全巡邏點打卡。',
    cost: '每顆約 NT$45–80',
    verify: '在鋁條端頭的讀取距離。',
  },
  {
    id: 'module',
    icon: '▣',
    name: '智慧模組艙',
    short: '電池、電路、無線、天線窗',
    focus: ['module', 'wire'],
    explode: 0,
    what: '200 × 34 mm 的密封盒，嵌在鋁邊框旁邊、跟地坪齊平；上蓋是非金屬天線窗。',
    how: '平常睡眠（約 10 µA），壓電被踩時才醒來記一筆；每 15 分鐘彙總一次，用 <strong>920 MHz LoRa</strong> 傳到大樓的閘道器。',
    diagram: svg(`
      <rect x="30" y="20" width="260" height="14" rx="2" class="dg-window"/><text x="160" y="31" class="dg-t sm light">非金屬天線窗 ASA／PC（與地坪齊平）</text>
      <rect x="40" y="36" width="240" height="4" class="dg-cu"/>
      <rect x="30" y="42" width="150" height="80" class="dg-pot"/><rect x="44" y="96" width="120" height="8" class="dg-pcb"/>
      <text x="105" y="70" class="dg-t sm">電子艙：PU 灌膠</text><text x="105" y="88" class="dg-s">LoRa／MCU／比較器</text>
      <rect x="184" y="42" width="106" height="80" class="dg-bat-bay"/><circle cx="237" cy="92" r="20" class="dg-bat"/>
      <text x="237" y="62" class="dg-t sm">電池艙</text><text x="237" y="95" class="dg-s" style="fill:#fff">ER18505</text>
      <text x="160" y="142" class="dg-s">電池艙只用矽膠封，保留洩壓；另加超級電容應付發射尖峰</text>`),
    where: '邊框端部、走道外側。感測線用 IP68 接頭穿過邊框，留 40 cm 維修迴圈，所以掀地墊清坑時不用拔線。全程用不鏽鋼編織套管，防老鼠咬。',
    use: ['每 15 分鐘上傳：步數、方向、電極讀值、電池', '有緊急狀況（積水 10 mm、夜間入侵）時立即上傳', '模組內的 SHT40 監測密封有沒有失效'],
    rugged: 'IP68（1.5 m、7 天，颱風淹水）加上 IP69K（高壓熱水沖洗）；耐溫以 85°C 設計；A4 不鏽鋼防盜螺絲；鋁和不鏽鋼之間用尼龍墊隔開，避免電蝕。',
    prior: '停車格感測器（平埋、會被車壓、電池 5–10 年、IPx9K）；人孔感測器（金屬蓋讓訊號掉 25–30 dB，所以一定要開非金屬窗）。',
    cost: '小量每組約 NT$1,500–2,500（估計）',
    verify: '蓋上鋁框後的訊號強度、實測平均電流、70°C 下的電池降額。',
  },
];
