// 使用者的「所在地／升學身份」起點。它決定從哪個題庫開始，不是問卷答案，也不進 AnswerMap。
// 目前只有中國大陸有完整的學校減法題庫；港澳臺起點先進院校池（#/hkmotw），其他國家或地區先進海外可申請學校（#/overseas），
// 並明說題庫分支尚未建成（見 docs/GLOBAL_ROADMAP.md 的階段表）。

export type OriginRegion = 'cn-mainland' | 'hk' | 'mo' | 'tw' | 'overseas'

export interface OriginOption {
  id: OriginRegion
  label: string
  hint: string
  /** 這個起點目前有沒有本地學校減法題庫。 */
  hasLocalPool: boolean
}

export const originOptions: readonly OriginOption[] = [
  { id: 'cn-mainland', label: '中國大陸', hint: '教育部 2026 名單 2,952 所普通高校的減法題庫', hasLocalPool: true },
  { id: 'hk', label: '香港', hint: '港澳臺院校池已上線（官方招生管道）；本地減法題庫建設中（路線圖 S4）', hasLocalPool: false },
  { id: 'mo', label: '澳門', hint: '港澳臺院校池已上線（官方招生管道）；本地減法題庫建設中（路線圖 S4）', hasLocalPool: false },
  { id: 'tw', label: '臺灣', hint: '港澳臺院校池已上線（官方招生管道）；本地減法題庫建設中（路線圖 S4）', hasLocalPool: false },
  { id: 'overseas', label: '其他國家或地區', hint: '海外機構招生頁已上線（S3）；題庫分支建設中（S4）', hasLocalPool: false },
]

export const defaultOrigin: OriginRegion = 'cn-mainland'
export const ORIGIN_STORAGE_KEY = 'unapply.origin.v1'

export function getOriginOption(id: OriginRegion): OriginOption {
  return originOptions.find((option) => option.id === id) ?? originOptions[0]
}

export function readStoredOrigin(): OriginRegion | null {
  try {
    const stored = window.localStorage.getItem(ORIGIN_STORAGE_KEY)
    if (stored && originOptions.some((option) => option.id === stored)) return stored as OriginRegion
  } catch {
    // 隱私模式／禁用儲存：當成沒選過
  }
  return null
}

export function saveOrigin(origin: OriginRegion) {
  try {
    window.localStorage.setItem(ORIGIN_STORAGE_KEY, origin)
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}
