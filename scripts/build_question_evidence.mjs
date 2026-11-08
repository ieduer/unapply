// 題庫效度證據（2026-11-08 批 G6 擴充，主會話裁定「題目以效度為準」）：把人工核對過的官方名單與管道原句判讀轉成展示層模組。
//   - 香港教資會資助大學：教資會官方頁（中英兩版，原檔與 SHA-256 釘在 data/research/official/）→ 8 所，對到港澳臺院校池 id。
//   - 港澳院校內地生管道原句核對：每條管道以存下的官方原句人工判讀 confirmed／unconfirmed／not_bachelor；只有 confirmed 才作題目取值。
//   - 批 G8：澳門院校公立／私立（教青局「在澳學習」逐校原句；未寫明＝未知，不由「4 公 6 私」總數推斷）；
//     香港院校內地／非本地生本科年學費（官方原句，港幣；學年與口徑照原文）。兩者都要求原句含所記的值，否則不產出。
// fail-closed：原檔雜湊不符、名單名稱不在原檔正文、id 不在院校池、判讀值不合法，一律不產出。
// 產出：src/data/questionEvidence.ts（不進 AnswerMap、不進學習證據、不送 Function）。
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const die = (m) => { console.error(`build_question_evidence: ${m}`); process.exit(1) }
const sha = (p) => createHash('sha256').update(readFileSync(join(root, p))).digest('hex')
const text = (p) => readFileSync(join(root, p), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const csv = (p) => {
  const [head, ...lines] = readFileSync(join(root, p), 'utf8').trim().split('\n')
  const keys = head.split(',')
  return lines.map((line) => { const cells = line.split(','); const row = {}; keys.forEach((k, i) => { row[k] = i === keys.length - 1 ? cells.slice(i).join(',') : cells[i] }); return row })
}

function parseCsv(path) {
  const t = readFileSync(join(root, path), 'utf8')
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i]
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i += 1 } else q = false } else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])))
}

const PAGES = {
  'data/research/official/ugc_fund_inst.big5.2026-11-08.html': { url: 'https://www.ugc.edu.hk/big5/ugc/site/fund_inst.html', sha256: '3305b33db82085eb5ff95a37b8184449f47685de0011b429931f9bb451599f4f' },
  'data/research/official/ugc_fund_inst.eng.2026-11-08.html': { url: 'https://www.ugc.edu.hk/eng/ugc/site/fund_inst.html', sha256: 'd120f229aa3f52fc5e470d01a2dc8124f2624b2dc26517c1c2a00afb08859545' },
}
for (const [p, meta] of Object.entries(PAGES)) if (sha(p) !== meta.sha256) die(`${p} sha256 mismatch`)
const pool = JSON.parse(readFileSync(join(root, 'public/data/hkmotw/pool.json'), 'utf8'))
const ids = new Set(pool.institutions.map((i) => i.id))

const ugcRows = csv('data/research/question_validity/hk_ugc_funded.2026-11-08.csv')
if (ugcRows.length !== 8) die(`UGC list must have 8 rows, got ${ugcRows.length}`)
const big5 = text('data/research/official/ugc_fund_inst.big5.2026-11-08.html')
const eng = text('data/research/official/ugc_fund_inst.eng.2026-11-08.html')
for (const r of ugcRows) {
  if (!ids.has(r.institutionId) || !r.institutionId.startsWith('hk-')) die(`unknown HK institution ${r.institutionId}`)
  if (!big5.includes(r.listedZh)) die(`${r.listedZh} not on the UGC page (zh)`)
  if (!eng.includes(r.listedEn)) die(`${r.listedEn} not on the UGC page (en)`)
}

// 批 G8：R2 真實瀏覽器補讀後的修訂版（澳門旅遊、城大、理工、鏡湖、中西 confirmed；聖若瑟只招研究生）；原 2026-11-08 版保留
const checks = csv('data/research/question_validity/hkmotw_channel_checks.2026-11-08-r2.csv')
const VERDICTS = ['confirmed', 'unconfirmed', 'not_bachelor']
const recorded = new Set(pool.institutions.flatMap((i) => i.channels.map((c) => `${i.id}|${c.channel}`)))
for (const c of checks) {
  if (!VERDICTS.includes(c.verdict)) die(`bad verdict ${c.verdict}`)
  if (!recorded.has(`${c.institutionId}|${c.channel}`)) die(`channel ${c.institutionId}|${c.channel} not in the pool`)
  if (!c.basis || !c.checkedAt) die(`missing basis/checkedAt for ${c.institutionId}`)
}

