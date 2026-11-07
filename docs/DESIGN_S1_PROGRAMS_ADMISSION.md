# S1 設計：中國大陸高校「專業 × 錄取條件 × 招生政策」資料層

- 狀態：**S1.a 已上線並擴到全部 2,952 校**（2026-11-07：首批 `2e79f9b`、修正批 A `6b70522`、批 B `ccf1770`／`8cb266cb`；站長裁定「做新題，擴到全部，22 MB放R2，該修正的都修正」）：起點條件層＋逐校展示，見手冊 §3.4。未動 43 題／引擎／AnswerMap／Function／A+ 證據契約／`src/shared-ui`。**S1.b（兩道正式題 S1 選科組合／S2 意向專業類，共享契約變更）已上線 2026-11-07（`5b18cd1`／`b3e0f4c8`，站長「放行，正式發布 C」）；UC 無需變更、未做任何 UC 生產寫入（證據見手冊 §3.4 與 OPERATIONS 批 C 節）。**
- 上位文件：`docs/GLOBAL_ROADMAP.md` S1 列（進入條件 S0 上線 ✔；完成定義「每題覆蓋率 `audit:data` 達到裁定門檻；A+ 證據契約不變」）。
- 既有慣例：`docs/MAINTENANCE_MANUAL.md` §3（CSV 入庫、來源 URL／日期／可信度欄、生成腳本、fail-closed 閘門）、§3.1a A6 招生管道表、`docs/DESIGN_A6_ADMISSION_CHANNEL.md`（學校 × 省份 × 年度、不誤殺、省份繁體口徑）。
- 首批資料與稽核：`data/research/program_offerings.2027.csv` 等（手冊 §3.4）；`/Users/ylsuen/CF/reports/operations/nope-s1-programs-admission-20261106/s1-audit.md`。

---

## 0. 一句話

把本站的「學校」顆粒度補到「學校 × 專業」，但每一格都要有官方來源、年度與適用省份；
能進減法題的只有**在全國口徑下完整、且缺失不會誤殺**的維度，其餘只展示。

## 1. 現況與缺口（為什麼要這一層）

| 既有維度 | 現況 | S1 要補的 |
| --- | --- | --- |
| A4 學費 | 只分公辦／民辦待核價／中外合作待核價；`1-3萬／3-8萬／8萬+` 在 `reservedValues` | 逐校逐專業收費（尤其中外合作專業）→ 才能啟用精確區間 |
| A5 校區 | 校級官方覆蓋 9/2952 | 省表給出校區／醫學院獨立招生代碼（哈工大威海／深圳、北師大珠海、復旦醫學院…）→ 專業落在哪個校區可直接得到 |
| A6 招生管道 | 14 校綜評逐省；強基／提前批／專項未入 | 強基 39 校已入；專項、提前批留下一批 |
| C4 外省生源比 | 0 覆蓋 | 需分省計劃（陽光高考，腳本不可達）→ 下一批 |
| C5 學科評估 | 第四輪 A 檔、8 個學科 | 現在有每校實際**招生專業（類）**，可以回答「這校有沒有開這個專業」而不只是「學科評估幾檔」 |
| （新）選考科目 | 無 | 2027 年起全國統一口徑的逐專業選考要求，四省官方表交叉核對 0 衝突 |

## 2. Schema

所有表都是 `data/research/*.csv`，UTF-8、英文欄名、每列帶 `sourceTitle／sourceUrl／sourceDate／confidence`（或對應到 `s1_sources.json` 的 `sourceIds`），
生成腳本 fail closed；省份一律全站繁體口徑（取自教育部主表），專業／學校名稱保留來源簡體原文（只在展示層轉字形）。

### 2.1 鍵

