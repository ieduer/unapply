// 起點分支（路線圖 S4 批 E2，研究 origin_branch_design.md 方案 B）：資格與範圍是「用戶是誰」，不是對學校的偏好——
// 像 origins.ts 的起點一樣存 localStorage（unapply.originPrefs.v1），不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function。
// 資格只用「保留」語義：海外機構官方頁寫明含該資格 → 標「校方頁面寫明接受」；沒寫明 → 未知、不劃掉。語言不進這一層（展示層以 origin.qual.*／origin.scope.* 翻譯）。
import type { OriginRegion } from './origins'
import { originSources } from './originSources'

export type Qualification =
  | 'hkdse' | 'hkdse-or-intl' | 'four-univ-jae' | 'gsat-ast' | 'ib-or-alevel'
  | 'uk-alevel' | 'ib' | 'us-hs' | 'au-atar' | 'de-abitur' | 'fr-bac' | 'jp' | 'kr' | 'sg' | 'my' | 'ca' | 'in' | 'other'

/** local＝只看所在地；abroad＝只看所在地以外（大陸起點＝港澳臺＋海外；海外起點＝海外＋港澳臺）；both＝並列。 */
export type Scope = 'local' | 'abroad' | 'both'

export interface QualificationOption {
  id: Qualification
  /** 對應 S3 `qualificationsListed` 的 token（子串相等）；空＝無專屬 token，全部未知。 */
  tokens: readonly string[]
  /** 「這是什麼資格」的官方頁（originSources 的 url；只有 live 的才渲染為鏈接）。 */
  sources: readonly string[]
}

export const GAOKAO_TOKEN = 'Gaokao (高考)'

export const QUALIFICATIONS_BY_ORIGIN: Record<OriginRegion, readonly Qualification[]> = {
  'cn-mainland': [],
  hk: ['hkdse', 'ib-or-alevel', 'other'],
  mo: ['four-univ-jae', 'hkdse-or-intl', 'other'],
  tw: ['gsat-ast', 'ib-or-alevel', 'other'],
  overseas: ['uk-alevel', 'ib', 'us-hs', 'au-atar', 'de-abitur', 'fr-bac', 'jp', 'kr', 'sg', 'my', 'ca', 'in', 'other'],
}

export const SCOPES_BY_ORIGIN: Record<OriginRegion, readonly Scope[]> = {
  'cn-mainland': ['local', 'abroad', 'both'],
  hk: ['local', 'abroad', 'both'],
  mo: ['local', 'abroad', 'both'],
  tw: ['local', 'abroad', 'both'],
  overseas: ['abroad', 'both'],
}

/** 範圍文案分三組：大陸起點、港澳臺起點（本地）、海外起點。 */
export function scopeGroup(origin: OriginRegion): 'cn' | 'local' | 'overseas' {
  return origin === 'cn-mainland' ? 'cn' : origin === 'overseas' ? 'overseas' : 'local'
}

