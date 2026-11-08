# Project State

Last updated: 2026-11-08 UTC
Current version: 49efd96（已部署 1bf7627b，生效 2026-11-08T15:31:44Z；批 G7 疊加於批 G6c 290e4ef／f5f28048）
Current objective: **路線圖 S0–S5 全部上線（2026-11-07；S5 生效時間為 UTC 2026-11-08T01:21:33Z），原待審事項 2026-11-08 已全部裁定，落地批 G1–G3 已上線（G1 01022627、G2 79c3c1b2、G3 5ac934ec＋path fef18140；G3 後續頁頭重疊與手機版面 b5b74217＋path a2719f97），G4（瀏覽器覆核結果入庫）2026-11-08 已上線（d0f6b69e），G5（精簡說明文字、頁尾三行、色系一鍵切換）2026-11-08 已上線（ec5dc3aa），G6（起點與目的地流程重做、互動糾錯、about 移到頁尾）2026-11-08 已上線（bec50ec9），G6 擴充（題目按目的地分題庫、以效度篩選，`docs/QUESTION_VALIDITY.md`）2026-11-08 已上線（0c801d21），G6c（全球減法互動細節 5 處）2026-11-08 已上線（f5f28048），G7（查詢頁、結果頁按專業彙總、企業直招列入減法；路線圖目標第 2、4、5 條）2026-11-08 已上線（1bf7627b），其餘為年度維護與批 G8（R1／R2 研究資料入庫）。** 全球化路線圖（docs/GLOBAL_ROADMAP.md）S0、S1 全批、S2 兩半、S3、S4 兩批、橫切項（批 F1）與 S5 只讀資料庫（批 F2）皆已上線並登記 accepted；年度維護照 `docs/ANNUAL_UPDATE.md`（各層 `nextReviewDue` 見 `/db/v1` 的 validity.calendar；各省 2028 選考表依慣例應已公布，下一次維護先核）。原待審項（各批 `PENDING_OWNER_REVIEW.md`：S2、S3、E1、E2、F1、F2；彙整 `reports/operations/nope-global-roadmap-20261107/OWNER_REVIEW.md`）站長 2026-11-08 授權主會話裁定，裁定與執行批次見 `reports/operations/nope-global-roadmap-20261107/DECISIONS.md`（A1 維持方案 B、A3 不改五面導航、B1 conflict 照列不排除、D1 學徒制算直招、D3／D4 不建、F2-1 CORS 接受、F2-2 不開）；原 43 維效度缺口仍列後續。

## 2026-11-08 批 G7：查詢頁、結果頁按專業彙總、企業直招列入減法（已上線，當前權威）

正式部署 `1bf7627b-72b4-44d1-a05d-56c2a2c6b1bb`，來源 `49efd96`，生效 `2026-11-08T15:31:44Z`；回滾 `f5f28048`／`290e4ef`。Status `20261108-nope-search-majors-paths-g7` r1（new）。

- `#/search`：按校名（簡繁英、簡稱、舊名）或專業查學校與選考要求、海外 GRAS 前 50。
- 結果頁按專業類／GRAS 學科彙總（只是彙總）。
- 非大學路徑：依目的地列已核企業直招，直招題照效度規則（大陸 2/3、海外 24/25 出題）。

手冊 §5.3b；證據 `reports/operations/nope-global-roadmap-20261107/nope-g7/`。

## 2026-11-08 批 G6c：全球減法互動細節 5 處修正（歷史；批 G7 疊加於其上）

正式部署 `f5f28048-7340-4206-836d-7def826265c0`，來源 `290e4ef`，生效 `2026-11-08T14:11:57Z`；回滾 `0c801d21`／`e82e643`。Status `20261108-nope-ux-fixes-g6c` r1。本地考生不再看到非本地生招生鏈接；頁頭不顯示版本雜湊；本地入學一句話；只剩一個目的地時有提示；資格說明只在選了海外時出現（`nope-g6/ux-audit.md` #40–#44）。

## 2026-11-08 批 G6 擴充：題目按目的地分題庫、以效度篩選（歷史；批 G6c 疊加於其上）

正式部署 `0c801d21-d5f0-4773-9f99-584c7bbb7b13`，來源 `e82e643`，生效 `2026-11-08T13:26:15Z`；回滾 `bec50ec9`／`9dab1bd`。Status `20261108-nope-region-banks-g6b` r1。
- 站長「徹底優化題目，不同地區可以不一樣，以效度為準」：港澳臺與海外分四個題庫，每題先過六條效度標準才出現（`docs/QUESTION_VALIDITY.md`，閘門 `audit:regions`、`test:regions`）。當時題數：海外 3、香港 2（大陸起點）／1（其他起點）、澳門 0、臺灣 0；大陸 45（非大陸起點 43，S1、A6 略過）。
- `#/global` 一題一頁，有進度、跳過、實時剩餘數；結果按目的地分組。資格選項只列資料裡出現的。#31 焦點問題已結清（ux-audit #39）。
- 證據：`reports/operations/nope-global-roadmap-20261107/nope-g6/validity-audit.md`、`nope-g6/region-banks/`。

## 2026-11-08 批 G6：起點與目的地流程重做、全面互動糾錯、about 移到頁尾（歷史；批 G6 擴充疊加於其上）

