# 不想考的 operations

Last normalized: 2026-08-10 PDT
Owner: suen
Lifecycle: active
Data class: student_owned
Documentation status: generated from local source, Git/GitHub audit, project catalog, and live Cloudflare inventory; unresolved facts remain fail-closed.

## Quick start

- Canonical local path: `/Users/ylsuen/CF/sites/interactive/unapply`
- Git authority: `ieduer/unapply`
- Git branch: `master`; deployed source `0352320`; documentation HEAD is separately recorded by Git
- Runtime config: `unapply/wrangler.jsonc` (name `unapply`)
- Current state: [PROJECT_STATE.md](../PROJECT_STATE.md)
- Workspace resource routing: [project resource index](../../../../reports/operations/project_resource_index.md)
- Documentation standard: [project operations standard](../../../../runbooks/project_operations_documentation_standard.md)
- Production mutation is forbidden until exact owner, target, bindings, backup, verification, and rollback have fresh readback.

## Existing project documentation relationship

This `docs/OPERATIONS.md` is the single project-local operations entrypoint.
Existing detailed manuals remain authoritative annexes for their exact scope;
historical handovers and ledgers are evidence, not current state.

- [docs/MAINTENANCE_MANUAL.md](MAINTENANCE_MANUAL.md)

## Project and runtime inventory

| Project ID | Runtime type | Resource | Domains |
| --- | --- | --- | --- |
| `nope-bdfz-net` | `pages` | `unapply` | nope.bdfz.net |

Live Cloudflare matching is metadata-only and does not prove application health:

| Resource | Live type | Readback | Detail |
| --- | --- | --- | --- |
| `unapply` | Pages | verified 2026-09-08 | production branch `master`; canonical deployment `5df11243-e7b1-48b1-9c2f-902f9757f0ea` |

## Authority and dependencies

- Project names: 不想考的
- Catalog owner: suen
- Data classes: student_owned
- Identity modes: central
- User Center required: true
- Pulse measurement: zone_host
- Runtime binding: APLUS_EVIDENCE → bdfz-user-center / UnapplyAPlusEvidence; live readback 2026-09-08.
- Shared User Center, APIS, nav, image, Pulse, App, clone-family, and VPS effects must be checked through workspace topic runbooks; this file does not weaken those gates.

## Resource location and restore

- Source authority: `/Users/ylsuen/CF/sites/interactive/unapply` (`ieduer/unapply`, `master`, Direct Upload); Git/GitHub authority above.
- External/local build inputs, archived paths, receipts, retention, and hydrate commands not stated below are `review_required` and block deletion.

Catalog backup evidence:
- Cloudflare immutable Pages deployments: current=5df11243-e7b1-48b1-9c2f-902f9757f0ea (source0352320), previous=18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c (sourceaff7c2a), last pre-change release=2700a82d-1239-4918-bc54-2938a585e8f8 (source 4be095d, 2026-08-26)

Catalog restore evidence:
- restore previous code/assets by rolling back to production deployment 18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c

Before deleting any local resource, satisfy the workspace path-preserving archive, remote readback, isolated restore, receipt, handbook, and project-state gates.

## Preflight and AI ownership

1. Read `/Users/ylsuen/CF/AGENTS.md`, this file, `PROJECT_STATE.md`, and linked annexes.
2. Inspect `git -C "/Users/ylsuen/CF/sites/interactive/unapply" status --short` when Git-backed.
3. Inspect recent `reports/agent_action_log.jsonl` ownership.
4. Resolve the exact source, Worker/Pages/VPS/App target, domains, bindings, data, and rollback live.
5. Append a scoped `start` row before the first mutation.
6. Preserve unrelated dirty work; never reset, clean, broad-checkout, or stash another task's changes.

## Build, test, and local verification entrypoints

Detected package entrypoints (presence is not proof they currently pass):

- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run build`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run dev`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run lint`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run pages:deploy`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run preview`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run test:evidence`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run test:trusted`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run test:filters`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run audit:questions`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run audit:values`
- `npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run audit:data`

Data-layer entrypoints and their preconditions:

- `run data:schools` regenerates the MOE master table from `data/research/全国普通高等学校名单.xls`.
- `run data:admission` regenerates `src/data/admissionChannels.ts` from
  `data/research/admission_channels.*.csv`; it fails closed on an unknown `moeCode`,
  a school-name mismatch against the MOE table, or a missing `sourceUrl`.
- `run data:research` REQUIRES the CollegesChat desensitized questionnaire on disk:
  `git clone --depth=1 https://github.com/CollegesChat/university-information.git /tmp/university-information`.
  Without it the build now aborts instead of silently emptying the crowdsourced B-series
  layer for ~2,400 schools. `ALLOW_MISSING_CROWD_SOURCE=1` is the explicit override.
  The upstream commit is recorded in `researchPipelineMeta.inputs.collegesChatSnapshot`.
- `run data:runtime` only re-exports the generated `.ts` layers into
  `public/data/runtime/*.json`; it has no external input and is always safe to run.

Run only commands supported by the current project toolchain and verify expected outputs in the project before using them as release evidence.

## Health and business-path verification

Catalog health probes:
- curl -sS -o /dev/null -w '%{http_code}\n' https://nope.bdfz.net/ # expected 2xx/3xx

Catalog contract checks:
- jq '.projects[] | select(.project_id=="nope-bdfz-net")' platform/project_verification_evidence.json

Also verify authentication boundaries, data read/write behavior, browser/device path, monitoring, clone-family and shared-hub regressions as applicable. HTTP 200 or a build alone is insufficient.

## Preview, deployment, and rollback

Catalog deploy commands (not authorization; fresh preflight remains mandatory):
- npm --prefix "/Users/ylsuen/CF/sites/interactive/unapply" run pages:deploy

Rollback/failback authorities:
- curl -sS -X POST -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/da810f08b63347a01d3db7fd42619972/pages/projects/unapply/deployments/18a2c95b-b5dd-4fca-bbe0-71c7f6b5c73c/rollback"

For data-backed projects, immutable code rollback does not restore D1/KV/R2/DO/Queue state. Use backup/restore or backward-compatible forward-fix procedures verified for the exact resource.

## Monitoring, privacy, cost, and incidents

- Monitoring coverage: required
- Measurement: zone_host
- Never record secret values, cookies, sessions, private keys, raw student content, or sensitive payloads.
- Verify current logs, errors, cost/usage, limits, owner, stop condition, and incident runbook before representing runtime health.

## Verification standard

0. Filter-validity gates (blocking for any release that touches questions, dimensions,
   or the data pipeline): `run audit:questions`, `run audit:values`, `run audit:data`,
   `run test:filters`, `run test:evidence`, `run test:trusted`, `run lint`, `run build`.
   `audit:values` fails when a dimension enum value has zero schools in the pool and is
   not declared in `reservedValues`; that is the mechanism that used to let questionnaire
   options silently disappear from the UI.
1. Source of truth: local/Git/GitHub authority above, refreshed before mutation.
2. Health probe: catalog probes above plus expected response semantics.
3. Contract/business path: catalog checks plus auth/data/UI/device behavior.
4. Deploy and forbidden actions: catalog command above; no deploy from dirty, duplicate, reconstruction, archive, or unverified source.
5. Dependency regression: matrix fan-out, shared hubs, clone family, App/VPS as applicable.
6. Backup/restore: catalog evidence above; missing exact evidence is blocking for writes/deletion.
7. Rollback/failback: catalog authority above, refreshed live before release.
8. Last verified: 2026-09-08 — production0352320; all nine gates,69 tests, live A6 Beijing 2 / Jiangsu 3, 2919 schools, health active. Exact evidence below.

## Synchronized documentation and handoff

