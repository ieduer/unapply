#!/usr/bin/env node
// 全站外部鏈接年檢（路線圖橫切項「對外鏈接規則」，批 F1 起）。網路依賴，**不**在發布閘門內。
//
//   npm run audit:links -- --out .tmp/link-check                       # 全量：盤點 → 逐條核查 → CSV＋summary
//   npm run audit:links -- --only data/research/school_websites.2026-04-21.csv   # 只核某一來源檔的 URL（可逗號分隔多個）
//   npm run audit:links -- --sample 10                                 # 每個來源檔抽樣 10%（決定性：按 URL 雜湊取樣）
//   npm run audit:links -- --since data/research/link_check.2026-11-07.csv.gz    # 與基線比對：基線 ok／reused 且 URL 未變者沿用不重抓，只重核壞鏈／被擋／不可達／跨網域轉址／新 URL
//   npm run audit:links -- --report <results.csv[.gz]> --out DIR       # 不打網路：只由既有結果 CSV 產出 summary JSON（入庫基線用）
//   npm run audit:links -- --inventory-only --out DIR                  # 只盤點，不打網路
//
// 盤點範圍：data/research/*.csv 欄名含 url／website 的欄、data/research/s1_sources.json 的 pageUrl／fileUrl、src/**/*.ts(x) 硬編碼鏈接
// （含生成檔，標 generated）、public/data/**/*.json 內所有 URL 字串。模板字串（含 ${）不計。
// 禮貌：UA 明示身分與聯絡方式；尊重 robots.txt（5xx 視為全禁；Crawl-delay 最多 10 秒）；同可註冊網域 ≥2 秒；全程同時連線 ≤6（NOPE_MAX_INFLIGHT）；
// 逾時 12 秒；403／404／412 不重試；只對連線重置重試 1 次；不停用 TLS 驗證；不登入、不填表、不繞過任何挑戰；不存頁面本文（只存狀態／標題／雜湊）。
// 狀態：ok＝2xx 且最終可註冊網域不變；redirect-cross-domain＝2xx 但最終網域改變；broken＝404／410／5xx 等非 2xx；
//      blocked＝401／403／412／429／503 或 200 挑戰殼（可見文字 <600 字且含挑戰字樣）——**被擋不算不可達**（研究 PENDING 第 6 項的預設口徑，待站長確認）；
//      robots-disallow；unreachable＝DNS／TLS／連線／逾時（大陸校網多為海外出口被重置：**連續兩輪不可達才標暫不可達**，見 docs/MAINTENANCE_MANUAL.md §3.9；本工具以 --since 基線的狀態＋本輪狀態判「連續兩輪」，寫在 notes）；
//      reused-baseline＝--since 基線 ok 且 URL 未變，沿用。
// 輸出（與研究會話 2026-11-07 的 link_check CSV 同欄）：<out>/link_check.<日期>.csv、<out>/link_check.<日期>.summary.json（各狀態與 tier 計數、壞鏈與跨網域清單、每來源檔計數）。
// 權威分級：src/data/authorityTiers.ts 規則表（由 data:tiers 生成）＋網域型態啟發式（與 src/lib/authorityTier.ts 相同）；不認得的第三方網域預設 P2 並標 review。
// 移植自 reports/operations/nope-xcut-directhire-links-20261107/research/tools/{inventory,check_links,tiers,build_link_report}.mjs（Node ≥22，無第三方依賴）。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { domainOf, hostOf, loadTierRules, makeTierOf } from './lib/authority_tier.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'] : []).filter(Boolean))
const TODAY = new Date().toISOString().slice(0, 10)
const OUT = resolve(process.cwd(), args.out || '.tmp/link-check')
const UA = 'Mozilla/5.0 (compatible; nope.bdfz.net link checker; +https://nope.bdfz.net; contact nope@bdfz.net)'
const MIN_INTERVAL_MS = 2000
const TIMEOUT_MS = Number(process.env.NOPE_TIMEOUT_MS || 12000)
const MAX_INFLIGHT = Math.min(6, Number(process.env.NOPE_MAX_INFLIGHT || 6))
const MAX_BODY_BYTES = 1_500_000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const nowIso = () => new Date().toISOString()
const die = (m) => { console.error(`check_links: ${m}`); process.exit(2) }

