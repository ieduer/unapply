# nope.bdfz.net 維護手冊（v2.0）

本手冊面向接手維護 `nope.bdfz.net` 的工程師。目標不是介紹產品，而是讓你能安全更新數據、核查覆蓋、發布上線並在必要時回滾。

## 1. 先理解架構

### 1.1 產品的第一性原理

本站只做一件事：

> 在權威學校全集中，用用戶自己的紅線做減法。

因此數據和代碼都必須遵守以下硬約束：

1. `2952` 所普通高校主池只能來自教育部年度名單（2026 版，截至 2026-06-17）。
2. 每次排除都必須可追溯到 `題目規則 + 用戶答案 + 學校字段`。
3. 缺失數據不准猜，必須「疑罪從無」。
4. 主觀或年度變動字段只能作增強層，不能污染官方主表。
5. **證據強度決定是否有排除權**。匿名生活回報不論票數都只供參考。B 類硬篩選需當年度、涵蓋整校、符合完整選項語義且帶逐校 HTTPS 來源的官方證據；校區或部分事實不能擴張為全校結論。
6. **預設必須可被來源推翻**。「填志願就能錄取」是先驗不是結論；查到招生章程說
   本科只走綜合評價時要能改判，且逐省逐年。

### 1.2 當前模塊分工

```text
src/data/officialSchools.ts   教育部 2026 普通高校主表（2952，build 側）
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
npm run data:programs
npm run audit:questions
npm run audit:values
npm run audit:data
npm run test:filters
npm run test:s1
npm run data:origins
npm run data:i18n
npm run test:origins
npm run test:i18n
npm run lint
npm run build
npm run dev
```

`audit:values` 是 2026-09 新增的死值閘門，說明見 §4.3。`data:i18n`／`test:i18n` 是 2026-11 批 E1 新增的多語言生成與閘門（§5.3）；`data:origins`／`test:origins` 是批 E2 的起點分支資料層與閘門（§5.4）。

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

換年度（教育部每年 6 月發布新名單）：

1. 把官方「全國普通高等學校名單」附件原檔存成 `data/research/moe_ordinary_schools.<截至日期>.xls`。
2. 更新 `scripts/build_official_schools.mjs` 開頭的 `CATALOG`：來源頁、附件網址、原檔路徑與 SHA-256、
   截至／發布日期、普通高校／本科／專科／成人／總數。腳本會逐項核對，任何一個數字對不上就 exit 1。
3. 用新舊兩份名單按學校標識碼比對，重產 `data/research/moe_former_names.<截至日期>.csv`
   （同碼不同名＝更名），並同步 `build_research_data.mjs` 讀取的檔名。按校名匹配的資料層
   （眾包問卷、合作辦學名單）靠它繼續對上；舊名若已是另一所學校的現名則不收。
4. `data:admission` 會因校名不一致而 exit 1——這是預期的閘門，把
   `admission_channels.*.csv` 裡的校名改成新名單的寫法。
5. 更新頁面與測試裡寫死的總數、年份與教育部連結，再跑完九道閘門。

2026 版相對 2025 版：新增 40 個標識碼、撤銷 7 個、更名 55 所、37 所專科升格為本科。

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

上游在 2026-09 把 `questionnaires/results_desensitized.csv` 拆成 `data/v1.csv` 與
`data/v1.additions.csv`（欄位不變），並把校區寫成「校名（校區）」。腳本兩種目錄都認；
全名對不上官方校名時會去掉結尾括號再比一次，校區回報仍併入母校、只供參考。
另有欄位完全不同的新版問卷 `data/v2.csv`（含校區與入學年份），樣本還很少，尚未接入。

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
- `collegeschat_results_desensitized.csv`，或 `/tmp/university-information/data/v1.csv` + `data/v1.additions.csv`（上游 2026-09 新目錄；舊路徑 `questionnaires/results_desensitized.csv` 仍相容）
- `moe_former_names.2026-06-17.csv`（教育部同碼更名別名）

注意：

1. `quality_crowd*.jsonl` 目前不再提交進倉庫，因為現有轉換結果列錯位，且不直接進運行時。
2. `city_environment.2026-04-21.csv` 與 `city_metro.2026-04-21.csv` 目前是空表。
3. `laosheng_school_profiles.2026-04-22.csv` 來自 `https://laosheng.top/fuwu/yuanxiao`，只用於學校官網與本科招生網補缺；它是第三方人工維護頁，不可直接拿它推導校區、地鐵距離或本科落點。
4. `github_school_profiles.2026-04-21.csv` 來自 `DaoSword/China-Education-Data`，只用於官網/校址補缺，不可直接拿它推導校區、地鐵距離或大一校區去向。
5. `campus_locations.2026-04-21.csv` 由 `Naptie/cn-university-geocoder`（主源）+ `ZsTs119/china-university-database` / `pg7go/The-Location-Data-of-Schools-in-China`（POI 校驗）+ `DaoSword/China-Education-Data`（校區地址補全）+ `GaoHR` 2021 全國大學信息表（僅補主校區近似坐標）聚合生成。`jtchen2k/hcu` 與 `daxue.cgsop.com` 暫只作人工核驗參考；`ramwin/china-public-data` 的高校名單基於 2017 年教育部附件，現已不再入正式管線。
6. `campus_official_overrides.2026-04-21.csv` 保存官方校區資料；B9 校區觀察只供參考，A5 沿用既有獨立門檻；本輪已補 9 所北京高校。
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
5. A5 官方結論寫入 `campus_official_overrides.2026-04-21.csv`；B 類整校年度結論及部分範圍備註另寫 `quality_official_overrides.2026-09-08.csv`，禁止將校區交通直接當整校 B9。

### 3.3 全球學科地圖資料層（2026-11 起）

目標與分階段見 `docs/GLOBAL_ROADMAP.md`。這一層只描述「各學科最前列的機構在哪裡」，不進 43 題篩選引擎，
不碰 AnswerMap／Function／A+ 證據契約；它有自己的 payload、自己的引擎與自己的閘門。

資料檔（都在 `data/research/`，建置不需要網路）：

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `gras_<年>_subjects.csv` | `npm run data:gras` | 57 學科：代碼、門類、英文名、軟科中文站簡體名、本站正體名、來源頁 |
| `gras_<年>_top50.csv` | `npm run data:gras` | 每科前 50：名次、機構代碼、英文名、地區、總分、來源頁、讀取日 |
| `gras_institutions_geo.<日期>.csv` | `npm run data:gras-geo` | 機構 → 座標、正體名、（大陸）教育部代碼與本站學校 id、座標來源 |
| `gras_institution_names_zh_hant.<日期>.csv` | 人工 | Wikidata zh-hant 標籤其實是簡體字形時的覆寫（只轉字形不換用詞；里／托／范等正體本字不改） |
| `gras_institution_websites.<日期>.csv` | `npm run data:gras-websites` | 機構官網：候選來自軟科機構頁、Wikidata P856、教育部主表；逐條 HTTP 核查；只收 `verified` 且 high／medium |
| `direct_hire_programs.<日期>.csv` | 人工維護（候選由只讀研究會話核官方頁後提供） | 企業直招高中生計劃：條件、給什麼、支薪、學位（yes／no／partial／unknown）、座標、官方頁、來源、核對日、可信度、`status`（active／…／`unverified`）。**2026-11-07 批 F1 起**：`status=unverified`（官方頁對聲明身分的檢查器回驗證頁、純 JavaScript 或站點維護中，條件欄未填）的候選只留在檔內供年檢重試，`build_world_atlas.mjs` 不渲染；渲染的條目 `confidence` 必為 high／medium、`sourceUrl` 必 https、`officialUrl` 有則必 https；`kind` 詞表：fellowship_to_hire／fellowship_grant／employer_degree／degree_apprenticeship／talent_program_with_degree／research_trainee／youth_internship_camp／apprenticeship（非學位學徒）／apprenticeship_mixed（同一入口含學位與非學位）／direct_hire_school_leaver（日本高卒採用類正職直聘）／sponsored_training_to_hire（公司資助培訓後任職），每個 kind 與國家名都有 `ui.world.program.kind.*`／`ui.world.program.country.*` 三語鍵（`test:atlas` 斷言）；`degree=yes／partial` 在介面標「含在職學位」——沿用 Dyson／Goldman Sachs／Siemens／Shopify 既有口徑（學徒制含在職學位是否算「繞過高校」仍是站長待審項）。2026-11-07 當時值：32 列＝既有 10（重核）＋14 核過候選＋8 unverified；渲染 24 |
| `ne_110m_land.geojson` | 一次性下載 | Natural Earth 1:110m Land（公有領域），只畫陸地 |

`npm run data:atlas`（`scripts/build_world_atlas.mjs`）把以上組成 `public/data/atlas/world-atlas.json`
與 `src/data/worldAtlasManifest.ts`（版本雜湊＋各類數量）；`npm run build` 會先跑它。前端 `#/world`
用 `src/lib/atlasData.ts` 懶載入並核對 manifest 數量，`src/engine/atlas.ts` 做學科／門類／地區減法。

年度更新（軟科每年約 10–11 月發布新一年 GRAS）：

1. `npm run data:gras`（必要時先改 `package.json` 裡的 `--year`）。腳本從年度索引頁找 Nuxt 靜態 build id，
   逐科下載 payload，在無 `require`／`process` 的 vm 沙箱裡執行後只取回傳物件。新增學科或門類會因
   `SUBJECT_ZH`／`FAMILY_ZH` 缺項直接失敗：先到軟科中文站抄簡體名、再寫正體名（只轉字形不換用詞）。
