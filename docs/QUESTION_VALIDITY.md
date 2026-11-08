# 題目效度標準（港澳臺與海外題庫，2026-11-08 批 G6 擴充起）

站長原話：「徹底優化題目，不同地區可以不一樣，以效度為準」。

`#/global` 的題目按**目的地**分成四個題庫：香港、澳門、臺灣、海外。題庫依起點不同，因為管道只算適用你起點的那些。中國大陸題庫是原 45 題，契約另見 `MAINTENANCE_MANUAL.md` §5.3a。

一道題只有同時通過下列標準才會在某個題庫出現。引擎在 `src/engine/regionBanks.ts`（純函式、語言中立），由兩道閘門強制：

- `npm run audit:regions`（`scripts/audit_region_questions.mjs`，在 `run-gates.sh` 中）：用真實 payload 對 5 個起點 × 4 個題庫重算，任何一條不過就 exit 1。
- `npm run test:regions`（`tests/region-banks.test.ts`）：鎖定各題庫的最終題目與每條標準。

## 六條標準＋池規模

| # | 標準 | 檢查方式 |
| --- | --- | --- |
| 1 | **來源**：取值只來自 P0（官方）或 P1（權威平台，見 `authority_tiers`），不用眾包、不用推斷 | 候選題定義寫明來源與層級；有鏈接時 `tierOf(url)` 必須與定義一致 |
| 2 | **覆蓋**：題庫池中有已知取值的機構 ≥60% | `known / pool ≥ 0.6` |
| 3 | **區分力**：只保留至少劃掉 1 所、又不會單選就劃光全池的選項；去掉這兩類之後必須還有選項 | 逐選項算單選劃掉數 |
| 4 | **準確**：機器解析或人工判讀的取值必須抽樣（≥20 筆，不足則全量），與原句對照相符 ≥95%，樣本留檔 | 判讀表在 `data/research/question_validity/`；引擎只用判讀為 `confirmed` 的取值 |
| 5 | **疑罪從無**：未知取值永不劃掉，requires 題（「只想讀」）也一樣 | 未知原因碼寫在卡片上（`subjects_no_gras`、`channels_unconfirmed`、`channels_none_applicable`） |
| 6 | **題數與順序**：每個題庫最多 8 題，按「預期劃掉數 × 覆蓋率」由高到低排；題目一句話、選項簡短 | 預期劃掉數＝各選項單選劃掉數的平均 |
| — | **池規模**：題庫池少於 10 所時不出題，只列池與官方入口 | 減法沒有意義 |

另有兩條規則：

- 資格（含高考）只作標示（「校方頁面寫明接受」），永不劃掉。
- 「官方頁未讀到」永遠不是劃掉的理由。

## 目前結果（當時值，2026-11-08）

| 題庫 | 起點 | 題數 | 題目 |
| --- | --- | --- | --- |
| 海外（池 388） | 全部 | 3 | 只想讀哪些學科（GRAS 57 學科，requires）→ 哪些學科門類一定不讀（GRAS 五門類）→ 哪些國家／地區一定不去 |
| 香港（池 16） | 中國大陸 | 2 | 哪類香港院校一定不考（教資會資助／其他，官方名單 8 所）→ 哪類招生管道你不會走（只用原句 confirmed 的內地生管道，覆蓋 11/16） |
| 香港（池 16） | 港澳臺、海外 | 1 | 哪類香港院校一定不考 |
| 澳門（池 10） | 全部 | 0 | 官方公私立名單未取得；管道與 GRAS 覆蓋不足 |
| 臺灣（池 4–5） | 全部 | 0 | 池少於 10 所 |
| 中國大陸 | 非大陸起點 | 43 | 自動略過 S1、A6（`NON_MAINLAND_AUTO_SKIP`） |

逐題覆蓋、各選項劃掉數、抽樣準確率、捨棄理由：`reports/operations/nope-global-roadmap-20261107/nope-g6/validity-audit.md`。重新產生表格：

```bash
npm run -s audit:regions -- --md /path/to/tables.md
```

## 證據檔

| 檔案 | 內容 |
| --- | --- |
| `data/research/official/ugc_fund_inst.{big5,eng}.2026-11-08.html` | 教資會「資助大學」頁存檔；SHA-256 釘在 `scripts/build_question_evidence.mjs` |
| `data/research/question_validity/hk_ugc_funded.2026-11-08.csv` | 8 所官方名稱 → 院校池 id |
| `data/research/question_validity/hkmotw_channel_checks.2026-11-08.csv` | 港澳院校池 21 筆內地生管道逐筆判讀（confirmed 14／unconfirmed 6／not_bachelor 1），含原句依據 |
| `src/data/questionEvidence.ts` | 由 `npm run data:validity`（build 鏈在 `data:hkmotw` 之後）產生；fail-closed：雜湊不符、名單不是 8 所、名稱不在頁面正文、id 不在池、判讀值不合法都會停 |

## 加一道題

1. 先找 P0／P1 來源，存檔或記錄 URL 與抓取日；確認 `tierOf(url)` 是 P0／P1。
2. 在 `regionBanks.ts` 的 `CANDIDATES` 加定義：`id`、`kind`（strike／requires）、`banks`、`source`、`values(item, ctx)`（未知回 `null`）、`order`、`sampled`。
3. 如果取值經機器解析或人工判讀：在 `data/research/question_validity/` 加判讀表（≥20 筆或全量，每筆附原句依據），由 `build_question_evidence.mjs` 轉入 `questionEvidence.ts`，引擎只用 `confirmed`。
4. 三語鍵 `ui.global.q.<id>.title`／`.hint`（選項另加鍵）→ `npm run data:i18n`。
5. 依序跑 `npm run audit:regions`、`npm run test:regions`。不過的題不會出現，`audit:regions --md` 會寫出理由；把結果更新到本檔「目前結果」與 validity-audit。
6. 只在引擎外估算過的候選（例：英語總分、學費）列在 `audit_region_questions.mjs` 的 `offline`。日後資料使其覆蓋達標時，閘門會失敗，提醒重新評估。

## 年度更新

資料層（海外層、港澳臺院校池、GRAS）年度更新後，題庫會自動重算。需要人工處理的有：

- 教資會名單：重抓頁面，更新存檔與雜湊。
- 管道判讀表：重新逐筆對照原句。
- 跑 `audit:regions` 和 `test:regions`；題數變化時，更新 `tests/region-banks.test.ts` 的「最終題目」斷言與本檔。
