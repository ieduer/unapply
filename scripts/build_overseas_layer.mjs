#!/usr/bin/env node
// 路線圖 S3（批 S3）：海外可申請學校層 → 前端懶載入 payload（兩層）。
//
//   node scripts/build_overseas_layer.mjs
//
// 讀 data/research/overseas_admissions.<日期>.csv（＋同名 .meta.json）、overseas_national_portals.<日期>.csv、overseas_visa_policies.<日期>.csv，
// 對照 S0 的 gras_institutions_geo／gras_institution_websites／gras_institution_names_zh_hant／gras_2026_top50，寫
//   public/data/overseas/index.json            每機構一條摘要（地區清單與機構列表用；gzip ≤ 200 KiB）
//   public/data/overseas/regions/<slug>.json   該地區機構全欄原文片段＋國家層申請平台＋簽證主管機關頁（只在進入地區頁時載入）
//   src/data/overseasManifest.ts               版本雜湊＋各類數量（前端載入時核對）
//
// 原則：只抄官方頁原文、不解讀；鏈接上線規則沿用研究 S3_SCHEMA_PROPOSAL.md §3 與路線圖「對外鏈接規則」——
//   機構招生頁只有 status=verified 且 confidence=high 才 linkLive；medium 只給名稱與「學校另一官方網域，待人工確認」；
//   high 須 domainMatch=true（招生頁在 S0 官網網域內），或 domainMatch=official-external 且人工確認欄 reviewedAt 非空（2026-11-08 批 G1，
//   DECISIONS C2；reviewNote 必須寫出招生頁網域；該網域之下的原文片段與來源才成為鏈接）；非 verified 的列不得帶任何抽取欄位；
//   blocked／not_found／needs_review 只進資料檔並寫「官方頁本站未讀到（原因）」；國家層 official-platform 需 confidence=high（有機構頁佐證）；
//   簽證頁 verified 才上鏈接；所有上線鏈接 https 且主機在記錄的可註冊網域之下。任何斷言不過就不產出（fail-closed）。
// 決定性：payload 不含建置時間；generatedAt 取輸入檔日期；版本雜湊只由內容決定。不寫 public/data/runtime/。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const researchDir = join(root, 'data', 'research')
const die = (m) => { console.error(`build_overseas_layer: ${m}`); process.exit(1) }
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false; else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return { header: header.map((h) => h.trim()), rows: body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))) }
}
function latestFile(pattern) {
  const files = readdirSync(researchDir).filter((f) => pattern.test(f)).sort()
  if (!files.length) die(`missing ${pattern} in data/research`)
  return join(researchDir, files[files.length - 1])
}
/** 主機是否在記錄的可註冊網域之下（研究 CSV 的 domain／officialDomain 欄已是可註冊網域，含 go.jp／gob.mx 等公共後綴）。 */
function hostUnder(url, domain) {
  if (!domain) return false
  let host
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, '') } catch { return false }
  const d = domain.toLowerCase().replace(/\.$/, '')
  return host === d || host.endsWith(`.${d}`)
}
const isHttps = (url) => /^https:\/\/[^\s]+$/.test(url)
/** 去掉伺服器寫進路徑的會話段（;jsessionid=…）：不是個人資料，但不該進 payload；去掉後網址仍可用。 */
const cleanUrl = (url) => url.replace(/;jsessionid=[^?#/]*/i, '')
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const dateOf = (iso) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso); if (!m) die(`時間格式不對：${iso}`); return m[1] }
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