// ---------- CSV ----------
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false; else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return { header, rows: body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) }
}
const csvCell = (v) => { const t = v === undefined || v === null ? '' : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
const readMaybeGz = (p) => p.endsWith('.gz') ? gunzipSync(readFileSync(p)).toString('utf8') : readFileSync(p, 'utf8')

// ---------- 網域與權威分級（共用 scripts/lib/authority_tier.mjs；與 src/lib/authorityTier.ts 同一規則） ----------
const stripFragment = (url) => { try { const u = new URL(url); u.hash = ''; return u.href } catch { return url } }
const tierRules = loadTierRules(join(root, 'data/research')).rules
const ruleTier = makeTierOf(tierRules)
function classify(url, ctx = {}) {
  const t = ruleTier(url)
  if (t) return t
  if (ctx.grasOfficial) return { tier: 'P0', reason: 'S0 兩來源交叉核查之機構官網' }
  if (ctx.cnSchoolSite) return ctx.titleMatch === 'yes' ? { tier: 'P0', reason: '中國大陸高校校網（非 edu.cn 網域，頁面標題含校名）' } : { tier: 'P0', reason: '中國大陸高校校網（非 edu.cn 網域，標題未能自動確認校名，列入人工覆核）', review: true }
  return { tier: 'P2', reason: '未在規則表中的第三方網域（預設 P2，列入人工覆核）', review: true }
}

// ---------- 盤點 ----------
const URL_RE = /https?:\/\/[^\s"'`<>()\[\]{}|\\^、，；]+/g
function walkDir(dir, acc = []) { for (const e of readdirSync(dir)) { const p = join(dir, e); const st = statSync(p); if (st.isDirectory()) walkDir(p, acc); else acc.push(p) } return acc }
function inventory() {
  const items = []
  const push = (url, sourceFile, sourceField, rowKey) => {
    let u = String(url).trim().replace(/[.,;:)\]]+$/, '')
    if (!/^https?:\/\//i.test(u) || u.includes('${') || u.includes('$')) return
    if (!hostOf(u) || !/\./.test(hostOf(u))) return
    items.push({ url: u, sourceFile, sourceField, rowKey })
  }
  const rel = (p) => relative(root, p)
  const csvDir = join(root, 'data', 'research')
  for (const f of readdirSync(csvDir).filter((f) => f.endsWith('.csv')).sort()) {
    if (/^link_check\./.test(f) || /^authority_tiers\./.test(f)) continue
    const { header, rows } = parseCsv(readFileSync(join(csvDir, f), 'utf8'))
    const fields = header.filter((h) => /url|website/i.test(h))
    if (!fields.length) continue
    rows.forEach((r, i) => { const key = (r[header[0]] || '') + '#' + (i + 2); for (const k of fields) for (const u of (r[k] || '').match(URL_RE) || []) push(u, 'data/research/' + f, k, key) })
  }
  const s1 = JSON.parse(readFileSync(join(csvDir, 's1_sources.json'), 'utf8'))
  for (const s of s1.sources || []) for (const k of ['pageUrl', 'fileUrl', 'url', 'sourceUrl']) if (s[k]) push(s[k], 'data/research/s1_sources.json', k, s.id)
  for (const f of readdirSync(csvDir).filter((f) => /^origin_sources\..*\.json$/.test(f))) { const j = JSON.parse(readFileSync(join(csvDir, f), 'utf8')); for (const s of j.sources || []) if (s.url) push(s.url, 'data/research/' + f, 'url', s.id) }
  for (const p of walkDir(join(root, 'src')).filter((p) => /\.(ts|tsx)$/.test(p)).sort()) {
    const text = readFileSync(p, 'utf8'); const generated = /^\/\/ Generated by /m.test(text.slice(0, 400))
    text.split('\n').forEach((line, i) => { for (const u of line.match(URL_RE) || []) push(u, rel(p), generated ? 'generated-ts' : 'hardcoded', `L${i + 1}`) })
  }
  const walkJson = (o, path, cb) => { if (Array.isArray(o)) o.forEach((v) => walkJson(v, path + '[]', cb)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walkJson(v, path ? path + '.' + k : k, cb); else if (typeof o === 'string' && /^https?:\/\//i.test(o.trim())) cb(path, o.trim()) }
  for (const p of walkDir(join(root, 'public', 'data')).filter((p) => p.endsWith('.json')).sort()) {
    let j; try { j = JSON.parse(readFileSync(p, 'utf8')) } catch { continue }
    let idx = 0
    walkJson(j, '', (path, url) => { idx += 1; push(url, rel(p), path.replace(/\.[0-9]{6,}(\[\])/g, '.<moeCode>$1'), `#${idx}`) })
  }
  const byUrl = new Map()
  for (const it of items) { if (!byUrl.has(it.url)) byUrl.set(it.url, []); byUrl.get(it.url).push(it) }
  return { items, byUrl }
}

// ---------- robots ----------
const robotsCache = new Map()
function robotsPathMatches(pattern, path) { let re = ''; for (const ch of pattern) re += ch === '*' ? '.*' : ch === '$' ? '$' : ch.replace(/[.+?^{}()|[\]\\]/g, '\\$&'); return new RegExp('^' + re).test(path) }
function parseRobots(text) {
  const groups = []; let current = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue
    const key = m[1].toLowerCase(), val = m[2].trim()
    if (key === 'user-agent') { if (!current || current.rulesStarted) { current = { agents: [], rules: [], crawlDelay: null, rulesStarted: false }; groups.push(current) } current.agents.push(val.toLowerCase()) }
    else if (current && (key === 'allow' || key === 'disallow')) { current.rulesStarted = true; if (val) current.rules.push({ allow: key === 'allow', path: val }) }
    else if (current && key === 'crawl-delay') { current.rulesStarted = true; const n = Number(val); if (Number.isFinite(n)) current.crawlDelay = n }
  }
  const ua = UA.toLowerCase()
  return groups.find((g) => g.agents.some((a) => a !== '*' && a.length > 1 && ua.includes(a))) || groups.find((g) => g.agents.includes('*')) || null
}
async function robotsFor(url) {
  const u = new URL(url); const key = `${u.protocol}//${u.host}`
  if (robotsCache.has(key)) return robotsCache.get(key)
  let entry = { group: null, status: 0, disallowAll: false, error: '' }
  try {
    const res = await withSlot(() => fetch(`${key}/robots.txt`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) }))
    entry.status = res.status; counters.requests += 1
    if (res.status === 200) { const ct = res.headers.get('content-type') || ''; const text = (await res.text()).slice(0, 500_000); counters.bytes += Buffer.byteLength(text); if (!/html/i.test(ct) && !/^\s*<(!doctype|html)/i.test(text)) entry.group = parseRobots(text) }
    else if (res.status >= 500) entry.disallowAll = true
    else { try { await res.body?.cancel() } catch {} }
  } catch (e) { entry.error = errCode(e); counters.requests += 1; counters.errors += 1 }
  robotsCache.set(key, entry); return entry
}
function robotsAllows(entry, url) {
  if (!entry || entry.disallowAll) return !entry?.disallowAll
  if (!entry.group) return true
  const u = new URL(url); const path = u.pathname + (u.search || '')
  let best = null
  for (const r of entry.group.rules) if (robotsPathMatches(r.path, path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow))) best = r
  return best ? best.allow : true
}
const errCode = (e) => { const c = e?.cause; return String(c?.code || (c?.message && !/fetch failed/i.test(c.message) ? c.message : '') || e?.code || e?.name || e?.message || e).slice(0, 90) }