const S = {
  hkeaaEn: 'https://www.hkeaa.edu.hk/en/hkdse/', hkeaaTc: 'https://www.hkeaa.edu.hk/tc/hkdse/', jupas: 'https://www.jupas.edu.hk/en/', edb: 'https://www.edb.gov.hk/tc/index.html',
  dsedjList: 'https://portal.dsedj.gov.mo/webdsejspace/internet/Inter_main_page.jsp?id=80123', must: 'https://ugadmissions.must.edu.mo/page/id-2840.html?locale=zh_TW',
  ceec: 'https://www.ceec.edu.tw/', ceecEn: 'https://www.ceec.edu.tw/en/', ceecGsat: 'https://www.ceec.edu.tw/en/xmdoc/cont?xsmsid=0J180519762978782512', ceecAst: 'https://www.ceec.edu.tw/en/xmdoc/cont?xsmsid=0J180520257949680510', ceecProcess: 'https://www.ceec.edu.tw/en/xmdoc/cont?xsmsid=0J180519600611186512', uacTw: 'https://www.uac.edu.tw/',
  ukLevels: 'https://www.gov.uk/what-different-qualification-levels-mean/list-of-qualification-levels', ucasTariff: 'https://www.ucas.com/undergraduate/applying-university/entry-requirements/ucas-tariff-points', ofqual: 'https://www.gov.uk/government/organisations/ofqual', ucas: 'https://www.ucas.com/',
  ibo: 'https://www.ibo.org/programmes/diploma-programme/',
  sat: 'https://satsuite.collegeboard.org/sat', act: 'https://www.act.org/content/act/en/products-and-services/the-act.html', ap: 'https://apstudents.collegeboard.org/what-is-ap', commonApp: 'https://www.commonapp.org/',
  atar: 'https://www.uac.edu.au/future-applicants/atar', vtac: 'https://www.vtac.edu.au/', qtac: 'https://www.qtac.edu.au/', studyAu: 'https://www.studyaustralia.gov.au/',
  kmk: 'https://www.kmk.org/themen/allgemeinbildende-schulen/bildungswege-und-abschluesse/sekundarstufe-ii-gymnasiale-oberstufe-und-abitur.html', anabin: 'https://anabin.kmk.org/', uniAssist: 'https://www.uni-assist.de/en/', hochschulstart: 'https://www.hochschulstart.de/', daad: 'https://www.daad.de/en/',
  onisep: 'https://www.onisep.fr/', campusFrance: 'https://www.campusfrance.org/en',
  dnc: 'https://www.dnc.ac.jp/kyotsu/', ejuEn: 'https://www.jasso.go.jp/en/ryugaku/eju/index.html', ejuJa: 'https://www.jasso.go.jp/ryugaku/eju/index.html', mext: 'https://www.mext.go.jp/en/', studyJp: 'https://www.studyinjapan.go.jp/en/',
  studyKr: 'https://www.studyinkorea.go.kr/',
  seab: 'https://www.seab.gov.sg/', moeSg: 'https://www.moe.gov.sg/',
  mpm: 'https://www.mpm.edu.my/', dongzong: 'https://www.dongzong.my/', moeMy: 'https://www.moe.gov.my/', emgs: 'https://educationmalaysia.gov.my/',
  ontario: 'https://www.ontario.ca/page/high-school-graduation-requirements', ircc: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html',
  cbse: 'https://www.cbse.gov.in/', cisce: 'https://cisce.org/',
  nzqa: 'https://www2.nzqa.govt.nz/ncea/', cao: 'https://www.cao.ie/', nuffic: 'https://www.nuffic.nl/en',
  neea: 'https://www.neea.edu.cn/', moeCn: 'http://www.moe.gov.cn/', chsi: 'https://gaokao.chsi.com.cn/',
  edbScheme2027: 'https://www.edb.gov.hk/tc/edu-system/postsecondary/policy-doc/pilot-scheme.html', edbScheme2026: 'https://www.edb.gov.hk/tc/edu-system/postsecondary/policy-doc/Scheme_2026/Scheme_2026.html',
  dseMeasures2023: 'https://www.gatzs.com.cn/gatzs/pz/hongkong/202301/20230116/2254669446.html', dseList2023: 'https://www.gatzs.com.cn/gatzs/pz/hongkong/202301/20230116/2254669442.html',
  joint2026: 'https://www.gatzs.com.cn/gatzs/pz/hongkong/202601/20260120/2293447012.html', gatzs: 'https://www.gatzs.com.cn/', gatzsGuide: 'https://www.gatzs.com.cn/bkzn/',
  moJae2021: 'https://www.gatzs.com.cn/gatzs/pz/aomen/202103/20210308/2035687239.html',
  // 2026-11-08 批 G4：真實瀏覽器覆核讀到的官方頁（data/research/origin_sources 新增）
  edbWay2026: 'https://www.edb.gov.hk/attachment/tc/edu-system/postsecondary/policy-doc/pilot-scheme/scheme_2026/way.pdf', edbList2026: 'https://www.edb.gov.hk/attachment/tc/edu-system/postsecondary/policy-doc/pilot-scheme/scheme_2026/list.pdf',
  ugc: 'https://www.ugc.edu.hk/eng/ugc/index.html', cspe: 'https://www.cspe.edu.hk/tc/', dsedj: 'https://portal.dsedj.gov.mo/webdsejspace/internet/Inter_main_page.jsp?id=80073',
  cac: 'https://www.cac.edu.tw/apply116/index.php', jbcrc: 'https://www.jbcrc.edu.tw/', frBac: 'https://www.education.gouv.fr/reussir-au-lycee/le-baccalaureat-general-10457', parcoursup: 'https://www.parcoursup.gouv.fr/',
  twGsat2023: 'https://www.gatzs.com.cn/gatzs/pz/tw/202301/20230116/2254669447.html', twGsat2019: 'https://www.gatzs.com.cn/gatzs/pz/tw/201901/20190130/1762061276.html', twSystem: 'https://www.gatzs.com.cn/z/tw/',
} as const

