# 不想考的 operations

Last normalized: 2026-08-10 PDT
Owner: suen
Lifecycle: active
Data class: student_owned
Documentation status: generated from local source, Git/GitHub audit, project catalog, and live Cloudflare inventory; unresolved facts remain fail-closed.

## Quick start

- Canonical local path: `/Users/ylsuen/CF/unapply`
- Git authority: `ieduer/unapply`
- Current local branch/HEAD: `master` / `0bedd2d`（未提交審計候選；線上source仍4925d96）
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
| `unapply` | Pages | verified 2026-08-10 | production branch `master`; canonical deployment `0f6af73a-9541-4e5e-bbbd-54ebe88c6695` |

## Authority and dependencies

- Project names: 不想考的
- Catalog owner: suen
- Data classes: student_owned
- Identity modes: central
- User Center required: true
- Pulse measurement: zone_host
- Runtime bindings: 0 names cataloged; names are intentionally omitted from this general handbook. Inspect the exact project config and live binding types under task-scoped authority.
- Shared User Center, APIS, nav, image, Pulse, App, clone-family, and VPS effects must be checked through workspace topic runbooks; this file does not weaken those gates.

## Resource location and restore

- Source authority: `/Users/ylsuen/CF/unapply`; Git/GitHub authority above.
- External/local build inputs, archived paths, receipts, retention, and hydrate commands not stated below are `review_required` and block deletion.

Catalog backup evidence:
- Cloudflare immutable Pages deployments: current=ddbda44d-af57-4c7e-bc63-108188b63b88 (source 4925d96, 2026-09-08T13:15Z), previous=7bea1ce9-6cb8-4adb-99a0-973afbb73fa2 (source 56a6439), last pre-change release=2700a82d-1239-4918-bc54-2938a585e8f8 (source 4be095d, 2026-08-26)

Catalog restore evidence:
- restore code/assets by rolling back to production deployment 2700a82d-1239-4918-bc54-2938a585e8f8

Before deleting any local resource, satisfy the workspace path-preserving archive, remote readback, isolated restore, receipt, handbook, and project-state gates.

## Preflight and AI ownership

1. Read `/Users/ylsuen/CF/AGENTS.md`, this file, `PROJECT_STATE.md`, and linked annexes.
2. Inspect `git -C "/Users/ylsuen/CF/unapply" status --short` when Git-backed.
3. Inspect recent `reports/agent_action_log.jsonl` ownership.
4. Resolve the exact source, Worker/Pages/VPS/App target, domains, bindings, data, and rollback live.
5. Append a scoped `start` row before the first mutation.
6. Preserve unrelated dirty work; never reset, clean, broad-checkout, or stash another task's changes.

## Build, test, and local verification entrypoints

Detected package entrypoints (presence is not proof they currently pass):

- `npm --prefix "/Users/ylsuen/CF/unapply" run build`
- `npm --prefix "/Users/ylsuen/CF/unapply" run dev`
- `npm --prefix "/Users/ylsuen/CF/unapply" run lint`
- `npm --prefix "/Users/ylsuen/CF/unapply" run pages:deploy`
- `npm --prefix "/Users/ylsuen/CF/unapply" run preview`
- `npm --prefix "/Users/ylsuen/CF/unapply" run test:evidence`
- `npm --prefix "/Users/ylsuen/CF/unapply" run test:trusted`
- `npm --prefix "/Users/ylsuen/CF/unapply" run test:filters`
- `npm --prefix "/Users/ylsuen/CF/unapply" run audit:questions`
- `npm --prefix "/Users/ylsuen/CF/unapply" run audit:values`
- `npm --prefix "/Users/ylsuen/CF/unapply" run audit:data`

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
- npm --prefix "/Users/ylsuen/CF/unapply" run pages:deploy

Rollback/failback authorities:
- curl -sS -X POST -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/da810f08b63347a01d3db7fd42619972/pages/projects/unapply/deployments/2700a82d-1239-4918-bc54-2938a585e8f8/rollback"

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
8. Last verified: 2026-09-08T13:20Z — live readback of https://nope.bdfz.net confirmed per-question titles advance, and A6 excludes 158 for a Beijing candidate vs 159 for a Jiangsu candidate (the extra one being 上海科技大学, which only Jiangsu candidates cannot reach on raw score). Province strings across the app are traditional-form; the admission-channel build fails closed on any province it cannot canonicalize.

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

## 2026-09-08 已授權過渡發布（驗證進行中）

站長在效度裁定後明示「如果比現在版本更靠譜些，可以先部署一版。缺失的以後再更新」。本輪按此接受增量可靠性改善；原全站準確性未通過的裁定保留，不再將既有資料缺口視為此次過渡發布的絕對阻塞。來源覆蓋、A6 無來源誤排、B 解析與頁面容錯修正納入候選；A2/E/C5 語義、證據端逐省重算、缺少資料與完整認證讀寫驗收仍列待辦。候選不改 AnswerMap 或共享服務。

Node 權威固定 `.nvmrc` / `engines.node` = 24.18.0，使用現有安裝重跑九閘；不更新依賴。發布與讀回完成後在本節寫入新 deployment/source。當前線上仍 ddbda44d-af57-4c7e-bc63-108188b63b88 / 4925d96，為本次直接回滾錨點；更早 2700a82d / 4be095d 保留。`CAPABILITY_FIT: no-new-capability`；既有 Pages、bindings、相容日期不變。

本次發布權威：[發布驗證記錄](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-release/README.md)。原[效度審計](/Users/ylsuen/CF/reports/operations/20260908-unapply-validity-audit/README.md)是資料缺口與修正證據。

發布前重驗（2026-09-08）：Node 24.18.0 的九個指定閘門全部 exit 0，55 條 filters、2 條 evidence、7 條 trusted 通過。Cloudflare API 確认正式分支 master、無 Git 自動建置 source、原正式部署 ddbda44d，APLUS_EVIDENCE 綁定及相容日期與本機一致。發布入口現在於 build 後再次檢查乾淨且已推送，回報真實 commit_dirty=false。
