# nope.bdfz.net 維護手冊（v1.6）

本手冊面向接手維護 `nope.bdfz.net` 的工程師。目標不是介紹產品，而是讓你能安全更新數據、核查覆蓋、發布上線並在必要時回滾。

## 1. 先理解架構

### 1.1 產品的第一性原理

本站只做一件事：

> 在權威學校全集中，用用戶自己的紅線做減法。

因此數據和代碼都必須遵守四條硬約束：

1. `2919` 所普通高校主池只能來自教育部年度名單。
2. 每次排除都必須可追溯到 `題目規則 + 用戶答案 + 學校字段`。
3. 缺失數據不准猜，必須「疑罪從無」。
4. 主觀或年度變動字段只能作增強層，不能污染官方主表。
5. **證據強度決定是否有排除權**。眾包值帶樣本量；只有 1 個人填答的值照常展示，
   但不參與硬篩選。官方章程/校方頁面的結論不受票數門檻限制，也不會被眾包覆蓋。
6. **預設必須可被來源推翻**。「填志願就能錄取」是先驗不是結論；查到招生章程說
   本科只走綜合評價時要能改判，且逐省逐年。

### 1.2 當前模塊分工

```text
src/data/officialSchools.ts   教育部 2025 普通高校主表（2919，build 側）
src/data/researchData.ts      研究增強層（build 側；不直接進前端 chunk）
src/data/campusResearch.ts    校區底稿（build 側；不直接進前端 chunk）
src/data/provinceAdmissionPortals.ts  31 省官方招考入口小表（runtime）
src/data/runtimeManifest.ts   runtime payload 版本與路徑
src/data/campusProvinceBuckets.ts  省份 → 校區 bucket 文件名
public/data/runtime/          運行時實際拉取的 JSON payload
src/data/schools.ts           類型 + build 側合併邏輯
src/data/questions.ts         43 題減法問卷
src/engine/filter.ts          排除引擎
src/engine/coverage.ts        每題覆蓋率與最大排除能力分析
src/components/*              路由頁面；已做 route-level lazy split
src/lib/theme.ts              色系預設與本地自定義
src/lib/runtimeData.ts        runtime payload 載入器
```

## 2. 日常命令

```bash
cd /Users/ylsuen/CF/unapply
npm install
npm run data:schools
npm run data:github-profiles
npm run data:laosheng-profiles
npm run data:campus-extract
npm run data:research
npm run data:runtime
npm run data:admission
npm run audit:questions
npm run audit:values
npm run audit:data
npm run test:filters
npm run lint
npm run build
npm run dev
```

`audit:values` 是 2026-09 新增的死值閘門，說明見 §4.3。

部署：

```bash
cd /Users/ylsuen/CF/unapply
npm run pages:deploy
curl -I https://nope.bdfz.net/
```

## 3. 數據更新流程

### 3.1 官方主表

適用情況：教育部發布新年度普通高校名單。

```bash
cd /Users/ylsuen/CF/unapply
npm run data:schools
npm run audit:questions
npm run build
```

核查點：

- `src/data/officialSchools.ts` 條數是否仍是教育部口徑。
- `schoolCount` 是否等於教育部普通高校數。
- 未把成人高校、港澳台高校、軍校等額外混進主池。

### 3.1a 招生管道表（A6）

適用情況：某校招生章程變了，或要新增一所本科只走綜合評價的院校。

編輯 `data/research/admission_channels.<日期>.csv`（腳本自動取字典序最後一個），欄位：

