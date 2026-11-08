// 起點與目的地 → 流程（2026-11-08 批 G6，主會話裁定 A／B／F）閘門：
// 5 起點 × 目的地組合：不含中國大陸就絕不進大陸題（A1 或任何一題）；含中國大陸先進 #/filter；非大陸起點自動略過 S1；
// 全球階段題目出現條件；v1→v2 遷移；換起點重設；planFlow 不碰 AnswerMap；「參與你這條管道」名單釘雜湊且全部對到教育部名單。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { GLOBAL_DESTINATIONS, NON_MAINLAND_AUTO_SKIP, isAutoSkipped, mainlandAutoSkip, normalizeDestinations, planFlow } from '../src/engine/flowPlan.ts'
import { DESTINATIONS, migrateOriginPrefsV1, normalizeOriginPrefs, originPrefsFor, type Destination } from '../src/data/originBranch.ts'
import { originOptions } from '../src/data/origins.ts'
import { allQuestions } from '../src/data/questions.ts'
import { participationLists } from '../src/data/participationLists.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const ORIGINS = originOptions.map((o) => o.id)
/** 目的地的全部非空子集（31 種）。 */
const SUBSETS: Destination[][] = []
for (let mask = 1; mask < 1 << DESTINATIONS.length; mask += 1) SUBSETS.push(DESTINATIONS.filter((_, i) => mask & (1 << i)))

test('5 起點 × 31 種目的地組合：不含中國大陸就不進大陸題；含中國大陸先進大陸題；兩者都有先大陸後全球', () => {
  assert.equal(SUBSETS.length, 31)
  for (const origin of ORIGINS) {
    for (const destinations of SUBSETS) {
      const plan = planFlow(origin, destinations, null)
      const label = `${origin} → ${destinations.join('+')}`
      const mainland = destinations.includes('cn-mainland')
      const global = destinations.some((d) => d !== 'cn-mainland')
      assert.deepEqual(plan.destinations, destinations, label)
      if (!mainland) {
        assert.equal(plan.entry, 'global', label)
        assert.equal(plan.stages.includes('mainland'), false, label)
        assert.deepEqual(plan.autoSkip, [], label)
      } else {
        assert.equal(plan.entry, 'filter', label)
        assert.equal(plan.stages[0], 'mainland', label)
      }
      assert.equal(plan.stages.includes('global'), global, label)
      assert.deepEqual(plan.stages, [...(mainland ? ['mainland'] : []), ...(global ? ['global'] : [])], label)
      assert.deepEqual(plan.globalDestinations, destinations.filter((d) => d !== 'cn-mainland'), label)
    }
  }
})

test('非大陸起點走大陸階段時自動略過只適用高考考生的題（S1 選考科目組合、A6 另外報名／校測）；大陸起點不略過；略過的題真的存在', () => {
  assert.deepEqual([...NON_MAINLAND_AUTO_SKIP], ['S1', 'A6'])
  for (const id of NON_MAINLAND_AUTO_SKIP) assert.ok(allQuestions.some((q) => q.id === id), id)
  for (const origin of ORIGINS) {
    const plan = planFlow(origin, ['cn-mainland'], null)
    if (origin === 'cn-mainland') assert.deepEqual(plan.autoSkip, [])
    else { assert.deepEqual(plan.autoSkip, ['S1', 'A6']); assert.ok(isAutoSkipped(plan, 'S1') && isAutoSkipped(plan, 'A6')); assert.equal(isAutoSkipped(plan, 'A1'), false) }
  }
  // 任何入口進大陸題（瀏覽頁的「進中國大陸題庫」、深鏈）都按起點略過：與目的地無關
  assert.deepEqual(mainlandAutoSkip('hk'), ['S1', 'A6'])
  assert.deepEqual(mainlandAutoSkip('cn-mainland'), [])
  assert.deepEqual(mainlandAutoSkip(null), [])
  assert.ok(/autoSkip=\{mainlandAutoSkip\(origin\)\}/.test(read('src/App.tsx')), 'QuestionRunner 用起點決定略過')
  // 自動略過寫入的值與手動「跳過」相同（'skip'），題目與選項鍵不變
  const runner = read('src/components/QuestionRunner.tsx')
  assert.ok(/next = \{ \.\.\.next, \[id\]: 'skip' \}/.test(runner), 'QuestionRunner 以 skip 寫入')
  assert.ok(/setAnswer\('skip'\)/.test(runner), '手動跳過也是 skip')
  const fn = read('functions/api/learning/[action].ts')
  assert.ok(/if \(value === 'skip'\) return 'skip'/.test(fn), 'Function 對任何題都接受 skip')
})

