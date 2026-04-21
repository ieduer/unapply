# nope.bdfz.net 數據研究需求（v1）

目標：把「你一定不考」從可用問卷升級為可信數據產品。所有資料都要能回答兩個問題：

1. 這條數據能否改變某一題的篩選結果？
2. 用戶/維護者能否追溯到來源、年份、適用範圍和可信度？

本站目前主表已使用教育部 2025 年普通高校 2919 所名單。後續 deep research 不應重新造學校全集，應補齊校區、學費、生活質量、專業/學科、招生來源、就業升學等增強層。

## 1. 來源優先級

| 優先級 | 來源 | 可入庫用途 | 備註 |
| --- | --- | --- | --- |
| P0 | 教育部、學位中心、陽光高考、各省教育考試院 | 學校全集、層次、學科評估、招生計劃 | 必須保留原始 URL、發布日期、附件名 |
| P1 | 學校官網、招生章程、就業質量報告、信息公開網 | 校區、學費、專業、就業、保研、轉專業 | 以年度為單位，不能跨年臆推 |
| P2 | 政府/行業公開數據，如生態環境部、中國氣象局、城軌協會、民政部 | 地理、氣候、交通、行政區劃 | 可做客觀推導，但要記錄推導規則 |
| P3 | GitHub/開放數據，如 CollegesChat、Chinese_Universities、cn-university-geocoder | 生活質量、別名、官網、校區底稿、輔助校驗 | 只作增強層；需標註 license 和抓取日期 |
| P4 | 用戶貢獻、在讀學生/校友 | 生活體驗、校區細節、管理規則 | 入庫前需人工審核；敏感/負面項需公開證據 |

已確認可用入口：

- 教育部 2025 全國高等學校名單：<https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html>
- 陽光高考：<https://gaokao.chsi.com.cn/>
- 學位中心學科評估：<https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/>
- 第二輪雙一流：<https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html>
- 985 工程名單：<https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html>
- 211 工程名單：<https://www.moe.gov.cn/srcsite/A22/s7065/200512/t20051223_82762.html>
- CollegesChat university-information：<https://github.com/CollegesChat/university-information>
- Chinese_Universities：<https://github.com/xioajiumi/Chinese_Universities>
- cn-university-geocoder：<https://github.com/Naptie/cn-university-geocoder>
- china-university-database：<https://github.com/ZsTs119/china-university-database>
- The-Location-Data-of-Schools-in-China：<https://github.com/pg7go/The-Location-Data-of-Schools-in-China>
- GaoHR 全國大學基本信息：<https://gaohr.win/site/blogs/2022/2022-03-27-university-of-china.html>
- HCU（高校沿革輔助校驗）：<https://github.com/jtchen2k/hcu>
- ramwin/china-public-data（2017 舊教育部名單，僅供歷史參考）：<https://github.com/ramwin/china-public-data/tree/master/%E5%85%A8%E5%9B%BD%E6%99%AE%E9%80%9A%E9%AB%98%E7%AD%89%E5%AD%A6%E6%A0%A1%E5%90%8D%E5%8D%95>
- 北京教育考試院高考高招：<https://www.bjeea.cn/html/gkgz/index.html>
- 北京教育考試院高招計劃查詢：<https://query.bjeea.cn/queryService/rest/plan/115>
- 北京教育考試院錄取統計查詢（2022-2024）：<https://gk-stu.bjeea.cn/#/app/volunteer-coach/query>

## 2. 必需數據包

把資料放到 `data/research/`，文件名使用下面約定。CSV 用 UTF-8，字段名固定英文；JSONL 每行一個 JSON 對象。

### 2.1 `campus_locations.csv`（P1）

用途：支撐 A5「校區位置」和 B9「校區地鐵距離」。這是當前價值最高的缺口，因為很多學校名義在主城，實際本科低年級在遠郊或分校。

必填字段：

