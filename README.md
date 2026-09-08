# 你一定不考 · UnApply

一個對標 [path.bdfz.net](https://path.bdfz.net)（減法人生）的**學校版減法工具**：不做推薦，只陪你從教育部 2025 名單的 2919 所普通高校中劃掉一定不考的那批。

- 線上：<https://nope.bdfz.net>
- 技術棧：Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion
- 部署：Cloudflare Pages（`wrangler.jsonc` → project `unapply`，production branch `master`）
- 用戶中心：[my.bdfz.net](https://my.bdfz.net) `siteKey='unapply'`
- 許可：代碼 MIT · 派生自 CollegesChat 的生活質量數據 CC BY-NC-SA 4.0

## 開發

Node 固定為 `.nvmrc` 的 24.18.0。最新部署、效度缺口與回滾見 [PROJECT_STATE.md](PROJECT_STATE.md)。

```bash
npm install
npm run data:schools  # 從教育部 2025 名單重建 src/data/officialSchools.ts
npm run data:github-profiles # 從 DaoSword 高等教育寬表提取 GitHub 補充的官網/校址
npm run data:laosheng-profiles # 從 laosheng.top 高校頁抽取官網/本科招生網補充表
npm run data:campus-extract # 從 GitHub 校區/POI 源生成 data/research/campus_locations.2026-04-21.csv
npm run data:research # 重建研究聚合層，並同步輸出 public/data/runtime/*.json
npm run data:runtime  # 只重導運行時 payload（schools.json + campus buckets）
npm run audit:questions # 檢查題目規則與維度枚舉是否一致
npm run audit:data   # 檢查每題實際覆蓋率與最大排除能力
npm run dev    # Vite 本機啟動
npm run build  # 先 data:runtime，再 tsc + vite build → dist/
npm run lint
```

`npm run data:research` 會優先讀取：

- `data/research/school_websites.2026-04-21.csv`
- `data/research/laosheng_school_profiles.2026-04-22.csv`
- `data/research/github_school_profiles.2026-04-21.csv`
- `data/research/campus_locations.2026-04-21.csv`
- `data/research/campus_official_overrides.2026-04-21.csv`
- `data/research/quality_official_overrides.2026-09-08.csv`
- `data/research/province_portals.2026-04-21.csv`
- `data/research/discipline_eval.4th.csv`
- `data/research/sino_foreign_programs.2026-04-21.csv`
- `data/research/collegeschat_results_desensitized.csv`

若項目內沒有 `collegeschat_results_desensitized.csv`，腳本會回退讀取本機 `/tmp/university-information/questionnaires/results_desensitized.csv`。
`quality_crowd*.jsonl` 目前不再提交進倉庫：現有轉換結果列錯位，且不進運行時；等後續基於原始問卷重新導出乾淨版本後再重新入庫。
`laosheng_school_profiles.2026-04-22.csv` 來自 [`laosheng.top/fuwu/yuanxiao`](https://laosheng.top/fuwu/yuanxiao) 的人工維護高校名錄，只作學校官網與本科招生網補缺，不參與 A5/B9 等高風險硬篩選推導。
`github_school_profiles.2026-04-21.csv` 來自 `DaoSword/China-Education-Data` 的高等教育寬表，只作官網/校址補缺，不參與高風險篩選維度推導。
`campus_locations.2026-04-21.csv` 目前由以下結構化源聚合生成：`Naptie/cn-university-geocoder`（主源）+ `ZsTs119/china-university-database` / `pg7go/The-Location-Data-of-Schools-in-China`（POI 校驗）+ `DaoSword/China-Education-Data`（校區地址補全）+ `GaoHR` 2021 全國大學信息表（僅補主校區近似坐標）。`jtchen2k/hcu` 與 `daxue.cgsop.com` 暫作人工校驗輔助，不直接入自動管線；`ramwin/china-public-data` 的高校名單基於 2017 年教育部附件，現已過時，只保留參考價值。
`campus_official_overrides.2026-04-21.csv` 保存官方校區資料；B9 校區觀察只供參考，A5 沿用既有獨立門檻；目前收錄 9 所北京高校；效度審計移除無來源人工預設後，`A5` 可硬排除資料為 `9/2919`。

## 部署

```bash
npm run pages:deploy  # 先確認乾淨且已推送，build 後再次過閘，再上傳至 Pages unapply
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
    researchData.ts         # 生成文件：研究聚合層（構建/腳本用，不直接進前端 chunk）
    campusResearch.ts       # 生成文件：校區底稿（構建/腳本用，不直接進前端 chunk）
    provinceAdmissionPortals.ts # 生成文件：31 省官方招考入口小表
    runtimeManifest.ts      # 生成文件：運行時 payload 版本與路徑
    campusProvinceBuckets.ts # 生成文件：省份 → 校區 bucket 文件名
    runtimeTypes.ts         # 運行時 payload 類型
    schools.ts              # 類型 + build 側合併邏輯
    environment.ts          # 省份/城市 → 氣候、供暖、地鐵等推導
    dimensions.ts           # A/B/C/E 維度 + 權威來源鏈接
    questions.ts            # 43 題減法問卷
  engine/
    filter.ts               # 純函數篩選引擎（疑罪從無）
    coverage.ts             # 每題覆蓋率 / 最大排除能力分析
  lib/
    bdfzIdentity.ts         # my.bdfz.net 集成
    runtimeData.ts          # fetch schools.json / campus buckets 的運行時載入器
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
public/data/runtime/
  schools.json              # 前端按需拉取的學校主 payload
  campuses/*.json           # 按省份拆分的校區 payload
db/
  schema.sql                # v2 引入 Worker + D1 時使用
scripts/
  build_official_schools.mjs # 下載並解析教育部 xls 的數據構建腳本
  extract_campus_locations.mjs # GitHub 校區/POI 數據 → campus_locations.csv
  build_research_data.mjs   # 研究資料 → researchData.ts 生成腳本
  build_campus_research.mjs # campus_locations.csv → campusResearch.ts 生成腳本
  export_runtime_payloads.ts # researchData/campusResearch/schools → runtime JSON payload
  audit_data_coverage.mjs   # 43 題覆蓋率審計腳本
  fetch_sources.md          # 數據採集流程 SOP
```

## 當前價值最高的缺口

1. `A5 校區位置`：校區底稿仍是 `3396` 條記錄、覆蓋 `2732` 所學校；真正進硬篩選的校級官方覆蓋目前只有 `9/2919`，仍需持續補 `campus_official_overrides.csv` 和 `campus_locations.csv` 的本科落點字段。
2. `C1-C4`：飲食禁忌、無障礙、LGBTQ+、外省生源目前幾乎沒有正式可用數據。
3. `province_portals.csv`：已接入 31 個省級官方入口，但除北京外仍缺少直達分數線/計劃查詢頁。
4. `school_websites.csv` / `laosheng_school_profiles.csv`：官網覆蓋已能補到大多數學校，但本科招生網仍偏少，尤其普通本科與高職院校。

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


## 2026-09-08 生活證據修復候選（發布前）

單線程接續原授權。匿名生活回報只供參考，保留全分母、分布、平票與未知；B硬排除要求當年度、整校、完整選項語義及逐校官方來源。中大B9不再被混校區票數排除；吉大只確認宿舍空調，教室未知，未填「都有」。修正三校無時間證據的地鐵推定及兩個過期網址，保留B全部來源到runtime JSON。現可出題15項，B24項暫緩；結果會保留部分不符合生活偏好的學校。

九閘與60 filters + 2 evidence + 7 trusted通過；4681逐選項逐省比較無新增排除、非B無變動，Chrome本機來源/分母/31省A6/儲存與rAF禁用/目錄和校區503重試通過。最終文字與對比調整後再核對驗證產物。發布前線上18a2c95b/sourceaff7c2a不變，也是本次回滾。CAPABILITY_FIT: no-new-capability；固定Node24.18.0、Wrangler4.100.0，無新增綁定或hub/AnswerMap/RPC變更。

A2第三方城市榜單與預設、E省級推導、C5缺項作负面證據、證據服務未帶candidateProvince及真實認證寫入/中央投影/重載驗收仍未完成；原43維全面準確性未通過裁定保留。依據：`/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/`。本輪原始問卷仍為既有0aa4c193，未拉取/複製/刪除。報告與來源retain_hot供現行版本復核，owner suen、複查2026-10-08；精確資源清理見私有manifest。