// ---- 口徑（正體中文標籤；只描述頁面讀到什麼，不解讀）----
const REGION_ZH = {
  Australia: '澳大利亞', Austria: '奧地利', Belgium: '比利時', Brazil: '巴西', Canada: '加拿大', 'China-Hong Kong': '中國香港', 'China-Macau': '中國澳門',
  'China-Taiwan': '中國臺灣', Croatia: '克羅地亞', 'Czech Republic': '捷克', Denmark: '丹麥', Ethiopia: '埃塞俄比亞', Finland: '芬蘭', France: '法國',
  Germany: '德國', Greece: '希臘', Hungary: '匈牙利', India: '印度', Iran: '伊朗', Ireland: '愛爾蘭', Israel: '以色列', Italy: '意大利', Japan: '日本',
  Malaysia: '馬來西亞', Mexico: '墨西哥', Netherlands: '荷蘭', 'New Zealand': '新西蘭', Norway: '挪威', Pakistan: '巴基斯坦', Poland: '波蘭',
  Portugal: '葡萄牙', 'Saudi Arabia': '沙特阿拉伯', Singapore: '新加坡', 'South Africa': '南非', 'South Korea': '韓國', Spain: '西班牙', Sweden: '瑞典',
  Switzerland: '瑞士', Thailand: '泰國', Tunisia: '突尼斯', 'Türkiye': '土耳其', 'United Arab Emirates': '阿聯酋', 'United Kingdom': '英國', 'United States': '美國',
  Argentina: '阿根廷', Azerbaijan: '阿塞拜疆', Chile: '智利', Egypt: '埃及', Russia: '俄羅斯', Nigeria: '尼日利亞', Kenya: '肯尼亞', Vietnam: '越南',
  Indonesia: '印度尼西亞', Philippines: '菲律賓', Colombia: '哥倫比亞', Peru: '秘魯', Qatar: '卡塔爾', Lebanon: '黎巴嫩', Jordan: '約旦', Romania: '羅馬尼亞',
  Slovenia: '斯洛文尼亞', Serbia: '塞爾維亞', Estonia: '愛沙尼亞', Lithuania: '立陶宛', Iceland: '冰島', Luxembourg: '盧森堡', Cyprus: '塞浦路斯', Morocco: '摩洛哥',
  Ghana: '加納', Uganda: '烏干達', Bangladesh: '孟加拉國', 'Sri Lanka': '斯里蘭卡', Kazakhstan: '哈薩克斯坦', Uruguay: '烏拉圭', Slovakia: '斯洛伐克',
}
const STATUS = ['verified', 'needs_review', 'blocked', 'not_found']
const STATUS_ZH = { verified: '官方頁已讀到', needs_review: '待人工覆核', blocked: '核查時被擋', not_found: '官方頁未找到' }
const GAOKAO = ['accepted', 'not_accepted', 'conflicting', 'separate_channel', 'mentioned', 'not_stated']
const GAOKAO_ZH = { accepted: '寫明接受', not_accepted: '寫明不接受', conflicting: '寫法有矛盾', separate_channel: '另有內地考生管道', mentioned: '有提及', not_stated: '未讀到' }
const PORTAL_TYPE_ZH = {
  'central-ug-application': '全國（或多校共用）本科申請平台', 'system-ug-application': '大學系統申請平台', 'state-ug-application': '州級申請中心',
  'province-ug-application': '省級申請中心', 'information-portal': '官方留學資訊入口', 'qualification-recognition': '學歷資格認證機構', exam: '統一入學考試',
}
const DOMAIN_CLASS_ZH = { gov: '政府主管機關', 'public-agency': '政府設立／資助的公共機構', 'official-platform': '各校共用的官方申請平台（非政府）' }

// ---- 表頭白名單（同時擋掉任何人名／聯絡人欄）----
const HEADERS = {
  admissions: ['institutionId', 'nameEn', 'nameZhHant', 'region', 'wikidata', 'grasSubjectsTop50', 'officialWebsite', 'officialDomain', 'websiteStatusS0', 'admissionsPageUrl', 'admissionsPageTitle', 'pageMatchScore', 'gaokaoPageUrl', 'gaokaoPolicy', 'gaokaoQuotes', 'qualificationsListed', 'qualificationsQuotes', 'englishTests', 'ieltsOverall', 'toeflOverall', 'englishQuotes', 'otherLanguage', 'otherLanguageQuotes', 'tuitionIntlQuotes', 'applicationChannels', 'applicationChannelQuotes', 'applicationTimelineQuotes', 'dataAcademicYear', 'sourceUrls', 'candidatePages', 'domainMatch', 'http', 'pagesFetched', 'fetchedAt', 'confidence', 'status', 'notes', 'reviewedBy', 'reviewedAt', 'reviewNote'],
  portals: ['region', 'portalName', 'portalType', 'domainClass', 'roleLabel', 'officialUrl', 'originalCandidateUrl', 'finalUrl', 'domain', 'pageTitle', 'audienceQuote', 'feesQuote', 'timelineQuote', 'corroboratingInstitutions', 'http', 'sha256', 'fetchedAt', 'confidence', 'status', 'notes'],
  visa: ['region', 'visaCategory', 'authority', 'officialUrl', 'originalCandidateUrl', 'finalUrl', 'domain', 'pageTitle', 'financialRequirementQuote', 'languageRequirementQuote', 'insuranceQuote', 'feeQuote', 'timelineQuote', 'http', 'sha256', 'fetchedAt', 'confidence', 'status', 'notes'],
}
const PERSON_COLUMN = /person|contact|staff|officer|legal|phone|tel\b|email|mail|姓名|聯絡|联系|法定代表/i