```csv
moeCode,schoolName,year,regularProvinces,comprehensiveProvinces,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

- `regularProvinces`：填志願即可投檔的省份，`|` 分隔；全國都有寫 `all`，一個都沒有寫 `none`；
  章程說「另在部分省份試點普通本科批次錄取」但沒公布名單時寫 `unpublished_pilot`
  （南方科技大學 2026 即如此），這種情況只在卡片上提示、永不參與排除。
- `comprehensiveProvinces`：只走綜合評價（須另行報名＋校測）的省份，同樣支援 `all` / `none`。
- **省份必須寫成全站的繁體口徑**（`江蘇`／`廣東`／`山東`，取自教育部主表）。
  章程原文是簡體，`build_admission_channels.mjs` 會用別名表歸一；
  歸一不了的直接 exit 1。這條閘門是實測踩出來的：CSV 寫簡體「江苏」時，
  逐省匹配永遠等不到「江蘇」，於是落到「收錄了但沒覆蓋該省」分支、悄悄回到 regular 先驗——
  界面一切正常，規則其實整條沒生效。`tests/admission-channel.test.ts` 另有一條測試
  直接拿考生地區下拉選單的 option value 去驗，避免測試和數據犯同一個錯。
- 兩個列表都要以**官方招生章程**為準；聚合號、知乎、公眾號只能當「該去查哪一頁」的線索，不入庫。
- 沒查全的省份就留空，引擎會回到 regular 先驗。寧可少排除，不誤殺。

```bash
npm run data:admission   # 校名/代碼/來源三重校驗，任一不過直接 exit 1
npm run data:runtime
npm run test:filters
```

判定順序（`src/lib/schoolProfile.ts` 的 `getRegularChannelState`）：

1. 未收錄 → `regular`。
2. `regularProvinces` 含 `unpublished_pilot` → `comprehensive_dominant`（只提示，不排除）。
3. 考生省份在 `regularProvinces` → `regular`。
4. 考生省份在 `comprehensiveProvinces` → `comprehensive_only`。
5. 收錄了但沒覆蓋到該省 → `regular`（通常是不在該省招生）。
6. 沒有考生省份時，只有「全國皆無常規批」才判 `comprehensive_only`。

**必須用當年章程，不能沿用上一年。** 2026 那一輪查證推翻了兩條依 2025 章程寫的數據：
上海科技大學 2026 常見問答明寫「除江蘇外其他綜合評價招生省份的考生均可以裸分填報」，
南方科技大學 2026 章程新增「另在部分省份試點普通本科批次錄取」。兩條都會直接改變排除結果。

反例務必記住：中國科學院大學在北京是綜評提前批與普通一批並行；寧波東方理工／福耀科技／
大灣區／深圳理工 2026 走普通批；**九所中外合作辦學大學沒有一所是綜評專屬**，
它們的綜評都是普通批之外的並行通道。憑印象一刀切會誤殺一大片。

### 3.2 研究增強層

適用情況：你補充了 `data/research/*.csv`，或者重新抓取了 CollegesChat 原始問卷。

**前置條件（硬性）**：眾包原始問卷必須在磁盤上。

```bash
git clone --depth=1 https://github.com/CollegesChat/university-information.git /tmp/university-information
```

沒有它時 `data:research` 會直接報錯退出。以前這裡只推一條 warning 就繼續產出，
任何人照文檔跑一次就會靜默清空約 2,400 所學校的 B 系眾包數據，而 `researchData.ts`
是生成物、看不出少了什麼。要刻意產出不含眾包層的數據，顯式設 `ALLOW_MISSING_CROWD_SOURCE=1`。

上游是活的倉庫，每次 build 會把 commit 記進 `researchPipelineMeta.inputs.collegesChatSnapshot`；
兩次 build 之間值變了幾千條時，先比這個 commit。

```bash
cd /Users/ylsuen/CF/unapply
npm run data:research
npm run audit:values
npm run audit:data
npm run build
```

當前腳本會接入：

- `school_websites.2026-04-21.csv`
- `laosheng_school_profiles.2026-04-22.csv`
- `github_school_profiles.2026-04-21.csv`
- `campus_locations.2026-04-21.csv`
- `campus_official_overrides.2026-04-21.csv`
- `province_portals.2026-04-21.csv`
- `discipline_eval.4th.csv`
- `sino_foreign_programs.2026-04-21.csv`
- `collegeschat_results_desensitized.csv` 或 `/tmp/university-information/questionnaires/results_desensitized.csv`

注意：

1. `quality_crowd*.jsonl` 目前不再提交進倉庫，因為現有轉換結果列錯位，且不直接進運行時。
2. `city_environment.2026-04-21.csv` 與 `city_metro.2026-04-21.csv` 目前是空表。
3. `laosheng_school_profiles.2026-04-22.csv` 來自 `https://laosheng.top/fuwu/yuanxiao`，只用於學校官網與本科招生網補缺；它是第三方人工維護頁，不可直接拿它推導校區、地鐵距離或本科落點。
4. `github_school_profiles.2026-04-21.csv` 來自 `DaoSword/China-Education-Data`，只用於官網/校址補缺，不可直接拿它推導校區、地鐵距離或大一校區去向。
5. `campus_locations.2026-04-21.csv` 由 `Naptie/cn-university-geocoder`（主源）+ `ZsTs119/china-university-database` / `pg7go/The-Location-Data-of-Schools-in-China`（POI 校驗）+ `DaoSword/China-Education-Data`（校區地址補全）+ `GaoHR` 2021 全國大學信息表（僅補主校區近似坐標）聚合生成。`jtchen2k/hcu` 與 `daxue.cgsop.com` 暫只作人工核驗參考；`ramwin/china-public-data` 的高校名單基於 2017 年教育部附件，現已不再入正式管線。
6. `campus_official_overrides.2026-04-21.csv` 是校級官方覆蓋層，只收能安全進 A5/B9 硬篩選的條目；本輪已補 9 所北京高校。
7. `researchData.ts` 與 `campusResearch.ts` 保留為 build 側生成結果；前端實際載入的是 `public/data/runtime/*.json`。

若要重放校區抽取：

```bash
cd /Users/ylsuen/CF/unapply
git clone --depth=1 https://github.com/Naptie/cn-university-geocoder.git /tmp/cn-university-geocoder
git clone --depth=1 https://github.com/ZsTs119/china-university-database.git /tmp/china-university-database
git clone --depth=1 https://github.com/pg7go/The-Location-Data-of-Schools-in-China.git /tmp/The-Location-Data-of-Schools-in-China
npm run data:campus-extract
npm run data:research
```

`data:campus-extract` 的輸出準則：

1. geocoder 校區點優先。
2. DaoSword 只補地址，不單獨推導大一校區和地鐵距離。
3. 百度 POI 只做坐標/行政區校驗。
4. 低置信度記錄只展示，不拿去做硬篩選。
5. 真正進 A5/B9 硬篩選的校級結論，必須另外寫入 `campus_official_overrides.2026-04-21.csv`。

## 4. 覆蓋率與風險判讀

用這條命令看 43 題實際是否有用：

```bash
cd /Users/ylsuen/CF/unapply
npm run audit:data
```

重點看三個字段：

1. `coveredRate`：有多少學校在該題有值。
2. `maxExcluded`：最狠的一個選項最多能排掉多少學校。
3. `impactfulOptions`：有幾個選項真的在起作用。

### 4.0 眾包證據門檻（2026-09 起）

`chooseCrowdValue` 一直在算 `sampleSize` / `winningVotes` / `confidence`，但舊代碼只取
`value`、把強度整個丟掉。後果是 1 個匿名回答和 40 個一致回答擁有完全相同的排除權力；
又因為缺失值走疑罪從無，實際效果是**被填答得越完整的學校越容易被劃掉**——這是系統性
偏差，不是噪音。

現在強度會一路帶到前端：

- 生成側：`profile.qualityEvidence[dim] = { source, confidence, sampleSize, winningVotes }`。
- 引擎側：`isHardFilterableQuality()` 攔住 `source === 'crowd' && confidence === 'low'`
  （等價於「贏的那個值只有 1 票」），`getSchoolDimensionValue` 對它回 `null`，走疑罪從無。
- 展示側：學校詳情頁每張卡片顯示「N 人填答 · M 票一致」，單票的標橙色並註明不參與排除。

當前分佈：44,929 條眾包值 = high 22,754 / medium 11,184 / **low 10,991（24.5%）**。
門檻上線後 B 系覆蓋率整體下降（例：B24 從 1,886 降到 1,597 所），這是預期的：
損失的是本來就不該有的排除權。

`setQuality()` 同時修掉一個靜默覆蓋：眾包階段在官方階段之後跑，以前會直接蓋掉
`campus_official_overrides.csv` 寫入的 B9 官方結論（實測 4 條）。現在官方 > 眾包，不可逆。

### 4.1 當前仍屬高風險缺口

- `A5 校區位置`：校區底稿已擴到 `2732` 所學校、`3396` 條記錄，但真正進硬篩選的校級官方覆蓋目前只有 `9/2919`；本輪新增北京 9 校後，`maxExcluded` 為 `3`。
- `C1-C4`：幾乎 0 覆蓋，網站必須繼續提示「數據補充中」並徵集。
- `C5 學科評估`：已從 3 所提升到 54 所，但仍只適合明確有專業方向的用戶。
- `school_websites.csv` / `laosheng_school_profiles.csv`：最終官網覆蓋已到 `2867` 所，且已補出 `31` 所學校的本科招生網；剩下的缺口主要在普通本科與高職院校。
- `province_portals.csv`：31 個省級招考入口已接，但除北京外大多還沒有分數線直達頁。

### 4.2 當前架構上仍需避免的坑

1. 眾包生活數據目前是「按學校聚合」，還不是「按校區/年級聚合」。
2. `B9` 目前混合了城市級和校區級資料；本輪只新增了 4 所有明確官方地鐵步行依據的北京高校，其餘仍需地鐵站距與本科生落點。
3. 不要把 `researchData.ts` / `campusResearch.ts` 再直接 import 回 runtime；前端只能走 `src/lib/runtimeData.ts` → `public/data/runtime/*.json`。
4. `db/schema.sql` 仍是 v2 預留，當前站點是純 SPA，別誤以為已有服務端數據校驗。
5. **不要用動畫庫承載必讀內容。** 題面（標題＋說明）以前包在 `AnimatePresence mode="wait"`
   裡，換題要等 exit 動畫跑完才掛載新節點，而那個動畫由 requestAnimationFrame 驅動。
   在 rAF 被節流或暫停的環境（背景分頁、部分內嵌 webview、無頭/隱藏視窗）裡它永遠跑不完，
   用戶會一路看著第 1 題的標題答完 39 題。現已改成 key 變更直接重新掛載＋純 CSS 進場動畫，
   且動畫**只動 transform 不動 opacity**——最壞情況是它靜止在原位，文字仍然可讀。
   任何新增的入場動畫都要守這條。

### 4.3 死值閘門 `audit:values`

這個站的失效模式不是報錯，是**靜默退化**：枚舉裡寫了一個取值，主池裡沒有任何學校
取到它，引用它的選項排除數恆為 0，然後被 `getVisibleOptions` 從界面上悄悄拿掉。
用戶看不到那個選項，維護者看不到任何錯誤。A4「≤ 3 萬（可接受民辦）」和
「≤ 8 萬（含部分中外合作）」正是這樣消失的——線上用戶其實只有「公辦」和「不限」兩個選擇。

`npm run audit:values` 把三種狀態分開：

| 狀態 | 含義 | 處理 |
| --- | --- | --- |
| live | 有夠格進硬篩選的數據 | 正常 |
| below_threshold | 有數據，但全是單票眾包 | 報告，不阻塞；樣本變多會自動恢復 |
| absent | 主池裡完全沒有 | **必須**寫進該維度的 `reservedValues`，否則 exit 1 |

`reservedValues` 過期（值有數據了還留在聲明裡）同樣報錯。當前 23 個聲明死值，
分佈在 A1（港澳台不在教育部名單）、A4（精確學費區間待 tuition_programs.csv）、
A5（`separate_freshman` 目前 0/2919，靠 campus_official_overrides 的 freshmanOnly 補）、
E5（三個方言分片）、B12/B14/B23（歸一化器從未產出）、C1-C4（整題 0 覆蓋）。

### 4.4 A4 學費分桶

教育部名單能權威分出公辦／民辦／中外合作三類，所以學費先按這三檔走：

- `公辦`（2,076 所）
- `民辦待核價`（829 所，本科多在 1.5-3 萬）
- `中外合作待核價`（14 所，6-25 萬）

以前民辦和中外合作合成一個 `民辦/合作待核價` 桶，導致「可接受民辦」這件事根本表達不了。
`1-3萬` / `3-8萬` / `8萬+` 三個精確區間保留在枚舉裡但列入 `reservedValues`，
等 `tuition_programs.csv` 逐校逐專業補完再啟用。

## 5. 前端與交互維護

### 5.1 色系

- 全站顏色依賴 CSS 變量。
- 用戶可通過右上角下方的 `色系` 面板選擇預設或自定義 accent。
- 色系會同時管理畫布背景、卡片深淺與 accent，不再固定黑底。
- 本地存儲鍵：`unapply.theme.v1`

若要新增預設：

1. 修改 `src/lib/theme.ts`
2. 保證深色底與文字對比足夠
3. `npm run build` 後目測首頁、問卷頁、結果頁

### 5.2 問題頁與結果頁

- 問卷頁不再展示覆蓋率與排除量說明，避免打斷答題；這些方法論統一放到 About。
- 沒有實際刪減能力的題與限制選項會先暫時隱藏。
- 新增 `A6 特殊招生／特長門檻`，目前是基於院校類型、校名和公開招生方式做的保守啟發式：藝術/體育院校、軍警院校、航海/飛行類優先標記；拿不準的不硬貼。
- `B7 假期節奏` 只在明確識別出 `有小學期` 或 `暑假短` 時才進負面值；含混文本一律不做硬結論。
- 當剩餘學校 `<= 10` 時，問卷會停在當前題並提示先看報告，不再自動跳轉到結果頁。
- 結果頁除了剩餘名單，還必須保留「查一所學校」檢索區，讓用戶能看到某所學校是保留還是被哪幾題排掉。
- 結果頁應保留「回去改條件」與「清空重來」入口。

## 6. 部署與驗證

部署前：

```bash
cd /Users/ylsuen/CF/unapply
npm run lint
npm run build
npm run audit:questions
npm run audit:values
npm run audit:data
npm run test:filters
npm run test:evidence
npm run test:trusted
```

部署後至少驗證：

1. `https://nope.bdfz.net/` 返回 200。
2. 首頁可進入問卷。
3. 問卷可正常進入，且當剩餘學校 `<=10` 時會直接出報告。
4. 當某題把結果壓到 `<=10` 所時，不應自動跳頁；要先出現收束提示，再由用戶主動進報告。
5. 結果頁能看到學校官網 + 省級官方招考入口，且「查一所學校」能查到保留/排除原因。
6. 右上角色系面板可用、縮放後不遮擋內容，且刷新後保留。
7. **逐題翻頁時標題和說明要跟著換**（不是只有選項換）。這條要真的翻幾題看，
   不能只看第一題——歷史上它壞過而且從界面上完全看不出來。
8. **A6 的考生地區選單改省份時，實時計數要跟著變**：北京排除 160 所、安徽 159 所
   （差的那一所是上海科技大學，它在安徽走普通本科批）。刷新後省份要保留。
9. 學校詳情頁（如 `#/school/南方科技大學`）要能看到「招生管道 · 章程依據」區塊、
   對應考生省份的結論和章程外鏈；B 系卡片要顯示「N 人填答 · M 票一致」。
10. 結果頁的排除理由必須是人話，不能出現 `comprehensive_eval` / `tier1` 這類內部標識。

注意：Cloudflare Pages 顯示 deploy 成功不等於自定義域名健康，最後驗證以 `https://nope.bdfz.net/` 實際響應為準。

## 7. 回滾

### 7.1 代碼回滾

```bash
cd /Users/ylsuen/CF/unapply
git log --oneline -n 10
git revert <COMMIT>
git push
```

### 7.2 只回滾數據層

```bash
cd /Users/ylsuen/CF/unapply
git checkout <GOOD_COMMIT> -- src/data/officialSchools.ts src/data/researchData.ts src/data/schools.ts
npm run data:runtime
npm run build
```

### 7.3 Cloudflare Pages 回滾

在 Pages dashboard 回滾到上一個健康 production deployment，然後再次驗證：

```bash
curl -I https://nope.bdfz.net/
```

## 8. 下一步 deep research 優先級

按價值排序：

1. `campus_official_overrides.csv` 繼續補能安全進硬篩選的校級官方結論；優先 985/211/雙一流和熱門本科
2. `campus_locations.csv` 補 `freshmanOnly` / `mainCampusType` / `metroDistanceKm`
3. `province_portals.csv` 補各省直達分數線/招生計劃頁（北京已接 `https://query.bjeea.cn/queryService/rest/plan/115`）
4. `school_websites.csv` 補本科招生網
5. `admission_origin.csv`
6. `transfer_policies.csv`
7. `employment_postgrad.csv`

格式要求見 [DATA_RESEARCH_REQUEST.md](/Users/ylsuen/CF/unapply/docs/DATA_RESEARCH_REQUEST.md)。


## 2026-09-08 效度審計候選（歷史：後續授權見下節）

[20260908-unapply-validity-audit 效度裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md) 是本輪驗證/阻塞/回退權威。基線HEAD 0bedd2d；當前為未提交候選，正式仍 ddbda44d/source4925d96；舊錨點2700a82d/source4be095d。全站準確性裁定不通過，雖然九個工程閘門綠。修正來源覆蓋、A6啟發式、B解析、重試及儲存白屏；A5硬資料9校，A6年度章程14校，北京排2、江蘇3。A2/E/C5資料語義與學習證據端漏省份仍阻塞發布。舊章程研究沿用，未重查14個全文；原問卷commit 0aa4c193a302dd27c4044f510f6880e9325d79b3 未變。

本輪資源全部retain_hot（suen、2026-10-08複查），報告含補丁、new-files備份、完整命令輸出與runtime manifest；無需hydration才能繼續本機維護，不刪原始問卷或既有來源。`CAPABILITY_FIT: no-new-capability`，無平台／共享契約變更。下一步按報告補資料與省份可信重算，單独取得站長部署批准。

## 2026-09-08 已授權過渡發布（已上線）

站長在效度裁定後明示「如果比現在版本更靠譜些，可以先部署一版。缺失的以後再更新」。此次接受已確證的增量改善；原全站準確性未通過裁定保留，資料與語義缺口列為後續更新，不再作本次過渡發布的絕對阻塞。

- 正式版本：18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c / source aff7c2a56a57e02d7d9054ead7ebd3c007314c9f；完成 2026-09-08T15:10:41.514768Z，master / Direct Upload，commit_dirty=false。
- Node 權威：.nvmrc / engines.node = 24.18.0；Wrangler 4.100.0；依賴未更新。
- 九個指定閘門全部 exit 0；55 filters + 2 evidence + 7 trusted = 64 通過。build 前後均通過 scripts/git-deploy-gate.sh；39 個部署檔雜湊與驗證產物一致。
- 正式域名與 immutable URL 的 schools.json 均為 2919 校 / 2919 唯一教育部代碼，SHA256 394a1c4a0cd3ac3ab29c7810decdb84cefa674a0ca19950145e4a1cc0c097da6；runtime 02032caa77a3。
- 正式瀏覽器：31 個實際省份 option；A6 北京已劃掉2/剩2917、江蘇3/2916；詳情成功載入，pageerror=0。本機另驗證停用儲存/rAF/第三方元件、目錄與校區503後重試通過。
- A5 127份混合值中118份無來源人工預設已移除，現有校級資料9/2919、maxExcluded=3；A6 年度章程14校，北京/江蘇各少排156所啟發式猜測。B原始問卷commit 0aa4c193a302dd27c4044f510f6880e9325d79b3 未變，1839校品質資料因解析修正而變動。
- APLUS_EVIDENCE -> bdfz-user-center / UnapplyAPlusEvidence 及 compatibility_date 2026-04-20 不變。學習 health 前後均200且 receipt active，完整JSON相同；未做認證學生寫入→中央投影→重載驗收，不能由health推論完成。AnswerMap未變。
- 待辦：A2第三方城市榜單與默認值；E省級推導；C5缺項作負面證據；證據服務逐省重算未帶candidateProvince；眾包校區/年份/分母；西湖逐省、A5大一、C1–C4、精確學費資料。詳見原裁定，不為增加排除數而補猜值。
- 直接回滾：production deployment ddbda44d-af57-4c7e-bc63-108188b63b88 / source4925d96（API讀回仍可用）；更早2700a82d-1239-4918-bc54-2938a585e8f8 / 4be095d保留。回滾只切此Pages版本，無資料庫遷移。

發布、驗證、回滾與確切檔案：[20260908-unapply-validity-release](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-release/README.md)。原[效度裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md)及OPTIONS保留歷史，不改寫先前未批准的事實。CAPABILITY_FIT: no-new-capability；葉子發布，無平台/共享契約變更。

資源：專案 /Users/ylsuen/CF/sites/interactive/unapply，GitHub ieduer/unapply@master；已推送的來源與 immutable Pages deployment 為還原權威。報告與既有 dist / .wrangler / node_modules/.tmp 保留熱狀態（owner suen，複查2026-10-08）；私有manifest列確切路徑/大小，任務暫存與隔離Chrome於收尾刪除。不刪原始問卷或既有來源。重建用 Node24.18.0 的 npm run build（已有鎖定依賴）；還原源碼可在經容量/manifest核准的 absent path 用 git clone --branch master https://github.com/ieduer/unapply.git <ABSENT_PATH>，再核對 git cat-file -t aff7c2a56a57e02d7d9054ead7ebd3c007314c9f 與 package-lock.json。既有不可變上一版可直接回滾，無需hydrate。
