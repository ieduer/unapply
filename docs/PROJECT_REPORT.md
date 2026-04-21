# nope.bdfz.net 項目報告（v1.5）

| 字段 | 值 |
| --- | --- |
| 項目名 | 你一定不考 · 不考大學指南 |
| 英文別名 | UnApply |
| 線上地址 | <https://nope.bdfz.net> |
| 本地路徑 | `/Users/ylsuen/CF/unapply/` |
| GitHub | <https://github.com/ieduer/unapply> |
| 技術棧 | Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion · html-to-image |
| 部署 | Cloudflare Pages（project `unapply`，production branch `master`，build output `dist`） |
| 用戶中心集成 | `siteKey='unapply'`；`window.BdfzIdentity.recordEvent/recordDownload` |
| 當前版本 | v1.5 = 2026-04-21，runtime payload 拆分、倉庫瘦身、校級官方覆蓋與預發布體檢完成 |
| 合規 | 代碼 MIT；CollegesChat 派生數據與用戶貢獻 CC BY-NC-SA 4.0 |

## 1. 第一性原理

本站不是志願填報推薦器。它只回答一件事：

> 在公開可信的學校全集中，哪些學校被用戶自己的紅線排除？

因此架構約束是：

1. 學校全集必須來自權威年度主表，不能靠第三方列表拼湊。
2. 每一次排除都必須能追溯到「用戶答案 + 學校字段 + 題目規則」。
3. 缺失字段不能被推測成負面事實；未知即不排除。
4. 主觀、易變、敏感字段只能眾包增強，不能混入官方主表。
5. 部署後以 `https://nope.bdfz.net/` 自定義域名實際響應為準。

## 2. 當前架構

```text
nope.bdfz.net
└─ Cloudflare Pages project: unapply
   └─ React SPA
      ├─ src/data/officialSchools.ts       # 生成文件：教育部 2025 普通高校 2919 所
      ├─ src/data/researchData.ts         # 生成文件：研究聚合層（build 側）
      ├─ src/data/campusResearch.ts       # 生成文件：校區底稿（build 側）
      ├─ public/data/runtime/*.json       # 前端實際 fetch 的 schools/campus payload
      ├─ src/data/schools.ts              # 類型 + build 側合併邏輯
      ├─ src/data/environment.ts           # 省份/城市 → 氣候、供暖、地鐵等推導
      ├─ src/data/dimensions.ts            # A/B/C/E 維度與來源
      ├─ src/data/questions.ts             # 42 題問卷
      ├─ src/engine/filter.ts              # 純函數篩選引擎
      ├─ src/engine/coverage.ts            # 每題/選項覆蓋率與排除能力分析
      ├─ src/lib/runtimeData.ts           # 運行時 payload 載入器
      └─ src/lib/bdfzIdentity.ts           # my.bdfz.net 事件同步

my.bdfz.net
└─ user_data_records
   ├─ 完成一輪減法
   ├─ 下載分享圖
   └─ 貢獻入口事件
```

`db/schema.sql` 是 v2 Worker + D1 的預留 schema；v1.5 仍是靜態 SPA，但學校主表與校區底稿已遷成 runtime JSON，不再把大研究表直接打進 JS chunk。

## 3. 數據層

### 3.1 官方主表

權威來源：教育部《全國高等學校名單》2025 版。

教育部口徑（截至 2025-06-20）：

- 全國高等學校 3167 所。
- 普通高等學校 2919 所，其中本科 1365 所、高職（專科）1554 所。
- 成人高等學校 248 所。
- 名單不含港澳台地區高校。

本項目主池只納入 2919 所普通高校。成人高校只在文案和文檔中作口徑說明。

重建命令：

```bash
cd /Users/ylsuen/CF/unapply
npm run data:schools
```

生成腳本 `scripts/build_official_schools.mjs` 會：

- 下載教育部頁面並定位普通高校 `.xls` 附件。
- 解析 2919 條普通高校記錄。
- 校驗院校代碼唯一。
- 輸出 `src/data/officialSchools.ts`。
- 為每條保留 `moeCode`、`department`、`moeLevel`、`ownership`、`sourceUrl`、`updatedAt`。

### 3.2 層次分類

層次分類由官方公開名單疊加：

- C9：9 所。
- 985：教育部「985 工程」名單。
- 211：教育部「211 工程」名單。
- 雙一流：教育部 2022 年第二輪「雙一流」建設高校名單。
- 其餘按教育部普通高校名單中的本科 / 專科分類。

不在普通高校附件中的軍校或特殊院校，不強行混入官方主表；如需展示，放在 `curatedSchools` 並保留來源標記。

### 3.3 增強層

`src/data/schools.ts` 的 `curatedSchools` 補充官方名單沒有的字段：

- 英文名、官網。
- 主校區類型、校區備註。
- 少量 B/C 維度樣本。
- 兼容繁簡和別名匹配。

