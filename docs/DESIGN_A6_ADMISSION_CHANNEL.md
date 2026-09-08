# A6「特殊招生門檻」設計修正：綜合評價院校被當成常規統招

- 狀態：**已實作**（2026-09-08）。落地與本設計的差異見文末「實作記錄」。
- 起因：學生回饋 —「那個排除大學的網站，只看綜測入學的被分在高考統招裡面了，雖然沒幾個大學」
- 撰寫日期：2026-09-08
- 影響面：`A6` 一題；`src/lib/schoolProfile.ts`、`src/data/dimensions.ts`、`src/data/questions.ts`、`src/engine/filter.ts`、`src/App.tsx`、`data/research/`
- 本文只做核查與設計，不含部署授權。

---

## 1. 核查結論：學生說的是對的，但範圍和他想的不一樣

### 1.1 線上復現（executable evidence）

線上 bundle 與本機源碼同構：

```
GET https://nope.bdfz.net/assets/index-CRg-BwD6.js
  → E={regular_gaokao:`普通高考常規統招`,art_exam:…}
  → 追蹤函數只做 add()，起手集合恆含 regular_gaokao
GET https://nope.bdfz.net/data/runtime/schools.json?v=10ad5e8cc1a8
  → 2919 筆，moeCode 覆蓋率 100%，無任何招生管道欄位
```

本機以真實主池復現（`npx tsx`，answers = `{ A6: 'regular_only' }`）：

| 學校 | 現有 A6 取值 | 選「只看普通高考常規統招」後 |
| --- | --- | --- |
| 南方科技大学 | `regular_gaokao` | **保留** |
| 上海科技大学 | `regular_gaokao` | **保留** |
| 上海纽约大学 | `regular_gaokao` | **保留** |
| 昆山杜克大学 | `regular_gaokao` | **保留** |
| 中央美术学院 | `regular_gaokao+art_exam` | 排除 |
| 中国人民公安大学 | `regular_gaokao+military_police` | 排除 |

全池 2919 所，A6 選 `regular_only` 只排掉 156 所（全部來自藝術／體育／軍警／航海四類）。

### 1.2 根因

`src/lib/schoolProfile.ts:54`：

```ts
export function getSpecialAdmissionTracks(school: School): SpecialAdmissionTrack[] {
  const tracks = new Set<SpecialAdmissionTrack>(['regular_gaokao'])   // ← 無條件塞入
  // 之後只 add，永不 remove
}
```

三個層次的缺陷：

1. **枚舉裡根本沒有「綜合評價」這個值。** `src/data/dimensions.ts:91` 的 `A6.values` 只有五個，`comprehensive_eval` 不存在，所以任何題目規則都寫不出這條排除。
2. **`regular_gaokao` 是硬編碼預設，不是數據。** 其餘四個 track 由校名／院校類型正則推導，唯獨「有沒有常規統招管道」沒有任何數據來源，卻被當成 100% 成立的事實。這違反本站自己的第 3 條硬約束（缺失數據疑罪從無）——這裡是把「未知」直接斷言成「有統招」。
3. **題目措辭把「統招」當成 exclusive 分類。** A6 的 `regular_only` 語意其實是「排掉藝體軍警航」，但標籤寫成「只看普通高考常規統招」，用戶會理解成「只留下填志願就能進的學校」。學生正是照字面理解的，而字面理解才是對的。

### 1.3 但是：不能憑印象列名單（這是本次核查最重要的發現）

一開始最自然的做法是「把新型研究型大學一鍋端」。實際查證後，這個直覺會製造**五所誤殺**：

| 學校 | 查證結果 | 若憑印象一刀切 |
| --- | --- | --- |
| 中国科学院大学 | 2026 章程：北京、江蘇、浙江、山東、陝西、湖南、四川 為「綜合評價（提前批）**與普通高考一批次並行**」 | ❌ 誤殺（北京考生本來就能統招進） |
| 宁波东方理工大学 | 2026 走普通批招生 | ❌ 誤殺 |
| 福建福耀科技大学 | 2026 走普通批招生 | ❌ 誤殺 |
| 大湾区大学 | 2026 廣東等地普通批，提檔即錄 | ❌ 誤殺 |
| 深圳理工大学 | 2026 本科批錄取，招生區域擴至 13 省 | ❌ 誤殺 |

