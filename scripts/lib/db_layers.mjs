// 路線圖 S5（批 F2）：讀站內各資料層（只讀、離線），組成統一 schema 的六類實體草稿（institution／program 引用／admission_channel／admission_condition／source 線索／validity 線索）。
// scripts/build_db.mjs 與 scripts/assemble_db_evidence.mjs 共用；不改任何既有 payload，只讀。實體定義見 docs/DB_SCHEMA.md。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export function parseCsv(text) {
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
const latest = (dir, re) => { const f = readdirSync(dir).filter((x) => re.test(x)).sort(); if (!f.length) throw new Error(`missing ${re} in ${dir}`); return f.at(-1) }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

/** 年度維護日曆（docs/ANNUAL_UPDATE.md）：每一族資料下一次應重核的日期（當時值；改日曆要同步文件）。 */
export const NEXT_REVIEW = {
  moe_list: '2027-06-30',          // 教育部年度名單約每年 6 月
  gras: '2027-11-30',              // 軟科 GRAS 約每年 10–11 月
  subject_tables: '2026-12-31',    // 各省選考要求表（2028 年表依慣例應已於 2026 年 2–4 月公布，下一次維護先核）
  catalog: '2027-04-30',           // 教育部本科專業目錄（年度增補約每年 4 月）
  strong_base: '2027-04-30',       // 強基計劃招生簡章約每年 4 月
  a6_charters: '2027-06-30',       // 各校本科招生章程約每年 4–6 月
  crs: '2027-06-30',               // 中外合作辦學監管平台名單（2026-05-25 更新；約半年至一年）
  hkmotw: '2027-11-30',            // 港澳臺院校年度招生頁約每年 10–12 月
  overseas: '2027-11-30',          // 海外招生頁、申請平台、簽證頁隨 GRAS 年版重抓
  origins: '2027-11-30',           // 起點資格制度與官方進大陸管道
  direct_hire: '2027-11-30',       // 企業直招條目年度重核
}

const REGION_OF_HKMOTW = { HK: 'China-Hong Kong', MO: 'China-Macau', TW: 'China-Taiwan' }
const REGION_OF_COUNTRY = { 'Hong Kong': 'China-Hong Kong', China: 'China' }

