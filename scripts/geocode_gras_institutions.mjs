#!/usr/bin/env node
// 把 GRAS 前 50 名機構對到座標、正體中文名與（大陸機構）教育部代碼。
//
//   node scripts/geocode_gras_institutions.mjs --year 2026
//
// 優先序：
//   1. 大陸機構：用中文名對教育部主表（nameSimplified），座標取本站校區底稿 campus_locations 的主校區；
//      校名用教育部正體名。這是本站既有權威，不用外部座標。
//   2. 其他機構：Wikidata（CC0）。先用英文標籤／別名精確比對並要求國家與軟科地區一致，再退到搜尋 API；
//      中文名只取 zh-hant／zh-tw／zh-hk 標籤，沒有就留空（不混簡體、不自行翻譯）。
//   3. 以上都對不上的，寫在 MANUAL_OVERRIDES（校園座標人工查核，附註來源）。
// 任何機構最後仍沒有座標 → 直接失敗，不讓地圖少點。
//
// 輸出 data/research/gras_institutions_geo.<fetchedAt>.csv。

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter(Boolean))
const year = Number(args.year || 2026)
const UA = { 'User-Agent': 'nope.bdfz.net data pipeline (non-commercial; contact nope@bdfz.net)' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}
function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// 本站的校名規範化（與 src/lib/schoolName.ts 同一份邏輯；這裡用 import 以免兩處分叉）。
const { normalizeSchoolName } = await import(`data:text/javascript,${encodeURIComponent(
  readFileSync(join(root, 'src/lib/schoolName.ts'), 'utf8')
    .replace(': Record<string, string>', '').replace(' as const', '').replace('(name: string): string', '(name)'),
)}`)

const schools = JSON.parse(readFileSync(join(root, 'public/data/runtime/schools.json'), 'utf8'))
const schoolByNorm = new Map(schools.map((s) => [normalizeSchoolName(s.nameSimplified ?? s.name), s]))
// 同一標識碼的舊校名（教育部年度名單比對）：外部資料還在用舊名時照樣對得上。
const formerNameRows = parseCsv(readFileSync(join(root, 'data/research/moe_former_names.2026-06-17.csv'), 'utf8'))
const currentNameByFormer = new Map(formerNameRows.map((r) => [normalizeSchoolName(r.formerName), r.currentName]))
function findSchool(zhName) {
  if (!zhName) return null
  const direct = schoolByNorm.get(normalizeSchoolName(zhName))
  if (direct) return direct
  const current = currentNameByFormer.get(normalizeSchoolName(zhName))
  return current ? schoolByNorm.get(normalizeSchoolName(current)) ?? null : null
}
const campusRows = parseCsv(readFileSync(join(root, 'data/research/campus_locations.2026-04-21.csv'), 'utf8'))
const mainCampusByMoe = new Map()
for (const r of campusRows) {
  if (!r.lat || !r.lng) continue
  const current = mainCampusByMoe.get(r.moeCode)
  const isMain = /主校区|校本部/.test(r.campusName)
  if (!current || (isMain && !current.isMain)) mainCampusByMoe.set(r.moeCode, { lat: Number(r.lat), lng: Number(r.lng), isMain, sourceUrl: r.sourceUrl })
}

// 軟科英文名 → 教育部簡體校名（軟科英文名與 Wikidata 對不上的大陸機構）。
const MAINLAND_ALIASES = {
  'China University of Geosciences': '中国地质大学（武汉）',
  'China University of Geosciences Beijing': '中国地质大学（北京）',
  'China University of Petroleum (East China)': '中国石油大学（华东）',
  'China University of Petroleum': '中国石油大学（北京）',
  'China University of Mining and Technology-Beijing': '中国矿业大学（北京）',
  'North University of China': '中北大学',
  'Wenzhou Medical University': '温州医科大学',
  "Chang'an University": '长安大学',
  'Kunming University of Science and Technology': '昆明理工大学',
  'Northwest A&F University': '西北农林科技大学',
  'Anhui Agricultural University': '安徽农业大学',
  'Yangzhou University': '扬州大学',
  'Shandong Agricultural University': '山东农业大学',
  'Jiangsu University of Science and Technology': '江苏科技大学',
  'Shaoxing University': '绍兴文理学院', // 2026 名單已更名绍兴大学，經舊校名表對上
  'Qilu University of Technology': '齐鲁工业大学',
  'Qingdao University': '青岛大学',
  'Nanjing University of Chinese Medicine': '南京中医药大学',
  'Shenyang Pharmaceutical University': '沈阳药科大学',
  'Huaqiao University': '华侨大学',
}

