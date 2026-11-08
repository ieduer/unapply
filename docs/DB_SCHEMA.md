# nope.bdfz.net 只讀資料庫 `/db/v1`：統一 schema（路線圖 S5，2026-11-07 批 F2 起）

Owner: suen。本文件定義資料庫的六類實體、欄位與 id 規則；使用契約（端點、版本、CORS、快取、使用規範）在 `docs/DB_API.md`，年度更新在 `docs/ANNUAL_UPDATE.md`。
資料庫是站內既有各資料層的**統一索引＋來源／有效期註記**，不新增任何判斷，**任何欄位都不表示錄取可能或推薦**；排名只描述學科分佈。
它不改任何既有 payload 的形狀（`public/data/**` 的消費者照舊），也不進題目／引擎／AnswerMap／A+ 學習證據。

## 1. 檔案與版本

```
public/db/v1/latest.json                     指向現行版本（≤ 10 KiB；快取 300 秒）
public/db/v1/<version>/manifest.json         版本總表：六個資料集的路徑／筆數／sha256／位元組，引用檔清單，輸入檔與計數
public/db/v1/<version>/institutions.json     institution
public/db/v1/<version>/crosswalk.json        跨層對照
public/db/v1/<version>/channels.json         admission_channel
public/db/v1/<version>/conditions.index.json admission_condition（小資料內嵌；大資料以 valueRawRef 指向既有 payload）
public/db/v1/<version>/sources.json          source
public/db/v1/<version>/validity.json         validity（每筆 channel／condition 一筆）
```

- `version`＝12 位十六進位，**只由內容決定**：`sha256(JSON.stringify({ schemaVersion, datasets: {名稱: sha256}, references: [[路徑, sha256]…] }))` 前 12 碼。內容不變重建就不變；版本目錄內的檔案永不改。
- `generatedAt`＝所有輸入記錄中最晚的日期（`YYYY-MM-DD`），不是建置時間。
- 每次部署只帶**當前**版本目錄（`scripts/build_db.mjs` 會刪掉其他版本目錄）；舊版本由舊部署（回滾）或 Git 歷史提供，見 `DB_API.md` §3。
- `schemaVersion` 為 1；不相容的欄位變更改走 `/db/v2/`，`/db/v1/` 只做追加。
- 每個資料集檔的頂層：`schema`（如 `nope.db.v1.institutions`）、`count`、分組計數（`byScheme`／`byKind`／`byType`／`byTier`…）、`generatedAt`、`records`（crosswalk 為 `pairs`＋`byId`；validity 的 `records` 是以 id 為鍵的物件）。

## 2. 實體

### 2.1 institution（`institutions.json`）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | string | `<scheme>:<code>`，見 §3 |
| `scheme` | `moe`／`gras`／`crs`／`hkmotw` | 來源體系：教育部主表／軟科 GRAS 2026 前 50／教育部中外合作辦學監管平台機構／港澳臺院校池 |
| `code` | string | 該體系內的原生代碼（教育部 10 位識別碼、GRAS `univCode`、平台詳情頁 id、池內 id） |
| `kind` | string | `mainland_hei`、`gras_ranked`、`joint_institution`、`foreign_independent_university`、`university`／`college`…（港澳臺池原值） |
| `name` | `{ zhHant, zhHans, en, original? }` | 照各層原文；`original` 是平台簡體原文（合作辦學機構）；缺者為 null，不自行翻譯 |
| `region` | string | GRAS 地區碼（`China`、`China-Hong Kong`、`United Kingdom`…） |
| `province`／`city` | string? | 大陸機構（教育部主表；合作辦學機構只有省） |
| `moeLevel`／`level`／`ownership` | string? | 教育部主表層次、本站分層（C9…專科）、辦學性質 |
| `cooperation`／`legalPerson`／`licenseNo` | string? | 合作辦學機構：合作類型、是否具法人資格、批准書／許可證編號 |
| `subjectsTop50`／`wikidata` | number?／string? | GRAS 機構：前 50 名的學科數（只描述分佈）、Wikidata Q 號 |
| `website`／`websiteTier`／`websiteTierReview`／`websiteConfidence` | | 官網與其權威分級（`P0`／`P1`／`P2`）；`websiteTierReview=true` 表示分級來自年檢基線且頁面標題未自動確認校名（待人工）；GRAS 官網的 high／medium |
| `admissionWebsite` | string? | 大陸機構本科招生網（研究增強層） |
| `status` | string | `listed`（教育部名單）、`ranked`（GRAS）、`listed`／`suspended`／`merged`／`terminated`（合作辦學）、`verified`／`review_required`（港澳臺池） |
| `sourceId` | string | 指向 `sources.json`（名單頁、排名頁、平台詳情頁、名單來源） |
| `reviewedAt` | date | 該筆最近核對日 |
| `siteRoute` | string? | 本站頁面 hash 路由（如 `#/school/北京大學` 的編碼形式、`#/world`、`#/hkmotw`） |