export function collectLayers(root) {
  const rd = join(root, 'data', 'research')
  const files = {}
  const refs = []          // 引用的既有 payload（不重複存一份）
  const institutions = []
  const crosswalk = []
  const channels = []
  const conditions = []
  const sourceHints = []   // { url, ctx, evidence? } — 來源線索，build_db 再合併證據與分級
  const hint = (url, ctx, evidence = null) => { if (url) sourceHints.push({ url, ctx, evidence }) }

  // ---- 教育部名單（moe:<moeCode>）
  const schools = readJson(join(root, 'public/data/runtime/schools.json'))
  const metaTs = readFileSync(join(root, 'src/data/officialSchoolMeta.ts'), 'utf8')
  const moeListUrl = /"sourcePageUrl": "([^"]+)"/.exec(metaTs)[1]
  const moeListDate = /"publishedDate": "([^"]+)"/.exec(metaTs)[1]
  const moeAttachment = /"ordinaryAttachmentUrl": "([^"]+)"/.exec(metaTs)[1]
  hint(moeListUrl, { family: 'moe_list', kind: 'gov', title: '教育部全國普通高等學校名單（2026）', date: moeListDate })
  hint(moeAttachment, { family: 'moe_list', kind: 'gov', title: '全國普通高等學校名單（附件 xls）', date: moeListDate })
  files.moeList = { url: moeListUrl, attachment: moeAttachment, publishedDate: moeListDate }
  for (const s of schools) {
    if (!/^\d{10}$/.test(s.moeCode || '')) throw new Error(`school without moeCode: ${s.id}`)
    institutions.push({
      id: `moe:${s.moeCode}`, scheme: 'moe', code: s.moeCode, kind: 'mainland_hei',
      name: { zhHant: s.name, zhHans: s.nameSimplified || null, en: s.nameEn || null },
      region: 'China', province: s.province, city: s.city || null, moeLevel: s.moeLevel || null, level: s.level || null, ownership: s.ownership || null,
      website: s.website || null, admissionWebsite: s.admissionWebsite || null,
      status: 'listed', sourceUrl: moeListUrl, family: 'moe_list', reviewedAt: moeListDate, siteRoute: `#/school/${encodeURIComponent(s.id)}`,
    })
  }

  // ---- 軟科 GRAS（gras:<univCode>）＋ 對照 moe
  const atlas = readJson(join(root, 'public/data/atlas/world-atlas.json'))
  const geoFile = latest(rd, /^gras_institutions_geo\.\d{4}-\d{2}-\d{2}\.csv$/)
  const geo = new Map(parseCsv(readFileSync(join(rd, geoFile), 'utf8')).map((g) => [g.univCode, g]))
  hint(atlas.ranking.url, { family: 'gras', kind: 'ranking', title: `${atlas.ranking.nameZh} ${atlas.ranking.year}`, date: atlas.ranking.fetchedAt })
  for (const sub of atlas.subjects) hint(sub.sourceUrl, { family: 'gras', kind: 'ranking', title: `GRAS ${atlas.ranking.year} ${sub.nameEn}`, date: atlas.ranking.fetchedAt })
  for (const inst of atlas.institutions) {
    const g = geo.get(inst.id)
    institutions.push({
      id: `gras:${inst.id}`, scheme: 'gras', code: inst.id, kind: 'gras_ranked',
      name: { zhHant: inst.nameZh || null, zhHans: null, en: inst.nameEn },
      region: inst.region, province: null, city: null,
      website: inst.website?.url || null, websiteConfidence: inst.website?.confidence || null,
      subjectsTop50: Object.keys(inst.ranks).length, wikidata: g?.wikidata || null,
      status: 'ranked', sourceUrl: atlas.ranking.url, family: 'gras', reviewedAt: inst.website?.verifiedAt || atlas.ranking.fetchedAt, siteRoute: '#/world',
    })
    if (inst.moeCode) crosswalk.push({ a: `gras:${inst.id}`, b: `moe:${inst.moeCode}`, relation: 'same_institution', basis: `${geoFile} moeCode` })
  }
  refs.push({ name: 'atlas', path: '/data/atlas/world-atlas.json', describes: 'GRAS 2026 每科前 50 名次、機構座標、陸地輪廓、企業直招條目（世界學科地圖 payload）', entity: 'institution+program' })

  // ---- 中外合作辦學（crs:<id>）：機構入 institution，全部 1,834 條入 admission_channel（入口）
  const jointFile = latest(rd, /^joint_programs\.\d{4}-\d{2}-\d{2}\.csv$/)
  const joint = parseCsv(readFileSync(join(rd, jointFile), 'utf8'))
  const jointMeta = readJson(join(rd, jointFile.replace('.csv', '.meta.json')))
  const ymd = (s) => { const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(s || ''); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null }
  for (const r of joint) {
    if (!/^\d+$/.test(r.id)) throw new Error(`joint id ${r.id}`)
    hint(r.sourceUrl, { family: 'crs', kind: 'gov', title: `教育部中外合作辦學監管工作信息平台 詳情 ${r.id}`, date: r.fetchedAt }, { http: 200, fetchedAt: r.fetchedAt, status: 'verified', evidence: `${jointFile}（nope-s2 2026-11-07 讀取；逐頁快取整體 SHA-256 見 meta.detailCacheSha256）` })
    if (r.kind === 'institution') {
      institutions.push({
        id: `crs:${r.id}`, scheme: 'crs', code: r.id, kind: r.cooperationType === 'foreign_independent' ? 'foreign_independent_university' : 'joint_institution',
        name: { zhHant: null, zhHans: null, en: null, original: r.name }, region: 'China', province: r.province || null, city: null,
        cooperation: r.cooperationType, legalPerson: r.legalPerson || null, licenseNo: r.licenseNo || null,
        status: r.status, sourceUrl: r.sourceUrl, family: 'crs', reviewedAt: r.fetchedAt, siteRoute: r.moeCode ? null : null,
      })
      if (r.moeCode) crosswalk.push({ a: `crs:${r.id}`, b: `moe:${r.moeCode}`, relation: r.legalPerson === '不具有法人资格' ? 'part_of' : 'same_institution', basis: `${jointFile} moeCode（${r.matchBy}）` })
    }
    channels.push({
      id: `crs:${r.id}`, kind: 'joint_program_entry', institutionId: r.moeCode ? `moe:${r.moeCode}` : null, region: 'China',
      name: { original: r.name }, programKind: r.kind, cooperation: r.cooperationType, level: r.level || null, levelLists: r.levelLists || null,
      enrolmentYears: r.enrolmentYears || null, enrolmentEndYear: r.enrolmentEndYear ? Number(r.enrolmentEndYear) : null,
      status: r.status, url: r.sourceUrl, sourceUrl: r.sourceUrl, family: 'crs',
      validity: { academicYear: null, validFrom: null, validTo: ymd(r.validUntil), fetchedAt: r.fetchedAt, reviewedAt: r.fetchedAt },
      detailRef: { path: '/data/joint/items.json', key: r.moeCode ? `items.${r.moeCode}[id=${r.id}]` : `unmatched[id=${r.id}]` },
    })
  }
  hint(jointMeta.source.homepage, { family: 'crs', kind: 'gov', title: jointMeta.source.publisher, date: jointMeta.generatedAt })
  refs.push({ name: 'joint.index', path: '/data/joint/index.json', describes: '中外合作辦學：每校機構／項目計數', entity: 'program' }, { name: 'joint.items', path: '/data/joint/items.json', describes: '中外合作辦學：逐校逐條詳情（招生方式、專業、證書、批准書編號與有效期）', entity: 'program+admission_channel' })

  // ---- 港澳臺院校池（hkmotw:<id>）
  const hkInstFile = latest(rd, /^hkmotw_institutions\.\d{4}-\d{2}-\d{2}\.csv$/)
  const hkChFile = latest(rd, /^hkmotw_admission_channels\.\d{4}-\d{2}-\d{2}\.csv$/)
  const pool = readJson(join(root, 'public/data/hkmotw/pool.json'))
  const atlasIdOf = new Map(pool.institutions.map((i) => [i.id, i.atlasId]))
  const atlasByEn = new Map(atlas.institutions.map((i) => [i.nameEn, i.id]))
  for (const r of parseCsv(readFileSync(join(rd, hkInstFile), 'utf8'))) {
    hint(r.listSourceUrl, { family: 'hkmotw', kind: 'institution', title: r.listSourceTitle, date: r.listSourceDate })
    institutions.push({
      id: `hkmotw:${r.id}`, scheme: 'hkmotw', code: r.id, kind: r.kind,
      name: { zhHant: r.nameZh, zhHans: null, en: r.nameEn || null }, region: REGION_OF_HKMOTW[r.region], province: null, city: null,
      website: r.website || null, status: r.status, sourceUrl: r.listSourceUrl, family: 'hkmotw', reviewedAt: r.listSourceDate, siteRoute: '#/hkmotw',
    })
    const atlasId = atlasIdOf.get(r.id) || (r.atlasNameEn ? atlasByEn.get(r.atlasNameEn) : null)
    if (atlasId) crosswalk.push({ a: `hkmotw:${r.id}`, b: `gras:${atlasId}`, relation: 'same_institution', basis: `${hkInstFile} atlasNameEn` })
  }
  const hkCh = parseCsv(readFileSync(join(rd, hkChFile), 'utf8'))
  const hkCount = {}
  for (const r of hkCh) {
    hkCount[r.institutionId] = (hkCount[r.institutionId] || 0) + 1
    const id = `hkmotw:${r.institutionId}:${hkCount[r.institutionId]}`
    hint(r.sourceUrl, { family: 'hkmotw', kind: 'institution', title: r.sourceTitle, date: r.sourceDate }, { http: Number(r.httpStatus) || null, fetchedAt: r.verifiedAt, status: r.status === 'verified' ? 'verified' : 'needs_review', evidence: hkChFile })
    channels.push({
      id, kind: 'hkmotw_channel', institutionId: `hkmotw:${r.institutionId}`, region: null, name: null,
      audience: r.audience, channel: r.channel, level: r.level || null, status: r.status, url: r.sourceUrl, sourceUrl: r.sourceUrl, family: 'hkmotw',
      validity: { academicYear: r.validFor || null, validFrom: null, validTo: null, fetchedAt: r.sourceDate, reviewedAt: r.verifiedAt },
    })
    const typeOf = { scoreRequirement: r.audience === 'mainland_gaokao' ? 'gaokao' : 'qualification', englishRequirement: 'english', tuition: 'tuition', applicationWindow: 'timeline' }
    for (const [field, type] of Object.entries(typeOf)) {
      if (!r[field]) continue
      conditions.push({ id: `${id}:${type}`, subjectId: id, type, valueRaw: r[field], valueNorm: null, academicYear: r.validFor || null, sourceUrl: r.sourceUrl, status: r.status, confidence: r.status === 'verified' ? 'high' : null, family: 'hkmotw', validity: { academicYear: r.validFor || null, validFrom: null, validTo: null, fetchedAt: r.sourceDate, reviewedAt: r.verifiedAt } })
    }
  }
  refs.push({ name: 'hkmotw.pool', path: '/data/hkmotw/pool.json', describes: '港澳臺院校池（只含 verified 的機構與管道）', entity: 'institution+admission_channel' })

  // ---- 海外層（機構沿用 gras:<univCode>；條件指向地區檔原文片段，不重複存一份）
  const oIndex = readJson(join(root, 'public/data/overseas/index.json'))
  const slugOf = new Map(oIndex.regions.map((r) => [r.code, r.slug]))
  const portalsFile = latest(rd, /^overseas_national_portals\.\d{4}-\d{2}-\d{2}\.csv$/)
  const visaFile = latest(rd, /^overseas_visa_policies\.\d{4}-\d{2}-\d{2}\.csv$/)
  const pc = {}, vc = {}
  const unsafeDomains = new Set()
  for (const r of parseCsv(readFileSync(join(rd, portalsFile), 'utf8'))) {
    const slug = slugOf.get(r.region); if (!slug) throw new Error(`portal region ${r.region}`)
    pc[slug] = (pc[slug] || 0) + 1
    const id = `portal:${slug}:${pc[slug]}`
    // unsafe（2026-11-08 批 G4）：官方網域疑遭劫持——不作來源、channel 不輸出網址
    const unsafe = r.status === 'unsafe'
    if (unsafe) unsafeDomains.add(r.domain)
    const https = !unsafe && /^https:\/\//.test(r.officialUrl)
    if (https) hint(r.officialUrl, { family: 'overseas', kind: r.domainClass, siteLive: r.status === 'verified' && r.confidence === 'high', title: r.pageTitle || r.portalName, date: r.fetchedAt }, { finalUrl: r.finalUrl || null, http: Number(r.http) || null, sha256: r.sha256 || null, fetchedAt: r.fetchedAt, status: r.status, evidence: portalsFile })
    channels.push({ id, kind: 'national_portal', institutionId: null, region: r.region, name: { original: r.portalName }, portalType: r.portalType, domainClass: r.domainClass, status: r.status, confidence: r.confidence || null, url: https ? r.officialUrl : null, sourceUrl: https ? r.officialUrl : null, note: unsafe ? '官方網域疑遭劫持（2026-11-08 批 G4），不收錄為來源、不輸出網址' : https ? null : '候選網址非 https 且官方頁本站未讀到，不收錄為來源', family: 'overseas', validity: { academicYear: null, validFrom: null, validTo: null, fetchedAt: r.fetchedAt, reviewedAt: r.reviewedAt || r.fetchedAt.slice(0, 10) } })
  }
  for (const r of parseCsv(readFileSync(join(rd, visaFile), 'utf8'))) {
    const slug = slugOf.get(r.region); if (!slug) throw new Error(`visa region ${r.region}`)
    vc[slug] = (vc[slug] || 0) + 1
    const id = `visa:${slug}:${vc[slug]}`
    hint(r.officialUrl, { family: 'overseas', kind: 'gov', siteLive: r.status === 'verified', title: r.pageTitle || r.authority, date: r.fetchedAt }, { finalUrl: r.finalUrl || null, http: Number(r.http) || null, sha256: r.sha256 || null, fetchedAt: r.fetchedAt, status: r.status, evidence: visaFile })
    conditions.push({ id, subjectId: `region:${r.region}`, type: 'visa', valueRaw: null, valueRawRef: { path: `/data/overseas/regions/${slug}.json`, pointer: `visa[${vc[slug] - 1}].quotes` }, valueNorm: { category: r.visaCategory, authority: r.authority }, academicYear: null, sourceUrl: r.officialUrl, status: r.status, confidence: r.confidence || null, family: 'overseas', validity: { academicYear: null, validFrom: null, validTo: null, fetchedAt: r.fetchedAt, reviewedAt: r.reviewedAt || r.fetchedAt.slice(0, 10) } })
  }
  const TYPE_FIELDS = [['gaokao', 'gaokao'], ['qualification', 'qualifications'], ['english', 'english'], ['other-language', 'otherLanguage'], ['tuition', 'tuition'], ['timeline', 'timeline']]
  for (const region of oIndex.regions) {
    const rf = readJson(join(root, 'public/data/overseas/regions', region.file))
    rf.institutions.forEach((inst, idx) => {
      if (inst.admissions.url) hint(inst.admissions.url, { family: 'overseas', kind: 'institution', institutionDomain: inst.website, siteLive: inst.admissions.linkLive === true, title: inst.admissions.title || null, date: inst.fetchedAt })
      for (const [type, field] of TYPE_FIELDS) {
        const block = inst[field]
        const quotes = block.quotes || []
        let valueNorm = null
        if (type === 'gaokao') valueNorm = block.policy
        if (type === 'qualification' || type === 'other-language') valueNorm = block.listed.length ? block.listed : null
        if (type === 'english') valueNorm = (block.tests.length || block.ielts || block.toefl) ? { tests: block.tests, ielts: block.ielts, toefl: block.toefl } : null
        if (!quotes.length && (valueNorm === null || valueNorm === 'not_stated')) continue
        for (const q of quotes) hint(q.url, { family: 'overseas', kind: 'institution', institutionDomain: inst.website, siteLive: q.live === true, title: null, date: inst.fetchedAt })
        conditions.push({
          id: `gras:${inst.id}:${type}`, subjectId: `gras:${inst.id}`, type, valueRaw: null,
          valueRawRef: { path: `/data/overseas/regions/${region.file}`, pointer: `institutions[${idx}].${field}.quotes`, quotes: quotes.length },
          valueNorm, academicYear: inst.dataAcademicYear || null, sourceUrl: quotes[0]?.url || inst.admissions.url || null,
          status: inst.status, confidence: inst.confidence || null, family: 'overseas',
          // reviewedAt：人工確認日（2026-11-08 批 G1 起，overseas_admissions 的 reviewedAt，只在招生頁位於人工確認的另一官方網域時給）優先，否則抓取日
          validity: { academicYear: inst.dataAcademicYear || null, validFrom: null, validTo: null, fetchedAt: inst.fetchedAt, reviewedAt: inst.admissions.reviewedAt || inst.fetchedAt },
        })
      }
    })
  }
  refs.push({ name: 'overseas.index', path: '/data/overseas/index.json', describes: '海外可申請學校：每機構摘要與地區列', entity: 'institution' }, { name: 'overseas.qualifications', path: '/data/overseas/qualifications.json', describes: '海外層：資格 token → 校方頁寫明接受的機構', entity: 'admission_condition' })
  for (const region of oIndex.regions) refs.push({ name: `overseas.region.${region.slug}`, path: `/data/overseas/regions/${region.file}`, describes: `海外層地區檔（${region.code}）：機構招生頁原文片段、申請平台、簽證主管機關頁`, entity: 'admission_condition+admission_channel' })

  // ---- 起點分支官方頁（65）：資格制度與港澳臺→大陸官方管道
  const originFile = latest(rd, /^origin_sources\.\d{4}-\d{2}-\d{2}\.json$/)
  const origin = readJson(join(rd, originFile))
  for (const s of origin.sources) {
    hint(s.url, { family: 'origins', kind: s.authorityKind || 'gov', siteLive: s.status === 'verified', title: s.title, date: s.fetchedAt }, { finalUrl: s.finalUrl || null, http: s.http || null, sha256: s.sha256 || null, fetchedAt: s.fetchedAt, status: s.status, evidence: originFile })
    channels.push({ id: `origin:${s.id}`, kind: s.group === 'channel' ? 'origin_mainland_channel' : 'origin_qualification_system', institutionId: null, region: s.region || null, name: { original: s.title }, purposeZh: s.purpose || null, status: s.status, url: s.url, sourceUrl: s.url, family: 'origins', validity: { academicYear: null, validFrom: null, validTo: null, fetchedAt: s.fetchedAt, reviewedAt: String(s.fetchedAt).slice(0, 10) } })
  }

  // ---- 大陸招生專業／選考要求（引用兩層 payload）＋ 強基 ＋ 國標目錄
  const pIndex = readJson(join(root, 'public/data/programs/index.json'))
  const catalog = readJson(join(root, 'public/data/programs/catalog.json'))
  const s1 = readJson(join(rd, 's1_sources.json'))
  const s1ByPage = new Map(s1.sources.filter((s) => s.kind === 'page').map((s) => [s.pageUrl, s]))
  for (const [sid, s] of Object.entries(pIndex.sources)) {
    const page = s1ByPage.get(s.url)
    hint(s.url, { family: sid.startsWith('qiangji') || sid.includes('qiangji') ? 'strong_base' : sid.includes('catalog') ? 'catalog' : 'subject_tables', kind: 'gov', title: s.title, date: s.date }, page ? { sha256: page.sha256, fetchedAt: page.fetchedAt || null, http: 200, status: 'verified', evidence: `s1_sources.json ${page.id}` } : null)
  }
  for (const s of s1.sources) if (s.kind !== 'page' && s.fileUrl) hint(s.fileUrl, { family: 'subject_tables', kind: 'gov', title: `${s.title}（原檔）`, date: s.publishedDate }, { sha256: s.sha256, fetchedAt: s.fetchedAt || null, http: 200, status: 'verified', evidence: `s1_sources.json ${s.id}（${s.store}）` })
  const offeringsMeta = readJson(join(rd, 'program_offerings.2027.all.meta.json'))
  conditions.push({ id: 'dataset:subject_requirements:2027', subjectId: 'dataset:programs', type: 'subject_requirement', valueRaw: null, valueRawRef: { path: '/data/programs/index.json', pointer: 'schools', buckets: '/data/programs/schools/programs-NN.json（依 src/data/programsManifest.ts bucketFileByProvince）' }, valueNorm: { schools: offeringsMeta.counts.schoolsWithOfferings, offerings: offeringsMeta.counts.offerings, provinces: Object.keys(pIndex.provinceSources).length }, academicYear: String(pIndex.admissionYear), sourceUrl: null, sourceIds: Object.values(pIndex.provinceSources).map((p) => p.sourceId), status: 'verified', confidence: 'high', family: 'subject_tables', validity: { academicYear: String(pIndex.admissionYear), validFrom: null, validTo: null, fetchedAt: offeringsMeta.generatedAt, reviewedAt: offeringsMeta.generatedAt } })
  for (const sb of pIndex.strongBase) {
    const src = pIndex.sources[sb.sourceId]
    conditions.push({ id: `moe:${sb.moeCode}:strong_base`, subjectId: `moe:${sb.moeCode}`, type: 'policy', valueRaw: null, valueNorm: { policy: 'strong_base_pilot', since: sb.since }, academicYear: '2026', sourceUrl: src.url, status: 'verified', confidence: 'high', family: 'strong_base', validity: { academicYear: '2026', validFrom: null, validTo: null, fetchedAt: src.date, reviewedAt: offeringsMeta.generatedAt } })
  }
  hint(catalog.source.url, { family: 'catalog', kind: 'gov', title: catalog.source.title, date: catalog.source.date })
  refs.push(
    { name: 'programs.catalog', path: '/data/programs/catalog.json', describes: `教育部《普通高等學校本科專業目錄（${catalog.year} 年）》：門類／專業類／專業`, entity: 'program' },
    { name: 'programs.index', path: '/data/programs/index.json', describes: `${pIndex.admissionYear} 年招生專業（類）與選考要求：每校摘要、圖樣、強基、來源`, entity: 'program+admission_condition' },
  )
  for (const f of readdirSync(join(root, 'public/data/programs/schools')).filter((f) => /^programs-\d+\.json$/.test(f)).sort()) refs.push({ name: `programs.bucket.${f.slice(9, 11)}`, path: `/data/programs/schools/${f}`, describes: '招生專業（類）逐校清單（按省分桶）', entity: 'program+admission_condition' })
  refs.push({ name: 'runtime.schools', path: '/data/runtime/schools.json', describes: '教育部名單 2,952 所＋研究增強層（官網、招生網、學費分桶、眾包生活條件與證據）', entity: 'institution' })

  // ---- A6 招生管道（章程依據）
  const a6File = latest(rd, /^admission_channels\.\d{4}-\d{2}-\d{2}\.csv$/)
  for (const r of parseCsv(readFileSync(join(rd, a6File), 'utf8'))) {
    hint(r.sourceUrl, { family: 'a6_charters', kind: 'institution', title: r.sourceTitle, date: r.sourceDate })
    channels.push({ id: `a6:${r.moeCode}`, kind: 'a6_admission_route', institutionId: `moe:${r.moeCode}`, region: 'China', name: { original: r.sourceTitle }, regularProvinces: r.regularProvinces, comprehensiveProvinces: r.comprehensiveProvinces, status: 'verified', confidence: r.confidence || null, url: r.sourceUrl, sourceUrl: r.sourceUrl, family: 'a6_charters', validity: { academicYear: r.year, validFrom: null, validTo: null, fetchedAt: r.sourceDate, reviewedAt: r.sourceDate } })
  }

  // ---- 企業直招（非大學路徑；只收站上渲染的條目）
  for (const p of atlas.programs) {
    hint(p.officialUrl, { family: 'direct_hire', kind: 'company', title: `${p.orgEn} ${p.programEn}（官方頁）`, date: p.verifiedAt })
    hint(p.sourceUrl, { family: 'direct_hire', kind: 'media_or_official', title: p.sourceTitle, date: p.sourceDate })
    const id = `direct-hire:${p.id}`
    channels.push({ id, kind: 'direct_hire', institutionId: null, region: REGION_OF_COUNTRY[p.country] || p.country, name: { en: `${p.orgEn}: ${p.programEn}`, zhHant: `${p.orgZh}：${p.programZh}` }, programKind: p.kind, paid: p.paid, degree: p.degree, sinceYear: p.sinceYear, status: p.status, confidence: p.confidence, url: p.officialUrl || null, sourceUrl: p.sourceUrl, officialUrl: p.officialUrl || null, family: 'direct_hire', validity: { academicYear: null, validFrom: p.sinceYear ? `${p.sinceYear}-01-01` : null, validTo: null, fetchedAt: p.verifiedAt, reviewedAt: p.verifiedAt } })
    conditions.push({ id: `${id}:eligibility`, subjectId: id, type: 'eligibility', valueRaw: p.eligibilityZh, valueNorm: null, academicYear: null, sourceUrl: p.officialUrl || p.sourceUrl, status: p.status, confidence: p.confidence, family: 'direct_hire', validity: { academicYear: null, validFrom: null, validTo: null, fetchedAt: p.verifiedAt, reviewedAt: p.verifiedAt } })
  }

  return { files, refs, institutions, crosswalk, channels, conditions, sourceHints, unsafeDomains: [...unsafeDomains], inputs: { geoFile, jointFile, hkInstFile, hkChFile, portalsFile, visaFile, originFile, a6File, atlasVersion: atlas.version, overseasVersion: oIndex.version, programsVersion: pIndex.version, jointCounts: jointMeta.counts } }
}
