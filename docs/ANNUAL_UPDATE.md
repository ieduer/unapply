# nope.bdfz.net 年度更新作業（路線圖 S5，2026-11-07 起）

Owner: suen。目的：每一層資料按官方發布節奏重核、入庫、重建只讀資料庫 `/db/v1`、發布並留紀錄，**每一步都能照本手冊重現**。
細節（各層欄位、建置斷言）在 `docs/MAINTENANCE_MANUAL.md` §3.x；資料庫 schema 在 `docs/DB_SCHEMA.md`；發布流程在 `docs/MAINTENANCE_MANUAL.md` §6 與 `docs/OPERATIONS.md`。
共同前提：Node 24.18.0（`export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH`）；**不使用任何付費或計量資源**（AI API、付費檢索皆不用）；抓取一律 UA 明示身分、尊重 robots.txt、同網域 ≥2 秒、不繞過任何挑戰；被擋或純 JavaScript 的官方頁留給人工瀏覽器覆核。

## 1. 月曆（各層下一次應重核的日期＝`validity.calendar`／`scripts/lib/db_layers.mjs` 的 `NEXT_REVIEW`，當時值）

| 月份 | 層（`family`） | 官方來源 | 下次 | 命令 |
| --- | --- | --- | --- | --- |
| 隨時（2026-12 前先核） | 各省選考要求表（`subject_tables`） | 各省教育廳／考試院「20XX 年擬招生專業選考科目要求」；**2028 年表依慣例應已於 2026 年 2–4 月公布** | 2026-12-31 | `npm run data:s1-fetch`（或 `--from-r2`）→ `data:s1-build` → `audit:s1` |
| 4 月 | 本科專業目錄（`catalog`）、強基簡章（`strong_base`） | 教育部《普通高等學校本科專業目錄》年度增補；各校強基計劃招生簡章 | 2027-04-30 | 改 `data/research/s1_sources.json` 釘定新檔 → `data:s1-build` |
| 4–6 月 | A6 招生章程（`a6_charters`） | 各校本科招生章程（陽光高考轉載；陽光高考對腳本回 412，人工以瀏覽器取章程後填 `admission_channels.<日期>.csv`） | 2027-06-30 | `npm run data:admission` |
| 6 月 | 教育部名單（`moe_list`） | 教育部《全國普通高等學校名單》（每年 6 月） | 2027-06-30 | 改 `scripts/build_official_schools.mjs` 的 `CATALOG` 釘定 → `data:schools` → `data:research`（需 CollegesChat 釘定快照，見 §3） |
| 半年～一年 | 中外合作辦學（`crs`） | 教育部中外合作辦學監管平台名單（頁面自述更新日；2026-05-25） | 2027-06-30 | `npm run data:joint-fetch -- --cache-dir DIR --lists-only` 看名單數 → 補抓詳情 → `data:joint-build` → `data:joint` |
| 10–11 月 | GRAS（`gras`） | 軟科世界一流學科排名年版 | 2027-11-30 | `data:gras` → `data:gras-geo` → `data:gras-websites` → `data:atlas` |
| 10–12 月 | 港澳臺院校池（`hkmotw`） | 各院校內地招生／非本地生年度頁、澳門教青局名單、陸生／海外聯招會 | 2027-11-30 | 改 `hkmotw_*.<日期>.csv` → `data:hkmotw` |
| 11 月（隨 GRAS） | 海外層（`overseas`）、起點官方頁（`origins`） | 各校國際本科招生頁、各國申請平台與簽證主管機關頁；資格制度官方頁 | 2027-11-30 | 研究目錄工具重抓（手冊 §3.7）→ `data:overseas` → `data:origins` |
| 11 月 | 企業直招（`direct_hire`） | 各計劃官方頁 | 2027-11-30 | 手冊 §3.3 第 4 步；`unverified` 候選人工重試 |
| 11 月 | 鏈接年檢 | 全站外部鏈接 | 每年 | `npm run audit:links -- --since data/research/link_check.<上一年>.csv.gz`（手冊 §3.9） |

日曆改了要同時改 `scripts/lib/db_layers.mjs` 的 `NEXT_REVIEW` 與本表（`validity.calendar` 由前者產生）。

## 2. 每一層的步驟與 fail-closed 閘門

每層都是「抓取／人工核對 → 入庫為 `data/research/*.<日期>.*`（新日期另存，舊檔保留）→ 生成器（建置斷言不過就不產出）→ 該層測試」：