正式部署 `bec50ec9-a137-46cc-9c12-8ff1338395a1`，來源 `9dab1bd`，生效 `2026-11-08T12:14:14Z`；回滾 `ec5dc3aa`／`7ba4882`。Status `20261108-nope-flow-ux-g6` r1。
- 站長回報的錯已修：起點中國大陸、只選港澳臺或海外時直接進全球減法，不再出現「哪些地區你一定不去？」。起點之後只問資格（非大陸起點）與「你考慮去哪裡讀？」；流程由 `planFlow` 決定；非大陸起點做大陸題略過選考科目組合。
- 全球減法依目的地組池、問了劃得動才出題、只列適用你的本科管道；陸生聯招會（2026 只招碩博）另列不算進剩下；香港起點結果頁標教育局文憑試收生計劃 2026/27 參與院校 165 所。
- about 移到所有頁面的頁尾；官方鏈接用機構名、介面無內部核查備註；捲動還原、作答於本分頁保留。懶載頁焦點（`nope-g6/ux-audit.md` #31）已於批 G6 擴充結清（#39）。

## 2026-11-08 批 G5：首頁與各頁精簡說明文字、頁尾合併三行、色系改為一鍵切換（歷史；批 G6 疊加於其上）

正式部署 `ec5dc3aa-b97b-4d96-b1ff-5f1916bb4b40`，來源 `7ba4882`，生效 `2026-11-08T09:33:30Z`；回滾 `d0f6b69e`／`3c22aae`。Status `20261108-nope-text-footer-theme-g5` r1。`/db/v1` `11bdc13613b3`。
- 首頁只留標題、校數、起點（只寫地名）、兩個可跳過的分支問題、按鈕、指標名稱與數字、一句話貢獻卡；其他頁開頭最多一句，方法與免責集中到關於頁；介面不再出現建設中、路線圖、批次字樣；資料、鏈接、題目與功能都沒刪。
- 頁尾三行（姊妹站／來源與開源／授權與免責），來源分級只在關於頁。
- 色系改為一鍵在紙色與墨色間切換（`ThemeToggle`），記住選擇；色系清晰硬規則寫入 `docs/MAINTENANCE_MANUAL.md` §5.1。字串鍵每語刪 48、增 11（1418→1381）。

## 2026-11-08 批 G4：真實瀏覽器覆核結果入庫＋問卷頁說明移到頁頭下方（歷史；批 G5 疊加於其上）

正式部署 `d0f6b69e-4363-4822-8a86-97dd9e535db3`，來源 `3c22aae`，生效 `2026-11-08T07:54:28Z`；回滾 `b5b74217`／`647525f`。Status `20261108-nope-browser-review-g4` r1。`/db/v1` `e37642910355`。
- 覆核 165 項、讀到 86 項入庫：海外機構 verified 340→379、平台 63→77、簽證 47→61、港澳臺池 28 所（都會大學上線、港城大改「內地高考單獨招生」）、起點官方頁 +12、企業直招 +5（29 條）；`moe.gov.et` 標 `unsafe` 全站不出網址；文憑試收生辦法摘要改為 2026 原文「3、3、2、A」。仍讀不到：機構 24、平台 13、簽證 29。
- 問卷頁頁頭在最上，生活回報說明在其下、手機收成一行。

## 2026-11-08 批 G3 後續：頁頭重疊與手機版面（兩站同批；歷史；批 G4 疊加於其上）

正式部署 `b5b74217-4cd5-49a8-90bc-2a0f8f95d6bc`，來源 `647525f`（feat `3d5f0be`＋fix `647525f`），生效 `2026-11-08T07:14:26Z`；回滾 `5ac934ec`／`9f8f500`。Status `20261108-nope-header-mobile-g3b` r1（fix）。同批 path.bdfz.net `a2719f97`／`c907611`（生效 05:35:14Z，回滾 `fef18140`／`3affc0d`，Status `20261108-path-shared-ui-placement-g3b`）。
- 站長回報右上角色系與頁頭重疊、手機需整體優化：全站統一 `SiteHeader`，色系改頁頭內彈層（shared-ui `placement="inline"`；path 不傳、畫面不變）；手機站名縮為 nope、語言切換不折行；獨立控制項 ≥40px；`#/world` 手機改卡片；頁尾留白避開導航圓標。11 路由 × 三語 × 兩色系 × 360–1440 六寬 396 樣本全過（手冊 §5.1a；作廢候選 `1631d3ca` 因桌面表格按鈕 36px）。

## 2026-11-08 批 G3：shared-ui 色系面板與同步提示多語標籤（兩站同批；歷史；批 G3 後續疊加於其上）

正式部署 `5ac934ec-f693-4788-abdd-c5fd32dd2932`，來源 `9f8f500`，生效 `2026-11-08T04:33:27Z`；回滾 `79c3c1b2`／`f7f3484`。Status `20261108-nope-shared-ui-labels-g3` r1。同批 path.bdfz.net `fef18140`／`3affc0d`（生效 04:33:45Z，回滾 `8771ae93`／`fb4b95b`，Status `20261108-path-shared-ui-labels-g3`）。
- `ThemeCustomizer`／`SyncNotice` 可選 `labels` prop（預設＝原字串）；nope 傳三語值，path 不傳（候選與上一版文字及面板 HTML 雜湊逐一相同）。裁定 A2。英文與簡體介面不再夾雜色系與同步提示原文。

## 2026-11-08 批 G2：全球池減法 `#/global`（路線圖 S4 完成定義；歷史；批 G3 疊加於其上）