| 鍵 | 來源 | 說明 |
| --- | --- | --- |
| `moeCode` | 教育部年度名單 10 位學校標識碼 | 本站唯一學校鍵。末 5 位＝各省招生「院校代碼」 |
| `campusLabel` | 省表招生名稱剝後綴 | 校區／醫學院／分校有獨立招生代碼時的標籤（`医学部`、`威海`、`珠海校区`…），空＝本部或不分 |
| `catalogCode` | 教育部《普通高等學校本科專業目錄》年度版 | 國標專業代碼 6 位（2026 外語類新增 7 位），後綴 T 特設、K 國家控制；專業類 4 位；門類 2 位 |
| `programName` | 各校「招生專業（類）名稱」 | 學校自訂，可能是專業、專業類（計算機類）、試驗班；對應到國標的方式記在 `catalogMatch` |
| `admissionYear` | 省表／章程年度 | 逐年新增，不跨年臆推 |
| `province` | 全站繁體省名；`all`＝全國統一 | 選考要求是全國統一口徑，省份只記「哪個省表列到了它」 |

### 2.2 表

**`bk_catalog.<年>.csv`（國標目錄，已產出 2026）**

```csv
code,name,special,controlled,classCode,className,disciplineCode,disciplineName,degreeNote,year,sourceTitle,sourceUrl,sourceDate
```

**`program_offerings.<年>.csv`（機構 × 招生專業（類）× 年度；已產出 2027，雙一流 144 校）**

```csv
moeCode,schoolName,schoolCode,campusLabel,admissionYear,programName,programNameBase,programCodes,programKind,
catalogMatch,catalogCode,catalogName,catalogClassCode,catalogClassName,disciplineCode,disciplineName,
requirementPattern,requirementRaw,requirementVariants,provinces,sourceIds,conflict,confidence,sourceDate
```

- `requirementPattern`：選考要求圖樣，字母固定序 `P物 C化 B生 Z政 H史 G地`（浙江另有 `T技术`，只進 `requirementVariants`）；`none`＝不提科目要求；空＝跨省衝突，不得使用。
- `catalogMatch`：`code`（學校代碼就是國標碼）／`name`／`name_base`（去括號後同名）／`class`（按專業類招生）／`none`（試驗班等）。
- `confidence`：`high`＝兩個以上省表一致；`medium`＝只有一省列到；`low`＝衝突。
- 這張表同時回答三件事：這校招哪些專業（類）、每個落在哪個校區、選什麼科才能報。

**`admission_requirements.<年>.csv`（錄取條件，下一批；章程層）**

```csv
moeCode,admissionYear,scope,programRef,requirementType,value,provinces,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

- `scope`：`school`／`program`；`programRef` 為 `programName` 或 `catalogCode`。
- `requirementType`：`subject`（選考，已由 offerings 表承載）、`single_subject`（單科成績，如外語≥90）、`language`（外語語種限英語／須口試）、
  `physical`（體檢：色盲色弱、身高、視力——只收章程原文可定位的條款）、`gender_quota`（軍警航海類性別比例，只展示）、`interview`（面試／政審）。
- 來源：各校年度招生章程（學校官網本科招生網；陽光高考章程庫為人工查核入口）。只收當年章程，不沿用上一年。

**`admission_policies.<年>.csv`（招生政策；強基已產出，其餘下一批）**

```csv
moeCode,admissionYear,policyType,provinces,programs,quota,feeCnyPerYear,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

- `policyType`：`strong_base`（強基）、`comprehensive_eval`（綜評，沿用 A6 表）、`early_batch`（提前批）、`special_plan_national`（國家專項）、
  `special_plan_university`（高校專項）、`special_plan_local`（地方專項）、`sino_foreign_program`（中外合作辦學專業，帶 `feeCnyPerYear`）。
- 強基首批：`strong_base_schools.2026.csv`（39 校），欄位較簡（名單級），日後併入本表。
- 中外合作專業收費同時回填 `tuition_programs.csv`（`docs/DATA_RESEARCH_REQUEST.md` §2.3 既有規格），A4 精確區間才可能啟用。

**`s1_sources.json`（來源釘定表，已產出）**：每個來源的出版單位、權威等級（P0 官方／P1 學校官方）、公告頁、檔案網址、發布日、SHA-256、大小、入庫方式、預期計數。

### 2.3 展示層型別（候選，未實作）

```ts
interface SchoolPrograms {            // 掛在 School 上，runtime payload 另分檔懶載入
  year: number
  programs: { name: string; campus?: string; catalog?: string; klass?: string; req: string /* PC|none|… */ }[]
  provinces: string[]                 // 列到該校的省表
  source: { ids: string[]; date: string }
}
```