而真正命中的，管道還是**逐省不同**的：

| 學校 | 查證結果 | 對北京考生 |
| --- | --- | --- |
| 上海科技大学 | 2025 章程：18 省（含北京）綜合評價；**僅安徽**走普通本科批 | 綜評，無統招 |
| 南方科技大学 | 631，須參加學校能力測試，於提前批自主選拔志願欄填報 | 綜評，無統招 |
| 上海纽约大学 | 須主動申請 → 初審 → 校園日 → 錄取 | 綜評，無統招 |
| 昆山杜克大学 | 高考 60% + 自主綜合評估 40%，須申請與校園日 | 綜評，無統招 |

**結論：這不是一個布林旗標，是一張「學校 × 省份 × 年度」的招生管道表。** 任何不記錄省份的修法，都會在「上科大對安徽考生」「國科大對北京考生」這類格子上重新出錯——只是換一個方向錯。

---

## 2. 設計

### 2.0 一個必須先講清楚的措辭問題

嚴格說，綜合評價**也是**普通高考統一招生的一部分（一樣由省招辦投檔錄取）。所以「統招 vs 非統招」這個切法在術語上站不住，吵起來我們會輸。

用戶真正在問的是：**「我只填志願、不另外報名、不去校測，這所學校還可能錄我嗎？」**

因此 A6 的軸線應該從「是不是統招」改成「**要不要另外報名並參加校測/面試**」。這個改法同時把藝術校考、體測、軍警政審面試、綜評校測收在同一條語意下，題目反而更乾淨。

### 2.1 數據層：新增 `data/research/admission_channels.csv`

依 `docs/DATA_RESEARCH_REQUEST.md` §2 的既有約定（P1 來源＝招生章程），新增數據包：

