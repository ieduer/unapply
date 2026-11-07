#!/usr/bin/env node
// 為世界學科地圖的機構補「學校官網」鏈接，而且每一條都要核查過才收。
//
//   node scripts/verify_institution_websites.mjs --year 2026
//   node scripts/verify_institution_websites.mjs --year 2026 --from data/research/gras_institution_websites.<日期>.csv   # 離線：用上一輪記錄的候選與連通結果重判，不打網路
//   node scripts/verify_institution_websites.mjs --year 2026 --from <上一輪 CSV> --recheck   # 只對上一輪未通過的列重打網路（含人工覆核清單 MANUAL_REVIEW），其餘列照抄
//   node scripts/verify_institution_websites.mjs --year 2026 --from <上一輪 CSV> --recheck --only RI02126,RI02976   # 只重打指定機構（須有 MANUAL_REVIEW 條目；鏈接年檢發現官網跨網域轉址時用），其餘列照抄
//
// 候選來源（都是公開、可追溯的）：
//   sr   軟科機構頁 https://www.shanghairanking.com/institution/<univUp> 裡的官網鏈接（排名機構自己登記的官網）
//   wd   Wikidata P856（官方網站）
//   moe  本站教育部主表的 website 欄（大陸機構；來源見 data/research/school_websites.*.csv）
// 核查：
//   1. 實際 GET（跟隨最多 5 次轉址、20 秒逾時），最終狀態 200，且最終網域與候選同一個可註冊網域（www 變動不算）。
//   2. 兩個獨立來源同一網域 → high；只有一個來源但網域像學術機構（.edu／.ac.／.edu.xx／大學字樣）→ medium；
//      其餘 → 不收（留在 review 欄位供人工）。
// 輸出 data/research/gras_institution_websites.<日期>.csv；build_world_atlas 只合併 status=verified 的列。

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean))
const year = Number(args.year || 2026)
const UA = 'Mozilla/5.0 (compatible; nope.bdfz.net link verifier; contact nope@bdfz.net)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
const csvCell = (v) => { const t = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }

const SECOND_LEVEL = new Set(['ac', 'edu', 'co', 'com', 'org', 'gov', 'net', 'or', 'ne'])
function registrableDomain(hostname) {
  const parts = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const tld = parts[parts.length - 1]
  const second = parts[parts.length - 2]
  if (tld.length === 2 && SECOND_LEVEL.has(second)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}
const NON_UNIVERSITY_HOSTS = /shanghairanking|beian\.miit|miit\.gov|pstatp|weibo|wechat|qq\.com|twitter|x\.com|facebook|linkedin|youtube|instagram|tiktok|bilibili|wikipedia|wikidata|google|baidu/i
const ACADEMIC_PATTERN = /(^|\.)(edu|ac)(\.[a-z]{2})?$|\.edu\.[a-z]{2}$|\.ac\.[a-z]{2}$|univ|uni-|universit|college|institute|hochschule|polytech|school|hospital|mdanderson|\.ethz\.ch$|\.epfl\.ch$|\.mit\.edu$|\.cnrs\.fr$/i

async function fetchText(url, timeout = 30000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(timeout) })
  return { status: res.status, url: res.url, text: res.ok ? await res.text() : '' }
}

async function srWebsite(univUp) {
  if (!univUp) return null
  try {
    const { status, text } = await fetchText(`https://www.shanghairanking.com/institution/${univUp}`)
    if (status !== 200) return null
    const hrefs = [...text.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
    return hrefs.find((h) => !NON_UNIVERSITY_HOSTS.test(h)) || null
  } catch { return null }
}

async function wikidataWebsites(qids) {
  const out = new Map()
  for (let i = 0; i < qids.length; i += 80) {
    const batch = qids.slice(i, i + 80)
    const query = `SELECT ?item ?website WHERE { VALUES ?item { ${batch.map((q) => `wd:${q}`).join(' ')} } ?item wdt:P856 ?website . }`
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })
      if (res.ok) {
        for (const b of (await res.json()).results.bindings) {
          const id = b.item.value.split('/').pop()
          if (!out.has(id)) out.set(id, b.website.value)
        }
        break
      }
      await sleep(4000 * (attempt + 1))
    }
    await sleep(1000)
  }
  return out
}

