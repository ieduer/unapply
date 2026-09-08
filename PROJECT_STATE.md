# Project State

Last updated: 2026-09-08 PDT
Current version: 4925d96（已部署）
Current objective: 修掉 A6 把綜合評價院校當成常規統招的誤判，並把「看起來在篩、實際沒在篩」這一類效度缺陷系統性堵住

## 本輪完成的工作

1. **A6 招生管道**（起因：學生回饋「只看綜測入學的被分在高考統招裡面了」）
   - 新增 `comprehensive_eval` 取值與 `data/research/admission_channels.*.csv` 逐省逐年數據層。
   - 考生地區升格為應用狀態，A6 逐省判定；未收錄的學校一律回到 regular 先驗。
   - 設計與查證記錄：`docs/DESIGN_A6_ADMISSION_CHANNEL.md`。
2. **眾包證據門檻**：`qualityEvidence` 貫通生成→引擎→展示；單票眾包值只展示不排除。
   官方結論不再被眾包靜默覆蓋（實測修掉 4 條 B9）。
3. **A4 學費分桶**：民辦與中外合作拆開，「公辦或民辦都行但不接受中外合作高學費」
   這個選項第一次真的能用（此前它排除 0 所，已被界面自動隱藏）。
4. **死值閘門** `npm run audit:values`：枚舉裡有、數據裡沒有的取值必須顯式聲明，
   否則構建失敗。當前 23 個聲明死值、5 個低於證據門檻。
5. **題面不再依賴動畫庫**：換題改為 key 重新掛載 + 純 CSS 進場動畫，且只動 transform。
6. **可重現性**：`data:research` 找不到 CollegesChat 原始問卷時 fail closed，
   並把上游 commit 記進 `researchPipelineMeta`。

## 驗證

- `npm run lint` / `npx tsc -b` / `npm run build`：綠。
- `npm run audit:questions`（43 題）/ `audit:values`（0 blocking）/ `audit:data`：綠。
- `npm run test:filters`（11 條）/ `test:evidence`（2 條）/ `test:trusted`（7 條）：綠。
- 本機瀏覽器實測：逐題標題正確切換；A6 省份切換即時重算（北京 160 / 安徽 159）；
  詳情頁招生管道區塊與章程外鏈正常；排除理由已是人話。
- 線上復驗（https://nope.bdfz.net，2026-09-08）：6 題標題逐題不同；
  A6 北京排除 160 / 安徽 159；結果頁查「上海科技大學」在安徽為「仍在場」、
  切到北京變「已排除」並給出「本科只走綜合評價（須另行報名+校測）」的理由。

## Known problems / Pending work

- 招生管道表已收 14 所，全部依 2026 年章程；唯一沒收錄的是西湖大學（章程確認同時有綜評與普通批，
  但逐省歸屬只寫「以各省教育考試院公布招生計劃為準」，拿不到一手依據），維持 regular 先驗。
- 章程逐年變動：2026 那輪查證推翻了兩條依 2025 章程寫的數據（上科大裸分可填、南科大新增普通批試點），
  下一個招生季必須整表重查。
- 省份字串全站用繁體（教育部主表口徑）。CSV 允許寫簡體但 build 會歸一，歸一不了直接 exit 1；
  這是實測踩出來的（簡體「江苏」讓逐省匹配整條靜默失效），測試已改為從考生地區選單取值校驗。
- A5 `separate_freshman` 與 C1-C4 仍無數據，題目/選項在界面上是隱藏的。
- A4 精確學費區間（1-3萬/3-8萬/8萬+）待 `tuition_programs.csv`。
- 眾包上游是活倉庫，本輪同時吃進了 2026-06-30 快照，值有增減屬正常。

Deployment status: 已上線。Pages deployment `ddbda44d-af57-4c7e-bc63-108188b63b88`（2026-09-08T13:15:42Z，source 4925d96）；
前一版 `7bea1ce9-6cb8-4adb-99a0-973afbb73fa2`（source 56a6439），本輪首發 `00cb3661-eb64-42a6-9371-1dbd592aacfc`（source e31a4da）
Rollback anchor: curl -sS -X POST -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/da810f08b63347a01d3db7fd42619972/pages/projects/unapply/deployments/2700a82d-1239-4918-bc54-2938a585e8f8/rollback"
Operations authority: docs/OPERATIONS.md
Ownership status: no mutation authority is implied; consult reports/agent_action_log.jsonl

## 2026-08-26 gk handoff consolidation

- Active sister-site and result handoffs now target `gk.rdfzer.com`; the duplicate 750 conversation action was removed.
- The encoded `nope` context is preserved in the gk URL before `#advice-top`.
- Live release: source `4be095d`, Pages `2700a82d-1239-4918-bc54-2938a585e8f8`.


## 2026-09-08 效度審計候選（歷史：後續授權見下節）

[20260908-unapply-validity-audit 效度裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md) 是本輪驗證/阻塞/回退權威。基線HEAD 0bedd2d；當前為未提交候選，正式仍 ddbda44d/source4925d96；舊錨點2700a82d/source4be095d。全站準確性裁定不通過，雖然九個工程閘門綠。修正來源覆蓋、A6啟發式、B解析、重試及儲存白屏；A5硬資料9校，A6年度章程14校，北京排2、江蘇3。A2/E/C5資料語義與學習證據端漏省份仍阻塞發布。舊章程研究沿用，未重查14個全文；原問卷commit 0aa4c193a302dd27c4044f510f6880e9325d79b3 未變。

本輪資源全部retain_hot（suen、2026-10-08複查），報告含補丁、new-files備份、完整命令輸出與runtime manifest；無需hydration才能繼續本機維護，不刪原始問卷或既有來源。`CAPABILITY_FIT: no-new-capability`，無平台／共享契約變更。下一步按報告補資料與省份可信重算，單独取得站長部署批准。

## 2026-09-08 已授權過渡發布（驗證進行中）

站長在效度裁定後明示「如果比現在版本更靠譜些，可以先部署一版。缺失的以後再更新」。本輪按此接受增量可靠性改善；原全站準確性未通過的裁定保留，不再將既有資料缺口視為此次過渡發布的絕對阻塞。來源覆蓋、A6 無來源誤排、B 解析與頁面容錯修正納入候選；A2/E/C5 語義、證據端逐省重算、缺少資料與完整認證讀寫驗收仍列待辦。候選不改 AnswerMap 或共享服務。

Node 權威固定 `.nvmrc` / `engines.node` = 24.18.0，使用現有安裝重跑九閘；不更新依賴。發布與讀回完成後在本節寫入新 deployment/source。當前線上仍 ddbda44d-af57-4c7e-bc63-108188b63b88 / 4925d96，為本次直接回滾錨點；更早 2700a82d / 4be095d 保留。`CAPABILITY_FIT: no-new-capability`；既有 Pages、bindings、相容日期不變。

本次發布權威：[發布驗證記錄](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-release/README.md)。原[效度審計](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md)是資料缺口與修正證據。

發布前重驗（2026-09-08）：Node 24.18.0 的九個指定閘門全部 exit 0，55 條 filters、2 條 evidence、7 條 trusted 通過。Cloudflare API 確认正式分支 master、無 Git 自動建置 source、原正式部署 ddbda44d，APLUS_EVIDENCE 綁定及相容日期與本機一致。發布入口現在於 build 後再次檢查乾淨且已推送，回報真實 commit_dirty=false。