2. `npm run data:gras-geo`。大陸機構先對教育部主表（含 `moe_former_names` 舊校名）並取 `campus_locations` 主校區座標；
   其餘查 Wikidata（標籤→別名→搜尋 API），中文名只取 zh-hant／zh-tw／zh-hk 標籤。任何機構對不到 → 腳本失敗並列出，
   加到 `MAINLAND_ALIASES`／`WIKIDATA_ALIASES`／`MANUAL_OVERRIDES`（人工座標要附註來源）後重跑。
3. `npm run data:gras-websites`（約 10 分鐘）。站長 2026-11-06 要求：權威鏈接可以加，但必須核查是官方或權威。
   腳本的規則：兩個獨立權威來源（軟科機構頁、Wikidata P856、教育部主表）同一可註冊網域且 GET 200、最終網域一致 → `high`；
   單一來源、網域像學術機構且連通 → `medium`；其餘不收（`status` 留 unreachable／rejected，供人工覆核）。
   `build_world_atlas.mjs` 只合併 `verified`，少於 300 所會直接失敗。不要手改 CSV 補鏈接——改腳本的來源或人工覆核清單再重跑。
   人工覆核清單在腳本的 `MANUAL_REVIEW`（每條寫證據與覆核日）；`--from <上一輪 CSV> --recheck` 只重打上一輪未通過的列（覆核網址實際 GET、最終網域一致才收；標 `allowBlocked` 的反爬 403 以瀏覽器開啟核對、標 `curlFallback` 的憑證鏈不完整站以系統 curl 再試），通過的列逐字照抄。2026-11-07 批 D4 以此把 S0 留下的 13 所補齊到 544/544。
4. 複核 `direct_hire_programs`：每條重新打開官方頁，更新 `status`／`verifiedAt`；連續兩年沒有招募標 `inactive`，不刪；官方頁對檢查器回 403／412 的（Dyson、Goldman Sachs 等）不算壞鏈，改人工瀏覽器核對並在 `notesZh` 記錄；`unverified` 候選人工在真實瀏覽器讀到條件原句後填齊欄位、改 `status=active` 與 `confidence`，否則維持不渲染。新 kind 要同時加 `KIND_ZH` 與三語鍵。
   新地區出現時 `build_world_atlas.mjs` 的 `REGION_ZH`／`CONTINENT` 會失敗，補上中文名與洲別；新國家的條目要加 `ui.world.program.country.<slug>` 三語鍵。
5. `npm run data:atlas` → `npm run test:atlas` → 其餘閘門 → 候選預覽 → Pages 交易（§6）。

口徑提醒：排名反映研究產出，不反映本科教學、錄取難度或學費，頁面與 About 已明示；不要把它接進任何「推薦」邏輯。

### 3.8 資料權威分級（2026-11 批 F1 起，路線圖橫切項）

每條對外鏈接按「鏈接目標是誰」分級，與頁面當下是否可達無關（可達性在 §3.9）。定義（研究 `reports/operations/nope-xcut-directhire-links-20261107/research/authority_tiers.md`）：

| 層級 | 定義 | 本站實例 |
| --- | --- | --- |
| **P0 官方** | 政府／教育主管機關／官方考試機構／機構本身的官方網域（學校官網、招生處、企業自有網域上的計劃官方頁） | moe.gov.cn、crs.jsj.edu.cn、各省教育考試院、dsedj.gov.mo、edb.gov.hk、`*.edu.cn`／`*.edu`／`*.ac.*` 校網、S0 兩來源核查的 GRAS 機構官網、palantir.com／goldmansachs.com 等 |
| **P1 權威平台** | 非主管機關本級但受官方委託／授權，或有公開方法論且本站只用於「描述」的平台 | chsi.com.cn（陽光高考）、chinadegrees.cn（學科評估）、shanghairanking.com（GRAS）、陸生／海外聯招會（寄存於大學網域）、camet.org.cn、cssn.cn、lever.co（企業職缺寄存）、findyou2026.com（吉利專站）、ucas.com／commonapp.org |
| **P2 第三方** | 媒體、開源社群、眾包；只作旁證或貢獻入口 | yicai.com、wikidata.org、naturalearthdata.com、fortune.com／36kr.com／sixthtone.com／cdsb.com、github.com（CollegesChat／Naptie／DaoSword／jtchen2k）、laosheng.top |
| **OWN** | 本站與姊妹站，不標 | nope／path／my.bdfz.net、gk.rdfzer.com、status.bdfz.net、github.com/ieduer/unapply |

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `data/research/authority_tiers.<日期>.csv` | 人工維護（`domain,match,tier,nameZh,reason,checkedAt`；`match`＝`prefix`（URL 前綴，GitHub 路徑用）／`host`（精確主機，如 www.gov.cn、www.edu.cn）／`registrable`（含子網域）） | 規則表；2026-11-07 當時值 106 條（P0 71／P1 15／P2 14／OWN 6） |
| `src/data/authorityTiers.ts`、`src/data/linkCheckBaseline.ts` | `npm run data:tiers`（`scripts/build_authority_tiers.mjs`；build 鏈最前） | 規則表（prefix → host → registrable、長網域先比）＋年檢基線計數（讀 §3.9 的 summary.json） |
| `src/lib/authorityTier.ts` | 程式 | `tierOf(url)`：先查規則表，再用網域型態啟發式（gov／gob／gouv／go／gc／mil 類與 edu／ac 類 → P0），都不認得回 `null`（頁面不標，不猜 P2）；`displayTier()` 把 OWN 收成不標 |
| `src/components/TierBadge.tsx` | 程式 | 鏈接旁的標籤「官方／權威平台／第三方」（`ui.tier.*` 三語；`data-tier` 屬性供驗收） |

標籤出現位置：首頁頁尾三組鏈接、About 全部來源鏈接（含多鏈接條目）、學校詳情的證據鏈接與校園生活來源、世界地圖直招條目的官方頁與來源頁。頁尾「權威數據」分區標題與第一財經（P2）是否移出、chinadegrees.cn／findyou2026.com 是否升 P0，屬站長待審項（`reports/operations/nope-s5-db-xcut-20261107/nope-f1/PENDING_OWNER_REVIEW.md`），未改。

新增網域規則：改 CSV（同日期檔可直接改；跨年改日期另存）→ `npm run data:tiers` → `npm run test:atlas`（斷言規則無重複、順序正確、站內已知鏈接判得出）。排名與第三方資料只用來描述分佈，不作錄取可能或推薦依據。

### 3.9 鏈接年檢（2026-11 批 F1 起）

工具 `scripts/check_links.mjs`（`npm run audit:links`；網路依賴，**不在發布閘門內**；移植自研究會話 tools/，Node ≥22 無第三方依賴）。盤點範圍：`data/research/*.csv` 欄名含 url／website 的欄、`s1_sources.json`、`origin_sources.*.json`、`src/**/*.ts(x)` 硬編碼鏈接（含生成檔）、`public/data/**/*.json` 內所有 URL（模板字串不計）。

禮貌與邊界（不得放寬）：UA 明示身分與聯絡方式；尊重 robots.txt（5xx 視為全禁、Crawl-delay 最多 10 秒）；同可註冊網域 ≥2 秒；全程同時連線 ≤6（`NOPE_MAX_INFLIGHT` 只能調小）；逾時 12 秒；403／404／412 不重試、只對連線重置重試 1 次；不停用 TLS 驗證；不登入、不填表、不繞過任何挑戰；不存頁面本文。

狀態口徑：`ok`／`redirect-cross-domain`／`broken`（404／410／5xx）／`blocked`（401／403／412／429／503 或 200 挑戰殼）／`robots-disallow`／`unreachable`（DNS／TLS／連線／逾時）／`reused-baseline`。**預設口徑（研究 PENDING 第 6、7 項，待站長確認）**：對聲明身分的檢查器被擋（blocked）**不標不可達**、鏈接保留、改人工瀏覽器抽查；大陸校網 `unreachable` 多為海外出口被重置或 TLS 鏈不完整，**連續兩輪不可達才標「官方頁暫不可達」**（工具以 `--since` 基線狀態＋本輪狀態在 notes 標「連續兩輪不可達」，人工確認後才改資料檔），單輪不可達不動。

年度流程（隨 GRAS 更新，約每年 11 月）：

1. `npm run audit:links -- --since data/research/link_check.<上一年>.csv.gz --out .tmp/link-check`：基線 ok／reused 且 URL 未變者沿用不重抓，只重核壞鏈／被擋／不可達／跨網域轉址／新 URL（全量約 6,100 條、1.5 小時、300 MiB；`--only <sourceFile>`／`--sample <百分比>` 可縮範圍）。
2. 讀 `.tmp/link-check/link_check.<日期>.summary.json`：`broken` 逐條處置（非校網：找現行官方頁，網域一致且 200 才改鏈，否則改上層頁或去 href 留文字＋註記；校網：人工確認後改鏈或下線）；`redirectCrossDomain` 只對「最終網域明顯仍是該校（.edu／.edu.cn／.ac.* 且校名一致）」者改為最終網址（school_websites 直接改列＋`sourceDate`／`notes`；GRAS 官網經 `verify_institution_websites.mjs --from … --recheck --only <univCode>` 加 MANUAL_REVIEW 條目重打——**但 GRAS 官網是海外層 S3 的錨點**：`build_overseas_layer.mjs` 斷言 `overseas_admissions` 的 `officialWebsite`＝S0 官網、招生頁在 `officialDomain` 之下，改網域會改變 S3 上鏈接判定，所以只在 S3 同批重抓時一起改），其餘留待下一輪；`blocked`／`unreachable` 依上段口徑。每一處改動寫入該年報告的 `link_fixes.md`（舊值／新值／依據）。
3. 入庫新基線：`gzip -9 -n -c link_check.<日期>.csv > data/research/link_check.<日期>.csv.gz`、`node scripts/check_links.mjs --report <csv> --out <dir>` 產 summary 並複製為 `data/research/link_check.<日期>.summary.json` → `npm run data:tiers`（更新 `linkCheckBaseline.ts`）→ `npm run data:research`（若改了 school_websites／campus_locations；需 CollegesChat 釘定快照在 `/tmp/university-information`，commit 見 `researchPipelineMeta.inputs.collegesChatSnapshot`）→ `data:atlas` → 閘門 → 候選 → Pages 交易（§6）。
4. 直招條目隨同重核（§3.3 第 4 步）；`unverified` 候選重試。

