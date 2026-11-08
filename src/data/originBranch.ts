// 起點分支（路線圖 S4 批 E2；2026-11-08 批 G6 重做）：資格與目的地是「用戶是誰、考慮去哪裡讀」，不是對學校的偏好——
// 像 origins.ts 的起點一樣存 localStorage（unapply.originPrefs.v2），不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function。
// 資格只對非大陸起點出現，只用「保留」語義：海外機構官方頁寫明含該資格 → 標「校方頁面寫明接受」；沒寫明 → 未知、不劃掉。
// 目的地（批 G6，取代三套互不一致的「範圍」題）：多選中國大陸／香港／澳門／臺灣／海外，至少一個，預設＝起點本地；
// 流程由 src/engine/flowPlan.ts 的 planFlow 依目的地決定（含中國大陸才走大陸 45 題）。語言不進這一層（展示層以鍵翻譯）。
import type { OriginRegion } from './origins'
import { originSources } from './originSources'

export type Qualification =
  | 'hkdse' | 'hkdse-or-intl' | 'four-univ-jae' | 'gsat-ast' | 'ib-or-alevel'
  | 'uk-alevel' | 'ib' | 'us-hs' | 'au-atar' | 'de-abitur' | 'fr-bac' | 'jp' | 'kr' | 'sg' | 'my' | 'ca' | 'in' | 'other'

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

/** 目的地：與起點同一組 id（中國大陸／香港／澳門／臺灣／海外）。 */
export type Destination = OriginRegion
export const DESTINATIONS: readonly Destination[] = ['cn-mainland', 'hk', 'mo', 'tw', 'overseas']

export const ORIGIN_PREFS_STORAGE_KEY = 'unapply.originPrefs.v2'
/** 批 E2 的舊鍵（{qualification, scope}）；讀到就遷移成 v2 並刪除。 */
export const LEGACY_ORIGIN_PREFS_STORAGE_KEY = 'unapply.originPrefs.v1'

export interface OriginPrefs {
  qualification: Qualification | null
  /** 至少一個；依 DESTINATIONS 排序去重。 */
  destinations: Destination[]
}

export function isQualification(value: unknown): value is Qualification {
  return typeof value === 'string' && value in QUALIFICATION_OPTIONS
}

export function isDestination(value: unknown): value is Destination {
  return typeof value === 'string' && (DESTINATIONS as readonly string[]).includes(value)
}

/** 預設目的地＝起點本地（大陸→中國大陸、香港→香港、澳門→澳門、臺灣→臺灣、其他→海外）；未選起點＝中國大陸。 */
export function defaultDestinations(origin: OriginRegion | null): Destination[] {
  return [origin ?? 'cn-mainland']
}

/** 換起點時的初始值：資格清空、目的地回到該起點預設。 */
export function originPrefsFor(origin: OriginRegion | null): OriginPrefs {
  return { qualification: null, destinations: defaultDestinations(origin) }
}

export const emptyOriginPrefs: OriginPrefs = originPrefsFor(null)

function sortDestinations(values: readonly unknown[]): Destination[] {
  return DESTINATIONS.filter((d) => values.includes(d))
}

/** 依起點把無效的資格歸零（大陸起點沒有資格題）；目的地去掉無效值、排序，空＝起點預設。 */
export function normalizeOriginPrefs(origin: OriginRegion | null, prefs: Partial<OriginPrefs> | null | undefined): OriginPrefs {
  const qualification = origin && prefs?.qualification && QUALIFICATIONS_BY_ORIGIN[origin].includes(prefs.qualification) ? prefs.qualification : null
  const destinations = sortDestinations(Array.isArray(prefs?.destinations) ? prefs!.destinations.filter(isDestination) : [])
  return { qualification, destinations: destinations.length ? destinations : defaultDestinations(origin) }
}

/**
 * v1（{qualification, scope}）→ v2：local→起點本地；abroad→起點以外全部（海外起點的舊選項寫明「只看海外與港澳臺」，故為海外＋港澳臺）；
 * both→全部；沒有 scope→起點預設。資格照搬（再由 normalizeOriginPrefs 依起點核對）。
 */
export function migrateOriginPrefsV1(origin: OriginRegion | null, v1: { qualification?: unknown; scope?: unknown } | null | undefined): OriginPrefs {
  const home = origin ?? 'cn-mainland'
  const scope = v1?.scope
  let destinations: Destination[]
  if (scope === 'local') destinations = [home]
  else if (scope === 'abroad') destinations = home === 'overseas' ? ['hk', 'mo', 'tw', 'overseas'] : DESTINATIONS.filter((d) => d !== home)
  else if (scope === 'both') destinations = [...DESTINATIONS]
  else destinations = [home]
  return normalizeOriginPrefs(origin, { qualification: isQualification(v1?.qualification) ? v1!.qualification as Qualification : null, destinations })
}

