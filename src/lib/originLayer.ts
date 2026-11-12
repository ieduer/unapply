// 起點分支的展示層小引擎（批 E2）：資格 token → 海外機構「校方頁面寫明接受」標示與計數。
// 只有保留語義：命中→標示；未命中→未知、不劃掉；永不過濾、永不改變機構數。與 engine/filter.ts 分離（海外池不是 School[]）。
import { originManifest } from '../data/originManifest'
import type { GaokaoPolicy } from '../data/overseasTypes'
import { fetchJson } from './fetchJson'

export interface QualificationsPayload {
  version: string
  overseasVersion: string
  generatedAt: string
  institutions: number
  /** S3 `qualificationsListed` token → 寫明該資格的機構 id（排序）。 */
  tokens: Record<string, string[]>
  /** gaokaoPolicy=accepted 的機構 id。 */
  gaokaoAccepted: string[]
}

let payloadPromise: Promise<QualificationsPayload> | null = null

export function loadQualificationsIndex(): Promise<QualificationsPayload> {
  if (!payloadPromise) {
    payloadPromise = fetchJson<QualificationsPayload>(`${originManifest.path}?v=${encodeURIComponent(originManifest.version)}`)
      .then((payload) => {
        if (payload.version !== originManifest.version || payload.institutions !== originManifest.counts.institutions || Object.keys(payload.tokens ?? {}).length !== originManifest.counts.tokens || payload.gaokaoAccepted?.length !== originManifest.counts.gaokaoAccepted) {
          throw new Error('qualifications payload incomplete')
        }
        return payload
      })
      .catch((error: unknown) => { payloadPromise = null; throw error })
  }
  return payloadPromise
}

export interface QualificationMark {
  /** 校方頁面寫明含所選資格（或寫明接受高考）。 */
  listed: boolean
  /** 命中的 token（展示用）。 */
  matched: string[]
  /** 大陸起點：gaokaoPolicy=accepted。 */
  gaokao: boolean
}

/** 一所機構對一組資格 token 的標示。token 以子串相等比對（研究 §3）。 */
export function markInstitution(listed: readonly string[], gaokaoPolicy: GaokaoPolicy | null, tokens: readonly string[], gaokao: boolean): QualificationMark {
  const matched = tokens.filter((token) => listed.includes(token))
  const gaokaoHit = gaokao && gaokaoPolicy === 'accepted'
  return { listed: matched.length > 0 || gaokaoHit, matched, gaokao: gaokaoHit }
}

export interface QualificationCounts {
  total: number
  listed: number
  /** 未寫明（保留）＝total − listed；永不少於 0。 */
  unread: number
}

/** 以懶載索引算全層／某地區的計數；ids 不給＝全部機構。 */
export function countListed(payload: QualificationsPayload, tokens: readonly string[], gaokao: boolean, ids?: readonly string[]): QualificationCounts {
  const hit = new Set<string>()
  for (const token of tokens) for (const id of payload.tokens[token] ?? []) hit.add(id)
  if (gaokao) for (const id of payload.gaokaoAccepted) hit.add(id)
  const total = ids ? ids.length : payload.institutions
  const listed = ids ? ids.filter((id) => hit.has(id)).length : hit.size
  return { total, listed, unread: total - listed }
}