2026-11-07 基線（當時值）：6,139 條去重 URL、3,704 可註冊網域；ok 2,743／unreachable 1,852（大陸 .edu.cn 1,018）／reused-s2 610／reused-s0 488／blocked 155／broken 114（非校網 6 已修，見 `nope-f1/link_fixes.md`）／redirect-cross-domain 103（school_websites 5 條已改；GRAS 2 條因是 S3 錨點暫緩，見 `nope-f1/link_fixes.md`）／robots-disallow 74；P0 6,042／P1 75／P2 13／OWN 9。基線檔 `data/research/link_check.2026-11-07.csv.gz`（研究 CSV 原樣壓縮，SHA-256 與研究檔一致）＋ `.summary.json`。

### 3.4 S1 專業／選考科目／招生政策資料層（2026-11 起）

設計與站長待決點見 `docs/DESIGN_S1_PROGRAMS_ADMISSION.md`。首批（2026-11-07 上線）走的是設計文件的 S1.a：
資料以**起點條件**的形式在 43 題之後另算一層、分開計數。批 C（S1.b，`5b18cd1`，2026-11-07 已上線）把它改成**兩道正式題**：
S1「你的選考科目是哪三科？」（`src/data/programPrefs.ts` 的 `SUBJECT_COMBOS` 20 個固定序組合鍵）與 S2「你想讀的專業類，學校一定要有開設嗎？」（`src/data/programClasses.ts` 92 個專業類代碼），
學校取值由 `src/engine/programs.ts` 的 `admissibleCombos`／`offeredClasses`（含通配值 `*`）算在逐校摘要上，經 `FilterContext.programs` 進 `getSchoolDimensionValue`；
沒有本科資料的學校取值 `null`、永不因兩題被劃掉。兩題選項 `alwaysVisible`（考生自身事實，排除 0 所仍要能作答；`audit:values` 視為符合預期）。
Function 以同一份釘定摘要重算；新頁面帶 `programsVersion`，舊 43 題頁面（無 `programsVersion`）仍可完成。A+ 證據契約（manifest／互動鍵／聚合）不變，`src/shared-ui` 不變。

前端鏈路（2026-11-07 批 B 起兩層）：`npm run data:programs`（`scripts/build_programs_layer.mjs`）讀全量 `program_offerings.2027.all.csv.gz`，寫
`public/data/programs/catalog.json`（目錄）、`index.json`（每校一條摘要：本科／專科數、各專業類的圖樣下標、按類招生的類、對到具體專業的 [專業下標, 圖樣下標]、試驗班圖樣；
問卷前置載入，S1／S2 取值與結果頁卡片計數用它）與 `schools/programs-NN.json`（31 個省桶，完整清單，編號沿用 `campusProvinceBuckets.ts`，只在學校詳情載入），並寫 `src/data/programsManifest.ts`
（版本雜湊＋各類數量＋省桶對照）；`build` 在 `data:atlas` 之後跑它。`src/lib/programsData.ts` 的 `loadProgramIndex`／`loadProgramBucket`／`loadProgramCatalog` 核對 manifest；
學校詳情以 S1／S2 的作答組成偏好（`evaluateSchoolPrograms`，與引擎同義：no-data／kept／struck／unknown）；不再有 localStorage 偏好。
`npm run test:s1`（`tests/s1-programs.test.ts`，10 項）檢查 manifest／摘要／省桶一致（每校都在教育部主表、圖樣與下標合法、雙一流 144 校都有本科清單、專科列不對本科目錄）、
S1／S2 取值與題目選項一致、覆蓋與可見選項、兩題在 `filterSchools` 的劃掉／保留行為、詳情判定與引擎等價。

資料檔（都在 `data/research/`）：

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `s1_sources.json` | 人工登記＋`data:s1-fetch --repin` 補雜湊 | 官方來源釘定表：出版單位、公告頁、檔案網址、發布日、SHA-256、大小、入庫方式（committed／external）、預期計數 |
| `raw/s1/*` | `data:s1-fetch` | 入庫原檔：湖北／河南／內蒙古 2027 選考要求 xlsx、教育部本科專業目錄 2026 PDF、強基 2020 名單 docx、各公告頁與三校強基簡章頁快照 |
| `bk_catalog.2026.csv` | `data:s1-build` | 國標本科專業目錄 883 種：代碼（含 T／K 後綴）、名稱、專業類、門類、學位授予註記 |
| `program_offerings.2027.csv` | `data:s1-build`（預設 scope dfc） | 雙一流 144 校 × 本科招生專業（類）：校區標籤、層次、學校自編代碼、國標對應（code／name／class／none）、選考要求圖樣、原文、列到它的省份、來源、跨省衝突、可信度 |
| `program_offerings.2027.all.csv.gz`、`_summary.2027.all.csv`、`.all.meta.json` | `data:s1-build -- --scope all` | 全部 2,952 校、本科＋高職（專科）兩層次（批 D1 起七省聯集 102,241 條）；專科列 `programKind=vocational` 不對本科目錄；跨省不一致的列圖樣寫 `conflict`（引擎視為可報、永不作排除依據，詳情頁標示）；gzip 入庫，`gzip -dc` 可 diff；前端 payload 由它產生 |
| `program_offerings_summary.2027.csv` | `data:s1-build` | 逐校彙總：專業數、校區、省表數、要求分佈、目錄對應數、衝突數 |
| `program_offerings.2027.meta.json` | `data:s1-build` | 輸入雜湊、各省表計數、對不到主表的院校、校區／醫學院代碼映射、學到的舊校名別名、折行與水印處理計數 |
| `strong_base_schools.2026.csv` | `data:s1-build` | 強基計劃 39 校（教育部 2020 名單 36＋2022 增列 3，以三校 2026 官方簡章為證） |
| `public/data/programs/catalog.json`、`index.json`、`schools/programs-NN.json`、`src/data/programsManifest.ts` | `data:programs` | 前端懶載入 payload 與 manifest（生成物，隨 build 重產；不要手改） |

重跑（離線可重現；external 大檔不入庫，缺少時腳本會從登記的官方網址下載並核對 SHA-256）：

```bash
cd /Users/ylsuen/CF/sites/interactive/unapply
brew list poppler >/dev/null || brew install poppler     # pdftotext：只用來把官方 PDF 轉文字／座標
npm run data:s1-fetch -- --cache-dir .tmp/s1-sources --from-r2   # 五個大檔（江蘇 xls、上海 PDF、浙江 zip、山東本科／專科 PDF）從既有私密桶 bdfz-ops-backups（unapply/s1-sources/v1/）取回；已釘雜湊不符直接 exit 1；--offline 不碰網路；不加 --from-r2 則從原網址下載
npm run data:s1-build -- --cache-dir .tmp/s1-sources --scope all   # 全量（前端用）；不認得的選考要求寫法、目錄計數不符都 exit 1
npm run data:s1-build -- --cache-dir .tmp/s1-sources               # 雙一流 144 校本科（稽核與設計用）
npm run audit:s1 -- --scope all --out /Users/ylsuen/CF/reports/operations/<任務>/
npm run data:programs && npm run test:s1                   # 前端 payload 與閘門（build 會自動跑 data:programs）
```

口徑與陷阱（都是這一輪實測踩到的）：

1. **學校對齊用教育部 10 位標識碼的末 5 位**（＝省表「院校代碼」）。但省表會給校區／醫學院／分校**獨立的招生代碼**
   （19001 北京大學醫學部、19246 復旦大學醫學院、19213 哈工大(威海)…），對不回母校就會漏掉整個醫學院的臨床醫學；
   `build_s1_programs.mjs` 的 `CAMPUS_SUFFIXES` 把它們剝回母校並寫進 `campusLabel`。母校必須真的在主表才算對上。
   另有十餘所院校的招生代碼≠教育部標識碍（金陵科技學院、西交利物浦…），按校名對上，記在 meta 的 `codeFallbackByName`。
2. **省表是 2025 年 2 月口徑，教育部 2026 名單已有 26 校更名**（常熟理工學院→蘇州工學院、新鄉醫學院→河南醫藥大學…）。
   `moe_former_names` 只含 2025→2026 同碼更名；更早的更名由湖北／江蘇表（有代碼）學成別名再給上海／浙江 PDF（無代碼）用。
3. **選考要求是封閉詞表**：湖北／江蘇／浙江／河南／內蒙古／山東用長句「物理,化学(2门科目考生均须选考方可报考)」（逗號有半形有全形），上海用簡寫
   「物和化」「不限」。浙江 3+3 另有「技术」科，全國通用版沒有，跨省比對時忽略它、只記在 `requirementVariants`。
   出現新寫法腳本會停：先補 `SUBJECT_KEY`，不要猜。