// ---- 批 G8：澳門公立／私立
const MO_TYPES = 'data/research/question_validity/macau_institution_types.2026-11-08.csv'
const moRows = parseCsv(MO_TYPES)
if (moRows.length !== 10) die(`Macao types must have 10 rows, got ${moRows.length}`)
const moOwnership = { public: [], private: [], unknown: [] }
for (const r of moRows) {
  if (!ids.has(r.institutionId) || !r.institutionId.startsWith('mo-')) die(`unknown Macao institution ${r.institutionId}`)
  if (new URL(r.sourceUrl).hostname !== 'portal.dsedj.gov.mo') die(`${r.institutionId}: source must be the DSEDJ page`)
  if (r.officialType === '公立') { if (!r.quoteZh.includes('公立')) die(`${r.institutionId}: quote lacks 公立`); moOwnership.public.push(r.institutionId) }
  else if (r.officialType === '私立') { if (!r.quoteZh.includes('私立')) die(`${r.institutionId}: quote lacks 私立`); moOwnership.private.push(r.institutionId) }
  else if (r.status === 'not-stated-in-official-source') { if (/公立|私立/.test(r.quoteZh)) die(`${r.institutionId}: marked not stated but the quote has a type`); moOwnership.unknown.push(r.institutionId) }
  else die(`${r.institutionId}: unexpected type ${r.officialType}`)
}

// ---- 批 G8：香港內地／非本地生本科年學費（港幣）
const HK_FEES = 'data/research/question_validity/hk_tuition.2026-11-08.csv'
const feeRows = parseCsv(HK_FEES)
if (feeRows.length !== 16) die(`HK tuition must have 16 rows, got ${feeRows.length}`)
const amountIn = (quote, n) => { const q = quote.replace(/\s/g, ''); return q.includes(Number(n).toLocaleString('en-US')) || q.includes(String(n)) }
const hkTuition = { rows: [], blocked: [], notApplicable: [], checked: feeRows.length, checkedAt: '2026-11-08', source: HK_FEES }
for (const r of feeRows) {
  if (!ids.has(r.institutionId) || !r.institutionId.startsWith('hk-')) die(`unknown HK institution ${r.institutionId}`)
  if (r.status === 'blocked-in-browser') { hkTuition.blocked.push(r.institutionId); continue }
  if (r.status === 'not-applicable') { hkTuition.notApplicable.push(r.institutionId); continue }
  if (r.status !== 'verified-in-browser' || r.currency !== 'HKD') die(`${r.institutionId}: status ${r.status} currency ${r.currency}`)
  const min = Number(r.annualTuitionMin), max = Number(r.annualTuitionMax || r.annualTuitionMin)
  if (!(min > 0 && max >= min)) die(`${r.institutionId}: bad amounts ${r.annualTuitionMin}–${r.annualTuitionMax}`)
  if (!amountIn(r.quoteZh, min) || !amountIn(r.quoteZh, max)) die(`${r.institutionId}: amounts not in the quoted sentence`)
  if (!/^https:\/\//.test(r.sourceUrl)) die(`${r.institutionId}: source must be https`)
  const basis = /首年|first[- ]year/i.test(r.quoteZh) ? 'first-year' : /平均/.test(r.quoteZh + r.reviewNote) ? 'average' : 'per-year'
  hkTuition.rows.push({ id: r.institutionId, min, max, academicYear: r.academicYear, basis, url: r.sourceUrl, quote: r.quoteZh.slice(0, 400), readAt: r.readAt.slice(0, 10) })
}
hkTuition.rows.sort((a, b) => a.id.localeCompare(b.id))

const out = {
  macauOwnership: { ...moOwnership, checked: moRows.length, checkedAt: '2026-11-08', source: MO_TYPES, aggregate: moRows[0].aggregateQuote },
  hkTuition,
  ugcFunded: { ids: ugcRows.map((r) => r.institutionId).sort(), source: Object.values(PAGES), fetchedAt: '2026-11-08' },
  channelChecks: {
    confirmed: checks.filter((c) => c.verdict === 'confirmed').map((c) => `${c.institutionId}|${c.channel}`).sort(),
    unconfirmed: checks.filter((c) => c.verdict === 'unconfirmed').map((c) => `${c.institutionId}|${c.channel}`).sort(),
    notBachelor: checks.filter((c) => c.verdict === 'not_bachelor').map((c) => `${c.institutionId}|${c.channel}`).sort(),
    checked: checks.length,
    checkedAt: '2026-11-08',
  },
}
writeFileSync(join(root, 'src/data/questionEvidence.ts'), `// Generated by scripts/build_question_evidence.mjs from data/research/question_validity/ and data/research/official/. Do not edit by hand.
// 題庫效度證據（展示層）：香港教資會資助大學官方名單；港澳院校內地生管道的原句人工判讀（只有 confirmed 才作題目取值）。
export const questionEvidence = ${JSON.stringify(out, null, 2)} as const
`)
console.log(JSON.stringify({ moPublic: moOwnership.public.length, moPrivate: moOwnership.private.length, moUnknown: moOwnership.unknown.length, hkFees: hkTuition.rows.length, hkFeeBases: hkTuition.rows.map((r) => `${r.id}:${r.basis}`).join(' '), ugc: out.ugcFunded.ids.length, confirmed: out.channelChecks.confirmed.length, unconfirmed: out.channelChecks.unconfirmed.length, notBachelor: out.channelChecks.notBachelor.length }))