export const QUALIFICATION_OPTIONS: Record<Qualification, QualificationOption> = {
  hkdse: { id: 'hkdse', tokens: ['HKDSE'], sources: [S.hkeaaTc, S.hkeaaEn, S.jupas, S.edb, S.ugc, S.cspe] },
  'hkdse-or-intl': { id: 'hkdse-or-intl', tokens: ['HKDSE', 'International Baccalaureate', 'A-Level'], sources: [S.hkeaaTc, S.ucasTariff] },
  'four-univ-jae': { id: 'four-univ-jae', tokens: [], sources: [S.dsedjList, S.must, S.dsedj] },
  'gsat-ast': { id: 'gsat-ast', tokens: ['Taiwan GSAT / 學測'], sources: [S.ceec, S.ceecGsat, S.ceecAst, S.ceecProcess, S.uacTw, S.cac, S.jbcrc] },
  'ib-or-alevel': { id: 'ib-or-alevel', tokens: ['International Baccalaureate', 'A-Level'], sources: [S.ucasTariff, S.ukLevels, S.ibo] },
  'uk-alevel': { id: 'uk-alevel', tokens: ['A-Level', 'GCSE / O-Level', 'BTEC', 'Scottish Highers', 'Cambridge Pre-U'], sources: [S.ukLevels, S.ucasTariff, S.ofqual, S.ucas] },
  ib: { id: 'ib', tokens: ['International Baccalaureate'], sources: [S.ibo, S.ucasTariff] },
  'us-hs': { id: 'us-hs', tokens: ['High School Diploma (US)', 'SAT', 'ACT', 'Advanced Placement (AP)'], sources: [S.sat, S.act, S.ap, S.commonApp] },
  'au-atar': { id: 'au-atar', tokens: ['ATAR'], sources: [S.atar, S.vtac, S.qtac, S.studyAu] },
  'de-abitur': { id: 'de-abitur', tokens: ['Abitur'], sources: [S.kmk, S.anabin, S.uniAssist, S.hochschulstart, S.daad] },
  'fr-bac': { id: 'fr-bac', tokens: ['Baccalauréat (France)'], sources: [S.onisep, S.campusFrance, S.frBac, S.parcoursup] },
  jp: { id: 'jp', tokens: ['EJU (Japan)'], sources: [S.dnc, S.ejuJa, S.ejuEn, S.mext, S.studyJp] },
  kr: { id: 'kr', tokens: ['Suneung / CSAT (Korea)'], sources: [S.studyKr] },
  sg: { id: 'sg', tokens: ['A-Level', 'Pre-university / Junior College'], sources: [S.seab, S.moeSg] },
  my: { id: 'my', tokens: ['STPM / UEC (Malaysia)'], sources: [S.mpm, S.dongzong, S.moeMy, S.emgs] },
  ca: { id: 'ca', tokens: [], sources: [S.ontario, S.ircc] },
  in: { id: 'in', tokens: ['CBSE / ISC (India)'], sources: [S.cbse, S.cisce] },
  other: { id: 'other', tokens: [], sources: [S.nzqa, S.cao, S.nuffic] },
}

/** 大陸起點（高考）的制度官方頁。 */
export const MAINLAND_ORIGIN_SOURCES: readonly string[] = [S.neea, S.moeCn, S.chsi]

export interface MainlandChannel {
  id: 'hk-dse-scheme' | 'joint-admission' | 'mo-baosong' | 'mo-jae' | 'tw-gsat'
  /** 翻譯鍵前綴（ui.channels.<key>.title／.summary）。 */
  key: string
  /** 官方頁（只有 live 的才渲染為鏈接）。 */
  sources: readonly string[]
  /** 管道本身的核查狀態：verified＝至少一個官方頁已讀到；needs_review＝官方頁本站未讀到（不上鏈接）。 */
  status: 'verified' | 'needs_review'
}