合併規則：官方字段優先，人工字段只補充非官方字段。不得用人工資料覆蓋 `moeCode`、主管部門、層次、辦學性質和來源 URL；未匹配到教育部普通高校附件的 `curatedSchools` 只輸出為 `curatedOnlySchools` 審計清單，不進 2919 所篩選主池。

### 3.4 研究數據生成層

`scripts/build_research_data.mjs` 會把 `data/research/*.csv` 與 CollegesChat 原始脫敏問卷聚合為 `src/data/researchData.ts`，`scripts/build_campus_research.mjs` 產出 `src/data/campusResearch.ts`，再由 `scripts/export_runtime_payloads.ts` 轉成 `public/data/runtime/*.json` 供前端按需 fetch。當前接入：

- `school_websites.2026-04-21.csv`
- `github_school_profiles.2026-04-21.csv`
- `campus_official_overrides.2026-04-21.csv`
- `province_portals.2026-04-21.csv`
- `discipline_eval.4th.csv`
- `sino_foreign_programs.2026-04-21.csv`
- `results_desensitized.csv`（CollegesChat 原始脫敏問卷）

效果：

- 結果頁與詳情頁已接入 31 個省級官方招考入口。
- 學校官網覆蓋已從 567 所提升到 2714 所，並新增 2709 所校址展示。
- `A5` 校級官方覆蓋已從 119 所提升到 127 所；首批新增 9 所北京高校的官方校區結論。
- `B1-B24` 大多數題從接近 0 覆蓋提升到 46% - 76%。
- `C5` 從 3 所提升到 54 所。
- `quality_crowd*.jsonl` 因列錯位且不進 runtime，已從 Git 倉庫移除，等重新導出乾淨版本後再入庫。

## 4. 維度

| 類別 | 題數 | 數據策略 |
| --- | ---: | --- |
| A 紅線 | 5 | 省份、城市等級、層次、學費口徑、校區位置；未知字段不排除 |
| E 環境 | 8 | 由省份/城市推導供暖、夏冬體感、霧霾、方言、地鐵、沿海、高海拔 |
| B 生活質量 | 24 | 宿舍、空調、澡堂、自習、晨跑、外賣、斷電、熱水、門禁等眾包字段 |
| C 特殊 | 5 | 飲食、無障礙、LGBTQ+、外省生源、學科評估；敏感字段需人工審核 |

核心規則仍是「疑罪從無」：

```typescript
if (schoolValue === null) continue
```

任何缺失字段都不觸發排除。這比填充假默認值更重要，因為錯誤排除比少排除更難恢復信任。

## 5. 已完成優化

- 官方學校主表從 125 所種子池擴為教育部 2025 版 2919 所普通高校。
- 人工 curated 未匹配項不再追加進主池，避免官方 2919 口徑被擴張。
- 移除舊的 3306 口徑，改用教育部 3167/2919/1365/1554/248 明確口徑。
- 新增 `npm run data:schools`，使官方目錄可重建、可審計。
- 學費維度改為公辦 / 民辦合作待核價的保守口徑，不再把未知民辦學費硬估到區間。
- 前端詳情、結果分佈、城市地鐵推導均可處理缺失字段。
- 問卷在剩餘學校變成 0 時立即提供「看排除結果 / 改上一題 / 清空重來」，不再強迫用戶答完整套題。
- B9「校門口必須有地鐵」規則收緊為排除「步行 15 分鐘內」；A4/A5/B9/C4/C5 標為混合數據，明確提示缺失不排除。
- 貢獻入口支持既有非權威維度和自定義重要數據，issue 正文固定輸出 `unapply.dataContribution.v1` JSON。
- README 與採集 SOP 更新到官方主表優先的工作流。
- `scripts/build_research_data.mjs` / `npm run data:research` 正式接管研究增強層。
- `scripts/extract_github_school_profiles.mjs` / `npm run data:github-profiles` 可從 `DaoSword/China-Education-Data` 抽取官網/校址補充表。
- `scripts/audit_data_coverage.mjs` / `npm run audit:data` 可直接輸出 42 題覆蓋率與最大排除能力。
- 問卷頁不再展示覆蓋率說明；無效題與 0 效果限制項會直接隱藏，方法論統一收斂到 About。
- 問卷現在只展示當前有實際刪減能力的題，且會隱藏 0 效果的限制選項，避免學生選了也沒有任何變化。
- `A4` 中目前無法生效的 `≤3萬 / ≤8萬` 選項、`A5` 的「不接受大一單獨分校區」等 0 效果限制已暫時隱藏。
- `C1-C4` 因當前數據無法形成有效排除，已從正式測試版問卷暫時隱藏，等待用戶與 deep research 補數據後再開。
- 學校目錄 lazy import 失敗時已補重試入口，避免一次瞬時載入失敗就整個卡死到刷新頁面。
- 全站新增本地色系自定義面板，樣式以 CSS 變量持久化到 `localStorage`。
- 路由頁面改為 lazy chunk，將研究數據從首頁首屏 chunk 拆出。
- 學校主表與校區底稿已遷成 `public/data/runtime/*.json`；前端 runtime 不再直接 import `researchData.ts` / `campusResearch.ts`。
- 校區資料已按省份拆成 31 個 bucket，學校詳情只拉當前省份的校區 payload。
- `audit:data` 已改成直接審計 runtime `schools.json`，避免“腳本看的是一套、前端跑的是另一套”。
- 本地 `tsx` 已納入 devDependencies，不再依賴 `npx --yes tsx` 臨時下載。
- 移除了 52MB 且未入 runtime 的 `quality_crowd.2026-04-21.jsonl`，避免 GitHub 大文件告警持續存在。