4. **PDF 解析走座標**（`pdftotext -tsv`）：上海／浙江按表頭中心分欄（`assignBy: 'center'`）、山東每欄靠左對齊改按該頁字左緣聚類分欄（`assignBy: 'left'`，聚出的欄數≠表頭欄數就停）、按 top 聚行；「浙江省教育考试院／上海市教育考试院」散字水印按單字剔除；
   山東表每頁重印兩行表頭與頁首標題（先找表頭行、表頭之上不當資料），要求欄會折行（「…方可报」＋「考)」，兩行各離主線約 6pt 而列距 12.35pt，幾何分不出上下）——以要求文法判：以「)」結尾且不以科目開頭的是後半接上方「有 ( 沒 )」的主線，其餘是前半接下方要求欄空著（或只剩尾巴）的主線；
   上海表的專業代碼字高不同、會與同列其他格差 2–3pt，相鄰主線欄位不重疊就合併；折行的校名／專業名殘段拼回 ±14pt 內最近的主線。
   `meta.droppedIncompleteRows` 不為 0 時先看是哪些列被丟。
5. **江蘇 .xls 有 65,536 行上限**，實測截斷發生在專科段、本科完整；公告頁的 .xlsx 鏈接 2026-11-06 回 404，補到後換成 .xlsx 並重釘。
   三個大原檔（22 MB）不入倉庫：在 R2 `bdfz-ops-backups/unapply/s1-sources/v1/`（站長 2026-11-07 批准的儲存），`s1_sources.json` 的 `r2` 欄記 SHA-256；上傳後必須讀回核對再刪本機副本。
   **缺口不是錯**：省表沒列到的學校保持未知，不猜填；`audit:s1 --scope all` 把本科缺口分類成人工清單（四省時本科缺 178、專科缺 551；批 D1 七省後本科缺 141、專科缺 280）。
   2026-11-07 批 D1 探測的其餘省份：北京 bjeea.cn、天津、河北、山西、遼寧、吉林（JS 頁）、黑龍江、安徽、福建（只有查詢系統）、江西、湖南（公告頁可達、附件主機 cms.jyt.hunan.gov.cn 從本機 TLS 不通）、廣東（只有查詢系統 eeagd.edu.cn/xkcx2027）、廣西、海南、重慶、四川（只有查詢系統 plan.sceea.cn，回 403）、貴州、雲南、西藏、陝西、甘肅（412）、青海、寧夏、新疆（只有查詢系統）——本機出口為海外 IP，多數省考試院對它重置連線；能腳本取得且為官方網域的只有山東、河南、內蒙古三省。查詢系統不當表抓（逐校查詢不能保證完整，也近乎繞過）。
6. **陽光高考（gaokao.chsi.com.cn）對非瀏覽器請求回 412 的 JavaScript 挑戰**，不可用腳本抓，也不要繞；院校庫／章程／專業庫只能人工在瀏覧器查核。
   北京教育考試院（bjeea.cn）從本機完全連不上；廣東（eeagd.edu.cn）回 /forbid。
7. 國標目錄對不到的只有各校「試驗班」（118 條），屬預期；`catalogMatch=class` 的是按「專業類」招生（計算機類、經濟學類…）。
8. **跨省不一致**（批 D1 七省交叉後出現 2 條，都是內蒙古農業大學自家表與他省不同）：`requirementPattern` 寫 `conflict`、`requirementRaw` 保留各省寫法，`build_programs_layer` 照常收進 payload（manifest `counts.conflicts`），
   `src/engine/programs.ts` 的 `isAdmissible` 把它與 `none` 一樣視為可報（不知道要求＝不排除），`requirementLabel` 顯示「各省表寫法不一致（不作排除依據）」。`audit:s1` 逐條列出但不阻塞；`test:s1` 守住「不一致條數 ≤ 10 且恆可報」。
9. **內蒙古表沒有院校代碼**，只能按校名對齊：先讓有代碼的表（湖北／江蘇／河南／山東）把 2025 年舊校名學成別名，內蒙古與上海／浙江 PDF 靠它對上；`alignSchool()` 是四種表共用的對齊入口。

年度更新（各省約每年 2 月公布下一屆的要求表；教育部目錄每年 4 月）：

1. 在 `s1_sources.json` 新增該年度的來源條目（新 id、新 `admissionYear`／年份檔名），舊條目保留。
2. `npm run data:s1-fetch -- --repin` 只對新條目補雜湊；舊條目雜湊不符要先弄清楚上游為何換檔。
3. `npm run data:s1-build -- --scope all`（前端 payload 的來源，入庫）與預設 scope（雙一流稽核用）。
4. `npm run audit:s1`，把報告放進任務的 `reports/operations/` 目錄；跨省衝突不為 0 時這一層不得進任何篩選。

### 3.5 港澳臺院校池資料層（2026-11 起，路線圖 S2 後半）

目標：讓香港／澳門／臺灣起點的用戶（以及想跨區看的大陸用戶）看到**官方來源核查通過**的院校與招生管道；它不是題庫、不進任何題目與引擎、不進 AnswerMap 與 A+ 證據。
資料形狀刻意做成「機構／招生管道／條件／來源／有效期」五層（`src/data/hkmotwTypes.ts`），S3 海外學校沿用同一形狀。

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `hkmotw_institutions.<日期>.csv` | 人工登記（來源見各列） | 機構：地區、正體校名（照官方）、英文名、類型、官網、名單來源與日期、在 GRAS 地圖上的英文名（對 `gras_institutions_geo`）、status |
| `hkmotw_admission_channels.<日期>.csv` | 人工登記＋逐條連通核對 | 管道：對象（內地高考生／港澳學生）、管道類型、層次、適用年度、成績／報考方式、英語、學費、時程、來源標題／網址／日期、HTTP 狀態、核對日、status、備註 |
| `public/data/hkmotw/pool.json`、`src/data/hkmotwManifest.ts` | `npm run data:hkmotw`（`scripts/build_hkmotw_pool.mjs`） | 前端懶載入 payload（約 30 KiB）與 manifest；`build` 在 `data:programs` 之後跑它 |

規則（路線圖「對外鏈接規則」）：來源網址必須 https、來源可註冊網域與機構官網一致、HTTP 200、帶讀取日與核對日；`status` 不是 `verified` 的機構／管道**不進 payload**，只把數量與原因寫進 `reviewRequired`（頁面底部列出名字）。
不認得的地區／類型／管道代碼直接失敗。核不過的常見原因：官網對腳本回 Cloudflare 驗證頁（香港都會大學）、招生頁純 JavaScript（香港城市大學內地招生網、澳門理工大學）——**不繞過**，留待人工覆核。

2026-11-07 批 D3 首批：香港 15 所（各校自己的內地高考／非本地學生招生頁為名單來源；教資會網站沒有可腳本讀取的資助院校名單頁，故不自行標「教資會資助」）、澳門 10 所（教青局「澳門高等院校連結」官方名單）、臺灣 2 個聯招會（陸生聯招會：2026 只辦碩博士班、學士班最近簡章 2019；海外聯招會：港澳學生聯合分發／各校單獨招生）；21 條管道、10 所對到 GRAS 地圖。
前端：`#/hkmotw`（`src/components/HkMoTwPage.tsx`，地區篩選、逐管道「條件與學費」展開、來源與核對日）；首頁港澳臺起點的主按鈕改為「看港澳臺院校池」；結果頁頁尾「跨區看港澳臺院校池」；世界地圖機構面板對得上池的機構多一個「港澳臺院校池：招生管道 →」。
閘門：`npm run test:hkmotw`（`tests/hkmotw-pool.test.ts`，7 項：manifest／payload 一致、三地區數量、每條管道 https＋同網域＋200＋日期、核不過的不上線、臺灣兩會狀態、GRAS 對照、起點提示）。

年度更新：各院校招生年度頁（多在每年 10–12 月更新下一屆）逐條重開、更新 `validFor`／條件／學費與 `verifiedAt`；管道消失（如暫停招生）改 `channel`，不刪列；新增院校先核官網網域。改完跑 `data:hkmotw → test:hkmotw → 其餘閘門 → 候選 → Pages 交易`。

### 3.6 中外合作辦學機構／項目資料層（2026-11 起，路線圖 S2 前半）