// 人工查核的座標（校園所在地，精度到校園級）。只放 Wikidata 比對不到的。
const MANUAL_OVERRIDES = {
  'National University of Defense Technology': { nameZhHant: '國防科技大學', lat: 28.2282, lng: 112.9953, note: '軍隊院校，不在教育部普通高校名單；長沙校本部' },
  'University of Western Brittany': { nameZhHant: null, lat: 48.3985, lng: -4.4862, note: 'Brest 校本部' },
  'Czech University of Life Sciences Prague': { nameZhHant: null, lat: 50.1300, lng: 14.3733, note: 'Praha-Suchdol 校園' },
  'Central School of Lille': { nameZhHant: null, lat: 50.6075, lng: 3.1369, note: 'Villeneuve-d\'Ascq 校園' },
  'Mohamed Bin Zayed University of Artificial Intelligence': { nameZhHant: null, lat: 24.4337, lng: 54.6180, note: 'Masdar City 校園' },
  'University of Veterinary Medicine Hannover': { nameZhHant: null, lat: 52.4092, lng: 9.7975, note: 'Hannover Bünteweg 校園' },
  'Macao University of Tourism': { nameZhHant: '澳門旅遊大學', lat: 22.2050, lng: 113.5505, note: '望廈校區' },
  'Indiana University, Indianapolis': { nameZhHant: null, lat: 39.7738, lng: -86.1766, note: 'Wikidata 搜尋只回圖書館實體；IUPUI 校園座標' },
}
// Wikidata 正體標籤帶消歧義括號或不合本站用法時的覆寫（只改顯示名，座標不變）。
const NAME_OVERRIDES = {
  'KU Leuven': '魯汶天主教大學',
}

// Wikidata 英文標籤與軟科寫法不同時的別名。
const WIKIDATA_ALIASES = {
  'Swiss Federal Institute of Technology Lausanne': 'École Polytechnique Fédérale de Lausanne',
  'Université Paris Cité': 'Paris Cité University',
  'Rutgers, The State University of New Jersey - New Brunswick': 'Rutgers University–New Brunswick',
  'Rutgers University, Newark': 'Rutgers University–Newark',
  'Purdue University, West Lafayette': 'Purdue University',
  'PSL University': 'Université PSL',
  'University of Illinois Urbana, Champaign': 'University of Illinois Urbana-Champaign',
  'Ohio State University, Columbus': 'Ohio State University',
  'Technion-Israel Institute of Technology': 'Technion – Israel Institute of Technology',
  'Aix Marseille University': 'Aix-Marseille University',
  'University of Oklahoma, Norman': 'University of Oklahoma',
  'NTNU - Norwegian University of Science and Technology': 'Norwegian University of Science and Technology',
  'The University of Newcastle, Australia': 'University of Newcastle',
  'University of Missouri, Columbia': 'University of Missouri',
  'AGH University of Krakow': 'AGH University of Science and Technology',
  'Shaanxi University of Science & Technology': 'Shaanxi University of Science and Technology',
  'Universite de Monastir': 'University of Monastir',
  "Sant'Anna School of Advanced Studies - Pisa": "Sant'Anna School of Advanced Studies",
  'Washington University in St Louis': 'Washington University in St. Louis',
  'University of Colorado at Denver': 'University of Colorado Denver',
  'University at Buffalo, the State University of New York': 'University at Buffalo',
  'Indiana University, Indianapolis': 'Indiana University Indianapolis',
  'Indiana University, Bloomington': 'Indiana University Bloomington',
  'University of Santiago Compostela': 'University of Santiago de Compostela',
  'University of South Carolina, Columbia': 'University of South Carolina',
  'University of Veterinary Medicine, Vienna': 'University of Veterinary Medicine Vienna',
  'Frankfurt School of Finance and Management': 'Frankfurt School of Finance & Management',
}

const REGION_COUNTRY = {
  'China': ["People's Republic of China", 'China'], 'China-Hong Kong': ["People's Republic of China", 'Hong Kong'],
  'China-Macau': ["People's Republic of China", 'Macau'], 'China-Taiwan': ['Taiwan', 'Republic of China'],
  'United States': ['United States of America', 'United States'], 'South Korea': ['South Korea'], 'Türkiye': ['Turkey', 'Türkiye'],
  'Czech Republic': ['Czech Republic', 'Czechia'], 'Netherlands': ['Kingdom of the Netherlands', 'Netherlands'],
  'Denmark': ['Denmark', 'Kingdom of Denmark'], 'Iran': ['Iran'],
}
const UNI_TYPE = /universit|institute|school|college|polytechnic|hospital|cancer|academy|hochschule|école|business/i
const normLabel = (s) => s.replace(/\s*\([^)]*\)\s*$/, '').replace(/^The\s+/i, '').trim()

