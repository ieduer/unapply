# Project State

Last updated: 2026-09-08 PDT
Current version: aff7c2a（已部署）
Current objective: 先發布確證改善，後續依原裁定補資料與省份證據重算；不宣稱全站準確性通過。

## 2026-09-08 已授權過渡發布（已上線）

站長在效度裁定後明示「如果比現在版本更靠譜些，可以先部署一版。缺失的以後再更新」。此次接受已確證的增量改善；原全站準確性未通過裁定保留，資料與語義缺口列為後續更新，不再作本次過渡發布的絕對阻塞。

- 正式版本：18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c / source aff7c2a56a57e02d7d9054ead7ebd3c007314c9f；完成 2026-09-08T15:10:41.514768Z，master / Direct Upload，commit_dirty=false。
- Node 權威：.nvmrc / engines.node = 24.18.0；Wrangler 4.100.0；依賴未更新。
- 九個指定閘門全部 exit 0；55 filters + 2 evidence + 7 trusted = 64 通過。build 前後均通過 scripts/git-deploy-gate.sh；39 個部署檔雜湊與驗證產物一致。
- 正式域名與 immutable URL 的 schools.json 均為 2919 校 / 2919 唯一教育部代碼，SHA256 394a1c4a0cd3ac3ab29c7810decdb84cefa674a0ca19950145e4a1cc0c097da6；runtime 02032caa77a3。
- 正式瀏覽器：31 個實際省份 option；A6 北京已劃掉2/剩2917、江蘇3/2916；詳情成功載入，pageerror=0。本機另驗證停用儲存/rAF/第三方元件、目錄與校區503後重試通過。
- A5 127份混合值中118份無來源人工預設已移除，現有校級資料9/2919、maxExcluded=3；A6 年度章程14校，北京/江蘇各少排156所啟發式猜測。B原始問卷commit 0aa4c193a302dd27c4044f510f6880e9325d79b3 未變，1839校品質資料因解析修正而變動。
- APLUS_EVIDENCE -> bdfz-user-center / UnapplyAPlusEvidence 及 compatibility_date 2026-04-20 不變。學習 health 前後均200且 receipt active，完整JSON相同；未做認證學生寫入→中央投影→重載驗收，不能由health推論完成。AnswerMap未變。
- 待辦：A2第三方城市榜單與默認值；E省級推導；C5缺項作負面證據；證據服務逐省重算未帶candidateProvince；眾包校區/年份/分母；西湖逐省、A5大一、C1–C4、精確學費資料。詳見原裁定，不為增加排除數而補猜值。
- 直接回滾：production deployment ddbda44d-af57-4c7e-bc63-108188b63b88 / source4925d96（API讀回仍可用）；更早2700a82d-1239-4918-bc54-2938a585e8f8 / 4be095d保留。回滾只切此Pages版本，無資料庫遷移。

發布、驗證、回滾與確切檔案：[20260908-unapply-validity-release](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-release/README.md)。原[效度裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md)及OPTIONS保留歷史，不改寫先前未批准的事實。CAPABILITY_FIT: no-new-capability；葉子發布，無平台/共享契約變更。

資源：專案 /Users/ylsuen/CF/sites/interactive/unapply，GitHub ieduer/unapply@master；已推送的來源與 immutable Pages deployment 為還原權威。報告與既有 dist / .wrangler / node_modules/.tmp 保留熱狀態（owner suen，複查2026-10-08）；私有manifest列確切路徑/大小，任務暫存與隔離Chrome於收尾刪除。不刪原始問卷或既有來源。重建用 Node24.18.0 的 npm run build（已有鎖定依賴）；還原源碼可在經容量/manifest核准的 absent path 用 git clone --branch master https://github.com/ieduer/unapply.git <ABSENT_PATH>，再核對 git cat-file -t aff7c2a56a57e02d7d9054ead7ebd3c007314c9f 與 package-lock.json。既有不可變上一版可直接回滾，無需hydrate。

Ownership: 發布與驗證完成；reports/agent_action_log.jsonl closeout 為交接權威。