唯一主來源：教育部中外合作辦學監管工作信息平台（教育涉外監管信息網）`https://www.crs.jsj.edu.cn/`「教育部審批和復核的機構及項目名單」——
`/aproval/orglists/1`（頁面標題「硕士及以上…名单」）、`/aproval/orglists/2`（「本科…名单」；**與首頁連結文字順序相反，以頁面標題為準**）、`/aproval/getbyarea/1..31`（各省，含「中外合作办学机构／项目」「内地与港澳台地区合作办学机构／项目」四類，海南另有第五類「境外高校在海南自由贸易港独立办学的大学」→ `cooperationType=foreign_independent`），以及每條 `/aproval/detail/<id>`。
這一層不進任何題目與引擎、不進 AnswerMap；只在結果卡片（計數一行）與學校詳情（清單區塊）展示。平台詳情頁沒有學費欄，所以不產生 A4 取值（收費以各校招生章程為準）。不存個人資料：法定代表人、校長等姓名欄一律不讀。

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| 快取 `<cache-dir>/list_*.html`、`<id>.html` | `npm run data:joint-fetch -- --cache-dir DIR`（`scripts/fetch_joint_programs.mjs`；2.5 秒一請求、失敗退避 30／90／300／600 秒、連續 6 次失敗停止、可續抓） | 33 個名單頁＋每條詳情頁的 HTML 原檔。**站方對同一出口約每 500 次請求重置 TLS**（2026-11-07 實測：1,834 條分三段才抓完），所以要慢、要能續 |
| `joint_programs.<日期>.csv`、`.meta.json` | `npm run data:joint-build -- --cache-dir DIR --date <日期>`（`scripts/build_joint_programs.mjs`） | 逐機構／項目一列：地區（繁體省名）、分類、合作類型、機構／項目、所在名單層次、名單標記（▲依條例批准／●復核通過／■本碩兼有）、名稱與括註、狀態（listed／suspended／merged／terminated，由名稱括註判）、對回的 `moeCode`（機構名或中方校名）、中方／外方（或內地／港澳臺）合作辦學者、層次、學制、招生規模、招生起止年份、招生方式、專業、證書、審批機關、批准書／許可證編號與有效期、變更記載筆數、來源網址、讀取日；meta 記名單數、對不到主表清單、快取 SHA-256 |
| `public/data/joint/index.json`、`items.json`、`src/data/jointProgramsManifest.ts` | `npm run data:joint`（`scripts/build_joint_layer.mjs`） | index：每校機構數／項目數／港澳臺合作數／仍在名單數（結果卡片）；items：逐校清單＋對不到主表的條目（學校詳情）；`build` 在 `data:hkmotw` 之後跑它 |

對回教育部主表：獨立法人機構（機構屬性「具有法人資格」：寧波諾丁漢大學、西交利物浦大學、昆山杜克大學、上海紐約大學、香港中文大學（深圳）、溫州肯恩大學、廣東以色列理工學院、深圳北理莫斯科大學…）與沒有中方合作辦學者的境外高校獨立辦學大學（海南比勒費爾德應用科學大學、海南洛桑旅遊大學）用機構名直接對（去掉「（英文：…）」尾註）；校內機構與項目用「中方合作辦學者」校名對，別名來源依序為教育部同碼舊名表、S1 省表學到的舊名（`program_offerings.2027.all.meta.json` 的 `learnedAliases`）、腳本內 `PLATFORM_ALIASES`（平台寫法：中国石油大学→中国石油大学(北京)、浙江大学城市学院→浙大城市学院、牡丹江医学院→牡丹江医科大学、合肥学院→合肥大学、赣南医学院→赣南医科大学…）。對不到的只剩非普通高校（2026-11-07 全量：8 條——中國農業科學院研究生院 2、上海國家會計學院 3、北京國家會計學院 2、廈門國家會計學院 1），留在 meta 的 `unmatched` 與 items 的 `unmatched`，只列不掛校；出現新的對不到普通高校時先查改名，再加別名，不得硬對。
閘門：`npm run test:joint`（`tests/joint-programs.test.ts`：manifest／兩層 payload 一致、名單全數有詳情、每條有平台網址＋編號＋層次＋讀取日、對回的學校都在主表、獨立法人機構以機構對回、45 題不變、狀態與層次口徑）。

年度更新：平台名單頁自述更新日（2026-11 時為「2026年5月25日更新」）；重抓時先 `--lists-only` 看名單數有沒有變，再補抓缺的詳情；已注銷／併入的條目平台仍列（名稱帶括註），本層照列並標狀態，不刪。

### 3.7 海外可申請學校層（2026-11 起，路線圖 S3）

目標：讓「其他國家或地區」起點的用戶（以及想跨區看的任何人）看到 GRAS 2026 前 50 的 403 所非中國大陸機構的**官方國際本科招生頁原文片段**、各國官方申請平台與簽證主管機關頁。
它只抄官方頁原文、不解讀、不換算、不用 AI 生成；任何欄位都不表示錄取可能；排名數字只描述學科分佈。不進任何題目／引擎／AnswerMap／A+ 證據（起點分支題屬 S4）。

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `overseas_admissions.<日期>.csv` | 研究會話 `reports/operations/nope-s3-overseas-20261107/research/tools/crawl_admissions.mjs` → `build_institutions_csv.mjs` → `redact_emails.mjs`，複製入庫 | 一校一列（鍵 `institutionId`＝`gras_institutions_geo` 的 `univCode`）：官網／可註冊網域（S0 已核）、招生頁 URL＋標題＋配對分、高考採認分類＋原句、學歷資格清單＋原句、IELTS／TOEFL 第一個分數＋原句、其他語言、國際生學費原句、申請管道、申請時程原句、資料學年、來源 URL 清單、`domainMatch`、HTTP、抓取頁數、抓取時間、`confidence`（high＝同可註冊網域／medium＝學校另一官方網域）、`status`（verified／needs_review／blocked／not_found）、notes |
| `overseas_national_portals.<日期>.csv` | 研究 `tools/national_candidates.json` → `verify_national.mjs` | 一平台一列：地區、名稱、類型、網域類別（gov／public-agency／official-platform）、`roleLabel`（編輯標籤）、官方 URL、最終網域、對象／費用／時程原句、`corroboratingInstitutions`（幾所機構官方頁鏈到該網域）、HTTP、SHA-256、抓取時間、`confidence`、`status` |
| `overseas_visa_policies.<日期>.csv` | 同上 | 一主管機關頁一列：地區、簽證類別、主管機關、官方 URL、財力／語言／保險／費用／時程原句、HTTP、SHA-256、抓取時間、`confidence`、`status` |
| `overseas_admissions.<日期>.meta.json` | 入庫時手寫 | 研究目錄路徑與方法摘要（指向 `METHOD.md`）、三檔 SHA-256 與列數、抓取期間與請求數、`counts`（與研究 `coverage.md` 一致；build 以此斷言）、去識別聲明、口徑提醒 |
| `public/data/overseas/index.json`、`regions/<slug>.json`、`src/data/overseasManifest.ts` | `npm run data:overseas`（`scripts/build_overseas_layer.mjs`） | index：每機構一條摘要（中英名、地區、官網、GRAS 前 50 學科數、status／confidence／`linkLive`、高考分類、資料學年、抓取日、各欄位有無旗標）＋地區列（按機構數排序，verified／未讀到／平台／簽證鏈接計數），gzip ≤ 200 KiB；地區檔：該地區機構全欄原文片段＋申請平台＋簽證頁，只在進入地區頁時載入；`build` 在 `data:joint` 之後跑它 |

建置斷言（任一不過就不產出）：三檔 SHA-256 與 meta 一致、表頭白名單（擋任何人名／聯絡人欄）、全欄無電郵樣式、`institutionId` 全部對到 geo／websites 且地區／官網一致、`grasSubjectsTop50` 與 `gras_2026_top50.csv` 一致、status／confidence／domainMatch 相互對應、原文片段每段 ≤ 280 字且都有來源、status／confidence 計數＝meta（研究 coverage 口徑）、平台／簽證 verified 必 HTTP 200 且網域一致、序列化後無電郵／會話字串／`pageMatchScore`。

鏈接上線規則（路線圖「對外鏈接規則」＋研究 `S3_SCHEMA_PROPOSAL.md` §3）：

- 機構招生頁只有 `status=verified` 且 `confidence=high` 才 `linkLive`（同時給 URL）；`medium`（學校另一官方網域，7 所）只給標題與主機名並寫「待人工確認後才上鏈接」；`blocked`／`not_found`／`needs_review` 只進資料檔，頁面寫「官方頁本站未讀到：原因」。
- 原文片段與來源清單的 URL 只在機構 `linkLive` 且該 URL 為 https、主機在官網可註冊網域之下時成為鏈接，否則只顯示主機名；`;jsessionid=` 之類伺服器會話段在入庫時去掉。
- 國家層平台 `verified` 且 `confidence=high` 才上鏈接；`official-platform`（UCAS、Common App、各州 TAC 等非政府平台）的 high 需 ≥1 所機構官方頁鏈到該網域（`verify_national.mjs` 已套用，build 再斷言）。簽證頁 `verified` 才上鏈接；被擋者只寫主管機關名與「核查時被擋（HTTP n）」。
- 高考採認標籤只看字樣（寫明接受／寫明不接受／寫法有矛盾／另有內地考生管道／有提及／未讀到），旁邊一律附原句不改寫；`ieltsOverall`／`toeflOverall` 是原句第一個分數，頁面寫明可能是總分或單項。

前端：`#/overseas`（`src/components/OverseasPage.tsx`：地區清單 → `#/overseas/<slug>` 地區頁（申請平台、簽證頁、機構列表）→ `#/overseas/<slug>/<institutionId>` 自動展開該機構）；首頁「其他國家或地區」起點主按鈕「看海外可申請學校」（`origins.ts` 提示）；世界地圖機構面板「招生條件（官方頁原文）→」；結果頁頁尾鏈接；About 來源段。
閘門：`npm run test:overseas`（`tests/overseas-layer.test.ts`，9 項：計數與 coverage 一致、兩層一致、機構鏈接規則與片段長度、國家層鏈接規則、無電郵／會話字串、index 體積、manifest 雜湊決定性、與地圖對照、起點提示與 45 題不變）。

年度更新（隨 GRAS 更新重核；研究目錄 `reports/operations/nope-s3-overseas-20261107/research/` 的工具可離線重跑）：