// ---- 讀檔與完整性 ----
const admissionsPath = latestFile(/^overseas_admissions\.\d{4}-\d{2}-\d{2}\.csv$/)
const date = /(\d{4}-\d{2}-\d{2})/.exec(admissionsPath)[1]
const portalsPath = join(researchDir, `overseas_national_portals.${date}.csv`)
const visaPath = join(researchDir, `overseas_visa_policies.${date}.csv`)
const metaPath = admissionsPath.replace(/\.csv$/, '.meta.json')
let meta
try { meta = JSON.parse(readFileSync(metaPath, 'utf8')) } catch { die(`missing or invalid ${metaPath}`) }
const csv = {}
for (const [key, path] of [['admissions', admissionsPath], ['portals', portalsPath], ['visa', visaPath]]) {
  let buf
  try { buf = readFileSync(path) } catch { die(`missing ${path}`) }
  const name = path.split('/').pop()
  const expected = meta.files?.[name]?.sha256
  if (!expected) die(`${name} 不在 meta.json 的 files 裡`)
  if (sha256(buf) !== expected) die(`${name} SHA-256 與 meta.json 不符（研究檔被改過？）`)
  const parsed = parseCsv(buf.toString('utf8'))
  if (parsed.header.join(',') !== HEADERS[key].join(',')) die(`${name} 表頭與入庫白名單不同：${parsed.header.join(',')}`)
  for (const h of parsed.header) if (PERSON_COLUMN.test(h)) die(`${name} 有疑似個人資料欄 ${h}`)
  if (parsed.rows.length !== meta.files[name].rows) die(`${name} 列數 ${parsed.rows.length} ≠ meta ${meta.files[name].rows}`)
  for (const r of parsed.rows) for (const [k, v] of Object.entries(r)) if (EMAIL.test(v)) die(`${name} ${k} 含電郵樣式：${v.slice(0, 80)}`)
  csv[key] = parsed.rows
}
const geo = parseCsv(readFileSync(latestFile(/^gras_institutions_geo\.\d{4}-\d{2}-\d{2}\.csv$/), 'utf8')).rows
const websites = parseCsv(readFileSync(latestFile(/^gras_institution_websites\.\d{4}-\d{2}-\d{2}\.csv$/), 'utf8')).rows
const nameOverrides = parseCsv(readFileSync(latestFile(/^gras_institution_names_zh_hant\.\d{4}-\d{2}-\d{2}\.csv$/), 'utf8')).rows
const top50 = parseCsv(readFileSync(join(researchDir, 'gras_2026_top50.csv'), 'utf8')).rows
const geoById = new Map(geo.map((g) => [g.univCode, g]))
const webById = new Map(websites.map((w) => [w.univCode, w]))
const overrideById = new Map(nameOverrides.map((n) => [n.univCode, n.nameZhHant]))
const subjectsById = new Map()
for (const r of top50) subjectsById.set(r.univCode, (subjectsById.get(r.univCode) ?? 0) + 1)

// ---- 原文片段 ----
/** 機構層片段：「<標籤>: …原文… [url]」或「…原文… [url]」，以「 ‖ 」分隔；每段原文 ≤ 280 字。 */
function parseInstitutionQuotes(cell, inst, field) {
  if (!cell) return []
  return cell.split(' ‖ ').map((seg) => {
    const m = /^(?:([^…[]{1,80}?): )?([\s\S]*?)\s*\[(https?:\/\/[^\]\s]+)\]\s*$/.exec(seg)
    if (!m) die(`${inst.institutionId} ${field} 片段無法解析：${seg.slice(0, 100)}`)
    const text = m[2]
    const body = text.replace(/^…/, '').replace(/…$/, '')
    if (body.length > 280) die(`${inst.institutionId} ${field} 片段超過 280 字（${body.length}）`)
    if (!body.trim()) die(`${inst.institutionId} ${field} 片段為空`)
    const url = m[3]
    const quote = { text, url: cleanUrl(url), live: inst.linkLive && isHttps(url) && inst.linkDomains.some((d) => hostUnder(url, d)) }
    if (m[1]) quote.label = m[1]
    return quote
  })
}
/** 國家層片段：以「 ‖ 」分隔的原文，來源就是該列 officialUrl。 */
function parseNationalQuotes(cell, where) {
  if (!cell) return []
  return cell.split(' ‖ ').map((text) => {
    const body = text.replace(/^…/, '').replace(/…$/, '')
    if (body.length > 280) die(`${where} 片段超過 280 字（${body.length}）`)
    return text
  })
}
const splitList = (cell) => (cell ? cell.split(';').map((s) => s.trim()).filter(Boolean) : [])
/** 非 verified 的原因：取 notes 第一句，去掉配對分（頁面不得顯示 pageMatchScore）。 */
function unreadReason(r) {
  const first = (r.notes || '').split('；')[0].replace(/（最高分 -?\d+）/g, '').trim()
  if (r.status === 'blocked') return first || `核查時被擋（HTTP ${r.http}）`
  if (r.status === 'needs_review') return first || '首頁只以 JavaScript 載入或待人工確認'
  if (r.status === 'not_found') return first || '官網可達但未找到國際本科招生頁'
  return ''
}