// ---------- 節流 ----------
const counters = { requests: 0, pages: 0, bytes: 0, blocked: 0, errors: 0, byStatus: {} }
let inflight = 0; const waiters = []
async function withSlot(fn) { if (inflight >= MAX_INFLIGHT) await new Promise((r) => waiters.push(r)); inflight += 1; try { return await fn() } finally { inflight -= 1; const w = waiters.shift(); if (w) w() } }
const domainState = new Map()
function withDomainSlot(domain, fn) {
  const st = domainState.get(domain) || { last: 0, chain: Promise.resolve() }; domainState.set(domain, st)
  const run = st.chain.then(async () => { const wait = st.last + MIN_INTERVAL_MS - Date.now(); if (wait > 0) await sleep(wait); try { return await fn() } finally { st.last = Date.now() } })
  st.chain = run.catch(() => {}); return run
}

// ---------- 抓取 ----------
function decodeBody(buf, contentType) {
  let cs = (/charset=([\w-]+)/i.exec(contentType || '') || [, ''])[1].toLowerCase()
  if (!cs) { const head = Buffer.from(buf.subarray(0, 4096)).toString('latin1'); const m = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head); cs = m ? m[1].toLowerCase() : 'utf-8' }
  if (cs === 'utf8') cs = 'utf-8'; if (/^(gb2312|gbk|gb-2312)$/.test(cs)) cs = 'gb18030'; if (/^(shift-jis|sjis|x-sjis)$/.test(cs)) cs = 'shift_jis'
  try { return new TextDecoder(cs, { fatal: false }).decode(buf) } catch { return new TextDecoder('utf-8').decode(buf) }
}
const htmlToText = (html) => String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const extractTitle = (html) => { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || ''); return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '' }
const CHALLENGE_RE = /cf-chl|cf_chl|challenge-platform|Just a moment|Attention Required|Access Denied|_Incapsula_Resource|Incapsula incident|Request unsuccessful|Pardon Our Interruption|distil_r_captcha|Please enable JavaScript and cookies to continue|DDoS protection by|Checking your browser|Verify you are human|Are you a robot|bot detection|Radware|Imperva|请完成安全验证|安全验证|访问被拒绝/i
async function politeFetch(url) {
  const target = stripFragment(url); const domain = domainOf(target)
  return withDomainSlot(domain, async () => {
    const robots = await robotsFor(target)
    if (robots.status === 0 && robots.error && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|CERT|certificate|UNABLE_TO_VERIFY|ERR_TLS|ERR_SSL|UND_ERR_SOCKET|ECONNRESET|TimeoutError|UND_ERR_CONNECT_TIMEOUT|EHOSTUNREACH|ENETUNREACH/i.test(robots.error)) return { url, status: 0, error: `host unreachable at robots: ${robots.error}`, fetchedAt: nowIso() }
    const delay = Math.min((robots.group?.crawlDelay || 0) * 1000, 10000); if (delay > MIN_INTERVAL_MS) await sleep(delay - MIN_INTERVAL_MS)
    if (!robotsAllows(robots, target)) return { url, status: 0, robotsBlocked: true, fetchedAt: nowIso() }
    let rec = null
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        rec = await withSlot(async () => {
          const res = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'zh-Hant,zh;q=0.9,en;q=0.8,*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
          const contentType = res.headers.get('content-type') || ''; const isText = /text\/|html|xml|json/i.test(contentType) || !contentType
          let buf; if (isText) buf = new Uint8Array(await res.arrayBuffer()); else { const reader = res.body?.getReader(); const chunks = []; let n = 0; if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.byteLength; if (n >= MAX_BODY_BYTES) { try { await reader.cancel() } catch {} break } } buf = Buffer.concat(chunks.map((c) => Buffer.from(c))) }
          const text = isText ? decodeBody(buf, contentType) : ''
          const html = /html|xml/i.test(contentType) || /^\s*<(!doctype|html)/i.test(text.slice(0, 500))
          const visible = html ? htmlToText(text) : text
          const challenge = res.status === 200 && CHALLENGE_RE.test(text.slice(0, 60000)) && visible.length < 600
          counters.requests += 1; counters.pages += 1; counters.bytes += buf.byteLength; counters.byStatus[res.status] = (counters.byStatus[res.status] || 0) + 1
          return { url, finalUrl: res.url, status: res.status, sha256: sha256(buf), title: html ? extractTitle(text) : '', textLength: visible.length, challenge, blocked: [401, 403, 429, 503].includes(res.status) || challenge, fetchedAt: nowIso(), attempt }
        })
        if ((rec.status === 429 || rec.status >= 500) && attempt === 1) { await sleep(MIN_INTERVAL_MS); continue }
        break
      } catch (e) { counters.requests += 1; counters.errors += 1; rec = { url, status: 0, error: errCode(e), fetchedAt: nowIso(), attempt }; if (attempt === 1 && /ECONNRESET|UND_ERR_SOCKET|EPIPE/i.test(rec.error)) { await sleep(2000); continue } break }
    }
    if (rec.blocked) counters.blocked += 1
    return rec
  })
}