## 6. 本輪上線前發現並修正的真問題

1. 問卷裡存在「看起來可選，但按當前數據完全刪不掉任何學校」的限制項，會直接誤導學生。
2. `C1-C4` 當前覆蓋率是 `0%`，把它們放在正式測試問卷裡只會增加噪音。
3. 學校主表動態載入失敗後沒有重試通路，網路抖動時會把學生困在錯誤頁。
4. 首頁和說明頁仍按靜態 42 題口徑表述，和實際動態出題狀態不一致。

## 7. 未完成數據缺口

| 缺口 | 優先級 | 處理方式 |
| --- | --- | --- |
| B 生活質量 24 維 | P1 | 解析 CollegesChat yml，保留來源和時間戳，人工審核後合併 |
| A5 校區位置 | P1 | 優先補 985/211/雙一流；來源為招生章程、官網校區介紹、地圖輔助；先寫入 `campus_official_overrides.csv` 再擴大 |
| 民辦/合作精確學費 | P1 | 按當年招生章程或陽光高考專業計劃核價；未核價保持 `民辦/合作待核價` |
| C5 學科評估 | P2 | 學位中心第四輪評估；第五輪未完整公開，不可臆補 |
| C3 LGBTQ+ 氛圍 | P3 | 只接受公開來源 + 人工合規審核；默認留空 |
| C4 外省生源 | P3 | 分省招生計劃年度變動大，短期不做全量精確化 |

詳細 deep research 需求與交付格式見 `docs/DATA_RESEARCH_REQUEST.md`。

完整維護與回滾手冊見 `docs/MAINTENANCE_MANUAL.md`。

## 8. 驗證與部署

本地驗證：

```bash
cd /Users/ylsuen/CF/unapply
npm run data:schools
npm run audit:questions
npm run lint
npm run build
npm audit
```

部署：

```bash
cd /Users/ylsuen/CF/unapply
npm run pages:deploy
curl -I https://nope.bdfz.net/
```

部署前需確認 Cloudflare Pages project 是 `unapply`，production branch 是 `master`，且 `nope.bdfz.net` 綁定到該 project。成功 deploy 不是最終驗證，最終驗證必須看 live custom domain。

## 9. 回滾

代碼回滾：

```bash
cd /Users/ylsuen/CF/unapply
git log --oneline -n 5
git revert <COMMIT>
git push
```

數據層回滾：

```bash
cd /Users/ylsuen/CF/unapply
git checkout <GOOD_COMMIT> -- src/data/officialSchools.ts src/data/schools.ts scripts/build_official_schools.mjs
npm run build
```

Cloudflare Pages 回滾：在 Pages dashboard 將 production deployment rollback 到上一個健康版本，然後用 `curl -I https://nope.bdfz.net/` 驗證。

## 10. 對學生測試期的說明

正式發給學生試用時，建議同步說明：

> 現在問卷裡只保留了按當前數據確實能起作用的題和限制項；暫時缺數據、選了也不會有變化的部分，先不讓大家白答。  
> 如果你覺得這個站有用，歡迎把它發給熟悉不同學校的學長學姐、在讀同學或校友。每多一條可核驗的補充，後面的人做減法就會更準一點。

這段話要跟「疑罪從無」一起理解：我們寧可先少排，也不願意拿不準的數據誤殺學校。

## 11. 相關項目

| 項目 | 作用 | 本地路徑 | 狀態 |
| --- | --- | --- | --- |
| path.bdfz.net | 職業減法 | `/Users/ylsuen/CF/minus-life/` | 已上線 |
| 750.bdfz.net | 北京高考語料 | `/Users/ylsuen/CF/750/` | 已上線 |
| my.bdfz.net | 用戶中心 + 記錄後端 | `/Users/ylsuen/CF/bdfz-user-center/` | 已上線 |
| nope.bdfz.net | 學校減法 | `/Users/ylsuen/CF/unapply/` | v1.5 結構優化完成 |

本報告是活文檔，後續數據採集和 D1 遷移應同步更新。