## 3. 哪些維度能進減法題，哪些只展示

判準沿用本站第一性原理：**缺失數據疑罪從無；證據強度決定排除權；全國口徑完整才有排除權**。

| 維度 | 資料完整度（首批） | 可否進減法 | 理由與形式 |
| --- | --- | --- | --- |
| 選考組合 → 全校無一可報專業 | 雙一流 144/144，四省聯集，0 衝突 | **可（學校層硬排除），但只對「專業清單完整」的學校** | 用戶選自己的 3 科；某校**所有**已列專業都不相容才劃掉。缺資料的學校不排除。首批模擬：物化生／物化政／物化地 0 校；含物不含化的組合劃掉 7 校（協和、國科大、上科大、南航、中科大、南科大、電子科大——全部專業皆要求物＋化）；史類組合劃掉 5 校。這一題在雙一流層排除力弱，在全部 2,952 校層才有意義 |
| 想讀的專業（類）→ 校無此專業 | 同上 | **可（`requires` 型，同 C5 形式）**：「我要讀計算機類」→ 只留有開設的學校 | 以國標專業類（92）為選項顆粒度，不用 883 個專業；試驗班（118 條，1.2%）按名稱關鍵字歸類或視為「未知＝保留」 |
| 想讀的專業 × 選考組合 | 同上 | 可，兩者疊加 | 「有開設且我選的科能報」 |
| 強基計劃 | 39/39 全國完整 | **可（`requires` 型）**：「必須有強基」→ 只留 39 校 | 名單級全國完整，無誤殺風險；但不能反向排除（「不要強基校」沒有意義） |
| 專業落點校區 | 17 校有獨立招生代碼 | 只展示 | 只有部分校區有獨立代碼，其餘校區無法從省表得知；可補 A5 的校級官方證據，不直接進題 |
| 單科／語種／體檢 | 未入（章程層） | 只展示（即使入了） | 逐校章程覆蓋永遠不完整；體檢條款涉及身體狀況，不做自動排除 |
| 專項計劃／提前批 | 未入 | 入後可作 `requires` 型 | 高校專項名單全國完整（陽光高考人工查核） |
| 中外合作專業收費 | 未入 | 入齊「該校全部專業」後才可回填 A4 | A4 是學校層桶；只要有一個專業收費不明就不能把學校判到某個區間 |

**契約影響**：任何新題都會改 `AnswerMap` 的鍵集合與 UC 側 `UnapplyAPlusEvidence` 的摘要，屬共享契約變更（`runbooks/shared_hub_synchronized_change_standard.md`）。
因此建議分兩步：**S1.a 先只在學校詳情頁與結果卡展示**（零契約風險，立即有價值）；**S1.b 新題**另立設計與 fan-out，等站長裁定。

## 4. 官方來源可取得性核查（2026-11-06 實測）