1. 先跑 S0 的 `data:gras`／`data:gras-geo`／`data:gras-websites`，讓新一年的機構與官網先核過（海外層從 S0 已核官網出發）。
2. 在研究目錄 `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH && node tools/crawl_admissions.mjs --only <ids> --force`（全量不帶 `--only`；只重判快取加 `--offline`）；國家層 `node tools/verify_national.mjs`（候選改 `tools/national_candidates.json`）；再 `node tools/build_institutions_csv.mjs && node tools/redact_emails.mjs` 重建三張 CSV 與 `coverage.md`。被擋（Cloudflare／Incapsula 挑戰、robots 全禁）與純 JavaScript 的機構**不繞過**，留 `blocked`／`needs_review` 給人工瀏覽器覆核；人工確認後把結果填回 CSV 並改 `status`／`confidence`。
3. 複製為 `data/research/overseas_*.<新日期>.csv`，寫新的 `.meta.json`（三檔 SHA-256、列數、`counts` 照新 `coverage.md`、抓取期間）。
4. `npm run data:overseas` → `npm run test:overseas` → 其餘閘門 → 候選 → Pages 交易（§6）。build 的 `REGION_ZH` 缺新地區會直接失敗，補正體名後重跑。

2026-11-07 批 S3 首批（當時值）：403 所中 verified 343（high 336／medium 7）、blocked 42、not_found 16、needs_review 2；高考採認有原句 35（accepted 4／not_accepted 2／separate_channel 4／mentioned 25）；平台 91 條（上鏈接 63）、簽證 90 條（上鏈接 47）；44 個地區；payload `23c590c30412`。抓取 2026-11-07T05:39–06:27Z、9,423 次 HTTP、587 個可註冊網域、零付費。

### 3.10 只讀資料庫 `/db/v1`（2026-11 批 F2 起，路線圖 S5）

把 §3.1–§3.9 的各層統一成有版本、有來源、有有效期的靜態資料庫，供 path／gk 等站內產品與任何人只讀取用。**只是索引與註記**：不改任何既有 payload 形狀、不新增判斷、不進題目／引擎／AnswerMap／A+ 證據；任何欄位都不表示錄取可能。不新增任何 Cloudflare 資源：檔案隨既有 Pages 專案發布，CORS／快取頭在 `public/_headers`（只匹配 `/db/*`）。

| 檔案 | 產生方式 | 內容 |
| --- | --- | --- |
| `scripts/lib/db_layers.mjs` | 程式 | 讀各層組成六類實體草稿＋來源線索；`NEXT_REVIEW` 年度日曆 |
| `scripts/lib/authority_tier.mjs` | 程式 | Node 端分級（與 `src/lib/authorityTier.ts` 同規則；`check_links.mjs` 共用） |
| `data/research/db_source_evidence.<日期>.json.gz` | `npm run data:db-evidence -- --date … --s3 … --s4 … --xcut …`（`scripts/assemble_db_evidence.mjs`，不連網） | 研究會話保存的逐 URL 抓取證據子集（2026-11-07 當時值 1,430 條） |
| `data/research/db_https_entry.<日期>.json` | 人工觸發的禮貌 https 探測 | 資料層記為 http 的來源的 https 入口（2026-11-07：11 條，10 可用、1 不可用） |
| `public/db/v1/<version>/*.json`、`public/db/v1/latest.json`、`src/data/dbManifest.ts` | `npm run data:db`（`scripts/build_db.mjs`；build 鏈在 `data:i18n` 之後、`tsc` 之前） | manifest＋六個資料集；只保留當前版本目錄 |

建置斷言（任一不過就不產出）：來源全 https 且有分級（規則表 → 網域型態 → 資料層脈絡）、institution id 格式、crosswalk 端點存在、channel／condition 引用的機構／來源存在且每筆有 validity、引用檔存在、latest ≤10 KiB、institutions gzip ≤500 KiB、無電郵字樣。閘門 `npm run test:db`（`tests/db.test.ts`，9 項：latest／manifest／資料集與 84 個引用檔 sha256、版本雜湊可重算、id 與 crosswalk 雙向、validity 齊、sources https＋分級、體積、`_headers` 只動 `/db/*`、三語鍵）。

更新：任何一層資料更新後，`npm run build` 會一併重建資料庫（新內容＝新 version）；提交時連同 `public/db/v1/` 一起提交（建置後工作樹必須乾淨）。年度流程見 `docs/ANNUAL_UPDATE.md`；schema `docs/DB_SCHEMA.md`；使用契約 `docs/DB_API.md`。2026-11-07 當時值：機構 3,935（moe 2,952／gras 544／crs 411／hkmotw 28）、對照 561、管道 2,051、條件 1,223、來源 3,516（可上鏈接 3,411）、有效期 3,274、引用檔 84（29.9 MB）；資料集合計約 5.7 MB（gzip 約 0.6 MB）。

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
- 引擎側：`isHardFilterableQuality()` 拒絕全部匿名生活回報，B類只接收當年度整校官方依據；`getSchoolDimensionValue` 對未過門檻的資料回 `null`。票數與信心標籤只供展示。
- 展示側：學校詳情顯示全部填答數、可歸一數、分布及無法判讀數；平票與全部未知也保留。所有匿名回報標為僅供參考，逐校官方補證另列日期、適用範圍與來源。

以下為舊單票門檻的歷史分佈（現已由整校/年度規則取代）：44,929 條眾包值 = high 22,754 / medium 11,184 / **low 10,991（24.5%）**。
門檻上線後 B 系覆蓋率整體下降（例：B24 從 1,886 降到 1,597 所），這是預期的：
損失的是本來就不該有的排除權。

`setQuality()` 同時修掉一個靜默覆蓋：眾包階段在官方階段之後跑，以前會直接蓋掉
`campus_official_overrides.csv` 寫入的 B9 官方結論（實測 4 條）。現在官方 > 眾包，不可逆。

### 4.1 當前仍屬高風險缺口

- `A5 校區位置`：校區底稿已擴到 `2732` 所學校、`3396` 條記錄，但真正進硬篩選的校級官方覆蓋目前只有 `9/2952`；新增北京 9 校後，`maxExcluded` 為 `3`。
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
| below_threshold | 有回報，但缺整校範圍或年度依據 | 報告，不阻塞；僅增加票數不會恢復硬篩選 |
| absent | 主池裡完全沒有 | **必須**寫進該維度的 `reservedValues`，否則 exit 1 |

`reservedValues` 過期（值有數據了還留在聲明裡）同樣報錯。當前 23 個聲明死值，
分佈在 A1（港澳台不在教育部名單）、A4（精確學費區間待 tuition_programs.csv）、
A5（`separate_freshman` 目前 0/2952，靠 campus_official_overrides 的 freshmanOnly 補）、
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

- 色系、畫布、字體與進場動畫放在 `src/shared-ui/`，與姊妹站 path.bdfz.net **逐位元組相同**
  （`theme.css`、`theme.ts`、`ThemeCustomizer.tsx`、`tests/theme-contrast.test.ts`、`scripts/check_shared_ui.mjs`）。
  本站自己的樣式只寫在 `src/index.css`。
- 色系只有兩套：`紙色`（淺）與 `墨色`（深）。不提供自選強調色——任意顏色無法保證文字對比度。
- 本地存儲鍵：`bdfz.subtraction.theme.v1`
- `npm run test:theme` 逐一計算每套色系的對比度：文字色對畫布／卡片底 ≥ 4.5:1、按鈕文字 ≥ 4.5:1、
  選項邊框 ≥ 3:1。不過就不發布。
- `npm run check:shared-ui` 核對共用檔與 `manifest.json` 一致，姊妹倉庫在旁邊時一併逐檔比對。

改共用模板：

1. 在任一站改 `src/shared-ui/` 裡的檔案，跑 `npm run test:theme`
2. `node scripts/check_shared_ui.mjs --write` 重寫 manifest
3. 把同樣的五個檔案與 manifest 複製到姊妹倉庫，兩邊各跑 `npm run check:shared-ui`
4. 兩站一起發布

元件裡不要用降低透明度（`opacity-*`）來表示次要或停用——用 `text-fog-500` 這類仍過對比度的字色；
字級不低於 12px（`text-xs`）。

### 5.2 問題頁與結果頁

- 問卷頁不再展示覆蓋率與排除量說明，避免打斷答題；這些方法論統一放到 About。
- 沒有實際刪減能力的題與限制選項會先暫時隱藏。
- 新增 `A6 特殊招生／特長門檻`，目前是基於院校類型、校名和公開招生方式做的保守啟發式：藝術/體育院校、軍警院校、航海/飛行類優先標記；拿不準的不硬貼。
- `B7 假期節奏` 只在明確識別出 `有小學期` 或 `暑假短` 時才進負面值；含混文本一律不做硬結論。
- 當剩餘學校 `<= 10` 時，問卷會停在當前題並提示先看報告，不再自動跳轉到結果頁。
- 結果頁除了剩餘名單，還必須保留「查一所學校」檢索區，讓用戶能看到某所學校是保留還是被哪幾題排掉。
- 結果頁應保留「回去改條件」與「清空重來」入口。

### 5.3 多語言（2026-11 批 E1 起，路線圖 S4）

介面提供 zh-Hant（正體，來源語言）、zh-Hans（簡體，建置期由正體字級轉換生成）、en（站方翻譯）。語言只是展示層：
不進 `AnswerMap`、不進 A+ 學習證據、不進 hash 路由；存 `localStorage` 鍵 `unapply.locale.v1`（值 `zh-Hant`／`zh-Hans`／`en`）。

**檔案與模組**