正式部署 `79c3c1b2-6ec2-4320-95e3-6f74a51f04a4`，來源 `f7f3484`（feat `519be12`＋fix `2ba3b70`、`f7f3484`），生效 `2026-11-08T03:56:02Z`；回滾 `01022627`／`18bf5f2`。Status `20261108-nope-global-subtraction-g2` r1。
- 展示層（手冊 §5.5）：池＝海外層 403＋港澳臺院校池 27（依起點與範圍預設）；4 題可跳過——地區、GRAS 門類（所有前 50 學科都在被劃門類才劃）、只想讀學科、港澳臺管道對象（已記錄管道全劃且含你這類考生的管道才劃）；申請平台只作說明；未知永不劃、資格只標示；每所劃掉的機構有逐條原因；分享只含選項鍵；狀態 `unapply.globalSubtraction.v1`（綁起點），不進 AnswerMap／學習證據／Function。
- 入口：港澳臺／海外起點主按鈕「開始全球減法」、結果頁跨國並列段、About。十九道閘門於 `f7f3484`（新增 `test:global` 11）；候選 `cb242317` 與正式 140/140；兩條起點流程與引擎離線計算一致；三語 × 兩色系 × 1440／390 對比 0 低於 4.5。
- 發布時另一工作階段的登記簿寫入覆蓋了本批 consumed 旗標，已在同一把鎖下依交易結果還原並註記（`docs/OPERATIONS.md` 批 G2 節）。

## 2026-11-08 批 G1：站長 11-08 裁定落地——英文站名、頁尾分區、權威分級、海外層 medium 7 所人工確認（歷史；批 G2 疊加於其上）

正式部署 `01022627-65fe-4987-ac32-15b78c6d913c`，來源 `18bf5f2`，生效 `2026-11-08T03:00:32Z`；回滾 `46a33556`／`987c934`。Status `20261108-nope-rulings-g1` r1。裁定 `reports/operations/nope-global-roadmap-20261107/DECISIONS.md`。
- B2 英文站名「nope · Universities You Won’t Apply To」、分享卡「Universities I won’t apply to」；B3 頁尾「官方與權威來源」（P0／P1）＋「第三方參考」（P2）；B4 chinadegrees.cn、findyou2026.com 升 P0（＋mitadmissions.org P0，107 條）；B5 年檢口徑已裁定。
- C2 海外層：MIT、Lancaster 人工確認升 high（新欄 reviewedBy／reviewedAt／reviewNote；official-external 須 reviewedAt 才 high）；ISCT、POSTECH S0 官網更新（`gras_institution_websites.2026-11-08.csv`）後 high；UTAS、HEC Paris、Gothenburg 改 not_found → verified 340、not_found 19、high 340、medium 0、鏈接 340；`/db/v1` `8295ccba5e1e`。
- 十八道閘門於 `18bf5f2`；候選 `5ec20b57` 與正式 138/138；三語 × 兩色系 × 1440／390 對比 0 低於 4.5。證據 `reports/operations/nope-global-roadmap-20261107/nope-g1/`。

## 2026-11-07／08 批 F2：路線圖 S5——只讀全球高校資料庫 `/db/v1`（歷史；批 G1 疊加於其上）

正式部署 `46a33556-daee-42ea-9f10-0c75cc5843e8`，來源 `987c934`，生效 `2026-11-08T01:21:33Z`；回滾 `8385ac10`／`2d3323c`。Status `20261107-nope-s5-db-f2` r1。
- `https://nope.bdfz.net/db/v1/latest.json` → 版本 `7926db10b4c6`：機構 3,935、對照 561、管道 2,051、條件 1,223、來源 3,516（全 https、帶分級）、有效期 3,274、引用既有 payload 84 檔；`/db/*` CORS GET、版本目錄 immutable、latest 300 秒；未新增 Cloudflare 資源。
- 文件：`docs/DB_SCHEMA.md`、`docs/DB_API.md`（對 path／gk 的只讀契約與「不得暗示錄取可能」規範）、`docs/ANNUAL_UPDATE.md`；手冊 §3.10；閘門 `test:db`；About「資料庫開放只讀」。
- 十八道閘門於 `987c934`；候選 `a8799d46` 與正式 138/138；三語 × 兩色系 × 1440／390 About 對比 0 低於 4.5。待審事項（2026-11-08 已裁定，見 DECISIONS.md）：`reports/operations/nope-s5-db-xcut-20261107/nope-f2/PENDING_OWNER_REVIEW.md`。

## 2026-11-07 批 F1：路線圖橫切項——企業直招擴充、壞鏈修正、權威分級標籤、鏈接年檢工具（歷史；批 F2 疊加於其上）

正式部署 `8385ac10-f587-44c8-ac43-f0dece8fc60f`，來源 `2d3323c`，生效 `2026-11-07T14:08:23Z`；回滾 `9753bdc3`／`55eb014`。Status `20261107-nope-xcut-directhire-links-f1` r1。
- 直招層 24 條上線（既有 10 重核＋14 核過候選；含在職學位者標示，沿用既有口徑）、8 條 `unverified` 只留檔；壞鏈 6 處＋school_websites 轉址 5 處已修，GRAS 兩所轉址因是 S3 錨點暫緩。
- 權威分級規則表 106 條 → 鏈接旁「官方／權威平台／第三方」標籤＋About 說明；鏈接年檢基線（6,139 URL）入庫，`npm run audit:links` 為年度工具（不進閘門）。
- 十七道閘門於 `2d3323c`；候選 `c8336b80` 與正式 130/130；三語 × 兩色系 × 1440／390 對比 0 低於 4.5。待審事項（2026-11-08 已裁定，見 DECISIONS.md）：`reports/operations/nope-s5-db-xcut-20261107/nope-f1/PENDING_OWNER_REVIEW.md`。

## 2026-11-07 批 E2：起點分支（資格／範圍）＋官方進大陸管道＋海外層資格標示＋結果頁跨國並列（歷史；批 F1 疊加於其上）