async function sparqlLabels(labels) {
  const values = labels.map((n) => `${JSON.stringify(n)}@en`).join(' ')
  const query = `SELECT ?label ?item ?coord ?countryLabel ?zhHant ?zhTw ?zhHk ?zh ?zhHans ?zhCn ?typeLabel WHERE {
  VALUES ?label { ${values} }
  { ?item rdfs:label ?label } UNION { ?item skos:altLabel ?label }
  ?item wdt:P625 ?coord . ?item wdt:P31 ?type . ?item wdt:P17 ?country .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  OPTIONAL { ?item rdfs:label ?zhHant FILTER(lang(?zhHant)="zh-hant") }
  OPTIONAL { ?item rdfs:label ?zhTw FILTER(lang(?zhTw)="zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhHk FILTER(lang(?zhHk)="zh-hk") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(lang(?zh)="zh") }
  OPTIONAL { ?item rdfs:label ?zhHans FILTER(lang(?zhHans)="zh-hans") }
  OPTIONAL { ?item rdfs:label ?zhCn FILTER(lang(?zhCn)="zh-cn") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { ...UA, Accept: 'application/sparql-results+json' } })
    if (res.ok) return (await res.json()).results.bindings
    await sleep(4000 * (attempt + 1))
  }
  throw new Error('wikidata sparql failed repeatedly')
}

async function searchEntity(name) {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=6&search=${encodeURIComponent(name)}`, { headers: UA })
  if (!res.ok) return []
  return (await res.json()).search || []
}
const countryLabelCache = new Map()
async function countryLabel(id) {
  if (!id) return null
  if (countryLabelCache.has(id)) return countryLabelCache.get(id)
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, { headers: UA })
  const label = res.ok ? ((await res.json()).entities[id]?.labels?.en?.value ?? null) : null
  countryLabelCache.set(id, label)
  return label
}
async function getEntity(id) {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, { headers: UA })
  if (!res.ok) return null
  const e = (await res.json()).entities[id]
  const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value
  const label = (l) => e.labels?.[l]?.value
  const countryId = e.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id || null
  return { id, countryId, lat: coord?.latitude, lng: coord?.longitude, desc: e.descriptions?.en?.value || '', zhHant: label('zh-hant') || label('zh-tw') || label('zh-hk') || null, zhAny: ['zh-hant', 'zh-tw', 'zh-hk', 'zh', 'zh-hans', 'zh-cn'].map(label).filter(Boolean) }
}