Any change to source authority, architecture, dependencies, runtime resources,
deployment, data, backup/restore, verification, monitoring, incidents, rollback,
or ownership must update this manual in the same task. Accepted version,
objective, blockers, deployment state, rollback anchor, and next action must
update `PROJECT_STATE.md` in the same task.

Every AI closeout must record changed files, generated artifacts, tests, live
version/deployment, rollback, dirty-tree state, unresolved follow-ups, and the
manual/state updates in `reports/agent_action_log.jsonl`. Chat is not a durable handoff.

## 2026-08-26 750 retirement

All current handoff links use `https://gk.rdfzer.com/?nope=<encoded>#advice-top`; no runtime source may link directly to 750. Verify build output, encoded context, browser navigation and the target advice panel. Rollback is the predecessor Pages deployment.


## 2026-09-08 效度審計候選（歷史：後續授權見下節）

[20260908-unapply-validity-audit 效度裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md) 是本輪驗證/阻塞/回退權威。基線HEAD 0bedd2d；當前為未提交候選，正式仍 ddbda44d/source4925d96；舊錨點2700a82d/source4be095d。全站準確性裁定不通過，雖然九個工程閘門綠。修正來源覆蓋、A6啟發式、B解析、重試及儲存白屏；A5硬資料9校，A6年度章程14校，北京排2、江蘇3。A2/E/C5資料語義與學習證據端漏省份仍阻塞發布。舊章程研究沿用，未重查14個全文；原問卷commit 0aa4c193a302dd27c4044f510f6880e9325d79b3 未變。

本輪資源全部retain_hot（suen、2026-10-08複查），報告含補丁、new-files備份、完整命令輸出與runtime manifest；無需hydration才能繼續本機維護，不刪原始問卷或既有來源。`CAPABILITY_FIT: no-new-capability`，無平台／共享契約變更。下一步按報告補資料與省份可信重算，單独取得站長部署批准。

## 2026-09-08 已授權過渡發布（歷史，已由生活證據修復取代）

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

## 2026-09-08 中山大學B9誤排確認（待修）

[原因裁定](/Users/ylsuen/CF/reports/operations/20260908-unapply-sysu-metro-check/README.md)：舊/新引擎151選項×31省共4681比較，唯一新增排除為B9步行15分鐘內。中大131條問卷中，33條過度推斷的近地鐵票變未知後，可歸一分母57→24，原有13條無地鐵票勝出；校區混票被錯當全校結論。官方2026-09-07南校园公告證實步行約5分鐘到中大站。判定為aff7c2a引入的回歸，不是新官方事實；原九閘未驗到這類語義問題。此次僅核查，未改產品或部署，現行18a2c95b/sourceaff7c2a、回滾ddbda44d/source4925d96不變。建議B9未有校區證據的眾包只展示；全池模擬硬資料1290→4、walkable排除1215→0，會觸發選項隱藏，須連同問卷資訊呈現處理。中大不加白名單，所有校區也不能一律填有地鐵。報告/evidence留熱，suen複查2026-10-08。


## 2026-09-08 生活回報適用範圍修復：串行接續檢查點

中山大學 B9 回歸已定位為匿名回報分母縮小與校區混用。全24項生活資料完成風險盤點，本地已改為未核實校區／年份的回報僅供參考，新增吉林大學2026全校宿舍空調官方補證。資料生成與型別檢查通過；回歸測試、其餘官方網址核對、九道閘門及新版部署尚未完成。當前線上仍為18a2c95b/sourceaff7c2a，也是待發布修復的回滾錨點。

依第二次上下文壓縮接續規則暫停本線程產品改動，完整範圍、授權、髒樹、暫存路徑與接續責任見 `/Users/ylsuen/CF/reports/operations/20260908-unapply-crowd-scope-repair/HANDOFF.md`。使用者已授權核查無誤後部署，不需再次徵求發布批准。這是未完成工作接續，不是驗收或發布紀錄。

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