正式部署 `9753bdc3-ebe9-4488-80a4-32db2fbcb728`，來源 `55eb014`，生效 `2026-11-07T12:56:17Z`；回滾 `460b9fcb`／`84c0fcd`。Status `20261107-nope-s4-origins-e2` r1。
- 方案 B 展示層（手冊 §5.4）：港澳臺／海外起點先答資格（18 種）與範圖（只本地／只海外／都考慮，可跳過），只存 `unapply.originPrefs.v1`，不進 AnswerMap／學習證據／Function；A+ 證據仍只有 45 題。
- 港澳臺起點附 7 條官方進大陸管道（只鏈 verified 來源，blocked／needs_review 顯示「官方頁本站未讀到」）；海外層按資格保留式標示「校方頁面寫明接受」與分國計數（`qualifications.json` `efbab412ac6e`：403 所、32 token、gaokaoAccepted 4）；結果頁按範圍並列港澳臺院校池與海外層（local 收成一行）；A6 港澳臺提示。
- i18n 新增 96 鍵（1,296 鍵，`9891b7f7178f`）；十七道閘門於 `55eb014`（新增 `test:origins` 7）；候選 `42982ad7` 與正式 129/129；三語 × 兩色系 × 1440／390 逐路由對比 0 低於 4.5。待審事項（2026-11-08 已裁定，見 DECISIONS.md）：`reports/operations/nope-s4-i18n-origins-20261107/nope-e2/PENDING_OWNER_REVIEW.md`。

## 2026-11-07 批 E1：三語介面 zh-Hant／zh-Hans／en（歷史；批 E2 疊加於其上）

正式部署 `460b9fcb-e6b8-4576-aa8f-e3b3d5381f53`，來源 `84c0fcd`，生效 `2026-11-07T11:52:24Z`；回滾 `41a45cad`／`7443bb5`。Status `20261107-nope-s4-i18n-e1` r1。
- 翻譯層 1,200 鍵（手冊 §5.3）：zh-Hant 來源打包進主包；zh-Hans 由 `data:i18n` 以 vendored OpenCC t2s 字級字典＋站內例外表生成（只轉字形不換用詞，140 條 fixtures 閘門）；en 站方翻譯；兩者自 `public/i18n/` 懶載（manifest `457977554cc4`）。頭部切換存 `unapply.locale.v1`，首次依瀏覽器語言，同步 `<html lang>`／title／description；hash 路由不帶語言。
- 引擎保持語言中立（機器欄＋展示層翻譯）；gk 交接、用戶中心紀錄、GitHub issue 文字固定 zh-Hant；資料驅動名稱不翻譯、官方名稱原文保留；題集／契約／Function／shared-ui／UC 不變；無付費、無新 Cloudflare 資源。
- 十六道閘門於 `84c0fcd`（新增 `test:i18n` 10）；候選 `959207b8` 與正式 128/128；三語 × 兩色系 × 1440／390 逐路由對比 0 低於 4.5。待審事項（2026-11-08 已裁定，見 DECISIONS.md）：`reports/operations/nope-s4-i18n-origins-20261107/nope-e1/PENDING_OWNER_REVIEW.md`。

## 2026-11-07 批 S3：海外可申請學校層 #/overseas（歷史；批 E1 疊加於其上）

正式部署 `41a45cad-b152-4a16-9f38-3db892008648`，來源 `7443bb5`，生效 `2026-11-07T10:24:43Z`；回滾 `26154a49`／`893667b`。Status `20261107-nope-s3-overseas-admissions` r1。
- 研究會話三張 CSV 入庫（403 所非大陸 GRAS 前 50 機構、91 條申請平台、90 條簽證頁；零付費、電郵已去識別）→ `build_overseas_layer.mjs` fail-closed → index（gzip 17 KiB）＋44 個地區檔懶載，manifest `23c590c30412`：官方頁已讀到 343（high 336／medium 7）、被擋 42、未找到 16、純 JS 2；招生頁上鏈接 336、平台 63/91、簽證 47/90；高考採認原句 35。
- 只抄官方頁原文、不解讀、不代表錄取可能；鏈接規則 verified＋high／平台需機構頁佐證／簽證 verified；不改題集／契約／UC；不進引擎。入口：首頁「其他國家或地區」主按鈕、世界地圖機構面板、結果頁頁尾、About。
- 十五道閘門於 `7443bb5`（新增 `test:overseas` 9）；候選 `f8fc27da` 與正式 126/126；真實路徑與候選一致。待審事項（2026-11-08 已裁定，見 DECISIONS.md）：`reports/operations/nope-s3-overseas-20261107/nope-s3/PENDING_OWNER_REVIEW.md`。

## 2026-11-07 批 D2：中外合作辦學機構／項目資料層（歷史；批 S3 疊加於其上）

正式部署 `26154a49-5bf2-4943-9105-c2526cf49e06`，來源 `893667b`，生效 `2026-11-07T09:12:01Z`；回滾 `df4540a2`／`26bad8c`。Status `20261107-nope-s2-jointprograms-d2` r1。
- 唯一主來源 crs.jsj.edu.cn 名單 1,834 條詳情全部讀到：機構 411、項目 1,423（內地與港澳臺合作 35），仍在名單 1,781；對回主表 1,826 條掛到 667 校，對不到 8 條（非普通高校）只列不掛校。manifest `a249d541a01a`。平台無學費欄，不產生 A4。
- 不改題集／契約／UC；不進引擎。入口：學校詳情「中外合作辦學」區塊、結果卡片計數行、About 來源。
- 閘門於 `893667b`（新增 `test:joint` 5）；候選 `9f53e53c` 與正式 79/79；真實路徑與候選一致。

## 2026-11-07 批 D3：港澳臺院校池 #/hkmotw（歷史；批 D2 疊加於其上）