| 層 | 生成器的 fail-closed 斷言（摘要） | 測試 |
| --- | --- | --- |
| 教育部名單 | 附件 SHA-256 與計數釘定 | `audit:data`、`audit:values` |
| 選考要求 | 原檔 SHA-256 釘定、省表列數、選科圖樣合法、對不到主表的校名列出 | `test:s1`、`audit:s1` |
| GRAS／地圖 | 57 學科×50、每機構有座標與地區中文名、官網 verified ≥300 | `test:atlas` |
| 直招 | 渲染者 `status≠unverified`、confidence high／medium、URL https、kind 在詞表 | `test:atlas` |
| 港澳臺池 | https＋同網域＋200＋日期；非 verified 不上線 | `test:hkmotw` |
| 合作辦學 | 名單全數有詳情、編號／層次／讀取日齊、對回主表 | `test:joint` |
| 海外層 | 三檔 SHA-256 與 meta 一致、表頭白名單、無電郵、計數＝coverage | `test:overseas` |
| 起點 | 來源狀態合法、只有 verified 上鏈接 | `test:origins` |
| 權威分級 | 規則表欄位、枚舉、無重複 | `test:atlas` |
| 資料庫 `/db/v1` | 來源全 https 且有分級、id 格式、crosswalk 端點存在、每筆 channel／condition 有 validity、latest ≤10 KiB、institutions gzip ≤500 KiB、無電郵 | `test:db` |
| 三語 | 鍵集合相等、佔位符一致、zh-Hans fixtures | `test:i18n` |

資料庫的來源證據在每次重抓後要重整（不連網）：

```bash
node scripts/assemble_db_evidence.mjs --date <日期> --s3 <S3 研究 sources.json> --s4 <S4 研究 sources.json> --xcut <橫切研究 sources.json>
```

它只收 `data:db` 會引用、倉庫內又沒有證據的 URL；輸出 `data/research/db_source_evidence.<日期>.json.gz`（決定性）。資料層新增 http 來源時，先以禮貌 https 探測補 `data/research/db_https_entry.<日期>.json`（`url → httpsUrl、status https-ok／https-redirects-to-http／https-failed`），否則 `data:db` 會把它列進 `excludedInsecure` 而不收為來源。

## 3. R2 原檔與前置資料

- 大型省表原檔：既有私密桶 `bdfz-ops-backups`、前綴 `unapply/s1-sources/v1/`（SHA-256 釘在 `data/research/s1_sources.json` 的 `r2` 欄）；重取用 `npm run data:s1-fetch -- --from-r2`（rclone 遠端 `r2:`）。新年度原檔上傳同前綴的新子路徑，上傳後讀回核對 SHA-256。**不新建桶、不新增綁定。**
- CollegesChat 眾包問卷：`data:research` 需要 `/tmp/university-information`（`git clone --depth=1 https://github.com/CollegesChat/university-information`）；只在要更新眾包層時拉新版，否則 fetch 釘定 commit（`src/data/researchData.ts` → `researchPipelineMeta.inputs.collegesChatSnapshot`）以免眾包層無聲漂移。

## 4. 待人工項（不繞過，年年都要）

- 陽光高考（gaokao.chsi.com.cn）對腳本回 412：章程與學費只能人工在瀏覽器讀。
- 海外被擋／純 JavaScript 機構（S3 當時 42＋2）、國家層被擋頁、直招 `unverified` 8 條、港澳臺待覆核 2 條：人工在真實瀏覽器核對後填回 CSV 並改 `status`。
- 大陸校網對海外出口的不可達：連續兩輪不可達才標「暫不可達」（手冊 §3.9，口徑待站長確認）。

## 5. 發布與紀錄

1. 單一功能提交推送 `master` → 乾淨提交上跑全部閘門＋`build`（建置後工作樹必須乾淨；`data:db` 的輸出要已提交）。
2. 候選上傳 → 逐檔 SHA-256 → 真實路徑驗收（`/db/v1/latest.json` 可讀、回應頭含 CORS 與 Cache-Control、`/api/learning/health` 不受影響）。
3. `release-pages-transaction.mjs`（登記的 managed_manual 交易）→ 正式讀回 → 登記簿 accepted／rollback。
4. Status：依 `/Users/ylsuen/CF/runbooks/status_public_updates.md` 發一筆（年度資料更新用 `improvement`），讀回 API／列表／RSS／`/api/status`。
5. 更新 `docs/OPERATIONS.md`（批次章節）、`PROJECT_STATE.md`、本手冊月曆（若改）與 `docs/GLOBAL_ROADMAP.md` 的當時值。
