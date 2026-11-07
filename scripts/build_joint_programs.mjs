#!/usr/bin/env node
// S2 前半（批 D2）：中外合作辦學機構／項目資料層。
//
//   node scripts/build_joint_programs.mjs --cache-dir DIR [--date YYYY-MM-DD]
//
// 輸入：fetch_joint_programs.mjs 抓回的名單頁與詳情頁（教育部中外合作辦學監管工作信息平台，唯一主來源）。
// 輸出：data/research/joint_programs.<日期>.csv（逐機構／項目一列）、joint_programs.<日期>.meta.json（計數、對不到主表清單、快取雜湊）。
// 對回教育部主表：獨立法人機構（寧波諾丁漢大學等）用機構名直接對；校內機構與項目用「中方合作辦學者」校名對（含教育部同碼舊名與 S1 學到的省表舊名）。
// 不存個人資料：法定代表人、校長等姓名欄一律不讀。
// 收費：平台詳情頁沒有學費欄，本層不產生 A4 取值（路線圖：收費只在官方來源給出時才取）。

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const argValue = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback }
const cacheDir = resolve(argValue('--cache-dir', '.tmp/crs'))
const date = argValue('--date', new Date().toISOString().slice(0, 10))
const researchDir = join(root, 'data', 'research')
const die = (m) => { console.error(`build_joint_programs: ${m}`); process.exit(1) }
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&ldquo;|&rdquo;/g, '"')
const strip = (h) => decode(h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
// 欄位內每行行尾空白去掉（官方頁原文常帶尾隨空格；只動空白，不動字）。
const csvCell = (v) => { const t = (v === undefined || v === null ? '' : String(v)).replace(/[ \t\u3000]+(?=\r?\n|$)/g, ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
const writeCsv = (path, header, rows) => writeFileSync(path, `${header.join(',')}\n${rows.map((r) => header.map((k) => csvCell(r[k])).join(',')).join('\n')}\n`)
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
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

// ---------- 教育部主表對齊 ----------
const { officialSchools } = await import(pathToFileURL(join(root, 'src', 'data', 'officialSchools.ts')).href)
const normalizeName = (s) => s.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',').replace(/：/g, ':').replace(/－|—|–/g, '-')
const byName = new Map(officialSchools.map((s) => [normalizeName(s.nameSimplified ?? s.name), s]))
for (const row of parseCsv(readFileSync(join(researchDir, 'moe_former_names.2026-06-17.csv'), 'utf8'))) {
  const cur = normalizeName(row.currentName), former = normalizeName(row.formerName)
  if (former && byName.has(cur) && !byName.has(former)) byName.set(former, byName.get(cur))
}
const s1Meta = JSON.parse(readFileSync(join(researchDir, 'program_offerings.2027.all.meta.json'), 'utf8'))
for (const [alias, current] of Object.entries(s1Meta.learnedAliases ?? {})) { const n = normalizeName(alias); const cur = byName.get(normalizeName(current)); if (cur && !byName.has(n)) byName.set(n, cur) }
// 平台寫法與教育部主表的差異（人工登記；只收確定的同一所學校）
const PLATFORM_ALIASES = { 中国石油大学: '中国石油大学(北京)', 中国地质大学: '中国地质大学(北京)', 中国矿业大学: '中国矿业大学(北京)', '哈尔滨工业大学(深圳)': '哈尔滨工业大学', '哈尔滨工业大学(威海)': '哈尔滨工业大学', 北京师范大学珠海校区: '北京师范大学', '中国人民大学(苏州校区)': '中国人民大学', 浙江大学城市学院: '浙大城市学院', 浙江大学宁波理工学院: '浙大宁波理工学院', 牡丹江医学院: '牡丹江医科大学', 合肥学院: '合肥大学', 赣南医学院: '赣南医科大学' }
function resolveSchool(raw) {
  if (!raw) return null
  let name = normalizeName(raw).replace(/^中方:/, '').trim()
  if (PLATFORM_ALIASES[name]) name = normalizeName(PLATFORM_ALIASES[name])
  if (byName.has(name)) return byName.get(name)
  const base = name.replace(/\(.*?\)$/, '')
  if (byName.has(base)) return byName.get(base)
  return null
}
const PROVINCE_ZH = { 北京: '北京', 上海: '上海', 天津: '天津', 重庆: '重慶', 江苏: '江蘇', 浙江: '浙江', 广东: '廣東', 海南: '海南', 福建: '福建', 山东: '山東', 江西: '江西', 四川: '四川', 安徽: '安徽', 河北: '河北', 河南: '河南', 湖北: '湖北', 湖南: '湖南', 陕西: '陝西', 山西: '山西', 黑龙江: '黑龍江', 辽宁: '遼寧', 吉林: '吉林', 广西: '廣西', 云南: '雲南', 贵州: '貴州', 甘肃: '甘肅', 内蒙古: '內蒙古', 宁夏: '寧夏', 新疆: '新疆', 青海: '青海', 西藏: '西藏' }

// ---------- 名單頁 ----------
const files = readdirSync(cacheDir)
const listFiles = files.filter((f) => f.startsWith('list_'))
if (listFiles.length < 33) die(`名單頁只有 ${listFiles.length}/33，先跑 fetch_joint_programs.mjs`)
const listed = new Map() // id → { region, category, levelLists:Set, markers:Set, nameInList }
for (const f of listFiles.filter((f) => f.startsWith('list_getbyarea_'))) {
  const html = readFileSync(join(cacheDir, f), 'utf8')
  const region = /font-size:20px; color:#CC0000; font-weight:bold">([^<]+)</.exec(html)?.[1]?.trim()
  if (!region) { if (!/aproval\/detail\//.test(html)) continue; die(`${f}: 找不到地區名`) }
  if (!PROVINCE_ZH[region]) die(`${f}: 地區 ${region} 不認得`)
  // 每個 <tr> 的第一格是分類標籤，第二格的 <ol> 列出機構／項目
  for (const tr of html.matchAll(/<tr>\s*<td bgcolor="#ffffff"[^>]*>([^<]{4,30})<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g)) {
    const category = decode(tr[1]).trim()
    if (!['中外合作办学机构', '中外合作办学项目', '内地与港澳台地区合作办学机构', '内地与港澳台地区合作办学项目', '境外高校在海南自由贸易港独立办学的大学'].includes(category)) continue
    for (const li of tr[2].matchAll(/<a href="\s*https?:\/\/www\.crs\.jsj\.edu\.cn\/aproval\/detail\/(\d+)\s*"[^>]*>([\s\S]*?)<\/a>/g)) {
      const id = Number(li[1]); const name = strip(li[2])
      const entry = listed.get(id) ?? listed.set(id, { id, region, category, levelLists: new Set(), markers: new Set(), nameInList: name }).get(id)
      entry.region = region; entry.category = category
    }
  }
}
// 名單頁標題：orglists/1＝「硕士及以上…名单」、orglists/2＝「本科…名单」（與首頁連結文字順序相反，以頁面標題為準）。
for (const [f, level, titleKey] of [['list_orglists_1.html', '硕士及以上', '硕士及以上中外合作办学机构与项目'], ['list_orglists_2.html', '本科', '本科中外合作办学机构与项目']]) {
  if (!readFileSync(join(cacheDir, f), 'utf8').includes(titleKey)) die(`${f}: 頁面標題不含「${titleKey}」，名單層次對應可能變了`)
  const html = readFileSync(join(cacheDir, f), 'utf8')
  for (const li of html.matchAll(/<li[^>]*>\s*<a href="\s*https?:\/\/www\.crs\.jsj\.edu\.cn\/aproval\/detail\/(\d+)\s*"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/li>/g)) {
    const id = Number(li[1]); const entry = listed.get(id) ?? listed.set(id, { id, region: '', category: '', levelLists: new Set(), markers: new Set(), nameInList: strip(li[2]) }).get(id)
    entry.levelLists.add(level)
    for (const m of li[3].matchAll(/[▲●■]/g)) entry.markers.add(m[0])
  }
}

// ---------- 詳情頁 ----------
const FIELDS = ['项目名称', '机构名称', '机构属性', '办学地址', '机构住所', '中外合作办学者', '内地与港澳台合作办学者', '合作办学者是否要求取得合理回报', '办学层次和类别', '学制', '每期招生人数', '办学规模', '招生起止年份', '招生方式', '开设专业或课程', '颁发证书', '审批机关', '批准书编号', '许可证编号', '批准书有效期', '许可证有效期', '备注']
const SKIP_PERSONAL = new Set(['法定代表人', '校长或主要行政负责人'])
function parseDetail(id, html, nameInList) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])))
  const kv = {}
  let changeRows = 0, lastChange = ''
  let inChanges = false
  for (const cells of rows) {
    if (cells.some((c) => c.startsWith('变更记载'))) { inChanges = true; continue }
    if (inChanges) { if (cells.length >= 4 && /^\d{4}年/.test(cells[2])) { changeRows += 1; lastChange = cells[2] }; if (cells.some((c) => /^招生简章/.test(c))) inChanges = false; continue }
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const key = cells[i].replace(/\s/g, ''), value = cells[i + 1]
      if (SKIP_PERSONAL.has(key)) continue
      if (FIELDS.includes(key)) kv[key] = kv[key] ? `${kv[key]}\n${value}` : value
    }
    // 第二個合作方（外方／港澳台）常獨佔一列（有時後面還跟著其他欄），接回合作辦學者欄；證書的外方列同理。
    if (cells.length >= 1 && /^(外方|港澳台)[:：]/.test(cells[0])) { const key = kv['内地与港澳台合作办学者'] !== undefined ? '内地与港澳台合作办学者' : '中外合作办学者'; kv[key] = `${kv[key] ?? ''}\n${cells[0]}`.trim(); for (let i = 1; i + 1 < cells.length; i += 2) { const k = cells[i].replace(/\s/g, ''); if (FIELDS.includes(k) && !SKIP_PERSONAL.has(k)) kv[k] = cells[i + 1] } }
  }
  const text = strip(html)
  const brochure = /招生简章[:：]\s*<a[^>]+href="([^"]+)"/.exec(html)?.[1] ?? ''
  const website = /办学网址[:：]\s*<a[^>]+href="([^"]+)"/.exec(html)?.[1] ?? ''
  const partners = kv['中外合作办学者'] ?? kv['内地与港澳台合作办学者'] ?? ''
  const chinese = (/(?:中方|内地)[:：]\s*([^\n]+)/.exec(partners)?.[1] ?? '').trim()
  const foreign = [...partners.matchAll(/(?:外方|港澳台)[:：]\s*([^\n]+)/g)].map((m) => m[1].trim()).join('；')
  const name = kv['项目名称'] ?? kv['机构名称'] ?? ''
  if (!name) die(`${id}: 詳情頁沒有名稱`)
  const kind = kv['项目名称'] ? 'project' : 'institution'
  const level = kv['办学层次和类别'] ?? ''
  const years = kv['招生起止年份'] ?? ''
  const endYear = Number((years.match(/(\d{4})\s*年?[^\d]*$/) ?? [])[1]) || Number((years.match(/[—\-－~至到](\d{4})/) ?? [])[1]) || null
  const annotation = /[（(]([^（）()]*(?:注销|终止|并入|停止招生|停办|撤销)[^（）()]*)[）)]\s*$/.exec(name)?.[1] ?? /[（(]([^（）()]*(?:注销|终止|并入|停止招生|停办|撤销)[^（）()]*)[）)]\s*$/.exec(nameInList ?? '')?.[1] ?? ''
  const status = /注销|撤销/.test(annotation) ? 'terminated' : /终止/.test(annotation) ? 'terminated' : /并入/.test(annotation) ? 'merged' : /停止招生|停办/.test(annotation) ? 'suspended' : 'listed'
  return { id, kind, name, nameBase: annotation ? name.replace(/\s*[（(][^（）()]*[）)]\s*$/, '') : name, annotation, legalPerson: kv['机构属性'] ?? '', address: kv['办学地址'] ?? kv['机构住所'] ?? '', chinesePartner: chinese, foreignPartner: foreign, level, duration: kv['学制'] ?? '', intake: kv['每期招生人数'] ?? kv['办学规模'] ?? '', enrolmentYears: years, enrolmentEndYear: endYear, admissionMode: kv['招生方式'] ?? '', programs: (kv['开设专业或课程'] ?? '').replace(/\n/g, ' '), certificates: (kv['颁发证书'] ?? '').replace(/\n/g, ' / '), approvalAuthority: kv['审批机关'] ?? '', licenseNo: (kv['批准书编号'] ?? kv['许可证编号'] ?? '').replace(/\s/g, ''), licenseKind: kv['批准书编号'] ? '批准书' : kv['许可证编号'] ? '许可证' : '', validUntil: kv['批准书有效期'] ?? kv['许可证有效期'] ?? '', remarks: (kv['备注'] ?? '').replace(/\n/g, ' '), changeRows, lastChange, brochureUrl: brochure, websiteUrl: website, status, hasFeeInfo: /学费|收费|元\/学年|元\/年/.test(text) }
}