正式部署 `df4540a2-5657-4676-bd83-9026fa232579`，來源 `26bad8c`，生效 `2026-11-07T07:17:28Z`；回滾 `c26a1b75`／`df6c782`。Status `20261107-nope-s2-hkmotw-pool-d3` r1。
- 27 所上線（香港 15／澳門 10／臺灣 2 個聯招會）、21 條官方核查通過的招生管道（內地高考生／港澳學生）、10 所對到 GRAS 地圖；香港都會大學、香港城市大學內地招生網、澳門理工大學入學頁核不過，待人工覆核不上線。payload `c9f04be5db8a`。
- 不改題集／契約／UC；起點分支題屬 S4 未做。入口：首頁港澳臺起點主按鈕、結果頁頁尾跨區鏈接、世界地圖機構面板。
- 十三道閘門於 `26bad8c`（新增 `test:hkmotw` 7）；候選 `d480c991` 與正式 77/77；真實路徑與候選一致。

## 2026-11-07 批 D1＋D4：七省 2027 選考要求表＋13 所機構官網（歷史；批 D3 疊加於其上）

正式部署 `c26a1b75-ae96-47f9-8dd8-7c2d931cf423`，來源 `df6c782`，生效 `2026-11-07T06:32:57Z`；回滾 `b3e0f4c8`／`5b18cd1`。Status `20261107-nope-s2-coverage-d1` r1。
站長 2026-11-07「距離最終goal還有哪些你自行推進」：葉子資料／介面更新走登記的發布交易；本批無契約變更、無 UC 寫入、無付費、無新 CF 資源。

- 資料：新增山東（PDF 本科／專科，R2 既有前綴）、河南（xlsx）、內蒙古（xlsx，只有校名）三省 2027 通用版表；102,241 條、2,608 校；本科校覆蓋 1,271/1,412（缺 141）、專科校 1,260/1,540（缺 280）；跨省不一致 2 條以 `conflict` 入庫（引擎視為可報、不作排除依據）。payload `3d0cc7ed3c79`。
- D4：13 所 S0 未驗官網人工覆核後 544/544；地圖 payload `fb75382a01b0`。
- 其餘省份：本機出口海外 IP 被多數省考試院重置；湖南附件主機不通；廣東／四川／福建／新疆只以查詢系統公布（不抓）。仍缺清單在 `reports/operations/nope-s2-coverage-jointprograms-20261107/nope-d1/s1-audit-all.md`。
- 閘門：十二道於 `df6c782`；候選 `589b2a81` 與正式 74/74；真實路徑 物生政 26／＋計算機類 169 劃掉、剩 2,783。

## 2026-11-07 批 C：S1.b 正式兩題——選考科目組合 S1、意向專業類 S2（歷史；批 D1 疊加於其上）

正式部署 `b3e0f4c8-4fe5-4e83-863f-476cd41ce836`，來源 `5b18cd1`（`1bc3995` feat＋`8f7f492` docs＋`5b18cd1` fix），生效 `2026-11-07T04:57:35Z`；回滾 `8cb266cb`／`ccf1770`。Status `20261107-nope-s1b-questions-c` r1。
站長「做新題」為功能授權；正式發布由站長 2026-11-07 在側會話直接裁定「放行，正式發布 C」。閘門、候選與正式讀回記錄在 `reports/operations/nope-s1-programs-admission-20261106/nope-c/`。

- 共享契約：`DimensionId` 追加 `S1`／`S2`（只追加），45 題；學校取值算在逐校招生專業摘要上（`FilterContext.programs`）；沒有本科資料者取值 null 永不被劃掉；試驗班通配值 `*`；兩題選項 `alwaysVisible`。
- Function：釘定摘要重算；新頁面帶 `programsVersion`；舊 43 題頁面仍可完成（換版不斷會話）。
- UC：契約不變（manifest／自由格式互動鍵／聚合校驗），可執行證據 `nope-c/uc-contract-evidence.json`（accepted `0559b0cf` 唯讀工作樹、記憶體庫）＋`uc-accepted-tests.txt`（1,149 測試 0 敗）；共享樞紐收據 `reports/operations/shared_hub_changes/20261107-user-center-nope-s1b-questions.json`（schema 2，status verified）。
- 移除：首頁起點條件區塊、`unapply.programPrefs.v1`、結果頁分層計數；詳情判定改由 S1／S2 作答推出。版號 v2.0。排除理由對兩題改寫成可讀句（S1 選考要求分佈、S2 開設專業類）。
- 閘門：`test:s1` 10、`test:trusted` 18（含 programsVersion 與舊頁面相容）、`audit:values` 45 維 0 阻斷、`audit:questions` 45 題；十二道於釋出提交 `5b18cd1` 上執行（`nope-c/check.txt`）；候選 `bc3c5927` 與正式 `b3e0f4c8` 真實路徑一致（物生政 33／＋計算機類 180）。

## 2026-11-07 批 B：擴到全部 2,952 校＋兩層 payload＋原檔上 R2（已上線，當前權威）

正式部署 `8cb266cb-2eb2-409d-915b-a90a28447448`，來源 `ccf1770`，生效 `2026-11-07T03:49:37Z`；回滾 `021e1a3d`／`6b70522`。Status `20261107-nope-s1-all-schools-b` r1。
站長裁定「擴到全部」「22 MB放R2」。