// ---- 機構 ----
const regionsSeen = new Set()
const ids = new Set()
const institutions = []
for (const r of csv.admissions) {
  const id = r.institutionId
  if (!id || ids.has(id)) die(`institutionId 缺少或重複：${id}`)
  ids.add(id)
  const g = geoById.get(id); const w = webById.get(id)
  if (!g) die(`${id} 不在 gras_institutions_geo`)
  if (!w) die(`${id} 不在 gras_institution_websites`)
  if (g.region !== r.region) die(`${id} region ${r.region} ≠ geo ${g.region}`)
  if (g.region === 'China') die(`${id} 是大陸機構，不屬海外層`)
  if (!REGION_ZH[r.region]) die(`${id} 地區 ${r.region} 沒有正體名；補到 REGION_ZH`)
  if (w.status !== 'verified' || w.website !== r.officialWebsite) die(`${id} 官網 ${r.officialWebsite} 與 S0 核查檔不一致（${w.status} ${w.website}）`)
  if (!hostUnder(r.officialWebsite, r.officialDomain)) die(`${id} officialDomain ${r.officialDomain} 與官網 ${r.officialWebsite} 不一致`)
  if (!STATUS.includes(r.status)) die(`${id} status ${r.status}`)
  if (!['high', 'medium', ''].includes(r.confidence)) die(`${id} confidence ${r.confidence}`)
  if ((r.status === 'verified') !== (r.confidence !== '')) die(`${id} status／confidence 不對應：${r.status}／${r.confidence}`)
  // 人工確認欄（2026-11-08 批 G1）：三欄同有同無；reviewedBy 是角色代碼（不存人名）；日期格式
  const reviewed = Boolean(r.reviewedAt)
  if (reviewed !== Boolean(r.reviewedBy) || reviewed !== Boolean(r.reviewNote)) die(`${id} reviewedBy／reviewedAt／reviewNote 須同有同無`)
  if (reviewed && !/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt)) die(`${id} reviewedAt 格式 ${r.reviewedAt}`)
  if (reviewed && !/^[a-z][a-z-]*$/.test(r.reviewedBy)) die(`${id} reviewedBy 必須是角色代碼：${r.reviewedBy}`)
  let reviewedExternalDomain = null
  if (r.confidence === 'high' && r.domainMatch === 'official-external') {
    if (!reviewed) die(`${id} official-external 只有人工確認（reviewedAt）後才允許 high`)
    reviewedExternalDomain = new URL(r.admissionsPageUrl).hostname.replace(/^www\./, '')
    if (!r.reviewNote.includes(reviewedExternalDomain)) die(`${id} reviewNote 必須寫出人工確認的招生頁網域 ${reviewedExternalDomain}`)
  } else if (r.confidence === 'high' && r.domainMatch !== 'true') die(`${id} high 卻 domainMatch=${r.domainMatch}`)
  if (r.status !== 'verified') for (const k of ['admissionsPageUrl', 'admissionsPageTitle', 'gaokaoQuotes', 'qualificationsListed', 'qualificationsQuotes', 'englishTests', 'ieltsOverall', 'toeflOverall', 'englishQuotes', 'otherLanguage', 'otherLanguageQuotes', 'tuitionIntlQuotes', 'applicationChannels', 'applicationChannelQuotes', 'applicationTimelineQuotes', 'domainMatch']) if (r[k]) die(`${id} status=${r.status} 卻帶抽取欄位 ${k}（官方頁本站未讀到的機構不得顯示任何頁面內容）`)
  if (r.confidence === 'medium' && r.domainMatch !== 'official-external') die(`${id} medium 卻 domainMatch=${r.domainMatch}`)
  if (!GAOKAO.includes(r.gaokaoPolicy)) die(`${id} gaokaoPolicy ${r.gaokaoPolicy}`)
  if (r.gaokaoPolicy !== 'not_stated' && !r.gaokaoQuotes) die(`${id} gaokaoPolicy=${r.gaokaoPolicy} 卻沒有原句`)
  const subjects = subjectsById.get(id) ?? 0
  if (String(subjects) !== r.grasSubjectsTop50) die(`${id} grasSubjectsTop50 ${r.grasSubjectsTop50} ≠ top50 檔 ${subjects}`)
  const linkLive = r.status === 'verified' && r.confidence === 'high'
  if (r.status === 'verified') {
    if (!r.admissionsPageUrl) die(`${id} verified 卻沒有招生頁 URL`)
    if (r.http !== '200') die(`${id} verified 卻 HTTP ${r.http}`)
  }
  if (linkLive) {
    if (!isHttps(r.admissionsPageUrl)) die(`${id} 招生頁不是 https：${r.admissionsPageUrl}`)
    if (!hostUnder(r.admissionsPageUrl, reviewedExternalDomain ?? r.officialDomain)) die(`${id} 招生頁主機不在 ${reviewedExternalDomain ?? r.officialDomain} 之下：${r.admissionsPageUrl}`)
  }
  if (r.confidence === 'medium' && hostUnder(r.admissionsPageUrl, r.officialDomain)) die(`${id} medium 卻在官網網域內（應為 high）`)
  const linkDomains = [r.officialDomain, ...(reviewedExternalDomain ? [reviewedExternalDomain] : [])]
  const inst = { institutionId: id, linkDomains, linkLive }
  const nameZh = overrideById.get(id) ?? r.nameZhHant
  const fetched = dateOf(r.fetchedAt)
  regionsSeen.add(r.region)
  const gaokaoQuotes = parseInstitutionQuotes(r.gaokaoQuotes, inst, 'gaokaoQuotes')
  const qualificationsQuotes = parseInstitutionQuotes(r.qualificationsQuotes, inst, 'qualificationsQuotes')
  const englishQuotes = parseInstitutionQuotes(r.englishQuotes, inst, 'englishQuotes')
  const otherLanguageQuotes = parseInstitutionQuotes(r.otherLanguageQuotes, inst, 'otherLanguageQuotes')
  const tuitionQuotes = parseInstitutionQuotes(r.tuitionIntlQuotes, inst, 'tuitionIntlQuotes')
  const channelQuotes = parseInstitutionQuotes(r.applicationChannelQuotes, inst, 'applicationChannelQuotes')
  const timelineQuotes = parseInstitutionQuotes(r.applicationTimelineQuotes, inst, 'applicationTimelineQuotes')
  const sources = r.sourceUrls ? r.sourceUrls.split(' | ').map((s) => s.trim()).filter(Boolean).map((url) => ({ url: cleanUrl(url), live: linkLive && isHttps(url) && linkDomains.some((d) => hostUnder(url, d)) })) : []
  const admissions = { status: r.status, statusZh: STATUS_ZH[r.status], confidence: r.confidence || null, linkLive }
  if (linkLive) {
    admissions.url = cleanUrl(r.admissionsPageUrl); admissions.title = r.admissionsPageTitle
    if (reviewedExternalDomain) { admissions.externalDomain = new URL(r.admissionsPageUrl).hostname; admissions.reviewedAt = r.reviewedAt }
  }
  else if (r.confidence === 'medium') {
    admissions.title = r.admissionsPageTitle
    admissions.externalDomain = new URL(r.admissionsPageUrl).hostname
    admissions.note = '學校另一官方網域，待人工確認後才上鏈接'
  } else admissions.note = `官方頁本站未讀到：${unreadReason(r)}`
  const summary = {
    id, nameEn: r.nameEn, nameZh: nameZh || null, region: r.region, website: r.officialWebsite, subjects,
    status: r.status, confidence: r.confidence || null, linkLive, gaokaoPolicy: r.gaokaoPolicy, dataAcademicYear: r.dataAcademicYear || null, fetchedAt: fetched,
    has: { gaokao: gaokaoQuotes.length > 0, qualifications: qualificationsQuotes.length > 0, english: englishQuotes.length > 0, otherLanguage: otherLanguageQuotes.length > 0, tuition: tuitionQuotes.length > 0, channels: channelQuotes.length > 0, timeline: timelineQuotes.length > 0 },
  }
  const detail = {
    ...summary,
    wikidata: r.wikidata || null,
    admissions,
    gaokao: { policy: r.gaokaoPolicy, policyZh: GAOKAO_ZH[r.gaokaoPolicy], quotes: gaokaoQuotes },
    qualifications: { listed: splitList(r.qualificationsListed), quotes: qualificationsQuotes },
    english: { tests: splitList(r.englishTests), ielts: r.ieltsOverall || null, toefl: r.toeflOverall || null, quotes: englishQuotes },
    otherLanguage: { listed: splitList(r.otherLanguage), quotes: otherLanguageQuotes },
    tuition: { quotes: tuitionQuotes },
    channels: { listed: splitList(r.applicationChannels), quotes: channelQuotes },
    timeline: { quotes: timelineQuotes },
    sources, pagesFetched: Number(r.pagesFetched) || 0,
  }
  institutions.push({ summary, detail })
}