/** 港澳臺起點進大陸高校的官方管道（研究 origin_branch_design.md §4 實際核查）。 */
export const MAINLAND_CHANNELS: Record<'hk' | 'mo' | 'tw', readonly MainlandChannel[]> = {
  hk: [
    { id: 'hk-dse-scheme', key: 'hk.dse', sources: [S.edbScheme2027, S.edbScheme2026, S.edbWay2026, S.edbList2026, S.dseMeasures2023, S.dseList2023], status: 'verified' },
    { id: 'joint-admission', key: 'hk.joint', sources: [S.joint2026, S.gatzs, S.gatzsGuide], status: 'verified' },
  ],
  mo: [
    { id: 'joint-admission', key: 'mo.joint', sources: [S.joint2026, S.gatzs, S.gatzsGuide], status: 'verified' },
    { id: 'mo-baosong', key: 'mo.baosong', sources: [], status: 'needs_review' },
    { id: 'mo-jae', key: 'mo.jae', sources: [S.moJae2021], status: 'verified' },
  ],
  tw: [
    { id: 'tw-gsat', key: 'tw.gsat', sources: [S.twGsat2023, S.twGsat2019, S.twSystem], status: 'verified' },
    { id: 'joint-admission', key: 'tw.joint', sources: [S.joint2026, S.gatzs, S.gatzsGuide], status: 'verified' },
  ],
}

export function sourceEntry(url: string) {
  return originSources[url]
}

export const ORIGIN_PREFS_STORAGE_KEY = 'unapply.originPrefs.v1'

export interface OriginPrefs {
  qualification: Qualification | null
  scope: Scope | null
}

export const emptyOriginPrefs: OriginPrefs = { qualification: null, scope: null }

export function isQualification(value: unknown): value is Qualification {
  return typeof value === 'string' && value in QUALIFICATION_OPTIONS
}

export function isScope(value: unknown): value is Scope {
  return value === 'local' || value === 'abroad' || value === 'both'
}

/** 依起點把無效的資格／範圍歸零（換起點時用）。 */
export function normalizeOriginPrefs(origin: OriginRegion | null, prefs: OriginPrefs): OriginPrefs {
  if (!origin) return emptyOriginPrefs
  const qualification = prefs.qualification && QUALIFICATIONS_BY_ORIGIN[origin].includes(prefs.qualification) ? prefs.qualification : null
  const scope = prefs.scope && SCOPES_BY_ORIGIN[origin].includes(prefs.scope) ? prefs.scope : null
  return { qualification, scope }
}

export function readStoredOriginPrefs(): OriginPrefs {
  try {
    const raw = window.localStorage.getItem(ORIGIN_PREFS_STORAGE_KEY)
    if (!raw) return emptyOriginPrefs
    const parsed = JSON.parse(raw) as Partial<OriginPrefs>
    return { qualification: isQualification(parsed.qualification) ? parsed.qualification : null, scope: isScope(parsed.scope) ? parsed.scope : null }
  } catch {
    return emptyOriginPrefs
  }
}

export function saveOriginPrefs(prefs: OriginPrefs) {
  try {
    window.localStorage.setItem(ORIGIN_PREFS_STORAGE_KEY, JSON.stringify({ qualification: prefs.qualification, scope: prefs.scope }))
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}

/** 海外層的資格標示依據：token 清單（大陸起點＝高考 token＋ gaokaoPolicy=accepted）。空＝不標示。 */
export function qualificationTokens(origin: OriginRegion | null, prefs: OriginPrefs): { tokens: readonly string[]; gaokao: boolean } {
  if (origin === 'cn-mainland') return { tokens: [GAOKAO_TOKEN], gaokao: true }
  if (!prefs.qualification) return { tokens: [], gaokao: false }
  return { tokens: QUALIFICATION_OPTIONS[prefs.qualification].tokens, gaokao: false }
}

/** 結果頁要不要並列跨區池：大陸起點看 scope；其他起點一律並列（它們的「結果」本來就是池）。 */
export function showCrossBorder(origin: OriginRegion | null, prefs: OriginPrefs): boolean {
  if (origin && origin !== 'cn-mainland') return true
  return prefs.scope === 'abroad' || prefs.scope === 'both'
}