export function readStoredOriginPrefs(origin: OriginRegion | null): OriginPrefs {
  try {
    const raw = window.localStorage.getItem(ORIGIN_PREFS_STORAGE_KEY)
    if (raw) return normalizeOriginPrefs(origin, JSON.parse(raw) as Partial<OriginPrefs>)
    const legacy = window.localStorage.getItem(LEGACY_ORIGIN_PREFS_STORAGE_KEY)
    if (legacy) {
      const migrated = migrateOriginPrefsV1(origin, JSON.parse(legacy) as { qualification?: unknown; scope?: unknown })
      saveOriginPrefs(migrated)
      window.localStorage.removeItem(LEGACY_ORIGIN_PREFS_STORAGE_KEY)
      return migrated
    }
  } catch {
    // 隱私模式／壞資料：當成沒選過
  }
  return originPrefsFor(origin)
}

export function saveOriginPrefs(prefs: OriginPrefs) {
  try {
    window.localStorage.setItem(ORIGIN_PREFS_STORAGE_KEY, JSON.stringify({ qualification: prefs.qualification, destinations: prefs.destinations }))
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

/**
 * 官方頁的乾淨名稱（批 G6：鏈接文字不用原始網頁標題）：網域 → 翻譯鍵 ui.source.<slug>。
 * 只有 live（verified＋https＋同網域）的官方頁才渲染為「官方說明 ↗」；沒有對應名稱的網域不渲染。
 */
export const SOURCE_ORG_BY_DOMAIN: Record<string, string> = {
  'edb.gov.hk': 'edbHk', 'gatzs.com.cn': 'gatzs', 'hkeaa.edu.hk': 'hkeaa', 'jupas.edu.hk': 'jupas', 'ugc.edu.hk': 'ugc', 'cspe.edu.hk': 'cspe',
  'dsedj.gov.mo': 'dsedj', 'must.edu.mo': 'must',
  'ceec.edu.tw': 'ceec', 'uac.edu.tw': 'uacTw', 'cac.edu.tw': 'cac', 'jbcrc.edu.tw': 'jbcrc',
  'neea.edu.cn': 'neea', 'moe.gov.cn': 'moeCn', 'chsi.com.cn': 'chsi',
  'www.gov.uk': 'govUk', 'ucas.com': 'ucas', 'ibo.org': 'ibo',
  'collegeboard.org': 'collegeBoard', 'act.org': 'act', 'commonapp.org': 'commonApp',
  'uac.edu.au': 'uacAu', 'vtac.edu.au': 'vtac', 'qtac.edu.au': 'qtac', 'studyaustralia.gov.au': 'studyAu',
  'kmk.org': 'kmk', 'uni-assist.de': 'uniAssist', 'hochschulstart.de': 'hochschulstart', 'daad.de': 'daad',
  'onisep.fr': 'onisep', 'campusfrance.org': 'campusFrance', 'education.gouv.fr': 'educationFr', 'parcoursup.gouv.fr': 'parcoursup',
  'dnc.ac.jp': 'dnc', 'jasso.go.jp': 'jasso', 'mext.go.jp': 'mext', 'studyinjapan.go.jp': 'studyJp',
  'studyinkorea.go.kr': 'studyKr',
  'seab.gov.sg': 'seab', 'moe.gov.sg': 'moeSg',
  'mpm.edu.my': 'mpm', 'dongzong.my': 'dongzong', 'moe.gov.my': 'moeMy', 'educationmalaysia.gov.my': 'emgs',
  'ontario.ca': 'ontario', 'canada.ca': 'ircc',
  'cbse.gov.in': 'cbse', 'cisce.org': 'cisce',
  'nzqa.govt.nz': 'nzqa', 'cao.ie': 'cao', 'nuffic.nl': 'nuffic',
}

/** 一組官方頁 → 可上鏈接的「機構名＋網址」（live 才留；同網域只留第一個）。 */
export function liveSourceLinks(urls: readonly string[]): { url: string; org: string }[] {
  const seen = new Set<string>()
  const out: { url: string; org: string }[] = []
  for (const url of urls) {
    const entry = originSources[url]
    const org = entry ? SOURCE_ORG_BY_DOMAIN[entry.domain] : undefined
    if (!entry || !entry.live || !org || seen.has(entry.domain)) continue
    seen.add(entry.domain)
    out.push({ url, org })
  }
  return out
}

/**
 * 港澳臺考生看「自己所在地」院校時的本地入學入口（批 G6）：香港＝大學聯合招生辦法（JUPAS）、澳門＝四校聯考、臺灣＝大學甄選入學／考試入學分發。
 * 只在 originSources 已 live 時上鏈接（liveSourceLinks 過濾），否則只寫名稱。
 */
export const LOCAL_ENTRY_SOURCES: Record<'hk' | 'mo' | 'tw', readonly string[]> = {
  hk: [S.jupas],
  mo: [S.dsedjList, S.dsedj],
  tw: [S.cac, S.uacTw],
}