### 2.2 crosswalk（`crosswalk.json`）

`pairs`：`{ a, b, relation, basis }`；`relation`＝`same_institution`（同一機構在兩個體系：GRAS↔moe、港澳臺池↔GRAS、具法人資格的合作辦學機構↔moe）或 `part_of`（不具法人資格的合作辦學機構 `a` 是教育部主表學校 `b` 的一部分）。`byId`：每個 id 的全部對照（`part_of` 的反向為 `has_part`），只由 `pairs` 展開，雙向一致（`test:db` 斷言）。

### 2.3 program（引用，不另存）

大陸招生專業（類）與選考要求沿用 S1 兩層 payload（`/data/programs/index.json`＋`/data/programs/schools/programs-NN.json`），國標目錄 `/data/programs/catalog.json`，合作辦學項目 `/data/joint/items.json`；它們列在 `manifest.references`（路徑、sha256、位元組、`describes`、`entity`）。形狀見 `src/data/programsTypes.ts`、`src/data/jointTypes.ts`。

### 2.4 admission_channel（`channels.json`）

共同欄位：`id`、`kind`、`institutionId`（可為 null）、`region`、`name`、`status`、`confidence?`、`family`（年度維護族，見 §4）、`sourceId`（可為 null：見 `sources.excludedInsecure`）。

| `kind` | 內容（當時值筆數） | 專屬欄位 |
| --- | --- | --- |
| `a6_admission_route` | 有官方章程佐證的「普通批／綜合評價」分省結論（14） | `regularProvinces`、`comprehensiveProvinces` |
| `hkmotw_channel` | 港澳臺院校招收內地高考生／港澳生的管道（23，含 2 條待覆核） | `audience`、`channel`、`level` |
| `national_portal` | 各國官方申請平台／資訊入口（91） | `portalType`、`domainClass`；非 https 的候選不收為來源並寫 `note` |
| `origin_qualification_system`／`origin_mainland_channel` | 起點資格制度官方頁（54）／港澳臺→大陸官方管道頁（11） | `purposeZh` |
| `joint_program_entry` | 教育部中外合作辦學監管平台名單全數（1,834；機構與項目） | `programKind`、`cooperation`、`level`、`levelLists`、`enrolmentYears`、`enrolmentEndYear`、`detailRef`（指向 `/data/joint/items.json` 的條目） |
| `direct_hire` | 企業直招高中生（非大學路徑，只收站上渲染的 24） | `programKind`、`paid`、`degree`（yes／no／partial／unknown）、`sinceYear`、`officialSourceId` |

### 2.5 admission_condition（`conditions.index.json`）

| 欄位 | 說明 |
| --- | --- |
| `id` | `<主體 id>:<type>`（如 `gras:RG00002:english`、`moe:4111010001:strong_base`、`hkmotw:hk-hku:1:tuition`、`visa:<地區 slug>:<n>`）或資料集級 `dataset:…` |
| `subjectId` | institution／channel id，或 `region:<GRAS 地區碼>`（簽證），或 `dataset:programs`（整份選考要求） |
| `type` | `gaokao`、`qualification`、`english`、`other-language`、`tuition`、`timeline`（S3 研究 §2 的六類）＋ `visa`、`policy`（強基）、`eligibility`（直招條件）、`subject_requirement`（S1 選考要求，資料集級） |
| `valueRaw` | 官方頁原文（小資料內嵌：港澳臺管道條件、直招條件）；不改寫 |
| `valueRawRef` | 大資料的指向：`{ path, pointer, quotes? }`——`path` 是 `manifest.references` 裡的既有 payload，`pointer` 是檔內位置（如 `institutions[2].english.quotes`） |
| `valueNorm` | 機器正規化值（只在來源層已有時給）：高考採認分類、資格 token 清單、`{ tests, ielts, toefl }`（原句第一個分數，可能是總分或單項）、`{ policy:'strong_base_pilot', since }`、`{ category, authority }`…；null＝未正規化 |
| `academicYear` | 資料學年／招生年度（原文；`2027`、`2027/28`）；null＝來源未標 |
| `sourceId`／`sourceRefs` | 來源；資料集級條件用 `sourceRefs`（`/data/programs/index.json` 的 `sources` 鍵） |
| `status`／`confidence` | 照來源層（verified／needs_review／blocked／not_found；high／medium） |

### 2.6 source（`sources.json`）