// ---------- 判狀態 ----------
function statusOf(rec) {
  if (rec.reused) return rec.reused
  if (rec.robotsBlocked) return 'robots-disallow'
  if (rec.status === 0) return 'unreachable'
  if (rec.blocked) return 'blocked'
  if (rec.status >= 200 && rec.status < 300) return domainOf(rec.finalUrl || rec.url) !== domainOf(rec.url) ? 'redirect-cross-domain' : 'ok'
  return 'broken'
}
const RECHECK_STATUSES = new Set(['broken', 'blocked', 'unreachable', 'redirect-cross-domain', 'robots-disallow'])

// ---------- 報告 ----------
const HEADER = ['url', 'sourceFile', 'sourceField', 'rowKey', 'finalUrl', 'domain', 'crossDomainRedirect', 'http', 'status', 'pageTitle', 'sha256', 'fetchedAt', 'tier', 'tierReason', 'notes']
function buildSummary(rows, extra = {}) {
  const count = (key) => { const m = {}; for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1; return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])) }
  const bySource = {}
  for (const r of rows) for (const f of r.sourceFile.split('|')) { bySource[f] = bySource[f] || {}; bySource[f][r.status] = (bySource[f][r.status] || 0) + 1 }
  const pick = (r) => ({ url: r.url, finalUrl: r.finalUrl, http: Number(r.http) || 0, tier: r.tier, sourceFiles: r.sourceFile.split('|'), pageTitle: r.pageTitle, notes: r.notes })
  return {
    schema: 'nope.link-check-summary.v1', generatedFrom: extra.generatedFrom || null, checkedAt: extra.checkedAt || TODAY,
    method: 'Node fetch; UA 明示身分；尊重 robots.txt；同可註冊網域 ≥2 秒；並發 ≤6；403／404／412 不重試；不繞過挑戰；被擋不算不可達；不可達須連續兩輪才標暫不可達',
    counts: { urls: rows.length, domains: new Set(rows.map((r) => r.domain)).size, byStatus: count('status'), byTier: count('tier'), reviewFlagged: rows.filter((r) => /人工覆核/.test(r.tierReason)).length },
    bySourceFile: Object.fromEntries(Object.entries(bySource).sort()),
    broken: rows.filter((r) => r.status === 'broken').map(pick),
    redirectCrossDomain: rows.filter((r) => r.status === 'redirect-cross-domain').map(pick),
    blocked: rows.filter((r) => r.status === 'blocked').map((r) => ({ url: r.url, http: Number(r.http) || 0, tier: r.tier })),
    robotsDisallow: rows.filter((r) => r.status === 'robots-disallow').map((r) => r.url),
    unreachable: { count: rows.filter((r) => r.status === 'unreachable').length, note: '多為大陸校網對海外出口重置連線或 TLS 鏈不完整；不是壞鏈證據，連續兩輪不可達才標暫不可達', mainlandEdu: rows.filter((r) => r.status === 'unreachable' && /\.edu\.cn$/.test(r.domain)).length },
  }
}
function writeOutputs(rows, dateTag, extra) {
  mkdirSync(OUT, { recursive: true })
  const csv = [HEADER.join(','), ...rows.map((r) => HEADER.map((k) => csvCell(r[k])).join(','))].join('\n') + '\n'
  writeFileSync(join(OUT, `link_check.${dateTag}.csv`), csv)
  const summary = buildSummary(rows, extra)
  writeFileSync(join(OUT, `link_check.${dateTag}.summary.json`), JSON.stringify(summary, null, 2) + '\n')
  console.log(`wrote ${OUT}/link_check.${dateTag}.csv (${rows.length} rows) + summary: ${JSON.stringify(summary.counts.byStatus)} tiers ${JSON.stringify(summary.counts.byTier)}`)
  return summary
}

