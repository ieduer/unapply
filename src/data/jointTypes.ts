// 中外合作辦學資料層 payload 的型別（public/data/joint/*，由 scripts/build_joint_layer.mjs 生成）。
// 來源：教育部中外合作辦學監管工作信息平台（唯一主來源）。這一層不進任何題目與引擎、不進 AnswerMap；
// 只在結果卡片（計數）與學校詳情（清單）展示。收費欄平台沒有，所以不產生 A4 取值。

export type JointKind = 'institution' | 'project'
/** 中外合作辦學／內地與港澳臺地區合作辦學／境外高校在海南自由貿易港獨立辦學的大學（平台名單第五類）。 */
export type JointCooperation = 'sino_foreign' | 'mainland_hkmotw' | 'foreign_independent'
export type JointStatus = 'listed' | 'suspended' | 'merged' | 'terminated'

export interface JointItem {
  /** 平台詳情頁 id（來源網址 https://www.crs.jsj.edu.cn/aproval/detail/<id>）。 */
  id: number
  kind: JointKind
  coop: JointCooperation
  /** 平台原文名稱（簡體，照官方）。 */
  name: string
  /** 名稱後的括註（已注銷／已併入／停止招生…），空＝無。 */
  annotation: string
  status: JointStatus
  /** 外方（或港澳臺方）合作辦學者，平台原文。 */
  foreign: string
  /** 中方合作辦學者（校內機構／項目），平台原文；獨立法人機構為空。 */
  chinese: string
  /** 機構屬性：具有法人資格／不具有法人資格；項目為空。 */
  legalPerson: string
  /** 辦學層次和類別（平台原文，如「本科学历教育」「外国硕士学位教育」）。 */
  level: string
  /** 出現在哪個名單：本科／硕士及以上（平台分類）。 */
  levelLists: string
  programs: string
  enrolmentYears: string
  enrolmentEndYear: number | null
  admissionMode: string
  licenseKind: string
  licenseNo: string
  validUntil: string
  province: string
  url: string
  fetchedAt: string
}

export interface JointIndexEntry {
  /** 機構數、項目數、其中內地與港澳臺合作數、境外高校獨立辦學數、仍在名單（非註銷／併入／停辦）數。 */
  i: number
  p: number
  hk: number
  fi: number
  live: number
}

export interface JointIndexPayload {
  version: string
  generatedAt: string
  source: { title: string; url: string; note: string }
  schools: Record<string, JointIndexEntry>
}

export interface JointItemsPayload {
  version: string
  items: Record<string, JointItem[]>
  /** 對不到教育部主表的條目（平台有、本站找不到對應學校），只列不掛校。 */
  unmatched: JointItem[]
}