| 路徑 | 作用 |
| --- | --- |
| `src/i18n/locales/zh-Hant.json` | 來源字典（鍵→正體文字，鍵依 en 排序）；打包進主包，永不缺鍵 |
| `src/i18n/locales/en.json` | 英文字典（同鍵集）；建置期壓縮到 `public/i18n/en.json` 懶載 |
| `src/i18n/zh-hans.overrides.json` | 簡體不能由字形轉換得到的少數鍵（目前只有 `meta.htmlLang`） |
| `scripts/build_i18n.mjs`（`npm run data:i18n`，在 `build` 鏈 `data:overseas` 之後） | 校驗三語鍵集合／空值／佔位符與標記一致，跑 140 條 fixtures，生成 `public/i18n/zh-Hans.json`、`public/i18n/en.json` 與 `src/data/i18nManifest.ts`（版本雜湊只由內容決定；前端載入時核對鍵數） |
| `scripts/lib/t2s.mjs` ＋ `scripts/vendor/opencc/`（OpenCC `TSPhrases.txt` 277 條＋`TSCharacters.txt` 4,113 條，Apache-2.0，只在建置期） | 正體→簡體字級轉換：先站內例外表 `SITE_PHRASES`，再 OpenCC 詞組（只處理一繁對多簡的歧義），再字級；不用任何用詞替換表（`tw2sp`／`zh-cn` 類） |
| `src/i18n/core.ts` | 無 React 依賴：`t(key, params)`、`tOr(key, fallback, params)`、`tpl(key)`、`formatNumber`、語言推測／儲存／懶載、`translatorFor(locale)`、`installDictionary`（測試用） |
| `src/i18n/react.ts` | `useLocale()`：`{ locale, t, tOr, n, setLocale }`，語言切換時訂閱者重繪 |
| `src/i18n/rich.tsx`／`richRender.tsx` | `<Rich k params slots/>`：模板允許 `<b>`、`<n>`（等寬數字）、`<x>`（強調色數字）、`<code>`、`<br/>`、`<a1>…<a9>`（鏈接／按鈕文字留在模板，網址留在程式） |
| `src/lib/i18nLabels.ts` | 把引擎／資料的機器欄翻成人話：題目、選項、取值（`val.*`）、省名、校名顯示規則、卡片標籤、排除理由、鏈接標籤、S1／S2 判定 |
| `src/components/LocaleSwitcher.tsx` | 頭部三態切換；字典先載再切，載不到就留在原語言 |
| `tests/i18n.test.ts`（`npm run test:i18n`）＋`tests/fixtures/zh-hans.fixtures.json` | 閘門，見下 |

**鍵名**（研究 `strings_inventory.md` §3 方案；追加式、不改名、不刪）：`q.<題號>.title`／`.subtitle`／`.opt.<key>.label`／`.hint`、`dim.<維度>.label`、`val.<維度>.<取值原文>`（取值就是契約，鍵的最後一段永不改）、`val.C5.subject.<代碼>`＋`val.C5.template`、`dist.level.*`／`dist.cityTier.*`、`subject.*`、`geo.province.<省名>`、`origin.<id>.label`／`.hint`、`section.*`、`tag.*`、`reason.*`、`program.*`、`link.*`、`meta.*`、`ui.<頁>.<項>`（頁 ∈ landing／runner／result／detail／about／world／hkmotw／overseas／contribute／share／evidence／app／common／data／aplus／locale）。模板佔位 `{name}`，由程式代入、永不翻譯。

**語言邊界**（哪些不翻、哪些只轉字形）

- 引擎、資料層、`lib/schoolProfile.ts`、`data/admissionAuthorities.ts`、Function 不得匯入 `src/i18n`（`test:i18n` 斷言）。引擎輸出的 zh-Hant 字串（`ExcludeReason.questionTitle`／`userAnswerLabel`／`schoolValue`、`buildSchoolTags`、`explainKept`）維持不變，另帶機器欄給展示層翻譯；gk 交接 `nope.v1` 固定送 zh-Hant 原文。
- 契約／紀錄字串不翻不轉：`public/learning-manifest.json`、`lib/learningEvidence.ts`、結果頁下載紀錄、貢獻頁 GitHub issue 標題／正文與用戶中心事件、`trustedAPlus.ts` 的簡體狀態文字（另帶 `messageKey` 供介面顯示）。程式裡這些行以 `// i18n-contract` 標記，CJK 字面量掃描會跳過。
- 資料驅動名稱不翻譯：學校名、城市名、專業目錄名、省考試院與來源標題、港澳臺院校／世界地圖／海外機構名與 payload 內的原文片段。校名顯示規則（`schoolDisplayName`）：zh-Hant＝原文（教育部主表簡體名照舊，不自行繁化）；zh-Hans＝手工增強層的 `nameSimplified`，其餘原文；en＝原文，有 `nameEn` 時並列。世界地圖學科名用 payload 自帶的 `nameZh`／`nameZhHans`／`nameEn`；地區名 en 用地區代碼（英文名）。payload 內的編輯說明（`statusZh`／`policyZh`／`note`／`roleLabel`／`typeZh`）以代碼經 `ui.overseas.*` 翻譯者優先，其餘照原文顯示。
- `src/shared-ui/` 與 path.bdfz.net 逐位元組相同：色系面板 6 條與同步提示階段標籤 3 條在英文介面維持中文（待站長裁定兩站是否同批改，見發布記錄的 `PENDING_OWNER_REVIEW.md`）。

**加一條字串**：在 `src/i18n/locales/zh-Hant.json` 與 `en.json` 加同一個鍵（保持排序；`data:i18n` 會擋鍵集合不一致、空值、佔位符或標記不一致）→ `npm run data:i18n` → 在程式裡 `t('key')`／`<Rich k="key"/>` → `npm run test:i18n`。簡體不手寫：若轉換結果有錯（一簡對多繁），在 `scripts/lib/t2s.mjs` 的 `SITE_PHRASES` 加詞組並補一條 fixture，不整體換轉換器；只有無法由字形得到的鍵才進 `zh-hans.overrides.json`。

**英譯審校規則**：題目與選項語義精確（不增減條件）、術語照研究 `glossary.en.md`（Gaokao、Double First-Class、Project 985／211、comprehensive evaluation、HKDSE／JUPAS、GSAT／AST、programme class 等）、站規用語（cross out／subtraction、benefit of the doubt、still standing）、數字格式與貨幣寫明（CNY）、不出現機器腔與鍵名；en 不得含 CJK（白名單：查學校的示例佔位、`高考 / Gaokao` 字樣）。疑義以正體為準（About 頁「語言說明」已寫明）。

**首次語言與切換**：已存的 `unapply.locale.v1` 優先；否則依 `navigator.languages`：`zh-TW`／`zh-HK`／`zh-MO`／`zh-Hant*`→zh-Hant，`zh-CN`／`zh-SG`／`zh-Hans*`→zh-Hans，`en*`→en，其餘（含單獨的 `zh`）→zh-Hant。非 zh-Hant 時 `main.tsx` 先載字典再首繪，載不到就留在 zh-Hant。切換時同步 `<html lang>`（`zh-Hant`／`zh-Hans`／`en`）、`document.title`、`meta[name=description]`；og:* 維持靜態正體。zh-Hans 介面的襯線字型在 `src/index.css` 以 `:root[lang="zh-Hans"]` 優先 Noto Serif SC（`index.html` 字型鏈接已加該家族；只在用到時下載）。

**閘門 `test:i18n`**：三語鍵集合相等、已排序、無空值、佔位符與富文本標記一致且成對；zh-Hans 逐鍵等於字級轉換（覆寫表除外）且 140 條 fixtures 全過、不換用詞；en 無 CJK；zh-Hant 與倉庫原文逐條相等（45 題標題／副標／選項、維度標籤、取值、科目、省名、起點）；程式裡的靜態鍵與動態鍵族都存在；介面檔無未經 `t()` 的 CJK 字面量（資料檔、引擎、shared-ui、契約行除外）；45 題在三語下選項數與 key 不變；manifest 雜湊可重算；語言推測表；引擎不匯入 i18n。對比度閘門 `test:theme` 不受語言影響，但英文字串更長：發布前以內建瀏覽器在三語 × 兩色系 × 1440／390 逐路由量測（批 E1 記錄見 `reports/operations/nope-s4-i18n-origins-20261107/nope-e1/`）。

**體積**（批 E1 當時值）：1,200 鍵；主包從 398 KiB 增到 466 KiB（含正體字典 77 KiB；gzip 143 KiB）；`public/i18n/zh-Hans.json` 77 KiB／`en.json` 91 KiB（gzip 各約 27 KiB），只在切到該語言時載入。無新執行期依賴；建置期字典 92 KiB 已 vendored。

### 5.4 起點分支與跨國結果（2026-11 批 E2 起，路線圖 S4；研究 origin_branch_design.md 方案 B）

起點（第 0 題，`origins.ts`，5 個值不變）之後，各起點先問「前幾題」——**資格**（港澳臺與海外起點）與**範圍**（所有起點）；皆可跳過。它們是「用戶是誰」，與 `candidateProvince`、`origin` 同性質：
存 `localStorage` 鍵 `unapply.originPrefs.v1`（`{ qualification, scope }`），**不進 `AnswerMap`、不進 `DimensionId`、不進 A+ 學習證據、不送 Function**（`test:origins` 斷言；若站長要讓起點答案進學習證據，是共享契約追加——方案 A——另批並先報站長）。

**資料與模組**