```csv
moeCode,schoolName,campusName,campusAddress,province,city,district,lat,lng,undergraduateScope,freshmanOnly,mainCampusType,nearestMetroStation,metroDistanceKm,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `moeCode`：教育部院校代碼，必須和 `src/data/officialSchools.ts` 對得上。
- `undergraduateScope`：`all_undergraduate` / `some_major` / `freshman_only` / `graduate_only` / `unknown`。
- `freshmanOnly`：`yes` / `no` / `unknown`。
- `mainCampusType`：`main_city` / `suburb_with_metro` / `suburb` / `separate_freshman`。
- `metroDistanceKm`：校門或主要教學區到最近已開通地鐵站步行距離，數字，未知留空。
- `confidence`：`high` / `medium` / `low`。

推薦來源順序：招生章程、學校校區介紹、學校地圖、官方地圖/地鐵站點。

若暫時只能做「學校級且可安全入硬篩選」的結論，先另外提交：

### 2.1a `campus_official_overrides.csv`（P1）

用途：只收能直接進 A5/B9 硬篩選的官方校級結論，避免把 `campus_locations.csv` 的展示底稿直接誤當真值。

必填字段：

```csv
moeCode,schoolName,campusName,mainCampusType,freshmanOnly,b9Value,nearestMetroStation,metroDistanceKm,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

入庫要求：

- 必須是學校官方頁、招生章程、校區介紹或官方交通頁。
- 只收「足夠清楚且不會誤殺」的條目；有專業分流、年級分流或多校區口徑不清的，不要硬填。
- `mainCampusType` / `b9Value` 只要有一項拿不準，就留空，等 full deep research 後再補。

### 2.2 `school_websites.csv`（P1）

用途：結果頁和詳情頁展示「學校官網」。鏈接本身必須是學校官方域名，不接受第三方院校導航站。

必填字段：

```csv
moeCode,schoolName,website,admissionWebsite,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `website`：學校官網首頁。
- `admissionWebsite`：本科招生網；沒有則留空。
- `sourceUrl`：優先填學校官網或陽光高考院校庫中展示該域名的頁面。

### 2.3 `tuition_programs.csv`（P1）

用途：支撐 A4「學費上限」。目前只能可靠區分公辦/民辦/合作待核價；精確金額需要逐校逐專業補。

必填字段：

```csv
moeCode,schoolName,year,provincePlan,majorCode,majorName,programType,tuitionCnyPerYear,tuitionBand,accommodationCnyPerYear,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `year`：招生年份，如 `2025`。
- `provincePlan`：招生省份；如只拿到全國章程填 `all`。
- `programType`：`public_regular` / `private` / `sino_foreign` / `mainland_hk_mo` / `other_coop`。
- `tuitionBand`：`公辦` / `1-3萬` / `3-8萬` / `8萬+` / `民辦/合作待核價`。

### 2.4 `discipline_eval.csv`（P2）

用途：支撐 C5「學科評估 / 王牌專業」。只接受學位中心公開結果；第五輪若無完整公開，不可補「網傳」。

必填字段：

```csv
moeCode,schoolName,disciplineCode,disciplineName,evaluationRound,grade,sourceTitle,sourceUrl,sourceDate,notes
```

取值規則：

- `evaluationRound`：`4` / `5`。
- `grade`：`A+` / `A` / `A-` / `B+` / `B` / `B-` / `C+` / `C` / `C-`。
- `disciplineCode`：按學科評估學科代碼；沒有代碼時先留空但保留學科中文名。

### 2.5 `admission_origin.csv`（P2）

用途：支撐 C4「外省人友好度」。需要按年份和招生省份計算，不能用單一年份個案泛化。

必填字段：

```csv
moeCode,schoolName,year,originProvince,planCount,totalPlanCount,outOfProvinceRatio,sourceTitle,sourceUrl,sourceDate,notes
```

計算規則：

- `totalPlanCount`：該校當年普通本科/專科招生總計劃數。
- `outOfProvinceRatio`：`1 - 本省計劃數 / totalPlanCount`。
- 若只採集部分省份，`totalPlanCount` 留空，不要計算比例。

### 2.6 `employment_postgrad.csv`（P2）

用途：未來新增「就業/升學/保研/出國」題。目前不進篩選，先作研究字段。

必填字段：

```csv
moeCode,schoolName,year,degreeLevel,employmentRate,postgradRate,recommendGradRate,overseasRate,topEmployerNotes,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `degreeLevel`：`undergraduate` / `associate` / `graduate` / `all`。
- 比率用 0-1 小數，如 `0.187`。
- 若報告只給「畢業去向落實率」，填 `employmentRate` 並在 `notes` 說明口徑。

### 2.7 `transfer_policies.csv`（P2）

用途：未來新增「轉專業/培養自由度」題。這是志願決策的關鍵點，但來源高度分散。

必填字段：

```csv
moeCode,schoolName,year,transferAllowed,gpaRequirement,majorRestriction,quotaPolicy,examInterviewRequired,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `transferAllowed`：`open` / `limited` / `strict` / `unknown`。
- `majorRestriction`：簡述是否禁止跨學科、醫學/師範/中外合作等是否限制。
- `quotaPolicy`：百分比或文字，沒有明確配額留空。