| 來源 | 內容 | 可取得性 | 抓取方式 | 更新頻率 | 限制 |
| --- | --- | --- | --- | --- | --- |
| 教育部《普通高等學校本科專業目錄（2026年）》 | 13 門類／92 類／883 專業 | ✅ `moe.gov.cn` PDF 直連 200 | `pdftotext -layout`，正則抓代碼行；三個計數對不上就停 | 每年 4 月 | 2026 起外語類 7 位代碼；交叉學科門類無專業類 |
| 湖北省教育廳 2027 選考科目要求彙總表 | 1,237 校、49,786 本科列，**xlsx** | ✅ 200；SHA 與 path 站釘定一致 | `@e965/xlsx` 讀第一工作表 | 每年 2 月 | 含專科；院校代碼含校區／醫學院獨立代碼 |
| 江蘇省教育廳 2027 彙總表 | 1,197 校、50,465 本科列，**xls** | ✅ 200（.xlsx 鏈接 404） | 同上；第二工作表軍校不入 | 每年 2 月 | .xls 65,536 行上限，截斷在專科段 |
| 上海市教育考試院 2027 本科專業選考科目要求 | 986 校、39,607 列，**PDF 914 頁** | ✅ 200 | `pdftotext -tsv` 座標分欄；要求用簡寫 | 每年 2 月 | 水印散字；代碼格字高不同；校名折行 |
| 浙江省教育考試院 2027 及以後選考科目要求 | 1,191 校、48,450 本科列，**zip→PDF 3,443 頁** | ✅ 200 | `unzip -p` ＋ `pdftotext -tsv` | 每年 2 月 | 無專業代碼欄；含「技术」科 |
| 教育部強基計劃試點名單（2020 意見附件 1） | 36 校 docx | ✅ 200 | 讀 `word/document.xml` | 不定期 | 2022 增列 3 校教育部網站無可抓原文，以三校 2026 簡章頁為證（P1） |
| **陽光高考**（院校庫、章程庫、專業庫、分省計劃、強基／專項專題） | 章程、計劃、專項名單 | ❌ 對非瀏覽器請求回 **412 JavaScript 挑戰** | **只能人工在瀏覽器查核**；不繞過、不自動化 | 章程每年 5–6 月 | A6 表的章程 URL 就是這樣人工取得的 |
| 山東省教育招生考試院 2027 通用版（本科／專科）**PDF** | 1,262 校 52,004 本科列；1,356 校 37,119 專科列 | ✅ 200（2026-11-07 批 D1） | `pdftotext -tsv` 左緣聚類分欄；要求欄折行以文法拼回 | 每年 3 月 | 有院校代碼；兩行表頭、每頁重印 |
| 河南省教育考試院 2027 **xlsx** | 1,302 校 53,620 本科列；41,980 專科列 | ✅ 200（批 D1） | `@e965/xlsx`，層次欄「本科／高职(专科)」 | 每年 4 月 | 有院校代碼 |
| 內蒙古招生考試信息網 2027 **xlsx**（本科／专科兩表） | 1,130 校 47,087 本科列；30,840 專科列 | ✅ 200（批 D1） | `@e965/xlsx`，兩工作表各帶層次；只有校名 | 每年 3 月 | 無院校代碼，按校名（含學到的舊名別名）對齊 |
| 湖南省教育廳 2027 通用版彙總表 | 公告頁可達 | ❌ 附件主機 cms.jyt.hunan.gov.cn 從本機 TLS 重置 | — | — | 批 D1 待從其他網路補抓 |
| 廣東 eeagd.edu.cn/xkcx2027、四川 plan.sceea.cn、福建 jyt.fujian.gov.cn/ztzl/zszyxkkmcx、新疆 xkcx.xjzk.gov.cn | 只以**查詢系統**公布 | ⚠ 頁可達（四川 403） | 不抓：逐校查詢不能保證完整，也近乎繞過 | — | 批 D1 不納入 |
| 北京教育考試院 bjeea.cn | 2027 在京選考要求、分省計劃查詢 | ❌ 本機 TCP／TLS 均不通 | — | — | 既有 `province_portals` 的北京計劃 API 同樣受影響，需從其他網路複核 |
| 廣東省教育考試院 eeagd.edu.cn | 2027 在粵選考要求 | ❌ 302 → `/forbid` | — | — | — |
| 山東 sdzk.cn、江蘇 jseea.cn、上海 shmeea、湖北 hbea | 首頁可達 | ✅ | — | — | 山東 2027 查詢系統 `xkkm.sdzk.cn` 不通 |
| 各校本科招生網章程／專業介紹 | 錄取條件、政策、收費 | ✅（逐校不同） | 逐校人工＋半自動；首批未做 | 每年 5–6 月 | 143 個站點格式各異；A6 的經驗是章程必須當年版 |

結論：**選考要求與專業清單可全自動、可離線重現**（批 D1 起七省官方表＋教育部目錄；其餘省份本機出口為海外 IP 多被重置、或只以查詢系統公布）；**章程層與分省計劃**必須人工或半自動，且陽光高考這條最省力的路對腳本是關閉的。

## 5. 管線（已實作，手冊 §3.4）

```text
s1_sources.json ──fetch_s1_sources.mjs──▶ raw/s1/（入庫原檔）＋ cache（external，SHA-256 釘定）
                                              │
                        build_s1_programs.mjs ─┼─▶ bk_catalog.2026.csv
                                              ├─▶ program_offerings.2027.csv ＋ _summary ＋ .meta.json
                                              └─▶ strong_base_schools.2026.csv
                        audit_s1_programs.mjs ──▶ s1-audit.md / .json（覆蓋率、衝突、目錄對應、選科模擬、來源缺口）
```

