# 你一定不考 · UnApply

一個對標 [path.bdfz.net](https://path.bdfz.net)（減法人生）的**學校版減法工具**：不做推薦，只陪你從教育部 2025 名單的 2919 所普通高校中劃掉一定不考的那批。

- 線上：<https://nope.bdfz.net>
- 技術棧：Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion
- 部署：Cloudflare Pages（`wrangler.jsonc` → project `unapply`，production branch `master`）
- 用戶中心：[my.bdfz.net](https://my.bdfz.net) `siteKey='unapply'`
- 許可：代碼 MIT · 派生自 CollegesChat 的生活質量數據 CC BY-NC-SA 4.0

## 開發

```bash
npm install
npm run data:schools  # 從教育部 2025 名單重建 src/data/officialSchools.ts
npm run data:github-profiles # 從 DaoSword 高等教育寬表提取 GitHub 補充的官網/校址
npm run data:campus-extract # 從 GitHub 校區/POI 源生成 data/research/campus_locations.2026-04-21.csv
npm run data:research # 從 data/research/ 與 CollegesChat 原始問卷重建 src/data/researchData.ts + src/data/campusResearch.ts
npm run audit:questions # 檢查題目規則與維度枚舉是否一致
npm run audit:data   # 檢查每題實際覆蓋率與最大排除能力
npm run dev    # Vite 本機啟動
npm run build  # tsc + vite build → dist/
npm run lint
```

`npm run data:research` 會優先讀取：

- `data/research/school_websites.2026-04-21.csv`
- `data/research/github_school_profiles.2026-04-21.csv`
- `data/research/campus_locations.2026-04-21.csv`
- `data/research/campus_official_overrides.2026-04-21.csv`
- `data/research/province_portals.2026-04-21.csv`
- `data/research/discipline_eval.4th.csv`
- `data/research/sino_foreign_programs.2026-04-21.csv`
- `data/research/collegeschat_results_desensitized.csv`

若項目內沒有 `collegeschat_results_desensitized.csv`，腳本會回退讀取本機 `/tmp/university-information/questionnaires/results_desensitized.csv`。
目前項目中的 `quality_crowd.2026-04-21.jsonl` 不直接入庫，因為現有轉換結果存在列錯位。
`github_school_profiles.2026-04-21.csv` 來自 `DaoSword/China-Education-Data` 的高等教育寬表，只作官網/校址補缺，不參與高風險篩選維度推導。
`campus_locations.2026-04-21.csv` 目前由以下結構化源聚合生成：`Naptie/cn-university-geocoder`（主源）+ `ZsTs119/china-university-database` / `pg7go/The-Location-Data-of-Schools-in-China`（POI 校驗）+ `DaoSword/China-Education-Data`（校區地址補全）+ `GaoHR` 2021 全國大學信息表（僅補主校區近似坐標）。`jtchen2k/hcu` 與 `daxue.cgsop.com` 暫作人工校驗輔助，不直接入自動管線；`ramwin/china-public-data` 的高校名單基於 2017 年教育部附件，現已過時，只保留參考價值。
`campus_official_overrides.2026-04-21.csv` 是校級官方覆蓋層，只收能安全進 A5/B9 硬篩選的條目；本輪先補了 9 所北京高校，讓 `A5` 覆蓋提升到 `127/2919`。

## 部署

```bash
npm run pages:deploy  # 會先 build，再 push 到 CF Pages 的 unapply 項目
```

Cloudflare 首次部署需要在 dashboard 新建 `unapply` Pages 項目並綁定 `nope.bdfz.net`。
部署後必須驗證 `https://nope.bdfz.net/` 的實際自定義域名，而不是只看 Pages deploy 成功。

## 項目結構

```
src/
  App.tsx                   # 根路由（hash router）
  main.tsx
  data/
    officialSchools.ts      # 生成文件：教育部 2025 普通高校 2919 所
    researchData.ts         # 生成文件：網站/招生入口/學科評估/眾包聚合
    campusResearch.ts       # 生成文件：校區明細（詳情頁 lazy load）
    schools.ts              # 官方全量名單 + curatedSchools 人工增強合併層
    environment.ts          # 省份/城市 → 氣候、供暖、地鐵等推導
    dimensions.ts           # A/B/C/E 維度 + 權威來源鏈接
    questions.ts            # 42 題減法問卷
  engine/
    filter.ts               # 純函數篩選引擎（疑罪從無）
    coverage.ts             # 每題覆蓋率 / 最大排除能力分析
  lib/
    bdfzIdentity.ts         # my.bdfz.net 集成
    schoolName.ts           # 官網 / 眾包 / 研究 CSV 共用名稱規範化
    share.ts                # html-to-image 分享圖
    theme.ts                # 本地色系狀態與 CSS 變量應用
  components/
    Landing.tsx
    QuestionRunner.tsx
    ResultPage.tsx
    SchoolDetail.tsx
    ShareCard.tsx
    ContributePage.tsx
    AboutPage.tsx
    ThemeCustomizer.tsx
docs/
  PROJECT_REPORT.md         # 目的、架構、數據缺口、合規
  DATA_RESEARCH_REQUEST.md  # deep research 所需資料與 CSV/JSONL 格式
  MAINTENANCE_MANUAL.md     # 接手維護、更新、審計、部署與回滾
db/
  schema.sql                # v2 引入 Worker + D1 時使用
scripts/
  build_official_schools.mjs # 下載並解析教育部 xls 的數據構建腳本
  extract_campus_locations.mjs # GitHub 校區/POI 數據 → campus_locations.csv
  build_research_data.mjs   # 研究資料 → researchData.ts 生成腳本
  build_campus_research.mjs # campus_locations.csv → campusResearch.ts 生成腳本
  audit_data_coverage.mjs   # 42 題覆蓋率審計腳本
  fetch_sources.md          # 數據採集流程 SOP
```

## 當前價值最高的缺口

1. `A5 校區位置`：校區底稿仍是 `3396` 條記錄、覆蓋 `2732` 所學校；真正進硬篩選的校級官方覆蓋目前只有 `127/2919`，仍需持續補 `campus_official_overrides.csv` 和 `campus_locations.csv` 的本科落點字段。
2. `C1-C4`：飲食禁忌、無障礙、LGBTQ+、外省生源目前幾乎沒有正式可用數據。
3. `province_portals.csv`：已接入 31 個省級官方入口，但除北京外仍缺少直達分數線/計劃查詢頁。
4. `school_websites.csv`：目前只覆蓋 567 所學校官網，本科招生網覆蓋更低。

詳見 [docs/MAINTENANCE_MANUAL.md](/Users/ylsuen/CF/unapply/docs/MAINTENANCE_MANUAL.md) 與 [docs/DATA_RESEARCH_REQUEST.md](/Users/ylsuen/CF/unapply/docs/DATA_RESEARCH_REQUEST.md)。

## 核心原則

1. **疑罪從無**：學校某維度數據缺失時，不用該題排除它。
2. **官方主表優先**：學校目錄以教育部年度名單為準；第三方和眾包只做增強，不替代主表。
3. **中性展示**：不給任何學校「絕對不推薦」標籤。
4. **判斷權在用戶**：所有「勸退」都由用戶的個人偏好觸發。
5. **非商業**：本站非商業用途，CollegesChat 派生數據繼承 CC BY-NC-SA 4.0。
6. **不提供志願填報建議**：本站不是教育機構，不對錄取結果負責。

## 姊妹站

- [path.bdfz.net](https://path.bdfz.net) — 職業減法
- [750.bdfz.net](https://750.bdfz.net) — 北京高考
- [my.bdfz.net](https://my.bdfz.net) — 用戶中心

## 申訴下架

學校官方認為某維度存在爭議，可發郵件至 <nope@bdfz.net>，48 小時內人工處理。