- 資料：`program_offerings.2027.all.csv.gz` 88,750 條（本科 53,220／專科 35,530；2,289 校；0 衝突）；本科校覆蓋 1,234/1,412（缺 178：職業大學 80、其他 63、獨立學院 20、警察類 15，人工清單在 `s1-audit-all.md`）；專科校 989/1,540。缺的保持未知。
- 原檔：三個 external 原檔已在 R2 `bdfz-ops-backups/unapply/s1-sources/v1/`（SHA-256 讀回一致，本機副本已刪）；`s1_sources.json` 的 `r2` 欄；`fetch_s1_sources.mjs --from-r2`。
- payload：`index.json`（每校摘要，151 KiB gzip）＋ 31 個省桶（詳情頁才載）；引擎算在摘要上；只公布專科的學校不判定。`test:s1` 9 項。
- 驗證：十二道閘門、候選與正式 74/74、真實路徑；報告 `reports/operations/nope-s1-programs-admission-20261106/nope-b/`。

## 2026-11-07 修正批 A（已上線；批 B 疊加於其上）

正式部署 `021e1a3d-164b-408b-a2af-fcec41712d31`，來源 `6b70522`，生效 `2026-11-07T03:30:29Z`；回滾 `7aa5e5b5`／`2e79f9b`。Status `20261107-nope-s1-fixes-a` r1。
站長裁定（2026-11-07）：「做新題，擴到全部，22 MB放R2，該修正的都修正」——本批是「該修正的都修正」；後續批次：B 擴到全部 2,952 校＋原檔上 R2、C 新題（S1.b，UC 生產寫入前停下回報）。

- `build_official_schools.mjs`：層次名單舊名對照，上海體育大學恢復雙一流非 211（31 → 32；144/144）；其餘記錄不變。
- `build_world_atlas.mjs`：`generatedAt` 取輸入最晚日期，payload 版本回到 `8a4beeaa84b5`，跨日重建不再變。
- `engine/programs.ts`：選科單獨生效的判定文案補空格。
- 十二道閘門、候選與正式 43/43、真實路徑皆過；報告 `reports/operations/nope-s1-programs-admission-20261106/nope-a/`。

## 2026-11-07 S1 首批：起點條件（選考科目／意向專業）與雙一流招生專業（已上線；修正批 A 疊加於其上）

正式部署 `7aa5e5b5-345e-403b-8cd6-d3d0076178d1`，來源 `2e79f9b6c9d356f4283cfcda1e6962a6e3a55187`，生效 `2026-11-07T03:01:44Z`；
回滾 `0ec6d42f-3b93-4859-bd22-813e7f000c3e`／`d4ae514`（走受審回滾交易，會撤掉起點條件與專業層，保留世界地圖）。Status `20261107-nope-s1-programs-admission` r1。
站長授權（2026-11-07 主會話）：「入庫實作，依據最終goal繼續推進。」

- 資料層（`66c82c3`）：`docs/DESIGN_S1_PROGRAMS_ADMISSION.md`；`data/research/s1_sources.json` 16 個官方來源釘定（13 個原檔入庫 `raw/s1/`，3 個大檔只釘 SHA-256）；
  `bk_catalog.2026.csv` 883 專業；`program_offerings.2027.csv` 雙一流 144 校（第二輪 147 減 3 所軍校；上海體育學院→上海體育大學）9,534 條，湖北／江蘇／上海／浙江 2027 表聯集 0 衝突；
  `strong_base_schools.2026.csv` 39 校；`npm run data:s1-fetch`／`data:s1-build`／`audit:s1`；稽核 `reports/operations/nope-s1-programs-admission-20261106/s1-audit.md`。
- 產品（`2e79f9b`）：首頁「起點條件 · 選填」（3 門選考科目／意向專業類或具體專業，`unapply.programPrefs.v1`，不進 AnswerMap）；`src/engine/programs.ts` 在 43 題之後另算一層並分開計數；
  結果頁起點條件區塊、查校理由、卡片專業數；學校詳情「招生專業 · 選考科目要求（2027 年）」；About 補來源。`public/data/programs/{catalog,offerings}.json` 懶載入，`src/data/programsManifest.ts` 版本 `948a2190ff3b`；新閘門 `test:s1`。
- 不變：43 題、引擎、Function、AnswerMap、A+ 證據契約（仍取 43 題結果）、`src/shared-ui`、依賴、binding。
- 驗證：十二道閘門全過（`nope/check.txt`）；候選 `6b1dbce5` 與正式、不可變網址 43/43 檔一致；本機雙色系桌面 1440／手機 390 逐路由對比度最低 6.27:1、無新增低對比、無橫向溢出；
  正式站真實路徑：物生政 → 起點條件劃掉 7 所（與稽核模擬一致）、中國科學技術大學詳情 56 專業／強基／6 個官方來源。
- 已知限制：陽光高考對腳本回 412 挑戰（章程層、分省計劃、專項名單只能人工）；bjeea.cn 本機不通；選科單獨生效時詳情文案缺一空格（下版修）；
  `officialSchools.ts` 把上海體育大學標成普通本科（A3，需另批）；已登入 A+ 路徑本次未改未測。
- 下一步（當時待站長定序；2026-11-08 起依 DECISIONS.md）：擴到全部 2,952 校（`data:s1-build --scope all`）→ 專項計劃名單（人工）→ 中外合作專業收費→A4 → 章程層錄取條件；選科／專業要不要成為新題（改契約）另議。
- 報告：`/Users/ylsuen/CF/reports/operations/nope-s1-programs-admission-20261106/RELEASE.md`、`REPORT.md`。

## 2026-11-06 全球化立項與 S0 世界學科地圖（歷史；S0 內容仍在線）

正式部署 `0ec6d42f-3b93-4859-bd22-813e7f000c3e`，來源 `d4ae5141bd04a0024a4054f2e4bf16c20cace891`，生效 `2026-11-06T22:50:51Z`；
回滾 `d7a7924d-dfa2-49b8-ae19-52054b56266c`／`6fa8a4e`（走受審回滾交易，會撤掉起點問題、世界地圖與官網鏈接）。Status `20261106-nope-global-atlas-s0` r1。