async function verifyUrl(candidate) {
  try {
    const target = new URL(candidate)
    const res = await fetch(target.href, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
    const finalUrl = new URL(res.url)
    const sameDomain = registrableDomain(finalUrl.hostname) === registrableDomain(target.hostname)
    return { ok: res.status === 200 && sameDomain, status: res.status, finalUrl: finalUrl.href }
  } catch (error) {
    return { ok: false, status: 0, finalUrl: '', error: error instanceof Error ? error.message.slice(0, 80) : String(error) }
  }
}

// 核查規則（站長 2026-11-06：鏈接必須核查是官方或權威）：
//   high    ≥2 個獨立權威來源同一網域，且實際連通（200、最終網域一致）
//   medium  ≥2 個來源同一網域但連通被擋（403／412／逾時等，常見於反爬），記錄狀態；或單一來源為軟科機構頁／教育部主表且連通；
//           或單一 Wikidata 來源、連通且網域像學術機構
//   不收    其餘（留 status 供人工覆核）
function decide(domain, list, first, check) {
  const sources = list.map((c) => c.source).sort().join('+')
  const multi = list.length >= 2
  // 連通成功用最終網址；被擋時優先給 https 的候選（同網域）。
  const url = check.ok ? check.finalUrl : (list.find((c) => c.url.startsWith('https://'))?.url || first.url)
  if (multi && check.ok) return { website: url, domain, sources, confidence: 'high', status: 'verified', http: check.status }
  if (multi) return { website: url, domain, sources, confidence: 'medium', status: 'verified', http: check.status, note: `sources agree; live fetch blocked or failed (${check.status}${check.error ? ' ' + check.error : ''})` }
  if (check.ok && (first.source === 'sr' || first.source === 'moe')) return { website: url, domain, sources, confidence: 'medium', status: 'verified', http: check.status }
  if (check.ok && (ACADEMIC_PATTERN.test(domain) || ACADEMIC_PATTERN.test(first.url))) return { website: url, domain, sources, confidence: 'medium', status: 'verified', http: check.status }
  return { website: '', domain, sources, confidence: '', status: check.ok ? 'rejected-single-source' : 'unreachable', http: check.status, note: check.error || '' }
}

// 人工覆核清單（手冊 §3.3 第 3 點：不要手改 CSV 補鏈接，改這裡再重跑）。只收「上一輪未通過」而人工確認過的機構官網：
// 每條寫明證據（兩個來源的網域經轉址後一致、或單一來源的學術網域實際連通）與覆核日；仍要實際 GET 連通、最終網域一致才收。
// 2026-11-07（批 D4）：S0 留下的 13 所。
const MANUAL_REVIEW = {
  RG00017: { url: 'https://www.utm.edu.mo/', evidence: 'sr 單一來源；.edu.mo 學術網域；2026-11-07 GET 200（該站 TLS 憑證鏈缺中繼憑證，Node fetch 驗證失敗、curl 以系統信任鏈通過）', reviewedAt: '2026-11-07', curlFallback: true },
  RI00055: { url: 'https://www.monash.edu/', evidence: 'sr monash.edu.au 與 wd monash.edu 同一機構；兩網址對腳本回 403（反爬），以內建瀏覽器開啟確認為 Monash University 官網', reviewedAt: '2026-11-07', allowBlocked: true },
  RI00101: { url: 'https://www.tuwien.at/', evidence: 'sr tuwien.ac.at 轉址到 tuwien.at，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI00128: { url: 'https://www.uantwerpen.be/', evidence: 'sr uantwerp.be 轉址到 uantwerpen.be，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI00910: { url: 'https://home.iitd.ac.in/', evidence: 'sr iitd.ernet.in 不通；wd iitd.ac.in（.ac.in 學術網域）轉址到 home.iitd.ac.in；GET 200', reviewedAt: '2026-11-07' },
  RI01179: { url: 'https://www.unibocconi.it/', evidence: 'sr unibocconi.eu 轉址到 unibocconi.it，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI01613: { url: 'https://www.universiteitleiden.nl/', evidence: 'sr leiden.edu 轉址到 universiteitleiden.nl，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI01647: { url: 'https://www.bi.no/', evidence: 'sr bi.edu 轉址到 bi.no，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI02150: { url: 'https://www.uab.cat/', evidence: 'sr 網址壞掉（http://http//www.uab.cat/en）修正後與 wd 同為 uab.cat；GET 200', reviewedAt: '2026-11-07' },
  RI02214: { url: 'https://www.usc.gal/', evidence: 'sr usc.es 轉址到 usc.gal，與 wd 一致；GET 200', reviewedAt: '2026-11-07' },
  RI02745: { url: 'https://indianapolis.iu.edu/', evidence: 'sr iupui.edu 轉址到 indianapolis.iu.edu（IUPUI 2024 年起改為 Indiana University Indianapolis，iu.edu 為印第安納大學官方網域）；GET 200', reviewedAt: '2026-11-07' },
  RI02940: { url: 'https://www.utsouthwestern.edu/', evidence: 'sr swmed.edu 轉址到 utsouthwestern.edu（.edu 學術網域，UT Southwestern 官網）；wd utswmedicine.org 為其醫療品牌網域；GET 200', reviewedAt: '2026-11-07' },
  RI03812: { url: 'https://mbzuai.ac.ae/', evidence: 'sr 單一來源 .ac.ae 學術網域；對腳本回 403（反爬），以內建瀏覽器開啟確認為 MBZUAI 官網', reviewedAt: '2026-11-07', allowBlocked: true },
  // 2026-11-07 鏈接年檢（reports/operations/nope-xcut-directhire-links-20261107/research/link_check_summary.md §4）：原官網跨網域轉址，最終網域仍明顯是該校（.ac.kr／.edu）。
  // 暫不套用（批 F1 決定，見 reports/operations/nope-s5-db-xcut-20261107/nope-f1/link_fixes.md）：S0 官網是海外層 S3 的錨點（officialWebsite／officialDomain 決定招生頁能否上鏈接），
  // 改網域會連帶改變 S3 判定（CU Denver 招生頁在 ucdenver.edu 會由 high 降 medium；POSTECH 招生頁在 postech.ac.kr 會由 medium 升 high，屬 S3 待站長項）。
  // 下一輪 S3 重抓時與 overseas_admissions 同批套用：取消註解後跑 --from <CSV> --recheck --only RI02126,RI02976。
  // RI02126: { url: 'https://www.postech.ac.kr/kor/index.do', evidence: 'sr＋wd 同為 postech.edu，2026-11-07 鏈接年檢見其跨網域轉址至 postech.ac.kr/kor/index.do（韓國學術網域，頁面標題「가치창출대학 POSTECH」；根路徑 / 回 404，故記最終網址）；改為最終網址', reviewedAt: '2026-11-07' },
  // RI02976: { url: 'https://www.cudenver.edu/', evidence: 'sr＋wd 同為 ucdenver.edu，2026-11-07 鏈接年檢見其跨網域轉址至 cudenver.edu（.edu 學術網域，University of Colorado Denver 官網）；改為最終網址', reviewedAt: '2026-11-07' },
}

function normalizeCandidate(url) {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    if (!/^https?:$/.test(u.protocol)) return null
    u.hash = ''
    return u.href
  } catch { return null }
}

async function redecideFrom(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'))
  const rank = { moe: 0, sr: 1, wd: 2 }
  const out = []
  for (const r of rows) {
    const candidates = r.candidates ? r.candidates.split(' | ').map((c) => { const i = c.indexOf(':'); return { source: c.slice(0, i), url: c.slice(i + 1) } }) : []
    const byDomain = new Map()
    for (const c of candidates) { const d = registrableDomain(new URL(c.url).hostname); if (!byDomain.has(d)) byDomain.set(d, []); byDomain.get(d).push(c) }
    const ordered = [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length || Math.min(...a[1].map((c) => rank[c.source])) - Math.min(...b[1].map((c) => rank[c.source])))
    // 離線重判：沿用上一輪對「第一個網域」記錄的連通結果（http／website／note），不再打網路。
    let picked = null
    for (const [domain, list] of ordered) {
      const first = [...list].sort((a, b) => rank[a.source] - rank[b.source])[0]
      const recordedForThisDomain = r.domain === domain
      if (!recordedForThisDomain) break
      const httpStatus = Number(r.http) || 0
      const wasOk = httpStatus === 200 && (r.status === 'verified' || r.status.startsWith('rejected'))
      const check = { ok: wasOk, status: httpStatus, finalUrl: r.website || first.url, error: r.note || '' }
      const decided = decide(domain, list, first, check)
      picked = decided
      break
    }
    // 上一輪是在第二個網域才通過的列：沿用原判定（網域、網址、可信度都已記錄）。
    if (!picked) {
      const matching = candidates.find((c) => registrableDomain(new URL(c.url).hostname) === r.domain)
      const derivedConfidence = r.confidence || (r.status === 'verified' ? (r.sources.includes('+') ? 'high' : 'medium') : '')
      picked = { website: r.website || (r.status === 'verified' && matching ? matching.url : ''), domain: r.domain || '', sources: r.sources || '', confidence: derivedConfidence, status: r.status || 'no-candidate', http: r.http || '', note: r.note || '' }
    }
    out.push({ univCode: r.univCode, nameEn: r.nameEn, region: r.region, ...picked, candidates: r.candidates })
  }
  return out
}

// 只重查上一輪未通過的列：有人工覆核條目的用覆核網址實際 GET；沒有的照原候選重打一次。通過的列逐字照抄（含 verifiedAt）。
async function recheckFrom(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'))
  const only = typeof args.only === 'string' ? new Set(args.only.split(',').map((c) => c.trim()).filter(Boolean)) : null
  if (only) for (const code of only) if (!MANUAL_REVIEW[code]) throw new Error(`--only ${code}: no MANUAL_REVIEW entry（指定重核的機構必須先寫人工覆核證據）`)
  const out = []
  for (const r of rows) {
    if (only ? !only.has(r.univCode) : r.status === 'verified') { out.push({ ...r }); continue }
    const review = MANUAL_REVIEW[r.univCode]
    if (review) {
      let check = await verifyUrl(review.url)
      // 憑證鏈不完整（缺中繼憑證）時 Node 驗不過、系統 curl 能過：只對人工覆核條目且標了 curlFallback 的用 curl 再試一次，結果照實記進 note。
      if (!check.ok && review.curlFallback) {
        const { execFileSync } = await import('node:child_process')
        try {
          const out = execFileSync('curl', ['-sS', '-o', '/dev/null', '-L', '--max-time', '20', '-A', UA, '-w', '%{http_code} %{url_effective}', review.url], { encoding: 'utf8' })
          const [status, finalUrl] = out.trim().split(' ')
          const sameDomain = registrableDomain(new URL(finalUrl).hostname) === registrableDomain(new URL(review.url).hostname)
          check = { ok: status === '200' && sameDomain, status: Number(status), finalUrl, error: check.error }
        } catch (error) { check = { ...check, error: (check.error || '') + ' / curl: ' + String(error.message).slice(0, 60) } }
      }
      const domain = registrableDomain(new URL(review.url).hostname)
      const sources = (r.candidates || '').split(' | ').filter(Boolean).map((c) => c.slice(0, c.indexOf(':'))).sort().join('+') || 'manual'
      if (check.ok) out.push({ ...r, website: check.finalUrl, domain, sources, confidence: /\+/.test(sources) ? 'high' : 'medium', status: 'verified', http: check.status, note: `manual review ${review.reviewedAt}: ${review.evidence}`, verifiedAt: review.reviewedAt })
      else if (review.allowBlocked && [401, 403, 412, 429, 503].includes(check.status)) out.push({ ...r, website: review.url, domain, sources, confidence: 'medium', status: 'verified', http: check.status, note: `manual review ${review.reviewedAt}: ${review.evidence}（腳本連通被擋 ${check.status}）`, verifiedAt: review.reviewedAt })
      else out.push({ ...r, status: 'unreachable', http: check.status, note: `manual review candidate failed: ${check.status} ${check.error || ''}`.trim() })
      await sleep(300)
      continue
    }
    out.push({ ...r })
  }
  return out
}

async function main() {
  if (args.from && 'recheck' in args) {
    const rows = await recheckFrom(args.from)
    writeRows(rows)
    return
  }
  if (args.from) {
    const rows = await redecideFrom(args.from)
    writeRows(rows, args.from)
    return
  }
  const geoFiles = (await import('node:fs')).readdirSync(join(root, 'data/research')).filter((f) => f.startsWith('gras_institutions_geo.') && f.endsWith('.csv')).sort()
  const geo = parseCsv(readFileSync(join(root, 'data/research', geoFiles[geoFiles.length - 1]), 'utf8'))
  const schools = JSON.parse(readFileSync(join(root, 'public/data/runtime/schools.json'), 'utf8'))
  const moeWebsite = new Map(schools.filter((s) => s.moeCode && s.website).map((s) => [s.moeCode, s.website]))

  const qids = [...new Set(geo.map((g) => g.wikidata).filter(Boolean))]
  process.stdout.write(`wikidata P856 for ${qids.length} items…\n`)
  const wd = await wikidataWebsites(qids)

  const rows = []
  let i = 0
  for (const inst of geo) {
    i += 1
    const candidates = []
    const sr = normalizeCandidate(await srWebsite(inst.univUp)); await sleep(250)
    if (sr) candidates.push({ source: 'sr', url: sr })
    const wdUrl = normalizeCandidate(inst.wikidata ? wd.get(inst.wikidata) : null)
    if (wdUrl) candidates.push({ source: 'wd', url: wdUrl })
    const moe = normalizeCandidate(inst.moeCode ? moeWebsite.get(inst.moeCode) : null)
    if (moe) candidates.push({ source: 'moe', url: moe })

    const byDomain = new Map()
    for (const c of candidates) {
      const d = registrableDomain(new URL(c.url).hostname)
      if (!byDomain.has(d)) byDomain.set(d, [])
      byDomain.get(d).push(c)
    }
    // 偏好：來源最多的網域；同票時 moe > sr > wd（教育部表是本站既有權威，軟科次之）。
    const rank = { moe: 0, sr: 1, wd: 2 }
    const ordered = [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length || Math.min(...a[1].map((c) => rank[c.source])) - Math.min(...b[1].map((c) => rank[c.source])))
    let picked = null
    for (const [domain, list] of ordered) {
      const first = [...list].sort((a, b) => rank[a.source] - rank[b.source])[0]
      const check = await verifyUrl(first.url)
      const decided = decide(domain, list, first, check)
      if (decided.status === 'verified') { picked = decided; break }
      picked = picked || decided
    }
    if (!picked) picked = { website: '', domain: '', sources: '', confidence: '', status: 'no-candidate', http: '' }
    rows.push({ univCode: inst.univCode, nameEn: inst.nameEn, region: inst.region, ...picked, candidates: candidates.map((c) => `${c.source}:${c.url}`).join(' | ') })
    if (i % 25 === 0) process.stdout.write(`${i}/${geo.length} verified=${rows.filter((r) => r.status === 'verified').length}\n`)
  }

  writeRows(rows)
}

function writeRows(rows, outPathOverride) {
  const verifiedAt = new Date().toISOString().slice(0, 10)
  const header = ['univCode', 'nameEn', 'region', 'website', 'domain', 'sources', 'confidence', 'status', 'http', 'note', 'candidates', 'rankingYear', 'verifiedAt']
  const out = [header.join(','), ...rows.map((r) => header.map((k) => csvCell(k === 'rankingYear' ? year : k === 'verifiedAt' ? (r.verifiedAt || verifiedAt) : r[k] ?? '')).join(','))].join('\n') + '\n'
  const outPath = outPathOverride || join(root, 'data/research', `gras_institution_websites.${verifiedAt}.csv`)
  writeFileSync(outPath, out)
  const stats = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
  const conf = rows.filter((r) => r.status === 'verified').reduce((acc, r) => { acc[r.confidence] = (acc[r.confidence] || 0) + 1; return acc }, {})
  console.log(`wrote ${rows.length} rows → ${outPath}`)
  console.log('status', JSON.stringify(stats), 'confidence', JSON.stringify(conf))
  console.log('not verified:', rows.filter((r) => r.status !== 'verified').map((r) => `${r.nameEn} [${r.status} ${r.sources || '-'} ${r.http}]`).join(' | '))
}

await main()