```csv
moeCode,schoolName,year,province,channel,extraApplication,extraExam,batch,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

- `province`：招生省份；全國統一口徑時填 `all`。
- `channel`：`regular`（填志願即可投檔）／`comprehensive_eval`（綜合評價）／`strong_base`（強基）／`early_batch_screening`（提前批面試政審）。
- `extraApplication`：`yes`/`no` — 是否須在高考志願之外另行報名。
- `extraExam`：`yes`/`no` — 是否須參加校測／校考／面試／體測。
- `year`：招生年度，逐年新增，不跨年臆推。

入庫要求（沿用 §2.1a 的保守原則）：

- 只收學校官方招生章程／本科招生網／陽光高考院校庫；聚合號、知乎、公眾號一律不入庫，只能作為「該去查哪一頁」的線索。
- 一所學校某年度的省份口徑沒查全，就**不要**寫 `all`，寧可只寫查實的幾個省，其餘留給預設。
- 每年 5–6 月章程季重跑一次，`sourceDate` 必填。

**首批研究清單（15 所，逐校逐省查章程）**：南方科技大学、上海科技大学、上海纽约大学、昆山杜克大学、西湖大学、中国科学院大学、深圳北理莫斯科大学、香港中文大学（深圳）、北京师范大学-香港浸会大学联合国际学院、温州肯恩大学、广东以色列理工学院、宁波东方理工大学、福建福耀科技大学、大湾区大学、深圳理工大学。

（前四所本次已有 P1 級佐證，仍須補齊逐省清單；後十一所須逐一查章程。西湖大学、深圳北理莫斯科、港中大（深圳）、UIC 尚未查證，設計上先留空＝維持現狀，不誤殺。）

### 2.2 建構層

`scripts/build_research_data.mjs` 讀入該 CSV，聚合成每校一筆，寫入 `src/data/researchData.ts`；`src/data/schools.ts` 的既有 merge 分支（`schools.ts:289`）把它掛到 `School`：

```ts
export interface SchoolAdmissionChannels {
  year: number;
  regularProvinces: string[];        // 明確查到「填志願即可」的省份
  comprehensiveProvinces: string[];  // 明確查到「須另行報名+校測」的省份
  scope: 'all' | 'partial';          // partial = 只查到部分省份，其餘未知
  source: { title: string; url: string; date: string };
}
```

`moeCode` 作為唯一鍵（線上 payload 覆蓋率實測 100%），不用校名——校名有繁簡與括號變體。

### 2.3 維度層

`src/data/dimensions.ts` 的 `A6.values` 增加 `comprehensive_eval`，並補上 P1 來源（各校招生章程 + 陽光高考院校庫），`notes` 說明「常規統招為預設先驗，僅在有章程佐證時才改判」。

`scripts/audit_question_rules.mjs` 已經會校驗「題目規則引用的值必須在 `DIMENSIONS[dim].values` 裡」——忘了同步就會紅，不必另寫守衛。

### 2.4 引擎層：讓 A6 認得考生省份

`getSpecialAdmissionTracks` 改為接受可選 context：

```ts
export function getSpecialAdmissionTracks(
  school: School,
  ctx?: { candidateProvince?: string },
): SpecialAdmissionTrack[] {
  const tracks = new Set<SpecialAdmissionTrack>()
  const ch = school.admissionChannels

  if (!ch) {
    tracks.add('regular_gaokao')                       // 無數據 → 維持先驗，絕不誤殺
  } else if (ctx?.candidateProvince && (
    ch.regularProvinces.includes(ctx.candidateProvince) ||
    ch.regularProvinces.includes('all')
  )) {
    tracks.add('regular_gaokao')                       // 該省有常規批
  } else if (ctx?.candidateProvince && ch.comprehensiveProvinces.includes(ctx.candidateProvince)) {
    tracks.add('comprehensive_eval')                   // 該省只有綜評
  } else if (ch.scope === 'all' && ch.regularProvinces.length === 0) {
    tracks.add('comprehensive_eval')                   // 全國口徑皆無常規批
  } else {
    tracks.add('regular_gaokao')                       // 其餘一律回到先驗
  }

  // 藝術／體育／軍警／航海四條維持現有校名與院校類型推導
  return Array.from(tracks)
}
```

四個分支的共同性質：**只要證據不足，就落回 `regular_gaokao`。** 保守方向永遠是「留著讓用戶自己看」，不是「替他劃掉」。

`getSchoolDimensionValue`（`src/engine/filter.ts:46`）與 `filterSchools` 增加可選 `FilterContext` 參數並透傳；不傳時行為與今天完全一致，`coverage.ts` 不必改。

### 2.5 考生地區升格為應用狀態

`考生地區` 目前只是 `ResultPage.tsx:125` 與 `SchoolDetail.tsx:70` 各自的 `useState`，預設北京，只用來拼省招辦連結——它已經在畫面上出現兩次，卻不影響任何篩選結果。

改為：提到 `App.tsx` 一份狀態（`localStorage` 持久化），加進 `App.tsx:196` 的 `useMemo` 依賴。收益：

- A6 能給出逐省正確答案（北京考生看不到上科大，安徽考生看得到）。
- 用戶在結果頁換省份，列表即時重算——2919 筆純客戶端過濾，成本可忽略。
- 那個選單終於名副其實。

風險點：`App.tsx:214` 的 `completeUnapplyAPlusSession(answers)` 學習證據契約。考生地區走獨立狀態、不進 `AnswerMap`，`answers` 形狀不變，`tests/learning-evidence.test.ts` 與 `test:trusted` 不受影響——這點必須用測試證明，不是用推理。

### 2.6 題目層：A6 重寫

```ts
{
  id: 'A6',
  title: '要不要另外報名、另外考一場？',
  subtitle: '除了填志願，有些學校還要單獨報名、校考、體測、政審或校測（綜合評價 631）。查到章程的才標，查不到的一律留著。',
  options: [
    { key: 'regular_only', label: '只看填志願就能錄取的（不另報名、不校測）',
      excludes: [{ dim: 'A6', values: ['art_exam','sports_test','military_police','navigation_flight','comprehensive_eval'] }] },
    { key: 'no_comprehensive', label: '排掉要綜合評價校測的（南科大／上科大這類）',
      excludes: [{ dim: 'A6', values: ['comprehensive_eval'] }] },
    { key: 'no_art_sports', label: '排掉藝術／體育特長類',
      excludes: [{ dim: 'A6', values: ['art_exam','sports_test'] }] },
    { key: 'no_screening', label: '排掉軍警／航海／飛行類',
      excludes: [{ dim: 'A6', values: ['military_police','navigation_flight'] }] },
    { key: 'any', label: '都看' },
  ],
}
```

### 2.7 展示層

- `specialTrackLabelMap` 增加 `comprehensive_eval: '綜評校測（該省無常規批）'`。`getSpecialAdmissionLabels` 只濾掉 `regular_gaokao`，新標籤會自動出現在結果卡與詳情頁——學生一眼就能看見這件事被承認了。
- `SchoolDetail` 在該標籤旁附章程連結與年度（例：「2025 年招生章程・18 省綜評，僅安徽普通批」）。這是本站「每次排除都能追溯」的要求，不是裝飾。

### 2.8 稽核與測試

1. `npm run audit:questions` — 新值未登記即紅（既有機制）。
2. `scripts/audit_data_coverage.mjs` 增加一條：CSV 中每個 `moeCode` 必須能在 `officialSchools` 命中，否則報錯。防止校名／代碼變動後規則靜默失效。
3. 新增 `tests/admission-channel.test.ts`，鎖住本次查證到的六個格子：

| 斷言 | 期望 |
| --- | --- |
| 北京考生 + `regular_only` | 上海科技大学、南方科技大学 **被排除** |
| 安徽考生 + `regular_only` | 上海科技大学 **保留** |
| 北京考生 + `regular_only` | 中国科学院大学 **保留**（綜評與一批並行） |
| 任何省份 + `regular_only` | 宁波东方理工大学、大湾区大学 **保留** |
| 無 `admissionChannels` 資料的學校 | 恆為 `regular_gaokao`，永不因本次改動被排除 |
| `A6: 'any'` | 排除數為 0 |

4. 回歸：`npm run test:evidence`、`npm run test:trusted`、`npm run lint`。

---

## 3. 分階段落地

| 階段 | 內容 | 阻塞條件 |
| --- | --- | --- |
| P0 | 2.3 維度值 + 2.4 引擎（僅 `scope:'all'` 分支）+ 2.6 題目 + 2.7 標籤 + 2.8 測試；CSV 先只收「全國皆無常規批」且已有章程佐證的學校（南科大／上纽／昆杜） | 無。不需考生省份，不會誤殺 |
| P1 | 2.5 考生地區升格 + 逐省判定；上科大等逐省學校入庫 | 需完成 15 所的章程研究 |
| P2 | 強基計劃、提前批面試政審（外交學院、國際關係學院這類）併入同一張表 | P1 的表結構穩定後 |

P0 就能回答學生的核心投訴（南科大這類不再冒充統招），且**零誤殺風險**；P1 才是真正正確的模型。

---

## 4. 明確不做的事

- 不依印象、不依聚合號名單填 CSV。本次核查已經證明直覺會製造五所誤殺。
- 不把綜評院校從主池刪除。本站是減法工具，決定權在用戶；我們只負責讓標籤誠實。
- 不擴張 2919 所官方主池。
- 不因為本設計而改動 `docs/OPERATIONS.md` 目前的未提交變更。
- 不在本任務中部署。

---

## 5. 驗收清單

- [ ] `data/research/admission_channels.<date>.csv` 每行都有官方 `sourceUrl` 與 `sourceDate`
- [ ] `npm run audit:questions` 綠
- [ ] `npm run audit:data` 綠（含新增的 moeCode 命中檢查）
- [ ] `tests/admission-channel.test.ts` 六條斷言全綠
- [ ] `npm run test:evidence` / `npm run test:trusted` 無回歸
- [ ] 結果卡與詳情頁能看到「綜評校測」標籤與章程連結
- [ ] `docs/MAINTENANCE_MANUAL.md` 加入「每年 5–6 月章程季重跑招生管道表」
- [ ] `PROJECT_STATE.md` 與 `docs/OPERATIONS.md` 同步；部署另行授權


---

## 6. 實作記錄（2026-09-08）

P0 與 P1 一次做完，因為 P1 的逐省判定在查證階段就已經是必需品：
上海科技大學 2025 年只有安徽走普通本科批，不分省就一定會在那一格出錯。

落地的文件：

| 層 | 文件 |
| --- | --- |
| 數據 | `data/research/admission_channels.2026-09-08.csv`（5 校，全部帶官方章程 URL） |
| 生成 | `scripts/build_admission_channels.mjs` → `src/data/admissionChannels.ts`（`npm run data:admission`） |
| 類型 | `src/data/runtimeTypes.ts` 的 `SchoolAdmissionChannels`；`School.admissionChannels` |
| 判定 | `src/lib/schoolProfile.ts` 的 `getRegularChannelState` / `getSpecialAdmissionTracks(school, ctx)` |
| 引擎 | `src/engine/filter.ts` 的 `FilterContext`，透傳到 `getSchoolDimensionValue` 與 `coverage.ts` |
| 狀態 | 考生地區升格為 `App.tsx` 狀態 + `localStorage`，A6 題面內嵌選單，改省份即時重算 |
| 題目 | A6 改問「要不要另外報名、另外考一場？」，新增 `no_comprehensive` 選項 |
| 展示 | 結果卡標籤「綜評校測·無常規批」；詳情頁「招生管道 · 章程依據」區塊帶章程外鏈與年度 |
| 測試 | `tests/admission-channel.test.ts`（7 條，含四所新校的不誤殺斷言） |

與設計稿的差異：

- 沒有引入 `scope: 'all' | 'partial'` 欄位。`regularProvinces` 用 `all` / `none` /
  省份列表三種寫法已經足夠表達，多一個欄位只會多一個可以寫錯的地方。
- `extraApplication` / `extraExam` 兩個布林欄位取消。學校同時有兩種管道時它們沒有意義，
  語義完全由兩個省份列表承載。
- 沒有做 P2（強基、提前批面試政審）。表結構已經能容納，但需要另一輪章程研究。

實測（`npm run test:filters`，2,919 所主池）：

- 北京考生選「只看填志願就能錄取的」：排除 160 所（原本 156 所，全是藝體軍警航）。
- 安徽考生：159 所——上海科技大學回到名單裡。
- 中國科學院大學、寧波東方理工、福耀科技、大灣區、深圳理工、西湖大學：任何省份都不排除。
- 未收錄招生管道的學校（如北京大學）恆為 `regular_gaokao`。

待辦：設計稿 §2.1 列的 15 所研究清單還剩 10 所沒查章程
（西湖大學、深圳北理莫斯科、香港中文大學（深圳）、UIC、溫州肯恩、廣東以色列理工、
寧波諾丁漢、西交利物浦、香港科技大學（廣州）、香港城市大學（東莞））。
沒收錄 = 走 regular 先驗，不誤殺，可以慢慢補。


---

## 7. 第二輪：15 所研究清單查完（2026-09-08）

把設計稿 §2.1 列的 15 所全部查到官方 2026 章程。**過程中推翻了第一輪的兩條數據**——
兩條都是拿 2025 年章程當成當年口徑造成的，這正是「年度」欄位存在的理由。

### 7.1 兩處必須修正的錯誤

| 學校 | 第一輪（依 2025 章程） | 2026 章程實際 | 影響 |
| --- | --- | --- | --- |
| 上海科技大学 | 18 省綜評、僅安徽普通批 → 北京考生被排除 | 常見問答原文：「**除江蘇外，其他綜合評價招生省份的考生均可以裸分填報**」 | 只有江蘇是綜評專屬；北京考生被誤排除 |
| 南方科技大学 | 631 是唯一入學途徑 → 全國排除 | 章程第十四條：「**另在部分省份試點普通本科批次錄取**」，但試點省份名單章程與簡章都沒公布 | 不能再全國排除 |

第二條逼出了一個新狀態。

### 7.2 新增第三態 `comprehensive_dominant`

原本的二分法（有常規批／沒有）表達不了「章程說有，但沒說在哪」。硬選一邊都是編造：
說「有」會讓南科大混進「填志願就能錄取」，說「沒有」會誤殺試點省份的考生。

所以第三態只做一件事：**在卡片上提示，永不參與排除**。
資料層用 `regularProvinces=unpublished_pilot` 這個哨兵值表示。
詳情頁的文案直說證據到哪為止：「章程另寫『部分省份試點普通本科批次錄取』，
但沒公布是哪些省，所以這裡不替你排除——要確認請查你所在省當年的招生計劃。」

### 7.3 14 所的最終口徑（全部依 2026 年章程）

| 學校 | 常規批 | 綜評 | 效果 |
| --- | --- | --- | --- |
| 上海纽约大学 | 無 | 全國 | 任何省份都排除 |
| 昆山杜克大学 | 無 | 全國 | 任何省份都排除 |
| 上海科技大学 | 17 省裸分可填 + 安徽普通本科批 | 18 省 | 僅江蘇排除 |
| 深圳北理莫斯科大学 | 17 省本科批 | 22 省提前批 | 內蒙古/遼寧/吉林/黑龍江/上海/重慶排除 |
| 南方科技大学 | 部分省份試點（名單未公布） | 24 省 | 只提示，不排除 |
| 中国科学院大学 | 7 省與綜評並行 | 同 7 省 | 不排除 |
| 香港中文大学（深圳） | 全國 21 省提前批 | 6 省雙軌 | 不排除 |
| 香港科技大学（广州） | 17 省提前批，明確不採綜評 | 無 | 不排除 |
| 香港城市大学（东莞） | 13 省普通批 | 無 | 不排除 |
| 广东以色列理工学院 | 15 省本科普通批 | 無 | 不排除 |
| 西交利物浦大学 | 全國本科批 | 蘇/粵（未錄取仍可走本科批） | 不排除 |
| 宁波诺丁汉大学 | 全國 | 浙江三位一體 | 不排除 |
| 温州肯恩大学 | 全國 | 浙江三位一體 | 不排除 |
| 北师大-香港浸会大学联合国际学院 | 全國（綜評僅限廣東） | 廣東 | 不排除 |

反直覺但重要的一條：**九所中外合作辦學大學沒有一所是綜評專屬。**
它們的綜評都是普通批之外的並行通道，西交利物浦的章程甚至明寫
「未被綜合評價錄取的考生，也可通過填報本科批次志願參與投檔和錄取」。

### 7.4 唯一沒收錄的：西湖大学

2026 年章程確認它有普通批（第十一條），也確認有綜評（浙蘇魯粵四省 2026 簡章俱在），
但章程對省份口徑只寫「以各省教育考試院公布招生計劃為準」，逐省歸屬拿不到一手依據。

按不誤殺原則**不收錄**，維持 regular 先驗，詳情頁顯示「未收錄本校的逐省招生管道」。
補齊需要逐省核對招生計劃，屬於下一輪工作。

### 7.5 實測（2,919 所主池，A6=只看填志願就能錄取的）

| 考生地區 | A6 排除數 | 名單內被排除的院校 |
| --- | --- | --- |
| 北京 | 158 | 上海纽约大学、昆山杜克大学 |
| 江苏 | 159 | ＋上海科技大学 |
| 上海 | 159 | ＋深圳北理莫斯科大学 |
| 安徽／广东 | 158 | 上海纽约大学、昆山杜克大学 |
