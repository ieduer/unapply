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

## 2026-09-08 中山大學B9誤排確認（待修）

[原因裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-sysu-metro-check/README.md)：舊/新引擎151選項×31省共4681比較，唯一新增排除為B9步行15分鐘內。中大131條問卷中，33條過度推斷的近地鐵票變未知後，可歸一分母57→24，原有13條無地鐵票勝出；校區混票被錯當全校結論。官方2026-09-07南校园公告證實步行約5分鐘到中大站。判定為aff7c2a引入的回歸，不是新官方事實；原九閘未驗到這類語義問題。此次僅核查，未改產品或部署，現行18a2c95b/sourceaff7c2a、回滾ddbda44d/source4925d96不變。建議B9未有校區證據的眾包只展示；全池模擬硬資料1290→4、walkable排除1215→0，會觸發選項隱藏，須連同問卷資訊呈現處理。中大不加白名單，所有校區也不能一律填有地鐵。報告/evidence留熱，suen複查2026-10-08。


## 2026-09-08 生活回報適用範圍修復：串行接續檢查點

中山大學 B9 回歸已定位為匿名回報分母縮小與校區混用。全24項生活資料完成風險盤點，本地已改為未核實校區／年份的回報僅供參考，新增吉林大學2026全校宿舍空調官方補證。資料生成與型別檢查通過；回歸測試、其餘官方網址核對、九道閘門及新版部署尚未完成。當前線上仍為18a2c95b/sourceaff7c2a，也是待發布修復的回滾錨點。

依第二次上下文壓縮接續規則暫停本線程產品改動，完整範圍、授權、髒樹、暫存路徑與接續責任見 `/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/HANDOFF.md`。使用者已授權核查無誤後部署，不需再次徵求發布批准。這是未完成工作接續，不是驗收或發布紀錄。


## 2026-09-08 生活證據修復候選（發布前）

單線程接續原授權。匿名生活回報只供參考，保留全分母、分布、平票與未知；B硬排除要求當年度、整校、完整選項語義及逐校官方來源。中大B9不再被混校區票數排除；吉大只確認宿舍空調，教室未知，未填「都有」。修正三校無時間證據的地鐵推定及兩個過期網址，保留B全部來源到runtime JSON。現可出題15項，B24項暫緩；結果會保留部分不符合生活偏好的學校。

九閘與60 filters + 2 evidence + 7 trusted通過；4681逐選項逐省比較無新增排除、非B無變動，Chrome本機來源/分母/31省A6/儲存與rAF禁用/目錄和校區503重試通過。最終文字與對比調整後再核對驗證產物。發布前線上18a2c95b/sourceaff7c2a不變，也是本次回滾。CAPABILITY_FIT: no-new-capability；固定Node24.18.0、Wrangler4.100.0，無新增綁定或hub/AnswerMap/RPC變更。

A2第三方城市榜單與預設、E省級推導、C5缺項作负面證據、證據服務未帶candidateProvince及真實認證寫入/中央投影/重載驗收仍未完成；原43維全面準確性未通過裁定保留。依據：`/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/`。本輪原始問卷仍為既有0aa4c193，未拉取/複製/刪除。報告與來源retain_hot供現行版本復核，owner suen、複查2026-10-08；精確資源清理見私有manifest。