fail-closed 點：來源雜湊不符；目錄三個計數不符；不認得的選考要求寫法；專業代碼不在當前門類下；強基名單數不符；三校簡章頁不含「强基计划」。

## 6. 接入閘門（任何一步接進前端前）

1. 資料閘：`audit:s1` 跨省衝突 0；雙一流覆蓋 100%；再往下擴到全部 2,952 校時，每校「專業清單完整」的判定要有來源依據（至少兩省表列到）。
2. 展示閘（S1.a）：只加 `public/data/runtime/` 新分檔與詳情頁區塊；主包不增大；`test:theme` 對比度；手機無橫向溢出；`check:shared-ui` 不變。
3. 題目閘（S1.b，需站長另批）：`audit:questions`／`audit:values`（新維度死值進 `reservedValues`）／`test:filters` 新斷言（含「缺資料學校不被排除」）；
   AnswerMap 變更走共享契約 fan-out（UC 證據摘要、A+ 門檻）；`test:evidence`／`test:trusted` 不得回歸。
4. 發布閘：十一道既有閘門＋候選預覽逐路由量測＋登記的 Pages 交易＋Status 紀錄（同 S0）。

## 7. 首批結果摘要（詳見稽核報告）

- 雙一流第二輪 147 所 → 教育部 2026 主池內 **144 所**（減國防科大、海軍軍醫、空軍軍醫三所軍校；上海體育學院已更名上海體育大學）。
- **144/144 校**都有本科招生專業（類）清單與選考要求：**9,534 條**，中位每校 68 條；137 校被四省表都列到、7 校三省。
- 跨省要求 **0 衝突**，證實「2027 起全國統一口徑」；98.3% 條目兩省以上一致（high）。
- 國標目錄對應：按國標碼 87.2%、按專業類 11.0%、對不到 1.2%（全是各校試驗班）。
- 校區／醫學院獨立招生代碼映射回母校 17 校；省表 26 個 2025 年舊校名已學成別名。
- 強基 39 校齊；其中 3 校（東北、湖南、西北農林）以官方 2026 簡章頁為證。

## 8. 需要站長決定的點

1. **選科與專業要不要成為新題**（S1.b，改 AnswerMap／A+ 契約、需 UC fan-out），還是**先只在詳情頁與結果卡展示**（S1.a）？建議先 S1.a。
2. 專業題的選項顆粒度：**92 個國標專業類**（建議）還是沿用 C5 的 8 個學科大類再擴？C5 是「學科評估 A 檔」，和「有沒有開設」是兩件事，建議並存不合併。
3. 下一批順序：(a) 擴到全部 2,952 校（同一管線、`--scope all`，約 5 萬條，零增量來源）；(b) 章程層錄取條件（人工為主）；(c) 專項計劃名單（陽光高考人工查核）；(d) 中外合作專業收費→A4。建議 a → c → d → b。
4. **陽光高考人工查核的分工**：腳本不可達且不應繞過；是否由站長／助手定期在瀏覽器匯出，或接受「章程層只做雙一流 144 校」。
5. 江蘇 .xlsx（404）與北京／廣東考試院不可達：是否需要從其他網路環境補抓，或接受四省聯集即足夠（結論上已足夠）。
6. 入庫原檔的大小上限：首批把 3.6 MB 原檔提交進倉庫，三個大檔（22 MB）只釘雜湊、留在任務證據目錄；可否接受，或改放 R2。
7. 附帶發現（**已修，修正批 A，2026-11-07**）：`officialSchools.ts` 雙一流標籤按 2022 校名比對，上海體育大學曾被標成普通本科；`build_official_schools.mjs` 已加層次名單舊名對照。

## 9. 明確不做

- 不用 AI 生成或補全任何專業、要求、政策欄位；不付費；不繞陽光高考的 412 挑戰。
- 不把排名／評估接進「推薦」；不做錄取機率；不以體檢條款自動排除學校。
- 不改 43 題、引擎、Function、AnswerMap、`src/shared-ui`；不發布；不提交（由站長審核後決定）。