// ---------- 主流程 ----------
async function main() {
  if (args.report) {
    const { header, rows } = parseCsv(readMaybeGz(resolve(process.cwd(), args.report)))
    if (header.join(',') !== HEADER.join(',')) die(`report: unexpected header ${header.join(',')}`)
    const tag = (/link_check\.(\d{4}-\d{2}-\d{2})\./.exec(args.report) || [, TODAY])[1]
    writeOutputs(rows, tag, { generatedFrom: relative(root, resolve(process.cwd(), args.report)), checkedAt: tag })
    return
  }
  const { items, byUrl } = inventory()
  console.log(`inventory: ${items.length} occurrences, ${byUrl.size} distinct URLs, ${new Set([...byUrl.keys()].map(domainOf)).size} registrable domains`)
  if (args['inventory-only'] === 'true') { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'inventory.json'), JSON.stringify({ generatedAt: nowIso(), items }, null, 0)); return }
  let urls = [...byUrl.keys()]
  if (args.only) { const only = new Set(args.only.split(',').map((s) => s.trim())); urls = urls.filter((u) => byUrl.get(u).some((it) => only.has(it.sourceFile))) }
  if (args.sample) {
    const pct = Number(args.sample); if (!(pct > 0 && pct <= 100)) die('--sample must be 1..100 (percent)')
    const h = (s) => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) } return (x >>> 0) % 100 }
    urls = urls.filter((u) => h(u) < pct)
  }
  const baseline = new Map()
  if (args.since) { const { rows } = parseCsv(readMaybeGz(resolve(process.cwd(), args.since))); for (const r of rows) baseline.set(r.url, r); console.log(`baseline: ${rows.length} rows from ${args.since}`) }
  // GRAS 官網與 crs.jsj.edu.cn 詳情頁的脈絡（分級用）
  const grasFiles = readdirSync(join(root, 'data/research')).filter((f) => /^gras_institution_websites\./.test(f)).sort()
  const grasOfficial = new Set(grasFiles.length ? parseCsv(readFileSync(join(root, 'data/research', grasFiles.at(-1)), 'utf8')).rows.filter((r) => r.status === 'verified').map((r) => r.website) : [])
  const cnSchoolSite = (u) => byUrl.get(u).some((it) => /school_websites|laosheng_school_profiles|github_school_profiles|runtime\/schools\.json/.test(it.sourceFile) && /website/i.test(it.sourceField))
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
  urls.sort((a, b) => hash(a) - hash(b))
  const started = Date.now(); let n = 0
  const results = new Map()
  await Promise.all(urls.map(async (url) => {
    const base = baseline.get(url)
    let rec
    if (base && !RECHECK_STATUSES.has(base.status)) rec = { url, reused: 'reused-baseline', finalUrl: base.finalUrl || url, status: Number(base.http) || 0, sha256: base.sha256, title: base.pageTitle, fetchedAt: base.fetchedAt }
    else rec = await politeFetch(url)
    results.set(url, { rec, base })
    n += 1
    if (n % 100 === 0) process.stderr.write(`[${nowIso()}] ${n}/${urls.length} req=${counters.requests} blocked=${counters.blocked} err=${counters.errors} MiB=${(counters.bytes / 1048576).toFixed(1)} ${Math.round((Date.now() - started) / 1000)}s\n`)
  }))
  const rows = urls.map((url) => {
    const { rec, base } = results.get(url); const sources = byUrl.get(url)
    const status = statusOf(rec)
    const title = rec.title || ''
    const schoolNames = sources.map((it) => (it.rowKey || '').split('#')[0]).filter((s) => /[㐀-鿿]/.test(s))
    const titleMatch = cnSchoolSite(url) ? (schoolNames.some((nm) => title.includes(nm.replace(/大学|学院|学校/g, '').slice(0, 4))) ? 'yes' : 'no') : ''
    const tier = classify(url, { grasOfficial: grasOfficial.has(url), cnSchoolSite: cnSchoolSite(url), titleMatch })
    const notes = []
    if (rec.error) notes.push(rec.error)
    if (rec.challenge) notes.push('challenge shell')
    if (status === 'unreachable') notes.push(base && base.status === 'unreachable' ? '連續兩輪不可達：可標暫不可達（人工確認後）' : '首輪不可達：不標，下一輪再核')
    if (status === 'redirect-cross-domain') notes.push(`→ ${hostOf(rec.finalUrl)}`)
    if (titleMatch) notes.push(`title-match:${titleMatch}`)
    return { url, sourceFile: [...new Set(sources.map((s) => s.sourceFile))].join('|'), sourceField: [...new Set(sources.map((s) => s.sourceField))].join('|'), rowKey: sources.map((s) => s.rowKey).slice(0, 3).join('|') + (sources.length > 3 ? `|+${sources.length - 3}` : ''), finalUrl: rec.finalUrl || '', domain: domainOf(url), crossDomainRedirect: rec.finalUrl ? (domainOf(rec.finalUrl) !== domainOf(url) ? 'yes' : 'no') : '', http: rec.status ?? 0, status, pageTitle: title, sha256: rec.sha256 || '', fetchedAt: rec.fetchedAt || '', tier: tier.tier, tierReason: tier.reason, notes: notes.join('; ') }
  })
  const summary = writeOutputs(rows, TODAY, { checkedAt: TODAY })
  console.log(JSON.stringify({ requests: counters.requests, bytes: counters.bytes, blocked: counters.blocked, errors: counters.errors, broken: summary.broken.length, redirectCrossDomain: summary.redirectCrossDomain.length }))
}
await main()
