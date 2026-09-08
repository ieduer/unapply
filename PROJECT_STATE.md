# Project State

Last updated: 2026-09-08 PDT
Current version: 6ff93d0 + working tree (未部署)
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
- 瀏覽器實測：逐題標題正確切換；A6 省份切換即時重算（北京 160 / 安徽 159）；
  詳情頁招生管道區塊與章程外鏈正常；排除理由已是人話。

## Known problems / Pending work

- 招生管道表只收了 5 所，設計稿列的 15 所還剩 10 所未查章程（未收錄 = 走先驗，不誤殺）。
- A5 `separate_freshman` 與 C1-C4 仍無數據，題目/選項在界面上是隱藏的。
- A4 精確學費區間（1-3萬/3-8萬/8萬+）待 `tuition_programs.csv`。
- 眾包上游是活倉庫，本輪同時吃進了 2026-06-30 快照，值有增減屬正常。

Deployment status: 尚未部署；線上仍是舊版本
Rollback anchor: curl -sS -X POST -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/da810f08b63347a01d3db7fd42619972/pages/projects/unapply/deployments/2700a82d-1239-4918-bc54-2938a585e8f8/rollback"
Operations authority: docs/OPERATIONS.md
Ownership status: no mutation authority is implied; consult reports/agent_action_log.jsonl

## 2026-08-26 gk handoff consolidation

- Active sister-site and result handoffs now target `gk.rdfzer.com`; the duplicate 750 conversation action was removed.
- The encoded `nope` context is preserved in the gk URL before `#advice-top`.
- Live release: source `4be095d`, Pages `2700a82d-1239-4918-bc54-2938a585e8f8`.
