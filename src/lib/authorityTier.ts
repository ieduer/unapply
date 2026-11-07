// 外部鏈接權威分級（路線圖橫切項，批 F1）：先查規則表（prefix → host → registrable），再用網域型態啟發式；都不認得的回 null（頁面不標）。
// 分級只看鏈接目標是誰，不看頁面當下是否可達；定義見 docs/MAINTENANCE_MANUAL.md §3.8。語言中立，不匯入 i18n。
import { authorityTierRules, type AuthorityTier } from '../data/authorityTiers'

export type { AuthorityTier }

const SECOND_LEVEL = new Set(['ac', 'edu', 'co', 'com', 'org', 'gov', 'net', 'or', 'ne', 'go', 'gouv', 'gc', 'gob', 'govt', 'sch', 'in', 'rnu', 'nhs', 'police', 'mil', 'lg'])

/** 可註冊網域（與 scripts/check_links.mjs 同一規則）：兩段式公用後綴（edu.cn／ac.uk／co.jp…）取三段，其餘取兩段。 */
export function registrableDomain(hostname: string): string {
  const parts = String(hostname || '').toLowerCase().replace(/\.$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const tld = parts[parts.length - 1]
  const second = parts[parts.length - 2]
  if (tld.length === 2 && SECOND_LEVEL.has(second)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

const GOV_RE = /(^|\.)(gov|gob|gouv|govt|go|gc|mil|lg)\.[a-z]{2}$|(^|\.)gov$|(^|\.)gv\.at$|(^|\.)admin\.ch$|(^|\.)europa\.eu$/i
const EDU_RE = /(^|\.)(edu|ac)\.[a-z]{2,3}$|(^|\.)edu$/i

export function tierOf(url: string | null | undefined): AuthorityTier | null {
  if (!url) return null
  let parsed: URL
  try { parsed = new URL(url) } catch { return null }
  if (!/^https?:$/.test(parsed.protocol)) return null
  const host = parsed.hostname.toLowerCase()
  const href = parsed.href.toLowerCase()
  for (const rule of authorityTierRules) {
    if (rule.match === 'prefix') { if (href.startsWith(rule.domain)) return rule.tier; continue }
    if (rule.match === 'host') { if (host === rule.domain) return rule.tier; continue }
    if (host === rule.domain || host.endsWith(`.${rule.domain}`)) return rule.tier
  }
  if (GOV_RE.test(host)) return 'P0'
  if (EDU_RE.test(host)) return 'P0'
  return null
}

/** 頁面上要標示的層級：OWN（本站／姊妹站）不標。 */
export function displayTier(url: string | null | undefined): Exclude<AuthorityTier, 'OWN'> | null {
  const tier = tierOf(url)
  return tier && tier !== 'OWN' ? tier : null
}