const detailFiles = files.filter((f) => /^\d+\.html$/.test(f))
const records = []; const missingDetail = []; const unmatched = []
let cacheHash = createHash('sha256')
for (const [id, entry] of [...listed.entries()].sort((a, b) => a[0] - b[0])) {
  const file = join(cacheDir, `${id}.html`)
  if (!existsSync(file)) { missingDetail.push(id); continue }
  const buf = readFileSync(file); cacheHash.update(String(id)).update(buf)
  const d = parseDetail(id, buf.toString('utf8'), entry.nameInList)
  // 對回主表：獨立法人機構先用機構名；其餘用中方校名（可能多個，取第一個對得上的）
  let school = null, matchBy = ''
  // 獨立法人機構（機構屬性「具有法人資格」）與境外高校獨立辦學的大學（無中方合作辦學者）以機構自身名稱對回教育部主表。
  if (d.kind === 'institution' && !/不具有/.test(d.legalPerson) && (/具有法人资格/.test(d.legalPerson) || !d.chinesePartner)) { school = resolveSchool(d.nameBase.replace(/（.*$/, '').replace(/\(.*$/, '')); if (school) matchBy = 'institution_name' }
  if (!school) for (const part of d.chinesePartner.split(/[、，,；;]/)) { const s = resolveSchool(part.replace(/等$/, '')); if (s) { school = s; matchBy = 'chinese_partner'; break } }
  if (!school) unmatched.push({ id, name: d.name, chinesePartner: d.chinesePartner, kind: d.kind, region: entry.region })
  records.push({
    id, sourceUrl: `https://www.crs.jsj.edu.cn/aproval/detail/${id}`, fetchedAt: date,
    region: entry.region, province: PROVINCE_ZH[entry.region] ?? '', category: entry.category, cooperationType: /港澳台/.test(entry.category) ? 'mainland_hkmotw' : /境外高校.*独立办学/.test(entry.category) ? 'foreign_independent' : 'sino_foreign',
    kind: d.kind, levelLists: [...entry.levelLists].sort().join('|'), markers: [...entry.markers].sort().join(''),
    name: d.name, nameInList: entry.nameInList, annotation: d.annotation, status: d.status,
    moeCode: school?.moeCode ?? '', moeName: school ? (school.nameSimplified ?? school.name) : '', matchBy,
    legalPerson: d.legalPerson, chinesePartner: d.chinesePartner, foreignPartner: d.foreignPartner, level: d.level, duration: d.duration, intake: d.intake, enrolmentYears: d.enrolmentYears, enrolmentEndYear: d.enrolmentEndYear ?? '', admissionMode: d.admissionMode, programs: d.programs, certificates: d.certificates, approvalAuthority: d.approvalAuthority, licenseKind: d.licenseKind, licenseNo: d.licenseNo, validUntil: d.validUntil, remarks: d.remarks, changeRows: d.changeRows, lastChange: d.lastChange, brochureUrl: d.brochureUrl, websiteUrl: d.websiteUrl, address: d.address, hasFeeInfo: d.hasFeeInfo ? 'yes' : 'no',
  })
}
if (records.some((r) => !r.licenseNo)) console.warn(`  ${records.filter((r) => !r.licenseNo).length} 條沒有批准書／許可證編號（詳情頁缺欄）`)
const header = ['id', 'sourceUrl', 'fetchedAt', 'region', 'province', 'category', 'cooperationType', 'kind', 'levelLists', 'markers', 'name', 'nameInList', 'annotation', 'status', 'moeCode', 'moeName', 'matchBy', 'legalPerson', 'chinesePartner', 'foreignPartner', 'level', 'duration', 'intake', 'enrolmentYears', 'enrolmentEndYear', 'admissionMode', 'programs', 'certificates', 'approvalAuthority', 'licenseKind', 'licenseNo', 'validUntil', 'remarks', 'changeRows', 'lastChange', 'brochureUrl', 'websiteUrl', 'address', 'hasFeeInfo']
writeCsv(join(researchDir, `joint_programs.${date}.csv`), header, records)
const count = (arr, key) => { const m = new Map(); for (const r of arr) m.set(key(r), (m.get(key(r)) ?? 0) + 1); return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1])) }
const meta = {
  generatedAt: date, source: { publisher: '教育部中外合作办学监管工作信息平台（教育涉外监管信息网）', homepage: 'https://www.crs.jsj.edu.cn/', lists: ['https://www.crs.jsj.edu.cn/aproval/orglists/1', 'https://www.crs.jsj.edu.cn/aproval/orglists/2', 'https://www.crs.jsj.edu.cn/aproval/getbyarea/1..31'], listUpdatedNote: '名單頁自述「教育部审批和复核的机构及项目名单（2026年5月25日更新）」', detailCacheSha256: cacheHash.digest('hex'), detailFilesHashed: records.length },
  counts: { listed: listed.size, withDetail: records.length, missingDetail: missingDetail.length, byKind: count(records, (r) => r.kind), byCategory: count(records, (r) => r.category), byCooperation: count(records, (r) => r.cooperationType), byLevelLists: count(records, (r) => r.levelLists), byStatus: count(records, (r) => r.status), byMatch: count(records, (r) => r.matchBy || 'none'), matchedSchools: new Set(records.filter((r) => r.moeCode).map((r) => r.moeCode)).size, withFeeInfo: records.filter((r) => r.hasFeeInfo === 'yes').length, byProvince: count(records, (r) => r.province) },
  unmatched, missingDetail,
}
writeFileSync(join(researchDir, `joint_programs.${date}.meta.json`), `${JSON.stringify(meta, null, 2)}\n`)
console.log(`joint_programs.${date}.csv: ${records.length} 條（名單 ${listed.size}，缺詳情 ${missingDetail.length}）；對到主表 ${records.filter((r) => r.moeCode).length}（${meta.counts.matchedSchools} 校），對不到 ${unmatched.length}`)
console.log(JSON.stringify(meta.counts))