| 欄位 | 說明 |
| --- | --- |
| `id` | `src:` ＋ `sha256(url)` 前 16 碼 |
| `url` | **一律 https**；資料層記為 http 者改用經核查可用的 https 入口（`data/research/db_https_entry.<日期>.json`），原值寫在 `note`；沒有 https 入口的不收，列在 `excludedInsecure` |
| `finalUrl`／`http`／`sha256`／`fetchedAt` | 抓取證據（轉址後網址、回應碼、本文 SHA-256、時間）；來源依序為資料層自帶（海外平台／簽證 CSV、origin_sources、s1_sources、合作辦學 CSV）→ `data/research/db_source_evidence.<日期>.json.gz`（研究會話）→ `data/research/link_check.<日期>.csv.gz`（年檢基線）；平台詳情頁未保存逐頁雜湊者 `sha256` 為 null |
| `domain` | 可註冊網域 |
| `tier`／`tierBy` | `P0` 官方／`P1` 權威平台／`P2` 第三方（定義見 `docs/MAINTENANCE_MANUAL.md` §3.8）；`tierBy`＝`rule`（規則表）、`heuristic`（gov／edu 網域型態）、`context:*`（依資料層脈絡：機構官方網域、gov、public-agency、exam-board、official-platform…） |
| `status` | `verified`、`blocked`、`needs_review`、`not_found`、`unreachable`、`broken`、`redirected` |
| `linkable` | 只有 https＋`verified`，且站上同一規則會上鏈接（海外招生頁 verified＋high 且在官網網域內、申請平台 verified＋high、簽證頁 verified…）才為 true；**消費者只應把 linkable 的來源渲染成鏈接** |
| `title`／`families`／`note`／`evidence` | 標題、使用它的資料族、https 入口說明、證據出處 |

### 2.7 validity（`validity.json`）

每筆 channel 與 condition 一筆（`records[<id>]`）：`academicYear`、`validFrom`、`validTo`（**null＝未知**；只在來源明寫時給，如合作辦學批准書有效期）、`fetchedAt`、`reviewedAt`、`nextReviewDue`、`family`。海外層（`family=overseas`）條件的 `reviewedAt` 在 2026-11-08 批 G1 起取 `overseas_admissions` 的人工確認欄 `reviewedAt`（招生頁位於人工確認的另一官方網域時：MIT、Lancaster），其餘為抓取日；該欄與 `reviewedBy`（角色代碼，不存人名）／`reviewNote` 只在研究入庫檔，資料庫不另存。`calendar` 是各族下一次應重核的日期（`scripts/lib/db_layers.mjs` 的 `NEXT_REVIEW`，與 `docs/ANNUAL_UPDATE.md` 同步）。

## 3. id 規則

| 實體 | 格式 | 例 |
| --- | --- | --- |
| institution | `moe:\d{10}`、`gras:R[A-Z]\d{5}`、`crs:\d+`、`hkmotw:(hk|mo|tw)-[a-z0-9-]+` | `moe:4111010001`、`gras:RC00002`、`crs:111`、`hkmotw:hk-hku` |
| channel | `a6:<moeCode>`、`hkmotw:<池 id>:<n>`、`portal:<地區 slug>:<n>`、`origin:<來源 id>`、`crs:<id>`、`direct-hire:<id>` | `portal:united-kingdom:1` |
| condition | `<主體 id>:<type>`、`visa:<slug>:<n>`、`dataset:subject_requirements:<年>` | `gras:RI00049:qualification` |
| source | `src:<sha256(url) 前 16 碼>` | |

`crs:<id>` 在 institution 與 channel 兩個資料集各自唯一（同一平台詳情頁：機構既是機構也是入口）。

## 4. 年度維護族（`family`）

`moe_list`、`gras`、`subject_tables`、`catalog`、`strong_base`、`a6_charters`、`crs`、`hkmotw`、`overseas`、`origins`、`direct_hire`。各族的來源、日曆與命令見 `docs/ANNUAL_UPDATE.md`。

## 5. 與既有資料層的對應

研究 `reports/operations/nope-s3-overseas-20261107/research/S3_SCHEMA_PROPOSAL.md` §2 的五表（institution／admission_channel／admission_condition／source／validity）原樣採用並加上 program（引用）；海外層 `*Quotes` 欄即 `valueRaw`（以 `valueRawRef` 指向地區檔），`gaokaoPolicy`／`qualificationsListed`／`ieltsOverall`… 即 `valueNorm`。港澳臺池本來就是「機構／管道／條件／來源／有效期」五層（`src/data/hkmotwTypes.ts`）。建置：`scripts/build_db.mjs`（共用 `scripts/lib/db_layers.mjs`、`scripts/lib/authority_tier.mjs`），閘門 `tests/db.test.ts`。
