// audit:regions（2026-11-08 批 G6 擴充）：以真實 payload 對每個起點 × 題庫重算出題計畫，強制六條效度標準＋池規模；
// 失敗即 exit 1。加 --md <檔案> 時另寫各題庫的覆蓋、各選項劃掉數、採用或捨棄理由（docs/QUESTION_VALIDITY.md 的證據表）。
//   npx tsx scripts/audit_region_questions.mjs [--md path]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGlobalPool, poolFor } from '../src/engine/globalFilter.ts'
import { BANKS, CANDIDATES, VALIDITY, evaluateBank } from '../src/engine/regionBanks.ts'
import { questionEvidence } from '../src/data/questionEvidence.ts'
import { bankEvidence } from '../src/lib/bankEvidence.ts'
import { tierOf } from '../src/lib/authorityTier.ts'
import { DIRECT_HIRE_RULE, planDirectHire } from '../src/engine/directHire.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const overseas = read('public/data/overseas/index.json')
const hkmotw = read('public/data/hkmotw/pool.json')
const atlas = read('public/data/atlas/world-atlas.json')
const items = buildGlobalPool(overseas, hkmotw, atlas)
const ORIGINS = ['cn-mainland', 'hk', 'mo', 'tw', 'overseas']
const errors = []
const fail = (m) => errors.push(m)
const ctxFor = (origin) => ({
  familyOf: new Map(atlas.subjects.map((s) => [s.code, s.family])),
  familyOrder: atlas.families.map((f) => f.code),
  subjectOrder: atlas.subjects.map((s) => s.code),
  origin,
  ...bankEvidence(),
})

// 標準 4：判讀證據全量 ≥20、題目只用 confirmed（準確率＝confirmed／被採用＝100%）
const checks = questionEvidence.channelChecks
if (checks.checked < VALIDITY.minSample) fail(`channel checks ${checks.checked} < ${VALIDITY.minSample}`)
if (questionEvidence.ugcFunded.ids.length !== 8) fail('UGC list must have 8 universities')

const plans = []
for (const origin of ORIGINS) {
  for (const bank of BANKS) {
    const plan = evaluateBank(bank, poolFor(items, [bank], origin), ctxFor(origin))
    plans.push({ origin, ...plan })
    if (plan.questions.length > VALIDITY.maxQuestions) fail(`${origin}/${bank}: ${plan.questions.length} questions`)
    let prev = Infinity
    for (const q of plan.questions) {
      if (!['P0', 'P1'].includes(q.source.tier)) fail(`${origin}/${bank}/${q.id}: tier ${q.source.tier}`)
      if (q.source.url && tierOf(q.source.url) !== q.source.tier) fail(`${origin}/${bank}/${q.id}: authority_tiers says ${tierOf(q.source.url)} for ${q.source.url}`)
      if (q.coverage < VALIDITY.minCoverage) fail(`${origin}/${bank}/${q.id}: coverage ${q.coverage}`)
      if (plan.pool < VALIDITY.minPool) fail(`${origin}/${bank}/${q.id}: pool ${plan.pool}`)
      for (const o of q.options) if (!(o.crossed > 0 && o.crossed < plan.pool)) fail(`${origin}/${bank}/${q.id}/${o.value}: crossed ${o.crossed}/${plan.pool}`)
      if (q.score > prev + 1e-9) fail(`${origin}/${bank}: order`)
      prev = q.score
      const def = CANDIDATES.find((c) => c.id === q.id)
      if (def.sampled && q.id === 'channels') {
        const ctx = ctxFor(origin)
        for (const item of poolFor(items, [bank], origin)) for (const code of def.values(item, ctx) ?? []) if (!ctx.confirmedChannels.has(`${item.id}|${code}`)) fail(`${origin}/${bank}: unconfirmed channel ${item.id}|${code} used`)
      }
    }
  }
}

// 不進引擎的候選題（批 G8 起用 R1／R2 研究資料重算）：海外英語總分、國際生學費、澳門元學費
const parse = (path) => {
  const t = readFileSync(join(root, path), 'utf8'); const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < t.length; i += 1) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i += 1 } else q = false } else cell += ch } else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = '' } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' } else if (ch !== '\r') cell += ch }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows; return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])))
}
const overseasPool = new Set(poolFor(items, ['overseas'], 'cn-mainland').map((i) => i.id))
const r1English = parse('data/research/overseas_english.2026-11-08.csv').filter((r) => overseasPool.has(r.institutionId))
const r1Tuition = parse('data/research/overseas_tuition.2026-11-08.csv').filter((r) => overseasPool.has(r.institutionId))
const byCountry = (rows, key) => { const m = new Map(); for (const r of rows) { const c = m.get(r.region) ?? [0, 0]; c[1] += 1; if (r[key] === 'extracted') c[0] += 1; m.set(r.region, c) } return [...m.entries()].filter(([, [k, n]]) => k / n >= VALIDITY.minCoverage).map(([c, [k, n]]) => `${c} ${k}/${n}`) }
const moFees = parse('data/research/macau_admission.2026-11-08.csv').filter((r) => /／年|／學年|每年/.test(r.tuitionValue))
const offline = [
  { bank: 'overseas', id: 'englishOverall', known: r1English.filter((r) => r.englishStatus === 'extracted').length, pool: r1English.length, reason: 'coverage', note: `R1（規則 r1-2026-11-08u；終版抽樣 45/45 為樣本內準確率）：只採原句寫明本科 IELTS／TOEFL 最低總分者。達 60% 的國家只有 ${byCountry(r1English, 'englishStatus').join('、') || '（無）'}，單國題庫不存在；香港機構的國際生頁在香港題庫的分母是 16 所，不足 60%` },
  { bank: 'overseas', id: 'tuition', known: r1Tuition.filter((r) => r.tuitionStatus === 'extracted').length, pool: r1Tuition.length, reason: 'coverage', note: 'R1：原句明確為本科國際生每年學費者；6 種幣別，未做匯率換算；全量 22/22 核對（樣本內）' },
  { bank: 'mo', id: 'tuitionMop', known: moFees.length, pool: 10, reason: 'coverage', note: `R2：原句明寫每年者 ${moFees.map((r) => r.nameZh).join('、')}，其中澳門元與港幣混雜；全期、未寫期間者不換算（主會話裁定）` },
]
for (const o of offline) if (o.known / o.pool >= VALIDITY.minCoverage && o.reason === 'coverage') fail(`${o.bank}/${o.id} now passes coverage (${o.known}/${o.pool}) — re-evaluate`)