### 2.8 `province_portals.csv`（P1）

用途：給不同地區考生提供本省官方錄取人數/分數線查詢入口。

必填字段：

```csv
candidateProvince,authorityName,portalUrl,scoreQueryUrl,planQueryUrl,sourceTitle,sourceUrl,sourceDate,confidence,notes
```

取值規則：

- `portalUrl`：省級教育考試院/招生考試信息網首頁。
- `scoreQueryUrl`：能直達院校往年錄取分數/位次查詢的官方頁；若沒有直鏈留空。
- `planQueryUrl`：能查招生計劃/專業組/專業錄取的官方頁；若沒有留空。
- 北京已知樣例：`https://gk-stu.bjeea.cn/#/app/volunteer-coach/query`

### 2.9 `quality_crowd.jsonl`（P1）

用途：匯總 CollegesChat、GitHub、用戶貢獻和人工核驗的 B/C 生活體驗字段。

每行格式：

```json
{
  "schema": "unapply.qualityContribution.v1",
  "moeCode": "10001",
  "schoolName": "北京大學",
  "dimensionId": "B1",
  "dimensionLabel": "宿舍格局",
  "value": "上床下桌",
  "scope": {
    "campus": "燕園校區",
    "major": "全校",
    "grade": "2023級",
    "sampleSize": "3人一致"
  },
  "source": {
    "type": "student",
    "title": "2023級在讀學生反饋",
    "url": "",
    "date": "2024-09",
    "confidence": "medium"
  },
  "evidence": "限本科新生宿舍；研究生宿舍另算。",
  "license": "CC BY-NC-SA 4.0",
  "reviewStatus": "pending"
}
```

`dimensionId` 可用既有 A/B/C 維度，也可用 `custom`。若 `custom`，必須增加：

```json
{
  "customCategory": "employment",
  "customMetric": "本科保研率"
}
```

## 3. 題目與數據映射核對

| 題目組 | 當前狀態 | 必要補強 |
| --- | --- | --- |
| A1 省份 | 已由教育部主表覆蓋 | 每年更新教育部附件即可 |
| A2 城市等級 | 可用但屬混合映射 | 需保留新一線榜單年份；二線/三線規則需文檔化 |
| A3 層次 | 已由 985/211/雙一流/本科專科覆蓋 | C9、985、211、雙一流名單需年度核對 |
| A4 學費 | 公辦/民辦可用，精確學費缺口大 | 補 `tuition_programs.csv` |
| A5 校區 | 當前覆蓋不足 | 補 `campus_locations.csv`，優先 985/211/雙一流和熱門民辦/合作 |
| E1-E8 環境 | 可用，但城市/省份級，不是校園級 | 保留推導規則；B9 再做校區級交通 |
| B1-B24 生活 | 問題覆蓋較全面，但數據覆蓋不足 | 補 `quality_crowd.jsonl`；每條要有範圍和來源 |
| C1-C3 特殊支持/友好度 | 可作柔性篩選，不能硬貼標籤 | 敏感/負面項必須公開證據 |
| C4 生源多樣性 | 邏輯合理，數據缺口大 | 補 `admission_origin.csv` |
| C5 學科評估 | 問題關鍵，當前只適合有專業方向者 | 補 `discipline_eval.csv`；第五輪未完整公開前用第四輪 |

當某維度缺失時，篩選引擎維持「疑罪從無」：不排除該校。這意味著數據越全面，網站越有價值；但不允許用猜測填空。

## 4. Deep Research 交付要求

每次交付至少包含：

1. 原始來源 URL 列表。
2. 抓取日期和資料發布日期。
3. 一個或多個 `data/research/*.csv` / `*.jsonl` 文件。
4. 字段口徑說明，尤其是比例、距離、校區、年份。
5. 無法核驗或存在衝突的條目單獨列出，不要混進主表。

文件命名建議：

```text
data/research/
  campus_locations.2026-04-21.csv
  tuition_programs.2026-04-21.csv
  school_websites.2026-04-21.csv
  discipline_eval.4th.csv
  admission_origin.2025.csv
  employment_postgrad.2024.csv
  transfer_policies.2025.csv
  province_portals.2026-04-21.csv
  quality_crowd.2026-04-21.jsonl
```
