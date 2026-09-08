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