- 目標：站點補充完善為全球學生可用；先問所在地，再用減法走到專業與學校；可跨國選；建全球高校權威資料庫並可查招生；
  企業直招高中生也列入；分 S0–S5 推進，詳見 `docs/GLOBAL_ROADMAP.md`。
- S0 內容：首頁第 0 題起點（中國大陸走既有題庫，其他起點先進全球學科地圖並明示題庫建設中）；`#/world`：軟科 GRAS 2026
  57 學科、544 所機構（前 50）、預設前 10 → 195 所／570 席位；門類／學科／地區減法；大陸機構連本站詳情；企業直招高中生 10 條。
- 不變：43 題、引擎、Function、AnswerMap、A+ 證據契約、`src/shared-ui`、依賴。
- 驗證：十道既有閘門＋`test:atlas`（10）全過；build 主包 357.7 kB、地圖分塊 21.8 kB、payload 237 KiB；
  本機瀏覽器桌面／手機、紙色／墨色逐路由對比度最低 6.27:1、無新增低對比、無橫向溢出。
- 權威鏈接（站長同日追加）：機構官網三來源交叉＋逐條連通核查，531/544 所（high 431、medium 100），13 所未收待人工覆核；學科席位連軟科學科頁。
- 發布：站長回覆「推送並發布」後走登記的 Pages 交易；候選 `dc57a019` 與正式 41/41 檔一致；正式站真實路徑與 health 讀回通過。
- 已知限制：排名只描述研究分佈；海外機構尚無專業／錄取／學費（S3）；港澳臺與海外起點尚無題庫（S2／S3）；
  企業直招條目只保證核對日為真；Wikidata 無正體標籤的 56 所海外機構只顯示英文名。
- 報告：`/Users/ylsuen/CF/reports/operations/nope-global-atlas-20261106/REPORT.md`。


## 2026-10-23 已完成者再作答無限重送修復（已上線，當前權威）

正式部署 `d7a7924d-dfa2-49b8-ae19-52054b56266c`，來源 `6fa8a4e00e36a23090544995133d51e693ee1955`，生效 `2026-10-23T15:00:29Z`；回滾 `84a4afd1`／`f2aa606`，走新的受審回滾交易（會恢復無限重送）。

- 原因：UC 對本學年已完成者回傳已完成的會話、互動序號不前進，客戶端無限重送（約每 260 ms 一次），提示停在「同步核验中」。影響 35 人。
- 修法：伺服器回報已完成即視為終結，清掉排隊、不重送，結果頁顯示「已核验」；序號不前進的 ok 只提示一次。未登入、其他拒絕、網路重試的處理不變。
- 正式站以測試帳號（本學年已完成）實測：作答到結果頁只有一次 start、0 次 interaction／complete。
- 遺留：「會話中途在別處完成」只由測試覆蓋；沒有新寫入完成證據。

發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/aplus-repeat-loop-20261023/RELEASE.md`。Status：`20261023-nope-repeat-completion-loop-fix` r1。

## 2026-10-23 學習記錄同步提示修復（歷史）

正式部署 `84a4afd1-0602-4c1c-af4c-d5173c94da94`，來源 `f2aa6068fa63ff50df029e3b7b85dee0338f7a61`，生效 `2026-10-23T14:13:18Z`；回滾 `321e6e06`／`0b02a20`，走新的受審回滾交易。

- 原因：未登入作答排隊後 `/api/learning/start` 永遠 401；UC 會話失效被轉成 503；全跳過等 400 拒絕被無限重送，排著完成紀錄時還擋住重新開始。首頁因此一直顯示紅色「核验未完成…联网后将自动重试」。
- 修法：401＝未登入，清隊列、不提示；其他 4xx 清隊列並提示一次「未被接受，不会自动重试」；網路／5xx 保留並重新取會話；全跳過不送完成；Function 把 UC 未登入轉成 401。
- 完成紀錄帶考生地區，Function 用同一地區重算 A6——原「證據服務未帶 candidateProvince」缺口就此關閉（UC 收到的摘要欄位不變）。
- path.bdfz.net 的同一問題已於同日 `26f3eea` 修復；兩站共有的「已完成者再作答無限重送」於同日修復，見上一節。

發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/nope-sync-notice-20261023/RELEASE.md`。Status：`20261023-nope-sync-notice-fix` r1。

## 2026-10-03 可讀色系與共用模板（歷史，已由 2026-10-23 修復取代；模板規則仍適用）

正式部署 `321e6e06-3841-4e8c-b218-ab37924dffb4`，來源 `0b02a2009ac906d13802c03f0a1e046b8c5ed467`，生效 `2026-10-03T15:09:45Z`。上一版 `94090cd4`／`c6c0410`（13:20Z，可讀色系首發）。

- `src/shared-ui/`、`tests/theme-contrast.test.ts`、`scripts/check_shared_ui.mjs` 與 path 倉庫（`ieduer/minus-life`）逐位元組相同；改共用檔必須兩站一起發布（`npm run check:shared-ui`）。
- 色系由五套加自選強調色減為「紙色」「墨色」；`npm run test:theme` 把文字對比度（≥ 4.5:1）、最小字級與「不用透明度表示次要內容」固定成閘門。舊紙色的輔助文字只有 3.6:1、強調色小字與主按鈕文字 2.6:1；深色色系下畫布遮罩仍是淺色。
- 頁尾姊妹站連結改為「path · 你一定不做哪個工作」。學校數據、篩選規則、Function、binding 均未變。

