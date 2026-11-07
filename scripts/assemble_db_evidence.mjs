#!/usr/bin/env node
// 路線圖 S5（批 F2）：把只讀研究會話保存的逐 URL 抓取證據（最終網址、HTTP、SHA-256、抓取時間）整理成倉庫內的離線證據檔，讓 build_db.mjs 不必連網、不必讀倉庫外的檔。
//
//   node scripts/assemble_db_evidence.mjs --date 2026-11-07 \
//     --s3 ../../../reports/operations/nope-s3-overseas-20261107/research/sources.json \
//     --s4 ../../../reports/operations/nope-s4-i18n-origins-20261107/research/sources.json \
//     --xcut ../../../reports/operations/nope-xcut-directhire-links-20261107/research/sources.json
//
// 只收 scripts/lib/db_layers.mjs 列出的來源 URL；倉庫內已有的證據（海外平台／簽證 CSV、origin_sources、s1_sources、合作辦學 CSV、data/research/link_check.*.csv.gz）
// 由 build_db.mjs 直接讀，這裡只補研究目錄裡才有的（主要是海外機構招生頁與原文片段來源）。不連網、不改其他檔；輸出決定性（同輸入同位元組）。
// 輸出：data/research/db_source_evidence.<date>.json.gz（{ schema, date, inputs, count, evidence: { url: { finalUrl, http, sha256, fetchedAt, from } } }）
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { collectLayers } from './lib/db_layers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter(Boolean))
const die = (m) => { console.error(`assemble_db_evidence: ${m}`); process.exit(2) }
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date || '')) die('--date YYYY-MM-DD required')
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const inputs = {}
const found = new Map()
const put = (url, rec, from) => { if (!found.has(url)) found.set(url, { ...rec, from }) }

const layers = collectLayers(root)
const wanted = new Set(layers.sourceHints.filter((h) => !h.evidence).map((h) => h.url))

if (args.s3) {
  const p = resolve(process.cwd(), args.s3); inputs.s3 = { file: p.split('/reports/')[1] ? 'reports/' + p.split('/reports/')[1] : p, sha256: sha(p) }
  const j = JSON.parse(readFileSync(p, 'utf8'))
  // 研究爬蟲以請求網址為鍵；原文片段引用的是最終網址（轉址後，常多一個結尾斜線）——兩者都對。
  for (const [url, r] of Object.entries(j.sources)) {
    if (r.kind === 'robots') continue
    const rec = { finalUrl: r.finalUrl || null, http: r.status ?? null, sha256: r.sha256 || null, fetchedAt: r.fetchedAt || null, blocked: !!r.blocked }
    if (wanted.has(url)) put(url, rec, 's3-research')
    if (r.finalUrl && wanted.has(r.finalUrl)) put(r.finalUrl, { ...rec, requestedAs: url }, 's3-research(final)')
  }
}
if (args.s4) {
  const p = resolve(process.cwd(), args.s4); inputs.s4 = { file: p.split('/reports/')[1] ? 'reports/' + p.split('/reports/')[1] : p, sha256: sha(p) }
  const j = JSON.parse(readFileSync(p, 'utf8'))
  for (const [url, r] of Object.entries(j.sources)) {
    const rec = { finalUrl: r.finalUrl || null, http: r.http ?? null, sha256: r.sha256 || null, fetchedAt: r.fetchedAt || null, status: r.status || null }
    if (wanted.has(url)) put(url, rec, 's4-research')
    if (r.finalUrl && wanted.has(r.finalUrl)) put(r.finalUrl, { ...rec, requestedAs: url }, 's4-research(final)')
  }
}
if (args.xcut) {
  const p = resolve(process.cwd(), args.xcut); inputs.xcut = { file: p.split('/reports/')[1] ? 'reports/' + p.split('/reports/')[1] : p, sha256: sha(p) }
  const j = JSON.parse(readFileSync(p, 'utf8'))
  for (const r of j.sources) if (wanted.has(r.url)) put(r.url, { finalUrl: r.finalUrl || null, http: r.http ?? null, sha256: r.sha256 || null, fetchedAt: r.fetchedAt || null, status: r.status || null }, 'xcut-research')
}
const evidence = Object.fromEntries([...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
const out = { schema: 'nope.db-source-evidence.v1', date: args.date, note: '只讀研究會話保存的逐 URL 抓取證據子集（只收 data:db 會引用、倉庫內又沒有證據的來源 URL）；http 為最終回應碼，sha256 為回應本文雜湊（被擋或未讀到者可能為空）。', inputs, wanted: wanted.size, count: found.size, evidence }
const gz = gzipSync(Buffer.from(JSON.stringify(out) + '\n'), { level: 9 })
const target = join(root, 'data', 'research', `db_source_evidence.${args.date}.json.gz`)
writeFileSync(target, gz)
console.log(JSON.stringify({ wanted: wanted.size, found: found.size, missing: wanted.size - found.size, bytes: gz.length, target: target.replace(root + '/', '') }))
