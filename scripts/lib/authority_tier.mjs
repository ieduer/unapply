// 外部鏈接權威分級（Node 端共用；與 src/lib/authorityTier.ts 同一規則）：規則表 data/research/authority_tiers.<日期>.csv（prefix → host → registrable，長網域先比）
// ＋網域型態啟發式（gov 類／edu・ac 類 → P0）。都不認得回 null，由呼叫端依脈絡補（如 check_links 預設 P2、build_db 依資料層脈絡）。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SECOND_LEVEL = new Set(['ac', 'edu', 'co', 'com', 'org', 'gov', 'net', 'or', 'ne', 'go', 'gouv', 'gc', 'gob', 'govt', 'sch', 'in', 'rnu', 'nhs', 'police', 'mil', 'lg'])
export function registrableDomain(hostname) {
  const parts = String(hostname || '').toLowerCase().replace(/\.$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const tld = parts[parts.length - 1], second = parts[parts.length - 2]
  if (tld.length === 2 && SECOND_LEVEL.has(second)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}
export const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase() } catch { return '' } }
export const domainOf = (url) => registrableDomain(hostOf(url))

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') q = false; else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [h, ...b] = rows
  return b.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])))
}

export function loadTierRules(researchDir) {
  const files = readdirSync(researchDir).filter((f) => /^authority_tiers\.\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort()
  if (!files.length) throw new Error('missing data/research/authority_tiers.<date>.csv')
  const order = { prefix: 0, host: 1, registrable: 2 }
  const rules = parseCsv(readFileSync(join(researchDir, files.at(-1)), 'utf8'))
    .map((r) => ({ domain: r.domain.toLowerCase(), match: r.match, tier: r.tier, nameZh: r.nameZh, reason: r.reason }))
    .sort((a, b) => order[a.match] - order[b.match] || b.domain.length - a.domain.length || a.domain.localeCompare(b.domain, 'en'))
  return { file: files.at(-1), rules }
}

const GOV_RE = /(^|\.)(gov|gob|gouv|govt|go|gc|mil|lg)\.[a-z]{2}$|(^|\.)gov$|(^|\.)gv\.at$|(^|\.)admin\.ch$|(^|\.)europa\.eu$/i
const EDU_RE = /(^|\.)(edu|ac)\.[a-z]{2,3}$|(^|\.)edu$/i

/** 回傳 { tier, reason, by: 'rule'|'heuristic' } 或 null。 */
export function makeTierOf(rules) {
  return (url) => {
    let parsed; try { parsed = new URL(url) } catch { return null }
    if (!/^https?:$/.test(parsed.protocol)) return null
    const host = parsed.hostname.toLowerCase(), href = parsed.href.toLowerCase()
    for (const r of rules) {
      const hit = r.match === 'prefix' ? href.startsWith(r.domain) : r.match === 'host' ? host === r.domain : (host === r.domain || host.endsWith(`.${r.domain}`))
      if (hit) return { tier: r.tier, reason: `${r.nameZh}：${r.reason}`, by: 'rule' }
    }
    if (GOV_RE.test(host)) return { tier: 'P0', reason: '政府／主管機關官方網域（gov 類）', by: 'heuristic' }
    if (EDU_RE.test(host)) return { tier: 'P0', reason: '教育機構官方網域（edu／ac 類）', by: 'heuristic' }
    return null
  }
}