回滾：`94090cd4-d483-4782-abfc-0146f7bc96d8`／`c6c0410`；回到 `7a066074`／`74f225e` 會同時退回舊色系。走新的受審回滾交易。

發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/shared-readable-theme-20261003/RELEASE.md`。Status：`20261003-nope-readable-theme` r1、`20261003-nope-sync-notice` r1。

## 2026-10-03 教育部 2026 名單與眾包快照更新（歷史，數據仍為現行）

正式部署 `7a066074-c3ac-4efc-979c-f65f583f40df`，來源 `74f225ed4df1488e56d0ab65944bac59787e49b7`，生效 `2026-10-03T12:40:33Z`，Direct Upload/master/commit_dirty=false；runtime `e4a56a351c2e`。通道 `nope-bdfz-net` 經位元組對帳由 `managed` 轉為 `accepted`，發布走 release authority 登記的一次性 Pages 交易。

- 學校主池：教育部 2026 名單（截至 2026-06-17）2,952 所，本科 1,412、高職專科 1,540。相對 2025：新增 40 個標識碼、撤銷 7 個、更名 55 所、37 所專科升格本科。
- 官方附件原檔 `data/research/moe_ordinary_schools.2026-06-17.xls` 入庫並釘 SHA-256；`data/research/moe_former_names.2026-06-17.csv` 提供同碼舊校名別名。
- 眾包問卷快照 `9f6328d670b46c61b08a3b57e5dc6787510a5f70`（上游改為 `data/v1.csv` + `data/v1.additions.csv`，校區寫成「校名（校區）」）：覆蓋 2,406 所、45,135 筆，仍只供參考、不具排除權。
- 篩選規則未變；有效題仍 15 題、24 項生活題暫緩硬排除；A6 北京排 2、江蘇排 3。
- 正式域名與不可變 URL 的 schools.json 均為 2952 校／2952 唯一教育部代碼，SHA256 `7b517c6cdcfb5b9e82ae5083718cd8d8d75af51e0b4f79d07f8649ecb585f80e`。

驗證：Node 24.18.0 九閘全過，60 filters + 2 evidence + 7 trusted = 69 tests；候選與正式站 39/39 檔逐檔一致；正式站瀏覽器驗證首頁數字、選「北京／天津」劃掉 148／剩 2804、更名學校詳情；learning health 前後 200／receipt active。APLUS_EVIDENCE → bdfz-user-center/UnapplyAPlusEvidence、compatibility_date 2026-04-20、AnswerMap 均未變。這不構成真實認證寫入→中央投影→重載驗收。

即時回滾：`5df11243-e7b1-48b1-9c2f-902f9757f0ea` / source `03523202ac0dddc7c5c416ed36008811d8e064f9`，走新的受審回滾交易並先讀回當時線上基線；只切 Pages 版本，無資料庫遷移。

仍未解決：A2 二線城市清單與預設（第一財經 2026 起不再發布分級，2025 版為最後一版）、E 省級推導、C5 缺項作負面證據、真實認證跨端驗收（證據服務未帶 candidateProvince 已於 2026-10-23 修復）、A5 大一校區、C1–C4、精確學費；上游新版問卷 `data/v2.csv`（含校區與入學年份）樣本很少，尚未接入。

發布、驗證、回滾與證據：`/Users/ylsuen/CF/reports/operations/path-nope-refresh-20261003/RELEASE.md`。Status 公開紀錄 `20261003-nope-moe2026-data` r1。CAPABILITY_FIT: no-new-capability；葉子發布，無平台/共享契約變更。原始問卷 clone 是可重建的暫存，收尾時刪除；重建前依手冊重新 clone。

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

Ownership: 發布與驗證完成；reports/agent_action_log.jsonl closeout 為交接權威。

## 2026-09-08 中山大學B9誤排確認（待修）

[原因裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-sysu-metro-check/README.md)：舊/新引擎151選項×31省共4681比較，唯一新增排除為B9步行15分鐘內。中大131條問卷中，33條過度推斷的近地鐵票變未知後，可歸一分母57→24，原有13條無地鐵票勝出；校區混票被錯當全校結論。官方2026-09-07南校园公告證實步行約5分鐘到中大站。判定為aff7c2a引入的回歸，不是新官方事實；原九閘未驗到這類語義問題。此次僅核查，未改產品或部署，現行18a2c95b/sourceaff7c2a、回滾ddbda44d/source4925d96不變。建議B9未有校區證據的眾包只展示；全池模擬硬資料1290→4、walkable排除1215→0，會觸發選項隱藏，須連同問卷資訊呈現處理。中大不加白名單，所有校區也不能一律填有地鐵。報告/evidence留熱，suen複查2026-10-08。


## 2026-09-08 生活回報適用範圍修復：串行接續檢查點

中山大學 B9 回歸已定位為匿名回報分母縮小與校區混用。全24項生活資料完成風險盤點，本地已改為未核實校區／年份的回報僅供參考，新增吉林大學2026全校宿舍空調官方補證。資料生成與型別檢查通過；回歸測試、其餘官方網址核對、九道閘門及新版部署尚未完成。當前線上仍為18a2c95b/sourceaff7c2a，也是待發布修復的回滾錨點。

依第二次上下文壓縮接續規則暫停本線程產品改動，完整範圍、授權、髒樹、暫存路徑與接續責任見 `/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/HANDOFF.md`。使用者已授權核查無誤後部署，不需再次徵求發布批准。這是未完成工作接續，不是驗收或發布紀錄。

## 2026-09-08 生活證據範圍修復（歷史，已由 2026-10-03 更新取代；規則仍沿用）

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
