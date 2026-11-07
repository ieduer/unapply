# 不想考的 operations

Last normalized: 2026-10-03 PDT
Owner: suen
Lifecycle: active
Data class: student_owned
Documentation status: generated from local source, Git/GitHub audit, project catalog, and live Cloudflare inventory; unresolved facts remain fail-closed.

## Quick start

- Canonical local path: `/Users/ylsuen/CF/sites/interactive/unapply`
- Git authority: `ieduer/unapply`
- Git branch: `master`; deployed source `df6c782`; documentation HEAD is separately recorded by Git
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
| `unapply` | Pages | verified 2026-11-07 | production branch `master`; canonical deployment `c26a1b75-ae96-47f9-8dd8-7c2d931cf423` (source `df6c782`) |

## Authority and dependencies

- Project names: 不想考的
- Catalog owner: suen
- Data classes: student_owned
- Identity modes: central
- User Center required: true
- Pulse measurement: zone_host
- Runtime binding: APLUS_EVIDENCE → bdfz-user-center / UnapplyAPlusEvidence; live readback 2026-10-03.
- Shared User Center, APIS, nav, image, Pulse, App, clone-family, and VPS effects must be checked through workspace topic runbooks; this file does not weaken those gates.

## Resource location and restore

- Source authority: `/Users/ylsuen/CF/sites/interactive/unapply` (`ieduer/unapply`, `master`, Direct Upload); Git/GitHub authority above.
- External/local build inputs, archived paths, receipts, retention, and hydrate commands not stated below are `review_required` and block deletion.

Catalog backup evidence:
- Cloudflare immutable Pages deployments: current=c26a1b75-ae96-47f9-8dd8-7c2d931cf423 (source df6c782, batch D1), previous=b3e0f4c8-4fe5-4e83-863f-476cd41ce836 (source 5b18cd1, batch C), earlier=8cb266cb-2eb2-409d-915b-a90a28447448 (source ccf1770), 021e1a3d-164b-408b-a2af-fcec41712d31 (source 6b70522), 7aa5e5b5-345e-403b-8cd6-d3d0076178d1 (source 2e79f9b), 0ec6d42f-3b93-4859-bd22-813e7f000c3e (source d4ae514), d7a7924d-dfa2-49b8-ae19-52054b56266c (source 6fa8a4e), 84a4afd1-0602-4c1c-af4c-d5173c94da94 (source f2aa606), 321e6e06-3841-4e8c-b218-ab37924dffb4 (source 0b02a20), 94090cd4-d483-4782-abfc-0146f7bc96d8 (source c6c0410), 7a066074-c3ac-4efc-979c-f65f583f40df (source 74f225e, MOE 2026 with old palette), 5df11243-e7b1-48b1-9c2f-902f9757f0ea (source 0352320, MOE 2025)

Catalog restore evidence:
- restore previous code/assets by rolling back to production deployment b3e0f4c8-4fe5-4e83-863f-476cd41ce836 (source 5b18cd1)

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

- `run data:schools` regenerates the MOE master table from the pinned official attachment `data/research/moe_ordinary_schools.2026-06-17.xls` (SHA-256 and expected counts in the `CATALOG` block of `scripts/build_official_schools.mjs`; falls back to the MOE site only when the pinned file is absent).
- `run data:admission` regenerates `src/data/admissionChannels.ts` from
  `data/research/admission_channels.*.csv`; it fails closed on an unknown `moeCode`,
  a school-name mismatch against the MOE table, or a missing `sourceUrl`.
- `run data:research` REQUIRES the CollegesChat desensitized questionnaire on disk:
  `git clone --depth=1 https://github.com/CollegesChat/university-information.git /tmp/university-information`.
  The builder reads `data/v1.csv` + `data/v1.additions.csv` (upstream layout since 2026-09) and still accepts the
  older `questionnaires/results_desensitized.csv`.
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
- Reviewed rollback transaction under `runbooks/release_authority_governance.md` to deployment `b3e0f4c8-4fe5-4e83-863f-476cd41ce836` (source `5b18cd1`), after a fresh live baseline readback (rolls back batch D1: the seven-province programs payload goes back to the four-province one and the 13 institution websites disappear; S1/S2 questions, the two-tier payload and the Function stay). Direct API rollback without a registered transaction is not release authority.

For data-backed projects, immutable code rollback does not restore D1/KV/R2/DO/Queue state. Use backup/restore or backward-compatible forward-fix procedures verified for the exact resource.

## Monitoring, privacy, cost, and incidents

- Monitoring coverage: required
- Measurement: zone_host
- Never record secret values, cookies, sessions, private keys, raw student content, or sensitive payloads.
- Verify current logs, errors, cost/usage, limits, owner, stop condition, and incident runbook before representing runtime health.

## Verification standard