// 批 G7：非大學路徑題（企業直招）——來源 P0、已核 ≥2、覆蓋 ≥60% 才出題；只看目的地，與起點無關
const pathPlans = ['cn-mainland', 'hk', 'mo', 'tw', 'overseas'].map((d) => planDirectHire(d, atlas.programs))
for (const p of pathPlans) {
  for (const e of p.verified) if (tierOf(e.officialUrl) !== 'P0') fail(`directHire/${p.destination}/${e.id}: official page not P0`)
  const should = p.verified.length >= DIRECT_HIRE_RULE.minVerified && p.coverage >= DIRECT_HIRE_RULE.minCoverage
  if (p.question !== should) fail(`directHire/${p.destination}: question ${p.question} but rule says ${should}`)
}

const pct = (x) => `${(x * 100).toFixed(0)}%`
console.log(JSON.stringify({ origins: ORIGINS.length, banks: BANKS.length, plans: plans.map((p) => `${p.origin}/${p.bank}:${p.questions.map((q) => q.id).join('+') || '-'}`), offline: offline.map((o) => `${o.bank}/${o.id} ${o.known}/${o.pool}`), directHire: pathPlans.map((p) => `${p.destination}:${p.verified.length}/${p.total}${p.question ? ' asked' : ''}`), channelChecks: `${checks.confirmed.length} confirmed / ${checks.checked}`, errors: errors.length }))

const mdIndex = process.argv.indexOf('--md')
if (mdIndex !== -1) {
  const out = []
  const groups = new Map()
  for (const p of plans) { const key = `${p.bank}|${JSON.stringify(p.questions.map((q) => [q.id, q.options.map((o) => [o.value, o.crossed])]))}|${JSON.stringify(p.rejected.map((r) => [r.id, r.reason]))}|${p.pool}`; if (!groups.has(key)) groups.set(key, { ...p, origins: [] }); groups.get(key).origins.push(p.origin) }
  for (const bank of BANKS) {
    out.push(`## 題庫：${{ hk: '香港', mo: '澳門', tw: '臺灣', overseas: '海外' }[bank]}`)
    for (const g of [...groups.values()].filter((x) => x.bank === bank)) {
      out.push('', `### 起點：${g.origins.join('、')}（池 ${g.pool} 所）`, '')
      out.push('| 題 | 類型 | 來源（層級） | 覆蓋 | 預期劃掉 × 覆蓋 | 各選項單選劃掉數 | 結論 |', '| --- | --- | --- | --- | --- | --- | --- |')
      for (const q of g.questions) out.push(`| ${q.id} | ${q.kind} | ${q.source.ref}（${q.source.tier}） | ${q.known}/${g.pool}（${pct(q.coverage)}） | ${q.score.toFixed(1)} | ${q.options.map((o) => `${o.value} ${o.crossed}`).join('；')} | 採用 |`)
      for (const r of g.rejected) out.push(`| ${r.id} | — | — | ${r.known}/${g.pool}（${pct(r.coverage)}） | — | — | 捨棄：${{ pool_small: '題庫池少於 10 所', coverage: '覆蓋未達 60%', no_effect: '沒有能劃掉又不劃光的選項', over_limit: '超過 8 題' }[r.reason]} |`)
    }
    for (const o of offline.filter((x) => x.bank === bank)) out.push('', `- 不進引擎的候選 \`${o.id}\`：${o.known}/${o.pool}（${pct(o.known / o.pool)}）→ 捨棄（${o.reason === 'source' ? '官方來源未取得' : '覆蓋未達 60%'}）；${o.note}`)
    out.push('')
  }
  out.push('## 非大學路徑題：你考不考慮不讀大學、直接進企業的路徑？（批 G7）', '', '不劃掉任何學校；選「不考慮」結果頁就不列企業直招。來源＝條目自己的官方頁（authority_tiers P0）且核對信心 high／medium＝已核；已核 ≥2 條且已核／全部 ≥60% 才出題。', '', '| 目的地 | 條目 | 已核 | 覆蓋 | 結論 |', '| --- | --- | --- | --- | --- |')
  for (const p of pathPlans) out.push(`| ${{ 'cn-mainland': '中國大陸', hk: '香港', mo: '澳門', tw: '臺灣', overseas: '海外' }[p.destination]} | ${p.total} | ${p.verified.length} | ${p.total ? pct(p.coverage) : '—'} | ${p.question ? '出題' : p.total ? '不出題（已核少於 2 條）：照列已核條目' : '不出題（沒有條目）'} |`)
  out.push('')
  writeFileSync(process.argv[mdIndex + 1], out.join('\n') + '\n')
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
