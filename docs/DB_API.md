# nope.bdfz.net 只讀資料庫 `/db/v1`：使用契約（路線圖 S5，2026-11-07 批 F2 起）

Owner: suen。對象：站內其他產品（path.bdfz.net、gk.rdfzer.com…）與任何想讀取的人。欄位定義在 `docs/DB_SCHEMA.md`。
本契約只承諾**讀**：沒有寫入、沒有查詢參數、沒有登入、沒有個人資料。消費端整合（path／gk 怎麼用）由各站自己的任務決定，本站不改它們的倉庫。

## 1. 端點

| 方法 | 路徑 | 內容 | 快取 |
| --- | --- | --- | --- |
| GET | `https://nope.bdfz.net/db/v1/latest.json` | 現行版本指標：`version`、`base`、`manifest`（路徑＋sha256）、各資料集路徑／筆數／sha256 | `Cache-Control: public, max-age=300` |
| GET | `https://nope.bdfz.net/db/v1/<version>/manifest.json` | 版本總表：資料集、引用檔（既有 payload 的路徑＋sha256）、輸入檔、計數 | `public, max-age=31536000, immutable` |
| GET | `https://nope.bdfz.net/db/v1/<version>/{institutions,crosswalk,channels,conditions.index,sources,validity}.json` | 六個資料集 | 同上（immutable） |
| GET | `https://nope.bdfz.net/data/…`（manifest.references 列出的檔） | 既有 payload（S1 招生專業、海外層地區檔、合作辦學詳情、港澳臺池、世界地圖、主表） | 既有（`public, max-age=0, must-revalidate`） |

同內容也在 `https://unapply.pages.dev/db/v1/…`。`/db/*` 回應帶 `Access-Control-Allow-Origin: *`、`Access-Control-Allow-Methods: GET`（瀏覽器可直接跨域 `fetch`）；設定在倉庫 `public/_headers`，只匹配 `/db/*`，不影響 `/api/learning/*` 與其他資產。資料全為公開官方資訊的索引，CORS 全開是預設（是否收窄列為站長待審項）。

## 2. 讀取方式

```js
const latest = await (await fetch('https://nope.bdfz.net/db/v1/latest.json')).json()
const manifest = await (await fetch(new URL(latest.manifest.path, 'https://nope.bdfz.net'))).json()
const institutions = await (await fetch(new URL(manifest.datasets.institutions.path, 'https://nope.bdfz.net'))).json()
// 可選：以 manifest.datasets.<名稱>.sha256 核對下載內容（Web Crypto: crypto.subtle.digest('SHA-256', bytes)）
```

- 先讀 `latest.json`，再讀版本目錄。版本目錄內容永不改，可長期快取；同一 `version` 字串永遠是同一份內容（版本＝內容雜湊）。
- 大資料（逐校招生專業、海外原文片段、合作辦學詳情）不在資料集裡：條件的 `valueRawRef.path` 指向 `manifest.references` 的檔，用 `pointer` 取片段；引用檔的 `sha256` 是**該版本建置時**的值，若既有 payload 之後被新部署更新，`latest.json` 會指向新版本。
- 實體之間用 id 連：`channels.institutionId`／`conditions.subjectId` → `institutions.id`；`*.sourceId` → `sources.id`；`crosswalk.byId[<id>]` 取同一機構在其他體系的 id（例：`moe:4111010001` ↔ `gras:RC00002`）。

## 3. 版本策略、回滾與年度切換

- `schemaVersion=1`。`/db/v1/` 只做**追加**（新欄位、新 kind／type、新資料族）；改名、刪欄、改語義一律開 `/db/v2/`，`/db/v1/` 至少保留一個年度週期並在 Status 公告。
- 每次部署只帶當前版本目錄；資料更新（含年度更新）會產生新 `version`，舊版本目錄隨新部署移除。需要固定某一版的消費者：自行快取，或從 GitHub `ieduer/unapply` 的對應提交取 `public/db/v1/<version>/`。
- **回滾**＝把 Pages 切回上一個部署：上一版的 `latest.json` 與其版本目錄就是回滾後的現行內容（舊 `version` 路徑再次可讀）；資料庫沒有獨立狀態，不需要遷移。
- 年度切換（見 `docs/ANNUAL_UPDATE.md`）：各層按日曆重抓 → 入庫 → `npm run build`（含 `data:db`）→ 閘門 → 候選 → Pages 交易 → Status。消費者看到 `latest.json.version` 變化即可重新讀取。

## 4. 欄位語義（摘要）

- **來源** `sources`：`url` 一律 https；`tier`＝P0 官方／P1 權威平台／P2 第三方（看鏈接目標是誰，不看可達性）；`status`＝最近一次抓取結果；`linkable=true` 才可渲染成鏈接（與本站同一規則），否則只顯示標題與網域並註明「官方頁本站未讀到」之類原因；`sha256`／`fetchedAt` 是抓取證據，可用來判斷頁面是否變動。
- **有效期** `validity`：`academicYear` 照來源原文；`validFrom`／`validTo` 只在來源明寫時給，**null＝未知，不是「永久有效」**；`nextReviewDue` 是本站下一次重核的預定日，過了這天還沒更新的資料要當作可能過期。
- **條件** `conditions`：`valueRaw` 是官方頁原文（不改寫）；`valueNorm` 是來源層已有的機器分類（如高考採認、IELTS 第一個分數——可能是總分或單項）；顯示時必須連同原文與來源。
- **狀態**：`blocked`／`needs_review`／`not_found` 的記錄照列（方便覆核），但不代表該機構「沒有」這項條件——是本站沒讀到。

## 5. 使用規範（引用本資料庫的產品必須遵守）

1. **不得暗示錄取可能**：任何欄位（排名、分級、可信度、條件分類、計數）都不能被呈現為錄取機率、推薦或排序依據；GRAS 名次只描述學科分佈。
2. 顯示條件或管道時附**來源與核對日**（`sources.title`／`fetchedAt` 或 `validity.reviewedAt`），只把 `linkable` 的來源做成鏈接。
3. 未讀到≠沒有：`status≠verified` 或欄位為 null 時寫「官方頁本站未讀到」或「未知」，不得推論為否定。
4. 疑罪從無：本資料庫的任何值都不應被用來替用戶「劃掉」學校，劃掉由用戶自己決定。
5. 非商業公益：沿用本站 CC BY-NC-SA 4.0；眾包層（CollegesChat）的授權同樣是 CC BY-NC-SA 4.0；機構名稱、網址與原文片段屬各來源方。
6. 不存個人資料：資料庫不含任何個人資料；消費端也不應把用戶答案寫回本站。

## 6. 穩定性與聯絡

- 欄位與 id 規則在 `/db/v1/` 內只追加；`kind`／`type` 清單可能增加，消費端遇到不認得的值應忽略而非報錯。
- 變更紀錄：Status（https://status.bdfz.net ，站點 `unapply`）；倉庫 `docs/OPERATIONS.md` 各批章節。
- 問題回報：GitHub `ieduer/unapply` issues（請勿附個人資料）。