0. Filter-validity gates (blocking for any release that touches questions, dimensions,
   or the data pipeline): `run audit:questions`, `run audit:values`, `run audit:data`,
   `run test:filters`, `run test:evidence`, `run test:trusted`, `run test:theme`, `run test:atlas`, `run test:s1`, `run check:shared-ui`, `run lint`, `run build`
   （`build` 會先跑 `data:runtime`、`data:atlas` 與 `data:programs`；`test:atlas` 檢查世界學科地圖 payload 與減法引擎；`test:s1` 檢查專業／選考 payload 與起點條件引擎）.
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
8. Last verified: 2026-11-07 — production df6c782 (batch D1); twelve gates on the release commit, 74 of 74 assets on candidate, custom and immutable hosts, signed-out real path (S1 物生政 26 struck, +计算机类 169 struck / 2783 kept; 河北民族师范学院 detail from the three new provinces; 内蒙古农业大学 conflict labels; #/world), health active. Exact evidence below.

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


<!-- fleet-authority-20261001:sites--interactive--unapply -->
## 2026-10-01 本機／GitHub／Cloudflare 核對

本項目的[逐項核對與來源邊界](/Users/ylsuen/CF/reports/operations/fleet-git-repair-20261001/projects/sites--interactive--unapply.md)列出本機分支、GitHub 上游、Cloudflare 實際部署、既有接受來源及未解決條件。本節是運維索引；保留原有操作／驗收／資料回退權威，不把保全分支或中繼資料讀回當成發布接受。


## 2026-10-03 教育部 2026 名單與眾包快照更新（歷史；發布流程與數據說明仍適用）

正式部署 `7a066074-c3ac-4efc-979c-f65f583f40df`，來源 `74f225ed4df1488e56d0ab65944bac59787e49b7`，生效 `2026-10-03T12:40:33Z`，Direct Upload/master/commit_dirty=false；runtime `e4a56a351c2e`。通道 `nope-bdfz-net` 經位元組對帳由 `managed` 轉為 `accepted`，發布走登記的一次性 Pages 交易（`scripts/release-pages-transaction.mjs`）。

發布流程（之後照做）：乾淨且已推送的提交 → Node 24.18.0 九閘 → `npm run build` → 上傳到 Pages 的 `candidate` 預覽分支 → 候選逐檔比對與真實路徑驗收 → 登記 `preview_verified` 收據（租期不超過一小時）→ 在倉庫根目錄執行交易 → 正式站逐檔比對、健康檢查、瀏覽器流程 → 更新接受版本 → 發布 Status 紀錄。不要直接跑 `npm run pages:deploy`：它會被部署閘擋下。

學校主池 2,952 所（本科 1,412／高職專科 1,540）；官方附件原檔與同碼舊校名別名表已入庫；眾包快照 `9f6328d`，覆蓋 2,406 所／45,135 筆，仍只供參考。篩選規則、AnswerMap、Function、`APLUS_EVIDENCE → bdfz-user-center/UnapplyAPlusEvidence`、compatibility_date 2026-04-20 均未變。換年度步驟見 `docs/MAINTENANCE_MANUAL.md` §3.1。

正式域名與不可變 URL 的 schools.json SHA256 `7b517c6cdcfb5b9e82ae5083718cd8d8d75af51e0b4f79d07f8649ecb585f80e`。回滾：`5df11243-e7b1-48b1-9c2f-902f9757f0ea`／來源 `0352320`，走新的受審回滾交易；只切 Pages 版本，無資料庫遷移。

未驗證：已登入學生寫入 → User Center 投影 → 重載。既有資料缺口不變（見 PROJECT_STATE）。資源：原始問卷 clone 為可重建暫存，收尾刪除；報告與私密收據留熱，複查 2026-11-03。

發布、驗證、回滾與證據：`/Users/ylsuen/CF/reports/operations/path-nope-refresh-20261003/RELEASE.md`。CAPABILITY_FIT: no-new-capability；葉子發布，無平台/共享契約變更。


## 2026-10-03 可讀色系與共用模板（歷史；模板規則仍適用）

正式部署 `321e6e06-3841-4e8c-b218-ab37924dffb4`，來源 `0b02a2009ac906d13802c03f0a1e046b8c5ed467`，生效 `2026-10-03T15:09:45Z`；上一版 `94090cd4`／`c6c0410`。

**跨倉庫依賴（新）**：`src/shared-ui/`（`theme.css`、`theme.ts`、`ThemeCustomizer.tsx`、`SyncNotice.tsx`）、`tests/theme-contrast.test.ts`、`scripts/check_shared_ui.mjs` 與 `ieduer/minus-life`（path.bdfz.net）逐位元組相同。改共用檔的步驟見 `docs/MAINTENANCE_MANUAL.md` §5.1；只發一站會讓另一站的閘門在下次發布時失敗。

色系只有「紙色」「墨色」。`test:theme` 是閘門：文字色對畫布／卡片底 ≥ 4.5:1、按鈕文字 ≥ 4.5:1、選項邊框 ≥ 3:1、元件不得用 `opacity-*` 或小於 12px 的字。

回滾：`94090cd4-d483-4782-abfc-0146f7bc96d8`／`c6c0410`，走新的受審回滾交易。學校數據、篩選規則、Function、binding 未變。

發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/shared-readable-theme-20261003/RELEASE.md`。CAPABILITY_FIT: no-new-capability。


## 2026-10-23 學習記錄同步提示修復（歷史；失敗分類與發布流程補充仍適用）

正式部署 `84a4afd1-0602-4c1c-af4c-d5173c94da94`，來源 `f2aa6068fa63ff50df029e3b7b85dee0338f7a61`，生效 `2026-10-23T14:13:18Z`；回滾 `321e6e06-3841-4e8c-b218-ab37924dffb4`／`0b02a20`，走新的受審回滾交易；只切 Pages 版本，無資料庫遷移。

**同步客戶端的失敗分類（`src/lib/trustedAPlus.ts`）**：401 表示未登入，清掉隊列、回 idle、不顯示提示，本頁之後不再排隊；408／429 以外的 4xx 是確定性拒絕，清掉隊列並只提示一次；網路錯誤與 5xx 保留隊列，下次重新向伺服器取會話與序號（`startPromise` 失敗後清空）。全跳過的結果不送完成紀錄。新增錯誤碼時要先決定它屬於哪一類，不能讓不可能成功的請求留在隊列裡。

**Function（`functions/api/learning/[action].ts`）**：`complete` 接受選填 `candidateProvince`（限 `candidateProvinceOptions`），用它重算覆蓋與篩選，與前端判斷一致；UC 丟出 `authenticated User Center session required` 時回 401 `authentication_required`。送給 UC 的完成摘要欄位與證據描述符未變。

**發布流程補充**：`release-pages-transaction.mjs` 要求收據帶 `http_budget.max_requests`（本次 40，實用 11）；每個收據路徑只能建一份 HTTP 日誌，被閘門擋下後要重跑時用同一份已登記位元組的副本路徑。交易若報「Catalog changed」，先證明 `platform/projects.json` 的變動來自哪個已批准任務（只還原那一項後雜湊等於原釘值），再改釘 `catalog_sha256`。

驗證：Node 24.18.0 十道閘門（含 test:trusted 14、test:theme 9、check:shared-ui）、候選與正式 39/39 逐檔一致、候選未登入路徑無提示、正式站登入路徑「同步核验中→已核验」且 complete 200。發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/nope-sync-notice-20261023/RELEASE.md`。Status `20261023-nope-sync-notice-fix` r1。CAPABILITY_FIT: no-new-capability；葉子發布，無平台／共享契約變更。

## 2026-10-23 已完成者再作答無限重送修復（已上線，當前權威）

正式部署 `d7a7924d-dfa2-49b8-ae19-52054b56266c`，來源 `6fa8a4e00e36a23090544995133d51e693ee1955`，生效 `2026-10-23T15:00:29Z`；上一版 `84a4afd1`／`f2aa606`。與 path `fb4b95b`（`8771ae93`）同一修法、先後發布。

**原因**：UC 對本學年已完成的使用者，start 一律回傳那個已完成的會話（`alreadyCompleted: true`），互動回 `ok`、`completed: true`、序號維持儲存值。客戶端把不前進的序號當成伺服器序號，項目仍算「未送」，`resumeUnapplyAPlusRecovery` 無限遞迴，每題約每 260 ms 重送一次，提示停在「同步核验中」。影響 35 人（UC 2026-2027 completed）。

**修法（只改 `src/lib/trustedAPlus.ts`）**：在上面的失敗分類之外加一類「伺服器已完成」——start 的 `alreadyCompleted`，或互動的 `completed`／`alreadyRecorded`，這個會話視為終結：清掉排隊的作答與完成紀錄、不送出，排著完成紀錄時顯示「已核验」，否則 idle；同一頁之後的作答不再發請求，「清空重來」後重新問一次 start。互動回 `ok` 但序號沒前進時當成一次性拒絕（409）。Function、學校數據、篩選規則、`src/shared-ui/`、binding、證據描述符與 UC 契約未變。

`tests/trusted-aplus-client-recovery.test.ts` 的三項回歸測試用「第 50 次互動請求後拋錯」把舊版的無限迴圈變成有界失敗；改 client 時必須保持通過。

驗證：Node 24.18.0 十道閘門（test:trusted 17、test:filters 60）、候選與正式 39/39 逐檔一致、候選上以 UC 已完成會話形狀的存根跑真實建置包（1 次 start、0 次 interaction）、正式站已登入測試帳號（本學年已完成）再作答到結果頁只有 1 次 start、0 次 interaction／complete，最後「已核验」。回滾：`84a4afd1-0602-4c1c-af4c-d5173c94da94`／`f2aa606`，走新的受審回滾交易（會恢復無限重送）。

發布、驗證與證據：`/Users/ylsuen/CF/reports/operations/aplus-repeat-loop-20261023/RELEASE.md`。Status `20261023-nope-repeat-completion-loop-fix` r1。CAPABILITY_FIT: no-new-capability；葉子發布，無平台／共享契約變更。


## 2026-11-06 全球化立項與第一階段世界學科地圖（歷史；資料層、閘門與發布流程仍適用）

**範圍**：站長 2026-11-06 口述的最終目標寫入 `docs/GLOBAL_ROADMAP.md`（S0–S5 分階段、資料權威分級、跨國規則、
企業直招高中生橫切層）。S0 已在本機實作：首頁「第 0 題 · 你在哪裡升學」起點選擇（中國大陸／香港／澳門／臺灣／其他，
存 `unapply.origin.v1`，不進 AnswerMap）；`#/world` 世界學科地圖（軟科 GRAS 2026 57 學科、每科前 10／25／50，
Equal Earth 投影、只畫陸地）與門類／學科／地區減法；「非大學路徑」圖層 10 條企業直招高中生計劃；About 補來源與路線圖；
結果頁加入口。43 題、篩選引擎、Function、AnswerMap、`APLUS_EVIDENCE`、`src/shared-ui` 均未變；無新依賴。

**新資料層與閘門**：`data/research/gras_2026_subjects.csv`、`gras_2026_top50.csv`（`npm run data:gras`）、
`gras_institutions_geo.2026-11-06.csv`（`npm run data:gras-geo`：139 所大陸機構用教育部校名＋校區底稿座標、385 Wikidata 標籤、
12 Wikidata 搜尋、8 人工）、`direct_hire_programs.2026-11-06.csv`（人工）、`ne_110m_land.geojson`（Natural Earth 公有領域）
→ `npm run data:atlas` → `public/data/atlas/world-atlas.json`（237 KiB，懶載入）＋ `src/data/worldAtlasManifest.ts`。
`npm run test:atlas` 為新閘門；`build` 先跑 `data:atlas`。年度更新步驟：`docs/MAINTENANCE_MANUAL.md` §3.3。

**驗證（Node 24.18.0）**：audit:questions／values／data 通過；test:filters 60、test:evidence 2、test:trusted 17、test:theme 9、
test:atlas 10 全過；check:shared-ui 6 檔一致；lint、tsc、build 通過（主包 357.7 kB，`WorldAtlasPage` 獨立分塊 21.8 kB）。
本機 Vite 內建瀏覽器：首頁起點切換與按鈕互換、`#/world` 載入 195 點／570 席位、劃掉工學 → 135 所／320 席位、
劃掉美國 → 82 所／141 席位且美國點改虛線、選清華顯示席位並有「看本站學校詳情」、企業直招圖層 10 菱形＋10 卡；
逐路由文字對比度量測（`/`、`#/world`、`#/about`，紙色與墨色，桌面 964–1440 與手機 390）新增低對比項 0、最低 6.27:1、最小字 12px、
無橫向溢出。未做：候選預覽上傳與正式站比對、已登入學生路徑（本輪不改 A+ 契約）。

**權威鏈接核查（站長同日追加）**：`npm run data:gras-websites`（`scripts/verify_institution_websites.mjs`）：候選來自軟科機構頁、Wikidata P856、教育部主表，逐條實際 GET；
兩個獨立來源同網域且連通＝high、同網域但被反爬擋＝medium、單一軟科／教育部來源連通＝medium，其餘不收。544 所中 531 所有官網（high 431、medium 100）。
機構面板顯示「學校官網 ↗」（title 寫核查依據與日期）；每個學科席位連到軟科該學科排名頁。另有正體字形覆寫表 `gras_institution_names_zh_hant.<日期>.csv`（唯一一筆：普林斯頓大學）。

**發布（站長回覆「推送並發布」）**：正式部署 `0ec6d42f-3b93-4859-bd22-813e7f000c3e`，來源 `d4ae5141bd04a0024a4054f2e4bf16c20cace891`（`ieduer/unapply@master`），
生效 `2026-11-06T22:50:51Z`；候選預覽 `dc57a019-1768-4017-bd75-452bdb8b7d1e`；change `20261106-nope-global-atlas-s0` 已消費（HTTP 預算 40，實用 10）。
十一道閘門在發布提交上全過（`nope/check.txt`）；候選、正式自訂網域、不可變網址 41/41 檔逐檔一致；正式站未登入真實路徑：首頁起點 5 選項、
`#/world` 195 所／570 席位 → 劃掉美國 139 所／351 席位（56 點虛線）、普林斯頓面板有官網與學科鏈接、企業直招圖層 10；health active；主控台無錯誤。
回滾：`d7a7924d-dfa2-49b8-ae19-52054b56266c`／`6fa8a4e`，走新的受審回滾交易；只切 Pages 版本，無資料庫遷移。Status `20261106-nope-global-atlas-s0` r1（new）。
CAPABILITY_FIT: no-new-capability（靜態 JSON，無新 Cloudflare 能力；Function、binding 未變）。

**未驗證**：已登入學生的 A+ 證據路徑（本次未改，最近一次登入實測 2026-10-23）。

報告：`/Users/ylsuen/CF/reports/operations/nope-global-atlas-20261106/REPORT.md`。

## 2026-11-07 S1 首批：起點條件（選考科目／意向專業）與雙一流招生專業（已上線；修正批 A 疊加於其上）

**授權**：站長 2026-11-07 在主會話回覆「入庫實作，依據最終goal繼續推進。」（由主會話轉達本側會話），涵蓋入庫、實作與本版正式發布；付費資源仍須另行申請。

**範圍**：資料層入庫（`66c82c3`）＋產品實作（`2e79f9b`，發布提交）。首頁新增「起點條件 · 選填」：選滿 3 門選考科目、
或從教育部《本科專業目錄（2026 年）》選專業類／具體專業（`StartConditions`，存 `unapply.programPrefs.v1`，不進 AnswerMap）。
`src/engine/programs.ts` 在 `filterSchools` 之後另算一層：有資料的學校若在意向專業類無任何招生專業、或在選科下無一可報就劃掉；
無資料的學校保留；只有試驗班對不到專業類的「不判定」保留。結果頁分開顯示與計數（不進 `stats.byQuestion`；A+ 證據與分享圖仍用 43 題結果），
查校列出被該層劃掉的學校與理由；學校詳情新增「招生專業 · 選考科目要求（2027 年）」（逐專業要求、校區／醫學院標籤、國標對應、強基標記、帶日期的官方來源）。
43 題、篩選引擎、Function、AnswerMap、`APLUS_EVIDENCE`、`src/shared-ui`、依賴與 binding 均未變。

**資料與閘門**：`data/research/s1_sources.json`（16 個官方來源，13 個原檔入庫 `raw/s1/`、3 個大檔只釘 SHA-256）→ `data:s1-build` →
`program_offerings.2027.csv`（雙一流 144 校、9,534 條、四省 2027 表聯集 0 衝突）、`bk_catalog.2026.csv`（883）、`strong_base_schools.2026.csv`（39）
→ `npm run data:programs`（`scripts/build_programs_layer.mjs`）→ `public/data/programs/{catalog,offerings}.json`（103／901 KiB，gzip 約 15／69 KiB，懶載入）＋
`src/data/programsManifest.ts`（版本 `948a2190ff3b`）。`npm run test:s1`（8）為新閘門；`build` 依序跑 `data:runtime`、`data:atlas`、`data:programs`。
`build` 也會重產世界學科地圖 payload：`build_world_atlas.mjs` 把 `generatedAt` 日期寫進 payload，跨日重建雜湊就變（`8a4beeaa84b5` → `488195a3f30f`，內容不變）；發布提交含該重產檔。
手冊 §3.4。

**驗證（Node 24.18.0，發布提交 `2e79f9b`）**：`nope/check.txt`：lint、check:shared-ui、test:theme 9、test:evidence 2、test:filters 60、test:trusted 17、
test:atlas 12、test:s1 8、audit:questions／values／data、build 全部 exit 0；建置後工作樹乾淨；dist 43 檔；主包 380.1 kB（gzip 117.2 kB；S0 為 357.7 kB，增量為首頁起點條件元件）。
本機 Vite 內建瀏覽器：選物理＋生物＋思想政治、意向 08 工學 → 0809 計算機類 → `#/result` 顯示「43 題剩 2952；起點條件另劃掉 142（沒開 19／選科不符 123／不判定 2；未入庫 2808 不受影響）」；
查校「中国科学技术大学」列為起點條件劃掉並附理由；北京大學詳情 65 個專業、61 對應目錄、醫學部分組、強基標記、四省＋教育部來源；非雙一流校顯示「尚未入庫」。
逐路由文字對比度（`/`、`#/result`、`#/school/北京大學`，紙色與墨色，桌面 1440 與手機 390）新增低對比項 0、最低 6.27:1（紙）／7.14:1（墨）、最小字 12px、無橫向溢出。

**發布**：候選 `6b1dbce5-9ae1-4e93-8848-53b3bf34c480`（43/43 檔一致；真實路徑同上，另驗 payload 版本與 health）；
收據 `20261107-nope-s1-programs-admission`（preview_verified，6 個 reviewed_changes）；`release-pages-transaction.mjs` 須在倉庫目錄執行
（第一次在 CF 根目錄跑因 `git remote` 失敗、HTTP 日誌 0 請求，已改名保留）；正式部署 `7aa5e5b5-345e-403b-8cd6-d3d0076178d1`，
來源 `2e79f9b6c9d356f4283cfcda1e6962a6e3a55187`，生效 `2026-11-07T03:01:44Z`（Cloudflare），HTTP 預算 40、實用 10。
正式自訂網域與不可變網址 43/43 檔一致；health active；正式站真實路徑：首頁 5 起點＋6 科按鈕、選物生政 → `#/result` 起點條件劃掉 7 所（與稽核模擬一致）、
中國科學技術大學詳情 56 專業／52 對應／強基／6 個官方來源鏈接；主控台無錯誤。`accept-production.mjs`：登記簿 accepted → `7aa5e5b5`／`2e79f9b`，rollback → `0ec6d42f`／`d4ae514`。
Status `20261107-nope-s1-programs-admission` r1（new）：`--check` valid、`--publish` created＋readback；API／RSS／`/api/status` 讀回一致。
CAPABILITY_FIT: no-new-capability（靜態 JSON，無新 Cloudflare 能力）。

**回滾**：`0ec6d42f-3b93-4859-bd22-813e7f000c3e`／`d4ae514`，走新的受審回滾交易（先讀回當時線上基線）；只切 Pages 版本，無資料庫遷移；
回滾會撤掉起點條件與專業層，世界地圖與起點問題保留。

**已知**：選科單獨生效時詳情頁判定文案「報不了56 個」缺一個空格（下版修）；`officialSchools.ts` 的雙一流標籤按 2022 校名比對，上海體育大學被標成普通本科（A3，需另批）；
已登入學生的 A+ 證據路徑本次未改、未實測（最近一次登入實測 2026-10-23）。

報告：`/Users/ylsuen/CF/reports/operations/nope-s1-programs-admission-20261106/RELEASE.md`（發布）與 `REPORT.md`（資料層設計與稽核）。

## 2026-11-07 修正批 A：上海體育大學雙一流標籤、世界地圖日期戳、判定文案（已上線；批 B 疊加於其上）

**授權**：站長 2026-11-07 主會話「做新題，擴到全部，22 MB放R2，該修正的都修正」之「該修正的都修正」。

**內容（`6b70522`）**：`scripts/build_official_schools.mjs` 新增 `LEVEL_LIST_NAME_BY_CURRENT_NAME`（上海体育大学 → 名單舊名 上海体育学院，來源：教育部 2026 名單標識碼 4131010277、第二輪雙一流名單），
重產 `officialSchools.ts`／runtime `schools.json`／`runtimeManifest`：雙一流非 211 由 31 → 32，民辦雙一流集合 144/144，其餘 2,951 筆不變。
`scripts/build_world_atlas.mjs` 的 `generatedAt` 改取輸入最晚讀取／核查日（版本回到 `8a4beeaa84b5`，跨日重建不再變）。`src/engine/programs.ts` 選科單獨生效的判定文案補空格。

**驗證與發布**：十二道閘門全過（`nope-a/check.txt`）；候選 `45eb204f-78cd-40e6-8fca-62fa241ca7e3` 43/43，候選真實路徑：中國科學技術大學判定文案「報不了這 56 個招生專業（類）」、上海體育大學詳情顯示「雙一流（非 211）」與 24 個招生專業；
收據 `20261107-nope-s1-fixes-a`（3 個 reviewed_changes）；正式部署 `021e1a3d-164b-408b-a2af-fcec41712d31`，來源 `6b70522e08dea910b2630fdb07ce16cedf1db5b3`，生效 `2026-11-07T03:30:29.192795Z`；
正式與不可變網址 43/43；health active；正式真實路徑：上海體育大學詳情層次徽章與專業區塊、主控台無錯誤。登記簿 accepted → `021e1a3d`／`6b70522`，rollback → `7aa5e5b5`／`2e79f9b`。Status `20261107-nope-s1-fixes-a` r1（fix）。

## 2026-11-07 批 B：招生專業／選考要求擴到全部 2,952 校，兩層 payload，原檔上 R2（已上線，當前權威）

**授權**：站長 2026-11-07 主會話「做新題，擴到全部，22 MB放R2，該修正的都修正」之「擴到全部」與「22 MB放R2」。

**資料（`ccf1770`）**：`data:s1-build --scope all` 收本科與高職（專科）兩個層次，寫 `data/research/program_offerings.2027.all.csv.gz`（88,750 條：本科 53,220／專科 35,530；2,289 校；跨省 0 衝突）＋ `program_offerings_summary.2027.all.csv`＋`.all.meta.json`；
`audit:s1 --scope all` 按教育部層次算覆蓋：本科校 1,412 中 1,234 有本科清單（87.4%），缺 178 分類為職業大學 80／其他 63／獨立學院 20／警察類 15（人工查核清單在 `s1-audit-all.md`，缺的保持未知）；專科校 1,540 中 989 有專科清單。
三個 external 原檔（江蘇 xls、上海 PDF、浙江 zip，共 22,524,774 B）上傳既有私密桶 `bdfz-ops-backups`，鍵 `unapply/s1-sources/v1/<檔名>`，讀回 SHA-256 一致後刪除本機副本；`s1_sources.json` 的 `r2` 欄記 bucket／key／SHA-256／bytes／MD5／上傳日；`fetch_s1_sources.mjs --from-r2` 以 rclone 遠端 `r2:` 取回。

**payload（兩層）**：`data:programs` 寫 `public/data/programs/index.json`（每校摘要：本科／專科數、各專業類圖樣、按類招生、對到具體專業的下標、試驗班圖樣；884 KiB／gzip 151 KiB）與 `schools/programs-NN.json`（31 個省桶，編號沿用校區分桶；只在學校詳情載入）；manifest 計數含 undergraduateSchools 1,235、undergraduateOfferings 53,220、vocationalOfferings 35,530、buckets 31。
引擎 `src/engine/programs.ts` 改算在摘要上：沒有本科清單的學校（含只公布專科的）為 no-data 保留；只有試驗班對不到專業類者 unknown 保留。結果頁計數改以本科校為口徑；詳情頁載入省桶、分本科／高職（專科）與校區分組。`test:s1` 9 項。

**驗證與發布**：十二道閘門全過（`nope-b/check.txt`）；候選 `70d46f1e-080e-4ab9-b469-4dcd0c752d10` 74/74；候選真實路徑：物生政＋計算機類 → 起點條件劃掉 1,158（沒開 166／選科不符 992／不判定 65；無本科資料 1,717 不受影響）、北京工業職業技術學院 35 個專科專業「不判定」、北方工業大學 45 個本科專業 5 個官方來源；
收據 `20261107-nope-s1-all-schools-b`（3 個 reviewed_changes）；正式部署 `8cb266cb-2eb2-409d-915b-a90a28447448`，來源 `ccf1770f0e03b469de16c973eab4ae20064b970d`，生效 `2026-11-07T03:49:37Z`；正式與不可變網址 74/74；health active；正式真實路徑北方工業大學詳情省桶載入、主控台無錯誤。
登記簿 accepted → `8cb266cb`／`ccf1770`，rollback → `021e1a3d`／`6b70522`。Status `20261107-nope-s1-all-schools-b` r1（new）。

**人工查核清單（交站長）**：本科校缺清單 178（分類見上，全名單在 `s1-audit-all.md` §0）；專科校缺 551；陽光高考章程／專項名單／分省計劃只能人工（412 挑戰）；bjeea.cn 本機不通、廣東回 forbid；江蘇公告頁 .xlsx 404（.xls 本科段完整）；三校招生代碼對不到主表（防災科技學院、內蒙古科技大學包頭師範學院／包頭醫學院）；省表 89 個舊校名已按代碼學成別名。

## 2026-11-07 批 C：S1.b 正式兩題（選考科目組合 S1、意向專業類 S2）（已上線，當前權威）

**授權**：站長 2026-11-07 主會話「做新題，擴到全部，22 MB放R2，該修正的都修正」之「做新題」（功能授權）；正式發布由站長 2026-11-07 在本側會話直接裁定「放行，正式發布 C」。User Center 無需變更、未做任何 UC 生產寫入。

**正式部署**：`b3e0f4c8-4fe5-4e83-863f-476cd41ce836`，來源 `5b18cd197892d786d4f6cb4fb5b6271ca8615c35`（`1bc3995` feat＋`8f7f492` docs＋`5b18cd1` fix），生效 `2026-11-07T04:57:35Z`（Cloudflare `ended_on`）；正式與不可變網址 74/74 一致；health active；正式真實路徑（`nope-c/production-browser.json`，逐步真實點擊）：物生政 → 劃掉 33／剩 2919，＋計算機類 → 劃掉 180／剩 2772，結果頁無起點條件層，北方工業大學／北京工業職業技術學院詳情判定正確，主控台無錯誤。
登記簿 accepted → `b3e0f4c8`／`5b18cd1`，rollback → `8cb266cb`／`ccf1770`。Status `20261107-nope-s1b-questions-c` r1（improvement，已發布並讀回，`status-readback-c.txt`）。收據 `20261107-nope-s1b-questions-c`（12 個 reviewed_changes）。

**共享契約變更（`1bc3995`）**：`DimensionId` 追加 `S1`、`S2`（只追加，43 個既有維度、取值、計分皆不動）；`Question.section` 加 `S_programs`；`allQuestions` 45 題（S 區排在 C 區之後）。
- S1「你的選考科目是哪三科？」：20 個固定序三科組合鍵（`PCB`…`ZHG`，序 物化生政史地）；學校取值＝至少有一個本科招生專業可報的組合集合（`admissibleCombos`）；選項 `requires` 該組合，所以只有「全部本科專業都報不了」的學校被劃掉。
- S2「你想讀的專業類，學校一定要有開設嗎？」：教育部 2026 本科目錄 92 個專業類，介面按門類→專業類兩層選；學校取值＝開設的專業類代碼＋（另有試驗班對不到專業類時）通配值 `*`；`requires` 遇通配值一律保留。
- 疑罪從無：沒有本科資料的學校（含只公布專科的）兩題取值皆 `null`，永不因這兩題被劃掉。兩題選項皆 `alwaysVisible`：考生自身事實（如物化生報得了每所有資料的學校、排除 0 所）仍是真實答案，不被 `getVisibleOptions` 隱藏；`audit:values` 對此類選項排除 0 所記為「符合預期」而非失效。
- `FilterContext.programs`（逐校招生專業摘要 `public/data/programs/index.json`）貫通前端、`analyzeQuestionCoverage`、Function 重算、`audit:values`／`audit:data` 與測試；App 把它當成與學校目錄同級的問卷前置資料（進問卷前載入，約 151 KiB gzip）。
- Function `complete`：以 ASSETS 載入釘定的 index.json（版本與計數對 `programsManifest`）後用同一上下文重算；新頁面帶 `programsVersion`（必須等於 `programsManifest.version`，否則 400）；**舊頁面（43 題，無 `programsVersion`）仍可完成**——S1／S2 不在其題單，不要求看過；帶了 S1／S2 卻無 `programsVersion` 視為無效。這樣 2026-11-07 之前已開始作答的會話在換版後不會斷。
- 介面：問卷 S1 六科挑三科、S2 門類／專業類下拉；首頁「起點條件 · 選填」、`unapply.programPrefs.v1` 本地偏好與結果頁「起點條件劃掉」分層計數全部移除（結果只來自引擎）；學校詳情的逐校判定改由 S1／S2 作答推出（`evaluateSchoolPrograms` 與引擎同義：no-data／kept／struck／unknown）。版號 v2.0；About 來源文案改為全部學校口徑。
- `data:programs` 另寫 `src/data/programClasses.ts`（目錄門類／專業類作為源碼），`questions.ts`／`dimensions.ts` 以 `.ts` 副檔名匯入（`audit:questions` 用純 node 跑）。
- 排除理由（結果頁「查校」與 gk `nope.v1` 交接）對這兩題改寫成可讀句（同批後續提交）：S1 列全校本科專業的選考要求分佈（`describeRequirements`，如「56 個本科招生專業（類）的選考要求：物理＋化學 ×50 / 物理 ×6（物理＋生物＋思想政治 一個都報不了）」），S2 列開設的專業類（最多 8 類）；S2 門類下拉只列有專業類的門類（14 交叉學科在目錄裡沒有專業類，不列）。

**User Center 側（無需變更、無生產寫入）**：UC 只釘 unapply 的資源描述（`manifestVersion unapply-result-v1`、`manifestDigest sha256:136c7868…`、`itemCount 1`、`loaderContractVersion`），互動鍵走自由格式 `^[A-Za-z0-9:_-]{1,100}$`（只有 jiubai 有 requiredInteractionKeys），完成只驗聚合（exact keys、kept＋excluded＝total、不同 `answer:*` 互動數 ≥ answeredCount）；題數 43→45 對 UC 不可見。可執行證據：`reports/operations/nope-s1-programs-admission-20261106/nope-c/uc-contract-evidence.json`（在 accepted `0559b0cf` 的唯讀工作樹上以 node:sqlite 記憶體庫跑 start→answer:A1／answer:S1／answer:S2／result_transcript→completion recorded；不碰 D1／Worker／祕密）與 `uc-accepted-tests.txt`。`public/learning-manifest.json`、`SOURCE_DESCRIPTOR` 不變；歷史證據與計分不動。共享樞紐變更收據：`reports/operations/shared_hub_changes/20261107-user-center-nope-s1b-questions.json`。

**扇出**：my（UC）verified_no_change；path（`src/shared-ui` 同步，`check:shared-ui` 過）verified_no_change；gk（`nope.v1` 交接，`sanitizeNopeContext` 取前 20 題、逐欄截斷，S1／S2 答案以題目標題＋選項標籤進入，不需改）verified_no_change；Pulse／Status／Companion 不涉及題集（Status 記錄在正式發布時才寫）。

**驗證**：十二道閘門於釋出提交 `5b18cd1` 上執行（`nope-c/check.txt`；`test:s1` 10、`test:trusted` 18、`audit:values` 45 維 0 阻斷、`audit:questions` 45 題、build 74 檔）；候選 `bc3c5927` 上傳、資產逐檔比對、瀏覽器真實路徑與對比度（候選 1024 紙色 6.27 起；本機 390 紙色 4.57／墨色 4.93 起，0 失敗）記錄在 `nope-c/candidate-*.json`；正式讀回 `production-assets.json`／`production-immutable-assets.json`／`production-browser.json`／`production-acceptance.json`。

**回滾**：`8cb266cb`／`ccf1770`，走受審回滾交易（先讀回當時線上基線）；只切 Pages 版本，無資料庫遷移。回滾會把兩題撤回起點條件層；已完成的學習記錄不受影響（UC 契約未變）。

## 2026-11-07 批 D1＋D4：七省 2027 選考要求表（山東／河南／內蒙古）＋ 13 所機構官網補齊（已上線，當前權威）

**授權**：站長 2026-11-07 主會話「距離最終goal還有哪些你自行推進」——葉子站既有契約下的資料與介面更新可自行走登記的發布交易；本批不改題集／DimensionId／AnswerMap／learning manifest／Function 契約，無 UC 或共享樞紐寫入，無付費資源，無新建 Cloudflare 資源（兩個山東 PDF 放進既有私密桶 `bdfz-ops-backups` 的既有前綴 `unapply/s1-sources/v1/`，與批 B 三檔同類）。

**正式部署**：`c26a1b75-ae96-47f9-8dd8-7c2d931cf423`，來源 `df6c7822f96c29bf530d7e5c5aebbb62dd1fa954`，生效 `2026-11-07T06:32:57Z`（Cloudflare `ended_on`）；候選 `589b2a81`、正式 nope.bdfz.net 與不可變網址 74/74 一致；health active；正式真實路徑（`nope-d1/production-browser.json`）與候選完全一致。登記簿 accepted → `c26a1b75`／`df6c782`，rollback → `b3e0f4c8`／`5b18cd1`。Status `20261107-nope-s2-coverage-d1` r1（improvement，已發布並讀回 `status-readback-d1.txt`）。收據 `20261107-nope-s2-coverage-d1`（2 個 reviewed_changes：About、SchoolDetail）。

**資料**（手冊 §3.4，`data/research/s1_sources.json` 23 條來源）：新增山東省教育招生考試院 2027 通用版本科／專科 PDF（external，R2 讀回核對）、河南省教育考試院 2027 xlsx、內蒙古招生考試信息網 2027 xlsx（本科／专科兩表，只有校名）及三個公告頁快照（committed）。`program_offerings.2027.all.csv.gz` 102,241 條（本科 56,511／專科 45,730）、2,608 校；**本科校覆蓋 1,271/1,412（缺 178 → 141）、專科校 1,260/1,540（缺 551 → 280）**；跨省不一致 2 條（內蒙古農業大學 動物醫學／食品質量與安全，HA/HB/SD/ZJ 物＋化 vs NM 物）以圖樣 `conflict` 入庫：引擎視為可報、永不作排除依據，詳情頁標示「各省表寫法不一致（不作排除依據）」。payload 版本 `8b9b28f927d8 → 3d0cc7ed3c79`（manifest 新增 `counts.provinces=7`、`counts.conflicts=2`）；Function 以同一 manifest 核對，舊頁面相容照舊。稽核 `nope-d1/s1-audit-all.md`（含仍缺 141 校清單：職業大學 75、其他 38、獨立學院 18、警察類 10）。

**探測結論（能腳本取得且為官方網域者）**：本機出口為海外 IP（dmit），多數省考試院對它重置 TLS；山東／河南／內蒙古三省可取；湖南公告頁可達但附件主機 `cms.jyt.hunan.gov.cn` 不通；廣東／四川／福建／新疆只以查詢系統公布（不抓）；北京／天津／河北／山西／遼寧／黑龍江／安徽／江西／廣西／海南／重慶／貴州／雲南／西藏／陝西／甘肅／青海／寧夏不通或無表。陽光高考 412 不繞過。

**D4**：`verify_institution_websites.mjs` 新增 `MANUAL_REVIEW`（13 條，各帶證據）與 `--from CSV --recheck`；`gras_institution_websites.2026-11-07.csv` 544/544 verified（high 440／medium 104；Monash／MBZUAI 反爬 403 以瀏覽器核對、澳門旅遊大學憑證鏈不完整以 curl 核對）；世界地圖 payload `8a4beeaa84b5 → fb75382a01b0`。

**程式**：`build_s1_programs.mjs` 共用 `alignSchool()`、試算表多工作表／無代碼、PDF 每頁表頭預掃、`assignBy: 'left'` 左緣聚類分欄、要求欄折行文法拼回；`build_programs_layer.mjs` 省表標籤 HA/NM/SD、conflict 圖樣；`engine/programs.ts` `REQUIREMENT_CONFLICT`；`programPrefs.ts` 標籤；`audit_s1_programs.mjs` 衝突逐條列出不阻塞；`test:s1` 11 項（新增七省／衝突／覆蓋不倒退）；About／SchoolDetail 省份列表改由 payload 推出。

**回滾**：`b3e0f4c8`／`5b18cd1`，受審回滾交易；只切 Pages 版本，無資料庫遷移；學習記錄不受影響。證據：`reports/operations/nope-s2-coverage-jointprograms-20261107/nope-d1/`；私密收據與 HTTP 日誌：`reports/private/nope-s2-coverage-jointprograms-20261107/`。