// ---- 國家層 ----
function nationalReason(r) {
  if (r.notes) return r.notes.replace(/（配對分 -?\d+[^）]*）/g, '').trim()
  if (r.status === 'blocked') return `核查時被擋（HTTP ${r.http}）`
  if (r.status === 'needs_review') return '頁面只以 JavaScript 載入、轉址或待人工確認'
  if (r.status === 'not_found') return '不可達或未找到對應頁'
  return ''
}
const portals = []
for (const r of csv.portals) {
  const where = `平台 ${r.region}／${r.portalName}`
  if (!regionsSeen.has(r.region)) die(`${where} 的地區不在機構表`)
  if (!STATUS.includes(r.status)) die(`${where} status ${r.status}`)
  if (!['high', ''].includes(r.confidence)) die(`${where} confidence ${r.confidence}`)
  if (!PORTAL_TYPE_ZH[r.portalType]) die(`${where} portalType ${r.portalType}`)
  if (!DOMAIN_CLASS_ZH[r.domainClass]) die(`${where} domainClass ${r.domainClass}`)
  if (!/^https?:\/\//.test(r.officialUrl)) die(`${where} officialUrl ${r.officialUrl}`)
  const corroborating = Number(r.corroboratingInstitutions) || 0
  const linkLive = r.status === 'verified' && r.confidence === 'high' && isHttps(r.officialUrl) && hostUnder(r.officialUrl, r.domain)
  if (r.status === 'verified') {
    if (r.http !== '200') die(`${where} verified 卻 HTTP ${r.http}`)
    if (r.confidence !== 'high') die(`${where} verified 卻 confidence=${r.confidence}`)
    if (!linkLive) die(`${where} verified 卻不符上線規則（https／網域）`)
    if (r.domainClass === 'official-platform' && corroborating < 1) die(`${where} official-platform 無機構頁佐證卻 verified`)
  }
  const item = {
    name: r.portalName, type: r.portalType, typeZh: PORTAL_TYPE_ZH[r.portalType], domainClass: r.domainClass, domainClassZh: DOMAIN_CLASS_ZH[r.domainClass], roleLabel: r.roleLabel,
    domain: r.domain || null, status: r.status, statusZh: STATUS_ZH[r.status], linkLive, corroborating, fetchedAt: dateOf(r.fetchedAt),
    quotes: { audience: parseNationalQuotes(r.audienceQuote, where), fees: parseNationalQuotes(r.feesQuote, where), timeline: parseNationalQuotes(r.timelineQuote, where) },
  }
  if (linkLive) { item.url = cleanUrl(r.officialUrl); item.pageTitle = r.pageTitle || null } else item.note = nationalReason(r)
  portals.push({ region: r.region, item })
}
const visa = []
for (const r of csv.visa) {
  const where = `簽證 ${r.region}／${r.visaCategory}`
  if (!regionsSeen.has(r.region)) die(`${where} 的地區不在機構表`)
  if (!STATUS.includes(r.status)) die(`${where} status ${r.status}`)
  if (!['high', ''].includes(r.confidence)) die(`${where} confidence ${r.confidence}`)
  if (!/^https?:\/\//.test(r.officialUrl)) die(`${where} officialUrl ${r.officialUrl}`)
  if (!r.authority) die(`${where} 缺主管機關名`)
  const linkLive = r.status === 'verified' && isHttps(r.officialUrl) && hostUnder(r.officialUrl, r.domain)
  if (r.status === 'verified') {
    if (r.http !== '200') die(`${where} verified 卻 HTTP ${r.http}`)
    if (r.confidence !== 'high') die(`${where} verified 卻 confidence=${r.confidence}`)
    if (!linkLive) die(`${where} verified 卻不符上線規則（https／網域）`)
  }
  const item = {
    category: r.visaCategory, authority: r.authority, domain: r.domain || null, status: r.status, statusZh: STATUS_ZH[r.status], linkLive, fetchedAt: dateOf(r.fetchedAt),
    quotes: { financial: parseNationalQuotes(r.financialRequirementQuote, where), language: parseNationalQuotes(r.languageRequirementQuote, where), insurance: parseNationalQuotes(r.insuranceQuote, where), fee: parseNationalQuotes(r.feeQuote, where), timeline: parseNationalQuotes(r.timelineQuote, where) },
  }
  if (linkLive) { item.url = cleanUrl(r.officialUrl); item.pageTitle = r.pageTitle || null } else item.note = nationalReason(r)
  visa.push({ region: r.region, item })
}

// ---- 計數斷言（與研究 coverage.md／meta.json 一致）----
const count = (arr, pred) => arr.filter(pred).length
const instCounts = {
  total: institutions.length,
  verified: count(institutions, (i) => i.summary.status === 'verified'), needs_review: count(institutions, (i) => i.summary.status === 'needs_review'),
  blocked: count(institutions, (i) => i.summary.status === 'blocked'), not_found: count(institutions, (i) => i.summary.status === 'not_found'),
  high: count(institutions, (i) => i.summary.confidence === 'high'), medium: count(institutions, (i) => i.summary.confidence === 'medium'), regions: regionsSeen.size,
}
const portalCounts = { total: portals.length, verified: count(portals, (p) => p.item.status === 'verified'), needs_review: count(portals, (p) => p.item.status === 'needs_review'), blocked: count(portals, (p) => p.item.status === 'blocked'), not_found: count(portals, (p) => p.item.status === 'not_found'), high: count(portals, (p) => p.item.linkLive) }
const visaCounts = { total: visa.length, verified: count(visa, (v) => v.item.status === 'verified'), needs_review: count(visa, (v) => v.item.status === 'needs_review'), blocked: count(visa, (v) => v.item.status === 'blocked'), not_found: count(visa, (v) => v.item.status === 'not_found'), high: count(visa, (v) => v.item.linkLive) }
for (const [name, actual, expected] of [['institutions', instCounts, meta.counts?.institutions], ['portals', portalCounts, meta.counts?.portals], ['visa', visaCounts, meta.counts?.visa]]) {
  if (!expected) die(`meta.json 缺 counts.${name}`)
  for (const [k, v] of Object.entries(expected)) if (actual[k] !== v) die(`${name}.${k} ${actual[k]} ≠ meta ${v}（研究 coverage.md 口徑）`)
}
if (instCounts.verified !== instCounts.high + instCounts.medium) die('verified ≠ high + medium')

// ---- 地區與 payload ----
const regionCodes = [...regionsSeen]
const slugs = new Map(regionCodes.map((code) => [code, slugify(code)]))
if (new Set(slugs.values()).size !== regionCodes.length) die('地區 slug 重複')
for (const slug of slugs.values()) if (!/^[a-z0-9-]{2,}$/.test(slug)) die(`slug 不合法：${slug}`)
const byRegion = (code) => institutions.filter((i) => i.summary.region === code)
const regionRows = regionCodes.map((code) => {
  const list = byRegion(code)
  const p = portals.filter((x) => x.region === code).map((x) => x.item)
  const v = visa.filter((x) => x.region === code).map((x) => x.item)
  return {
    code, slug: slugs.get(code), nameZh: REGION_ZH[code], file: `${slugs.get(code)}.json`,
    institutions: list.length, verified: count(list, (i) => i.summary.status === 'verified'), linkLive: count(list, (i) => i.summary.linkLive), unread: count(list, (i) => i.summary.status !== 'verified'),
    portals: p.length, portalsLive: count(p, (x) => x.linkLive), visa: v.length, visaLive: count(v, (x) => x.linkLive),
  }
}).sort((a, b) => b.institutions - a.institutions || a.code.localeCompare(b.code))
const sortInst = (a, b) => a.summary.nameEn.localeCompare(b.summary.nameEn, 'en') || a.summary.id.localeCompare(b.summary.id)
const regionOrder = new Map(regionRows.map((r, i) => [r.code, i]))
const indexPayload = {
  version: '', generatedAt: date,
  source: { research: 'reports/operations/nope-s3-overseas-20261107/research', files: Object.fromEntries(Object.entries(meta.files).map(([k, v]) => [k, v.sha256])), crawl: { startedAt: meta.crawl.startedAt, finishedAt: meta.crawl.finishedAt } },
  regions: regionRows,
  institutions: [...institutions].sort((a, b) => (regionOrder.get(a.summary.region) - regionOrder.get(b.summary.region)) || sortInst(a, b)).map((i) => i.summary),
}
const regionPayloads = regionRows.map((row) => ({
  version: '', generatedAt: date, region: { code: row.code, slug: row.slug, nameZh: row.nameZh },
  portals: portals.filter((x) => x.region === row.code).map((x) => x.item).sort((a, b) => Number(b.linkLive) - Number(a.linkLive) || a.name.localeCompare(b.name, 'en')),
  visa: visa.filter((x) => x.region === row.code).map((x) => x.item).sort((a, b) => Number(b.linkLive) - Number(a.linkLive) || a.category.localeCompare(b.category, 'en')),
  institutions: byRegion(row.code).sort(sortInst).map((i) => i.detail),
}))
// 版本雜湊：index（version 留空）＋各地區檔（version 留空，slug 字母序）；tests/overseas-layer.test.ts 以同一定義重算。
const hash = createHash('sha256')
hash.update(JSON.stringify(indexPayload))
for (const p of [...regionPayloads].sort((a, b) => a.region.slug.localeCompare(b.region.slug))) hash.update('\n').update(JSON.stringify(p))
const version = hash.digest('hex').slice(0, 12)
indexPayload.version = version
for (const p of regionPayloads) p.version = version

// ---- 最後掃描：序列化後不得含電郵或會話字串；index gzip 體積上限 ----
const indexJson = JSON.stringify(indexPayload)
const allJson = [indexJson, ...regionPayloads.map((p) => JSON.stringify(p))]
for (const text of allJson) {
  if (EMAIL.test(text)) die('payload 含電郵樣式')
  if (/jsessionid|PHPSESSID|sessionid=/i.test(text)) die('payload 含會話字串')
  if (/pageMatchScore/.test(text)) die('payload 不得帶 pageMatchScore')
}
const indexGzip = gzipSync(Buffer.from(indexJson)).length
if (indexGzip > 200 * 1024) die(`index.json gzip ${indexGzip} B 超過 200 KiB`)

const outDir = join(root, 'public', 'data', 'overseas')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'regions'), { recursive: true })
writeFileSync(join(outDir, 'index.json'), indexJson)
for (const p of regionPayloads) writeFileSync(join(outDir, 'regions', `${p.region.slug}.json`), JSON.stringify(p))
const gaokaoCounts = Object.fromEntries(GAOKAO.map((k) => [k, count(institutions, (i) => i.summary.gaokaoPolicy === k)]))
const manifest = {
  version, indexPath: '/data/overseas/index.json', regionsBasePath: '/data/overseas/regions', generatedAt: date,
  counts: {
    regions: regionCodes.length, institutions: instCounts.total, byStatus: { verified: instCounts.verified, needs_review: instCounts.needs_review, blocked: instCounts.blocked, not_found: instCounts.not_found },
    byConfidence: { high: instCounts.high, medium: instCounts.medium }, admissionsLinksLive: count(institutions, (i) => i.summary.linkLive), nameZhHant: count(institutions, (i) => Boolean(i.summary.nameZh)),
    gaokao: gaokaoCounts,
    portals: { total: portalCounts.total, verified: portalCounts.verified, live: portalCounts.high }, visa: { total: visaCounts.total, verified: visaCounts.verified, live: visaCounts.high },
    indexGzipBytes: indexGzip,
  },
}
writeFileSync(join(root, 'src', 'data', 'overseasManifest.ts'), `// Generated by scripts/build_overseas_layer.mjs. Do not edit by hand.\nexport const overseasManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
const regionBytes = regionPayloads.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p)), 0)
console.log(`wrote public/data/overseas/index.json (${(indexJson.length / 1024).toFixed(0)} KiB, gzip ${(indexGzip / 1024).toFixed(0)} KiB) + ${regionPayloads.length} region files (${(regionBytes / 1024).toFixed(0)} KiB) version ${version}`)
console.log(JSON.stringify(manifest.counts))
