# 數據採集 SOP

本文檔描述 nope.bdfz.net 的數據層重建流程。原則是：教育部年度名單做主表，第三方/眾包只做增強；任何無來源或未核價字段保持空值，由篩選引擎「疑罪從無」處理。

更完整的 deep research 需求、字段格式、CSV/JSONL schema 見 `docs/DATA_RESEARCH_REQUEST.md`。

## 1. 官方學校主表

權威口徑：

- 教育部《全國高等學校名單》2025 版：<https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html>
- 截至 2025-06-20，全國高等學校 3167 所。
- 普通高等學校 2919 所：本科 1365 所，高職（專科）1554 所。
- 成人高等學校 248 所只作口徑說明，暫不進入減法主池。
- 名單不含港澳台地區高校。

重建命令：

```bash
cd /Users/ylsuen/CF/unapply
npm run data:schools
```

輸出：

- `src/data/officialSchools.ts`
- 每條保留 `moeCode`、`department`、`moeLevel`、`ownership`、`sourceUrl`、`updatedAt`。
- 生成腳本會校驗普通高校總數必須為 2919，且院校代碼不可重複。

## 2. 層次標籤

`scripts/build_official_schools.mjs` 在生成時按官方來源疊加：

- C9：9 所。
- 985：教育部「985 工程」名單。
- 211：教育部「211 工程」名單。
- 雙一流：教育部 2022 年第二輪「雙一流」建設高校名單。
- 其餘按教育部名單中的本科 / 專科分類。

軍校或不在普通高校附件中的學校不強行塞入教育部普通高校主表。若需要展示，只能在 `curatedSchools` 作額外補充，並保留來源標記。

## 3. 人工增強層

`src/data/schools.ts` 中的 `curatedSchools` 只補充官方名單不提供、且已有人工核對的字段：

- 英文名、官網。
- 主校區類型與備註。
- 少量 B/C 維度樣本。
- 兼容別名和繁簡匹配。

禁止把人工增強字段反向覆蓋官方字段：

- `moeCode`
- `department`
- `moeLevel`
- `ownership`
- `sourceUrl`
- `updatedAt`

未匹配到教育部普通高校附件的人工項只能保留在 `curatedOnlySchools` 審計清單，不進入 `schools` 篩選主池。

## 4. 生活質量眾包

CollegesChat 數據可作 B 維度增強，但必須保持來源和時間戳：

```bash
cd /Users/ylsuen/CF/unapply
mkdir -p scripts/raw
git clone https://github.com/CollegesChat/university-information scripts/raw/university-information
```

後續解析腳本應輸出 `data/research/quality_crowd.jsonl`，最小結構：

```json
{
  "schema": "unapply.qualityContribution.v1",
  "moeCode": "10001",
  "schoolName": "北京大學",
  "dimensionId": "B1",
  "value": "四人間",
  "source": {
    "type": "github",
    "title": "CollegesChat",
    "url": "https://github.com/CollegesChat/university-information",
    "date": "2026-04-21",
    "confidence": "medium"
  },
  "reviewStatus": "pending"
}
```

敏感維度或容易過時的數據不得直接入庫，需人工審核後合併。

## 5. 校區與學費

校區位置沒有統一權威結構化源，按優先級補：

1. 學校官網本科招生章程。
2. 學校官網校區介紹。
3. 地圖距離與地鐵站點只作輔助判斷。

學費：

- 教育部名單只能穩定判斷公辦、民辦、中外合作/內地與港澳合作辦學。
- 民辦/合作辦學精確金額需按當年招生章程或陽光高考專業計劃核對。
- 未核價時填 `民辦/合作待核價`，不要估算成 `1-3萬`、`3-8萬` 或 `8萬+`。

## 6. 驗證清單

每次改動數據層後至少跑：

```bash
cd /Users/ylsuen/CF/unapply
npm run data:schools
npm run audit:questions
npm run lint
npm run build
npm audit
```

部署前額外確認：

```bash
cd /Users/ylsuen/CF/unapply
npx wrangler pages project list
curl -I https://nope.bdfz.net/
```

部署成功不等於自定義域名已更新；最後必須以 `https://nope.bdfz.net/` 實際響應為準。
