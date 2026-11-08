// 起點與目的地 → 減法流程（2026-11-08 批 G6，主會話裁定 A／B）。純函式、語言中立、不碰 AnswerMap：
//   - 目的地含「中國大陸」→ 階段一＝大陸 45 題（#/filter，題目與學習證據契約不變）；
//     非大陸起點走大陸階段時，S1 選考科目組合不適用（不是以高考選科報考）→ 自動略過（與手動「跳過」同一個值 'skip'，不參與篩選）。
//   - 目的地含香港／澳門／臺灣／海外任一 → 階段二＝全球減法（#/global，展示層），池只含所選目的地。
//   - 兩者都有：先大陸、後全球；只有非大陸目的地：直接進全球，不經任何大陸題。
// 起點、資格與目的地都不是問卷答案：不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據（tests/flow-plan.test.ts 斷言）。
import type { OriginRegion } from '../data/origins'
import type { Destination, Qualification } from '../data/originBranch'

export type FlowStage = 'mainland' | 'global'
export type GlobalDestination = Exclude<Destination, 'cn-mainland'>

/** 依顯示順序；與 originBranch.DESTINATIONS 一致（這裡不匯入值，保持引擎只依賴型別）。 */
const ORDER: readonly Destination[] = ['cn-mainland', 'hk', 'mo', 'tw', 'overseas']
export const GLOBAL_DESTINATIONS: readonly GlobalDestination[] = ['hk', 'mo', 'tw', 'overseas']

/**
 * 非大陸起點在大陸階段自動略過的題（批 G6 擴充，逐題判斷「只適用高考考生」）：
 *   S1 選考科目組合（新高考選科）；A6 另外報名／校測（藝體特長、綜合評價、軍警航海飛行等高考招生類型，依考生省份的招生管道表判定）。
 * 其餘 43 題講地區、城市、層次、學費、校區、環境、生活、專業開設，任何起點都適用。
 */
export const NON_MAINLAND_AUTO_SKIP: readonly string[] = ['S1', 'A6']

/** 進大陸階段（任何入口：首頁、瀏覽頁的「進中國大陸題庫」、深鏈 #/filter）時自動略過的題：只看起點。 */
export function mainlandAutoSkip(origin: OriginRegion | null): readonly string[] {
  return origin && origin !== 'cn-mainland' ? NON_MAINLAND_AUTO_SKIP : []
}

export interface FlowPlan {
  /** 實際用來排程的起點；未選＝中國大陸（深鏈 #/filter 的預設）。 */
  origin: OriginRegion
  /** 已正規化的目的地（排序去重，至少一個）。 */
  destinations: Destination[]
  stages: FlowStage[]
  /** 首頁「開始減法」進入的路由。 */
  entry: 'filter' | 'global'
  /** 大陸階段自動略過的題號（只對非大陸起點）。 */
  autoSkip: readonly string[]
  /** 全球階段的目的地（不含中國大陸）；沒有全球階段時為空。 */
  globalDestinations: GlobalDestination[]
  /** 資格題只對非大陸起點出現；大陸起點恆為 null。 */
  qualification: Qualification | null
  showQualification: boolean
}

export function normalizeDestinations(origin: OriginRegion | null, destinations: readonly unknown[] | null | undefined): Destination[] {
  const list = ORDER.filter((d) => (destinations ?? []).includes(d))
  return list.length ? list : [origin ?? 'cn-mainland']
}

export function planFlow(origin: OriginRegion | null, destinations: readonly unknown[] | null | undefined, qualification: Qualification | null = null): FlowPlan {
  const effective: OriginRegion = origin ?? 'cn-mainland'
  const list = normalizeDestinations(effective, destinations)
  const mainland = list.includes('cn-mainland')
  const globalDestinations = GLOBAL_DESTINATIONS.filter((d) => list.includes(d))
  const stages: FlowStage[] = [...(mainland ? ['mainland' as const] : []), ...(globalDestinations.length ? ['global' as const] : [])]
  const showQualification = effective !== 'cn-mainland'
  return {
    origin: effective,
    destinations: list,
    stages,
    entry: mainland ? 'filter' : 'global',
    autoSkip: mainland ? mainlandAutoSkip(origin) : [],
    globalDestinations,
    qualification: showQualification ? qualification : null,
    showQualification,
  }
}

/** 某題在這個流程裡是否自動略過。 */
export function isAutoSkipped(plan: Pick<FlowPlan, 'autoSkip'>, questionId: string): boolean {
  return plan.autoSkip.includes(questionId)
}
