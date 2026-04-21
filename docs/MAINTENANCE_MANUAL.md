# nope.bdfz.net 維護手冊（v1.5）

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
src/data/questions.ts         42 題減法問卷
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
npm run data:campus-extract
npm run data:research
npm run data:runtime
npm run audit:questions
npm run audit:data
npm run lint
npm run build
npm run dev
```

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

### 3.2 研究增強層

適用情況：你補充了 `data/research/*.csv`，或者重新抓取了 CollegesChat 原始問卷。

```bash
cd /Users/ylsuen/CF/unapply
npm run data:research
npm run audit:data
npm run build
```

當前腳本會接入：

- `school_websites.2026-04-21.csv`
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
3. `github_school_profiles.2026-04-21.csv` 來自 `DaoSword/China-Education-Data`，只用於官網/校址補缺，不可直接拿它推導校區、地鐵距離或大一校區去向。
4. `campus_locations.2026-04-21.csv` 由 `Naptie/cn-university-geocoder`（主源）+ `ZsTs119/china-university-database` / `pg7go/The-Location-Data-of-Schools-in-China`（POI 校驗）+ `DaoSword/China-Education-Data`（校區地址補全）+ `GaoHR` 2021 全國大學信息表（僅補主校區近似坐標）聚合生成。`jtchen2k/hcu` 與 `daxue.cgsop.com` 暫只作人工核驗參考；`ramwin/china-public-data` 的高校名單基於 2017 年教育部附件，現已不再入正式管線。
5. `campus_official_overrides.2026-04-21.csv` 是校級官方覆蓋層，只收能安全進 A5/B9 硬篩選的條目；本輪已補 9 所北京高校。
6. `researchData.ts` 與 `campusResearch.ts` 保留為 build 側生成結果；前端實際載入的是 `public/data/runtime/*.json`。

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

用這條命令看 42 題實際是否有用：

```bash
cd /Users/ylsuen/CF/unapply
npm run audit:data
```

重點看三個字段：

1. `coveredRate`：有多少學校在該題有值。
2. `maxExcluded`：最狠的一個選項最多能排掉多少學校。
3. `impactfulOptions`：有幾個選項真的在起作用。

### 4.1 當前仍屬高風險缺口

- `A5 校區位置`：校區底稿已擴到 `2732` 所學校、`3396` 條記錄，但真正進硬篩選的校級官方覆蓋目前只有 `127/2919`；本輪新增北京 9 校後，`maxExcluded` 仍只有 `5`。
- `C1-C4`：幾乎 0 覆蓋，網站必須繼續提示「數據補充中」並徵集。
- `C5 學科評估`：已從 3 所提升到 54 所，但仍只適合明確有專業方向的用戶。
- `school_websites.csv`：官方/手工主表只覆蓋 567 所；加上 GitHub 補充後，最終官網覆蓋已到 2714 所，但仍需持續做官方核驗。
- `province_portals.csv`：31 個省級招考入口已接，但除北京外大多還沒有分數線直達頁。

### 4.2 當前架構上仍需避免的坑

1. 眾包生活數據目前是「按學校聚合」，還不是「按校區/年級聚合」。
2. `B9` 目前混合了城市級和校區級資料；本輪只新增了 4 所有明確官方地鐵步行依據的北京高校，其餘仍需地鐵站距與本科生落點。
3. 不要把 `researchData.ts` / `campusResearch.ts` 再直接 import 回 runtime；前端只能走 `src/lib/runtimeData.ts` → `public/data/runtime/*.json`。
4. `db/schema.sql` 仍是 v2 預留，當前站點是純 SPA，別誤以為已有服務端數據校驗。

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
- 當剩餘學校 `<= 10` 時，問卷會直接結束並進結果頁，不再逼用戶做完整套題。
- 結果頁應保留「清空重來」入口。

## 6. 部署與驗證

部署前：

```bash
cd /Users/ylsuen/CF/unapply
npm run lint
npm run build
npm run audit:questions
npm run audit:data
```

部署後至少驗證：

1. `https://nope.bdfz.net/` 返回 200。
2. 首頁可進入問卷。
3. 問卷可正常進入，且當剩餘學校 `<=10` 時會直接出報告。
4. 結果頁能看到學校官網 + 省級官方招考入口。
5. 右上角色系面板可用、縮放後不遮擋內容，且刷新後保留。

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