| 路徑 | 作用 |
| --- | --- |
| `src/data/originBranch.ts` | `Qualification`（18 值）、`Scope`（local／abroad／both）、`QUALIFICATIONS_BY_ORIGIN`（hk 3／mo 3／tw 3／overseas 13／cn 無）、`SCOPES_BY_ORIGIN`（海外起點只有 abroad／both）、每個資格對應的 S3 `qualificationsListed` token 與「這是什麼資格」官方頁、港澳臺→大陸官方管道 `MAINLAND_CHANNELS`、儲存與歸零、`qualificationTokens`（大陸起點＝高考 token＋`gaokaoPolicy=accepted`）、`showCrossBorder` |
| `data/research/origin_sources.2026-11-07.json` | 研究會話 `sources.json` 的子集（65 條：起點制度官方頁與港澳臺→大陸管道），含狀態、網域、SHA-256、抓取時間；不含電郵 |
| `scripts/build_origin_layer.mjs`（`npm run data:origins`，build 鏈在 `data:overseas` 之後、`data:i18n` 之前） | 讀地區檔 → `public/data/overseas/qualifications.json`（token → 機構 id、`gaokaoAccepted`；gzip ≤ 20 KiB）；讀研究子集 → `src/data/originSources.ts`（url → 標題／網域／狀態／核對日／`live`）；`src/data/originManifest.ts`（版本雜湊只由內容決定，綁 S3 版本）。fail-closed |
| `src/lib/originLayer.ts` | 懶載索引（核對 manifest）、`markInstitution`（token 子串相等；大陸起點另看 `gaokaoPolicy=accepted`）、`countListed`（listed＋unread＝total，永不過濾） |
| `src/components/OriginBranch.tsx` | 首頁起點卡內的分支面板：資格單選（含提示與官方頁）、範圍單選、清除；說明不進紀錄 |
| `src/components/MainlandChannels.tsx` | 港澳臺院校池內的「官方進大陸管道」：每條帶狀態徽章、本站摘要（當時值）、官方頁鏈接與核對日 |
| `tests/origins.test.ts`（`npm run test:origins`） | 閘門，見下 |

**規則（硬性）**

- 資格只用**保留**語義：海外機構官方頁 `qualificationsListed` 含所選 token → 標「校方頁面寫明接受：…」；大陸起點 `gaokaoPolicy=accepted` → 「校方頁面寫明接受高考」；其餘一律「官方頁未讀到（保留）」。**絕不劃掉**任何機構、計數永遠 listed＋unread＝total；`not_accepted` 也只是不標示（原句照列，由用戶自己決定）。`status≠verified` 的機構不標示。
- 對外鏈接：只有 `originSources[url].live`（研究 verified＋https＋最終網域在記錄網域下）才渲染為鏈接；blocked／needs_review（IBO、Parcoursup、教育部 education.gouv.fr、CBSE／CISCE、KICE robots、澳門教青局保送專頁、臺灣申請系統登入頁）只寫標題、網域與「官方頁本站未讀到：原因」。`test:origins` 以白名單網域尾綴核對全部上線鏈接。
- 港澳臺→大陸官方管道的「要點」是本站摘要（當時值：文憑試收生計劃「3、3、2、2」、2026 聯招 3 月報名／5 月 23–24 日考、學測均標等），頁面明寫「以當年辦法與簡章為準」；不代表錄取可能、不替任何人判定資格。
- 跨國規則：所在地只影響「前幾題」與「可申請管道」，不預設剔除任何國家。結果頁 `CrossBorderSections`：大陸起點看 `scope`（abroad／both 展開；local 或未選折疊為一行入口）；港澳臺／海外起點一律展開；兩段各帶機構數、已核計數、資料日與入口，資格有 token 時加「寫明接受 n／保持未知 m」。
- 大陸起點的 45 題不變；港澳臺起點進大陸題庫時 A6 多一行官方管道提示（`ui.runner.a6.hkmotwNote`），判定不變。

**加一個資格／管道**：在 `originBranch.ts` 加值與 token（token 必須是 S3 地區檔實際出現的字串，`test:origins` 會擋）；官方頁先進 `data/research/origin_sources.<日期>.json`（由研究會話的 `sources.json` 取子集，或新核查後追加，含狀態與抓取時間）→ `npm run data:origins` → 三語鍵 `origin.qual.<id>.label`／`.hint` 或 `ui.channels.<key>.title`／`.summary` → `npm run data:i18n` → `test:origins`＋`test:i18n`。年度重核：研究目錄 `tools/verify_sources.mjs` 重抓 → 更新子集 → 重跑 `data:origins`（`live` 隨狀態變）。

**閘門 `test:origins`**（7 項）：不進 AnswerMap／DimensionId／learning-manifest／A+ 證據；起點 5 個不變、各起點資格與範圍選項齊、換起點歸零；資格 token 全部存在於 S3 資料且索引與地區檔逐 token 一致；保留語義（標示永不減少機構數、listed＋unread＝total、`not_accepted` 不劃）；官方頁 live 規則、needs_review 管道不上鏈接、網域白名單、無電郵；三語鍵齊；manifest 雜湊可重算、gzip ≤ 20 KiB、綁 S3 版本。

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
npm run test:theme
npm run check:shared-ui
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

## 2026-09-08 已授權過渡發布（歷史，已由生活證據修復取代）

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

## 2026-09-08 生活證據範圍修復（已上線，當前權威）

正式部署 `5df11243-e7b1-48b1-9c2f-902f9757f0ea`，來源 `03523202ac0dddc7c5c416ed36008811d8e064f9`，完成 `2026-09-08T23:18:48.600864Z`，Direct Upload/master/commit_dirty=false；runtime `8faec1133601`。發布前後Git閘門通過，39檔產物雜湊一致；正式域名和不可變URL的2919校/2919唯一教育部代碼資料SHA256均為 `0db94d09cdce2bbb6eee90388278dc190d6a35313af540e1604701a11e240413`。

中大B9不再由不同校區匿名回報誤排。生活回報的分母含所有非空填答，保留分類分布、平票與未知；57335組眾包資料中12697組沒有勝出值也保留參考。B硬排除只接受當年度、整校、符合完整選項語義並帶逐校官方HTTPS來源的證據。吉大2026官方公告只證明全校宿舍空調，不擴張成教室都有。另撤除三校無分鐘數證據的地鐵推定，修正兩個過期官方URL，所有B來源保留到runtime JSON。

**代價：24項生活題暫緩硬排除，目前有效題15项；結果可能保留不符合生活偏好的學校。** 首頁、題面、結果與詳情已明示範圍、分歧及未知。沒有擴張2919校主池、改AnswerMap/RPC/Functions/共享樞紐或安裝新依賴。

九閘全過，60 filters + 2 evidence + 7 trusted = 69 tests；151選項×31省的4681比較無新增排除、非B結果不變。Chrome本機與正式站均驗證中大131/24/107、吉大官方來源、A6北京2/2917與江蘇3/2916、來源連結與日期、手機無横向溢出、pageerror=0；本機另驗證停用儲存/rAF/第三方元件、目錄與校區首次503後成功重試。線上learning health前後均200/receipt active且JSON一致。這不構成真實認證寫入→中央投影→重載驗收。

即時回滾：`18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c` / source `aff7c2a56a57e02d7d9054ead7ebd3c007314c9f`，已只讀核對successful production及可讀舊產物，未實際切回；用既有Pages rollback API，完成後再驗canonical、正式域名asset/catalog/health。無資料庫遷移。

仍未解決：A2第三方城市榜單與預設、E省級推導、C5缺項作負面證據、證據服務未帶candidateProvince、真實認證跨端驗收，以及原裁定列出的招生/校區/學費資料缺口。原43維全面準確性未通過裁定保留。

CAPABILITY_FIT: no-new-capability。Node24.18.0、Wrangler4.100.0、Pages production compatibility_date2026-04-20、APLUS_EVIDENCE→bdfz-user-center/UnapplyAPlusEvidence均不變。只做葉子站修復；既有學習與身份橋契約未變，沒有新增監控排程。

資源與還原：本地來源 `/Users/ylsuen/CF/sites/interactive/unapply`，GitHub `ieduer/unapply@master` 與不可變部署 `https://5df11243.unapply.pages.dev` 是版本還原權威。原始問卷 `/tmp/university-information/questionnaires/results_desensitized.csv` 沿用現存commit `0aa4c193a302dd27c4044f510f6880e9325d79b3`，未複製/更新/刪除；重建研究資料用 `npm run data:research`，已有生成資料的版本建置用固定Node的 `npm run build`。在核准的不存在目錄可 `git clone --branch master https://github.com/ieduer/unapply.git <ABSENT_PATH>`，先 `git cat-file -t 03523202ac0dddc7c5c416ed36008811d8e064f9` 核對Git還原來源並按manifest核對檔案，再建置；不可將clone本身當還原驗收。

本任務Chrome與wrangler暫存共36820KiB已清理，task root不存在，沒有本任務存活瀏覽器/伺服器。原始來源、當前生成資料、既有dist/.wrangler/node_modules/.tmp與驗證報告均retain_hot供現行版本還原與待補資料復核，owner suen、review2026-10-08；沒有本輪Drive冷資料待歸檔。精確路徑/大小/狀態見 `/Users/ylsuen/CF/reports/private/runtime-artifact-manifests/20260908-unapply-crowd-scope-repair.json`。本輪未刪任何既有來源。

裁定、來源、九閘、瀏覽器、發布及清理證據：`/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/README.md`。文件收尾另提交推送；Pages未配置Git autobuild，因此純文件提交不改線上來源。