async function main() {
  const top = parseCsv(readFileSync(join(root, `data/research/gras_${year}_top50.csv`), 'utf8'))
  const byCode = new Map()
  for (const r of top) if (!byCode.has(r.univCode)) byCode.set(r.univCode, { univCode: r.univCode, nameEn: r.univNameEn, univUp: r.univUp, region: r.region })
  const institutions = [...byCode.values()]

  // 1. 大陸機構先對教育部主表（含別名），座標取校區底稿。
  const pending = []
  const out = []
  const mainlandNeedsWikidataName = []
  for (const inst of institutions) {
    const override = MANUAL_OVERRIDES[inst.nameEn]
    if (override) {
      out.push({ ...inst, lat: override.lat, lng: override.lng, nameZhHant: override.nameZhHant || '', moeCode: '', schoolId: '', wikidata: '', coordinateSource: 'manual', nameSource: override.nameZhHant ? 'manual' : '', note: override.note })
      continue
    }
    if (inst.region === 'China') {
      const alias = MAINLAND_ALIASES[inst.nameEn]
      if (alias) {
        const school = findSchool(alias)
        if (!school) throw new Error(`alias ${alias} not in MOE table (nor in former names)`)
        const campus = mainCampusByMoe.get(school.moeCode)
        if (!campus) throw new Error(`no campus coordinates for ${school.name} (${school.moeCode})`)
        out.push({ ...inst, lat: campus.lat, lng: campus.lng, nameZhHant: school.name, moeCode: school.moeCode, schoolId: school.id, wikidata: '', coordinateSource: 'moe-campus', nameSource: 'moe', note: '' })
        continue
      }
      mainlandNeedsWikidataName.push(inst)
    }
    pending.push(inst)
  }

  // 2. Wikidata 標籤批次。
  const labelFor = (inst) => normLabel(WIKIDATA_ALIASES[inst.nameEn] || inst.nameEn)
  const labels = [...new Set(pending.map(labelFor))]
  const matches = {}
  for (let i = 0; i < labels.length; i += 40) {
    const bindings = await sparqlLabels(labels.slice(i, i + 40))
    for (const b of bindings) {
      ;(matches[b.label.value] ||= []).push({
        id: b.item.value.split('/').pop(), coord: b.coord.value, country: b.countryLabel?.value, type: b.typeLabel?.value || '',
        zhHant: b.zhHant?.value || b.zhTw?.value || b.zhHk?.value || null,
        zhAny: [b.zhHant?.value, b.zhTw?.value, b.zhHk?.value, b.zh?.value, b.zhHans?.value, b.zhCn?.value].filter(Boolean),
      })
    }
    process.stdout.write(`wikidata labels ${Math.min(i + 40, labels.length)}/${labels.length}\n`)
    await sleep(1200)
  }

  const unresolved = []
  for (const inst of pending) {
    const accepted = REGION_COUNTRY[inst.region] || [inst.region]
    const candidates = matches[labelFor(inst)] || []
    let pick = candidates.find((c) => accepted.includes(c.country) && UNI_TYPE.test(c.type))
    let matchedBy = pick ? 'wikidata-label' : ''
    let lat, lng
    if (pick) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(pick.coord)
      lng = Number(m[1]); lat = Number(m[2])
    } else {
      for (const found of await searchEntity(labelFor(inst))) {
        await sleep(250)
        const entity = await getEntity(found.id)
        if (!entity || entity.lat === undefined || !UNI_TYPE.test(`${entity.desc} ${found.description || ''}`)) continue
        const country = await countryLabel(entity.countryId)
        if (!accepted.includes(country)) continue
        pick = { id: entity.id, zhHant: entity.zhHant, zhAny: entity.zhAny, type: entity.desc }
        lat = entity.lat; lng = entity.lng; matchedBy = 'wikidata-search'
        break
      }
      await sleep(300)
    }
    if (!pick) { unresolved.push(`${inst.nameEn} [${inst.region}]`); continue }

    // 大陸機構：有 Wikidata 正體名就用它對教育部主表，校名與座標改用本站權威。
    if (inst.region === 'China') {
      const school = (pick.zhAny || [pick.zhHant]).map(findSchool).find(Boolean) || null
      if (school) {
        const campus = mainCampusByMoe.get(school.moeCode)
        out.push({ ...inst, lat: campus?.lat ?? lat, lng: campus?.lng ?? lng, nameZhHant: school.name, moeCode: school.moeCode, schoolId: school.id, wikidata: pick.id, coordinateSource: campus ? 'moe-campus' : matchedBy, nameSource: 'moe', note: '' })
        continue
      }
      unresolved.push(`${inst.nameEn} [China; wikidata ${pick.id} zh=${(pick.zhAny || []).join('/') || '∅'} not in MOE table — add to MAINLAND_ALIASES]`)
      continue
    }
    const nameZhHant = NAME_OVERRIDES[inst.nameEn] || pick.zhHant || ''
    out.push({ ...inst, lat, lng, nameZhHant, moeCode: '', schoolId: '', wikidata: pick.id, coordinateSource: matchedBy, nameSource: NAME_OVERRIDES[inst.nameEn] ? 'manual' : pick.zhHant ? 'wikidata-zh-hant' : '', matchedType: pick.type || '', note: '' })
  }

  if (unresolved.length) {
    console.error(`UNRESOLVED ${unresolved.length}:\n${unresolved.join('\n')}`)
    process.exit(1)
  }
  for (const row of out) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) throw new Error(`no coordinates for ${row.nameEn}`)
  }

  const fetchedAt = new Date().toISOString().slice(0, 10)
  const header = ['univCode', 'nameEn', 'univUp', 'region', 'nameZhHant', 'nameSource', 'moeCode', 'schoolId', 'lat', 'lng', 'coordinateSource', 'wikidata', 'matchedType', 'note', 'rankingYear', 'resolvedAt']
  out.sort((a, b) => a.univCode.localeCompare(b.univCode))
  const body = out.map((r) => header.map((k) => csvCell(k === 'rankingYear' ? year : k === 'resolvedAt' ? fetchedAt : r[k])).join(','))
  const outPath = join(root, 'data/research', `gras_institutions_geo.${fetchedAt}.csv`)
  writeFileSync(outPath, [header.join(','), ...body].join('\n') + '\n')
  const stats = out.reduce((acc, r) => { acc[r.coordinateSource] = (acc[r.coordinateSource] || 0) + 1; return acc }, {})
  console.log(`wrote ${out.length} institutions → ${outPath}`)
  console.log('coordinate sources', JSON.stringify(stats), 'zh-hant names', out.filter((r) => r.nameZhHant).length)
}

await main()