test('資格只對非大陸起點；未選起點＝中國大陸（深鏈 #/filter）；目的地空＝起點本地', () => {
  assert.equal(planFlow('cn-mainland', ['cn-mainland'], 'hkdse').qualification, null)
  assert.equal(planFlow('cn-mainland', ['cn-mainland'], null).showQualification, false)
  assert.equal(planFlow('hk', ['hk'], 'hkdse').qualification, 'hkdse')
  const deep = planFlow(null, [], null)
  assert.equal(deep.origin, 'cn-mainland')
  assert.equal(deep.entry, 'filter')
  for (const origin of ORIGINS) assert.deepEqual(normalizeDestinations(origin, []), [origin])
  assert.deepEqual(normalizeDestinations('hk', ['overseas', 'zz', 'hk']), ['hk', 'overseas'])
  assert.deepEqual([...GLOBAL_DESTINATIONS], ['hk', 'mo', 'tw', 'overseas'])
})

test('站長回報的錯：大陸起點只選港澳臺與海外 → 不出現 A1「哪些地區你一定不去？」，直接進全球減法', () => {
  const plan = planFlow('cn-mainland', ['hk', 'mo', 'tw', 'overseas'], null)
  assert.equal(plan.entry, 'global')
  assert.deepEqual(plan.stages, ['global'])
  // v1 範圍「只看港澳臺與海外」遷移後同樣不進大陸題
  const migrated = migrateOriginPrefsV1('cn-mainland', { scope: 'abroad' })
  assert.equal(planFlow('cn-mainland', migrated.destinations, null).entry, 'global')
  // 換起點重設：澳門的「只看本地」不會帶到香港
  assert.deepEqual(originPrefsFor('hk'), { qualification: null, destinations: ['hk'] })
  assert.deepEqual(normalizeOriginPrefs('hk', migrateOriginPrefsV1('mo', { scope: 'local' })).destinations, ['mo'])
})

test('planFlow 純函式：不匯入 AnswerMap／filter／學習記錄／i18n；不改題目與選項鍵', () => {
  const src = read('src/engine/flowPlan.ts').replace(/^\s*\/\/.*$/gm, '')
  assert.equal(/AnswerMap|DimensionId|from '\.\/filter'|bdfzIdentity|trustedAPlus|learningEvidence|i18n/.test(src), false)
  assert.equal(/^import (?!type )/m.test(src), false, '只匯入型別')
  assert.equal(allQuestions.length, 45)
  const manifest = JSON.parse(read('public/learning-manifest.json')) as { manifestDigest: string }
  assert.equal(manifest.manifestDigest, 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99')
})

test('參與院校名單：教育局文憑試收生計劃 2026/27 原檔雜湊釘定、165 所全部對到教育部 2026 名單、無重複', () => {
  const list = participationLists['hk-dse-2026']
  assert.ok(list)
  assert.equal(list.origin, 'hk')
  assert.equal(list.channel, 'hk-dse-scheme')
  assert.equal(list.count, 165)
  assert.equal(list.schoolIds.length, 165)
  assert.equal(new Set(list.schoolIds).size, 165)
  const pdf = readFileSync(`${root}/data/research/participation/edb_hk_dse_scheme_2026_27_list.pdf`)
  assert.equal(createHash('sha256').update(pdf).digest('hex'), list.source.sha256)
  assert.match(list.source.url, /^https:\/\/www\.edb\.gov\.hk\//)
  const schools = JSON.parse(read('public/data/runtime/schools.json')) as { id: string }[]
  const ids = new Set(schools.map((s) => s.id))
  for (const id of list.schoolIds) assert.ok(ids.has(id), id)
  // 名單只是展示層標示：不進 Function、不進 learning manifest
  assert.equal(/participation/i.test(read('functions/api/learning/[action].ts') + read('public/learning-manifest.json')), false)
})

test('港澳臺院校池畫面上的資料備註不含內部核查字樣（資料檔照留）；有用的部分（原文、官方頁網址）保留', async () => {
  const { publicNote, isInternalNote } = await import('../src/lib/publicNote.ts')
  const hkmotw = JSON.parse(read('public/data/hkmotw/pool.json')) as HkMoTwPayloadNotes
  let shown = 0
  for (const inst of hkmotw.institutions) {
    for (const text of [inst.notes, ...inst.channels.map((c) => c.notes)]) {
      const out = publicNote(text)
      assert.equal(isInternalNote(out), false, out)
      if (out) shown += 1
    }
  }
  assert.ok(shown >= 15, `shown ${shown}`)
  assert.equal(publicNote('頁面原文：A；頁面以 JavaScript 載入，腳本讀到的正文只含部分要求'), '頁面原文：A')
  assert.equal(publicNote('香港出路統整 https://x.example/ （正文以 JavaScript 載入）'), '香港出路統整 https://x.example/')
  // 港澳臺院校池頁的管道名稱用三語鍵，不用資料檔裡帶「待人工覆核」的中文名
  const page = read('src/components/HkMoTwPage.tsx')
  assert.equal(/channel\.channelZh/.test(page), false)
  assert.ok(/publicNote\(channel\.notes\)/.test(page) && /publicNote\(inst\.notes\)/.test(page))
})

interface HkMoTwPayloadNotes { institutions: { notes: string; channels: { notes: string }[] }[] }
