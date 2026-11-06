#!/usr/bin/env node
// 把研究層 CSV 與陸地輪廓組成前端懶載入的世界學科地圖 payload。
//
//   node scripts/build_world_atlas.mjs            # 讀 data/research，寫 public/data/atlas/world-atlas.json 與 src/data/worldAtlasManifest.ts
//
// 輸入（都在倉庫內，建置不需要網路）：
//   data/research/gras_<year>_subjects.csv              scripts/fetch_gras_rankings.mjs
//   data/research/gras_<year>_top50.csv                 scripts/fetch_gras_rankings.mjs
//   data/research/gras_institutions_geo.<date>.csv      scripts/geocode_gras_institutions.mjs（取最新日期）
//   data/research/gras_institution_names_zh_hant.<date>.csv  人工：Wikidata zh-hant 標籤含簡體字形時的字形覆寫（只轉字形不換用詞）
//   data/research/gras_institution_websites.<date>.csv  scripts/verify_institution_websites.mjs（取最新日期；只合併 verified）
//   data/research/direct_hire_programs.<date>.csv       人工維護（取最新日期）
//   data/research/ne_110m_land.geojson                  Natural Earth 1:110m Land，公有領域
//                                                       https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
//
// 投影：Equal Earth（Šavrič, Patterson, Jenny 2018），在建置期就把陸地算成 SVG 路徑、把機構算成 x/y，
// 前端不帶任何地理函式庫。只畫陸地，不畫國界。南緯 60 度以南（南極）不畫。
//
// 任一機構缺座標、任一地區缺中文名、任一學科列數不足 → 直接失敗，不讓地圖悄悄少資料。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const researchDir = join(root, 'data', 'research')
const YEAR = 2026
const TOP_N_MAX = 50
const WIDTH = 1000

const REGION_ZH = {
  Argentina: '阿根廷', Australia: '澳大利亞', Austria: '奧地利', Azerbaijan: '阿塞拜疆', Belgium: '比利時', Brazil: '巴西',
  Canada: '加拿大', Chile: '智利', China: '中國大陸', 'China-Hong Kong': '中國香港', 'China-Macau': '中國澳門', 'China-Taiwan': '中國臺灣',
  Croatia: '克羅地亞', 'Czech Republic': '捷克', Denmark: '丹麥', Egypt: '埃及', Ethiopia: '埃塞俄比亞', Finland: '芬蘭', France: '法國',
  Germany: '德國', Greece: '希臘', Hungary: '匈牙利', India: '印度', Iran: '伊朗', Ireland: '愛爾蘭', Israel: '以色列', Italy: '意大利',
  Japan: '日本', Malaysia: '馬來西亞', Mexico: '墨西哥', Netherlands: '荷蘭', 'New Zealand': '新西蘭', Norway: '挪威', Pakistan: '巴基斯坦',
  Poland: '波蘭', Portugal: '葡萄牙', 'Saudi Arabia': '沙特阿拉伯', Singapore: '新加坡', 'South Africa': '南非', 'South Korea': '韓國',
  Spain: '西班牙', Sweden: '瑞典', Switzerland: '瑞士', Thailand: '泰國', Tunisia: '突尼斯', 'Türkiye': '土耳其',
  'United Arab Emirates': '阿聯酋', 'United Kingdom': '英國', 'United States': '美國',
  Russia: '俄羅斯', Nigeria: '尼日利亞', Kenya: '肯尼亞', Vietnam: '越南', Indonesia: '印度尼西亞', Philippines: '菲律賓', Colombia: '哥倫比亞',
  Peru: '秘魯', Qatar: '卡塔爾', Lebanon: '黎巴嫩', Jordan: '約旦', Romania: '羅馬尼亞', Slovenia: '斯洛文尼亞', Serbia: '塞爾維亞',
  Estonia: '愛沙尼亞', Lithuania: '立陶宛', Iceland: '冰島', Luxembourg: '盧森堡', Cyprus: '塞浦路斯', Morocco: '摩洛哥', Ghana: '加納',
  Uganda: '烏干達', Bangladesh: '孟加拉國', 'Sri Lanka': '斯里蘭卡', Kazakhstan: '哈薩克斯坦', Uruguay: '烏拉圭', Slovakia: '斯洛伐克',
}
const CONTINENT = {
  asia: { zh: '亞洲', regions: ['China', 'China-Hong Kong', 'China-Macau', 'China-Taiwan', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'India', 'Pakistan', 'Thailand', 'Iran', 'Israel', 'Saudi Arabia', 'United Arab Emirates', 'Azerbaijan', 'Türkiye', 'Vietnam', 'Indonesia', 'Philippines', 'Qatar', 'Lebanon', 'Jordan', 'Bangladesh', 'Sri Lanka', 'Kazakhstan', 'Russia'] },
  europe: { zh: '歐洲', regions: ['United Kingdom', 'Germany', 'France', 'Italy', 'Netherlands', 'Spain', 'Sweden', 'Austria', 'Denmark', 'Switzerland', 'Norway', 'Finland', 'Belgium', 'Ireland', 'Portugal', 'Czech Republic', 'Croatia', 'Poland', 'Hungary', 'Greece', 'Romania', 'Slovenia', 'Serbia', 'Estonia', 'Lithuania', 'Iceland', 'Luxembourg', 'Cyprus', 'Slovakia'] },
  north_america: { zh: '北美洲', regions: ['United States', 'Canada', 'Mexico'] },
  south_america: { zh: '南美洲', regions: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Uruguay'] },
  oceania: { zh: '大洋洲', regions: ['Australia', 'New Zealand'] },
  africa: { zh: '非洲', regions: ['South Africa', 'Egypt', 'Tunisia', 'Ethiopia', 'Nigeria', 'Kenya', 'Morocco', 'Ghana', 'Uganda'] },
}
const KIND_ZH = {
  fellowship_to_hire: '直聘型 fellowship', fellowship_grant: '資助型 fellowship', employer_degree: '雇主資助學位',
  degree_apprenticeship: '學位學徒制', talent_program_with_degree: '企業特才培養（含學位）', research_trainee: '全職預備研究員',
  youth_internship_camp: '中學生實訓營',
}

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
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
function latestFile(prefix) {
  const files = readdirSync(researchDir).filter((f) => f.startsWith(prefix) && f.endsWith('.csv')).sort()
  if (!files.length) throw new Error(`missing ${prefix}*.csv in data/research`)
  return join(researchDir, files[files.length - 1])
}

// Equal Earth
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2
function equalEarth(lng, lat) {
  const l = (lng * Math.PI) / 180
  const p = (lat * Math.PI) / 180
  const t = Math.asin(M * Math.sin(p))
  const t2 = t * t
  const t6 = t2 * t2 * t2
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
  return [x, y]
}
const X_MIN = equalEarth(-180, 0)[0]
const X_MAX = equalEarth(180, 0)[0]
const Y_TOP = equalEarth(0, 84)[1]
const Y_BOTTOM = equalEarth(0, -58)[1]
const SCALE = WIDTH / (X_MAX - X_MIN)
const HEIGHT = Math.round((Y_TOP - Y_BOTTOM) * SCALE)
function project(lng, lat) {
  const [x, y] = equalEarth(lng, lat)
  return [Number(((x - X_MIN) * SCALE).toFixed(1)), Number(((Y_TOP - y) * SCALE).toFixed(1))]
}

function landPaths(geojson) {
  const paths = []
  for (const feature of geojson.features) {
    const [, , , maxLat] = feature.bbox
    if (maxLat < -60) continue // 南極洲
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) {
      let d = ''
      for (const ring of polygon) {
        let last = null
        ring.forEach(([lng, lat], index) => {
          const [x, y] = project(lng, Math.max(-58, Math.min(84, lat)))
          const key = `${x},${y}`
          if (key === last) return
          last = key
          d += index === 0 ? `M${x} ${y}` : `L${x} ${y}`
        })
        d += 'Z'
      }
      if (d.length > 12) paths.push(d)
    }
  }
  return paths
}

function main() {
  const subjects = parseCsv(readFileSync(join(researchDir, `gras_${YEAR}_subjects.csv`), 'utf8'))
  const top = parseCsv(readFileSync(join(researchDir, `gras_${YEAR}_top50.csv`), 'utf8'))
  const geoPath = latestFile('gras_institutions_geo.')
  const geo = parseCsv(readFileSync(geoPath, 'utf8'))
  const programsPath = latestFile('direct_hire_programs.')
  const programRows = parseCsv(readFileSync(programsPath, 'utf8'))
  const namesPath = latestFile('gras_institution_names_zh_hant.')
  const nameOverrides = new Map(parseCsv(readFileSync(namesPath, 'utf8')).map((n) => [n.univCode, n.nameZhHant]))
  const websitesPath = latestFile('gras_institution_websites.')
  const websiteRows = parseCsv(readFileSync(websitesPath, 'utf8'))
  const websiteByCode = new Map()
  for (const w of websiteRows) {
    if (w.status !== 'verified') continue
    if (!/^https?:\/\//.test(w.website) || !['high', 'medium'].includes(w.confidence) || !/^\d{4}-\d{2}-\d{2}$/.test(w.verifiedAt)) {
      throw new Error(`website row ${w.univCode}: verified row must have https url, high/medium confidence and verifiedAt`)
    }
    websiteByCode.set(w.univCode, { url: w.website, sources: w.sources, confidence: w.confidence, verifiedAt: w.verifiedAt })
  }
  if (websiteByCode.size < 300) throw new Error(`only ${websiteByCode.size} verified websites; rerun scripts/verify_institution_websites.mjs`)
  const geojson = JSON.parse(readFileSync(join(researchDir, 'ne_110m_land.geojson'), 'utf8'))

  if (subjects.length !== 57) throw new Error(`expected 57 subjects, got ${subjects.length}`)
  const familyMap = new Map()
  for (const s of subjects) familyMap.set(s.familyCode, { code: s.familyCode, nameEn: s.familyNameEn, nameZh: s.familyNameZhHant })
  const families = [...familyMap.values()]

  const rowsBySubject = new Map()
  for (const r of top) {
    if (!rowsBySubject.has(r.subjectCode)) rowsBySubject.set(r.subjectCode, [])
    rowsBySubject.get(r.subjectCode).push(r)
  }
  for (const s of subjects) {
    const rows = rowsBySubject.get(s.subjectCode) || []
    if (rows.length !== TOP_N_MAX) throw new Error(`${s.subjectCode} has ${rows.length} rows, expected ${TOP_N_MAX}`)
  }

  const geoByCode = new Map(geo.map((g) => [g.univCode, g]))
  const ranksByCode = new Map()
  for (const r of top) {
    if (!geoByCode.has(r.univCode)) throw new Error(`no geo row for ${r.univCode} ${r.univNameEn}; rerun scripts/geocode_gras_institutions.mjs`)
    if (!ranksByCode.has(r.univCode)) ranksByCode.set(r.univCode, {})
    ranksByCode.get(r.univCode)[r.subjectCode] = Number(r.rank)
  }

  const regionSet = new Set(geo.map((g) => g.region))
  const continentOf = {}
  for (const [key, c] of Object.entries(CONTINENT)) for (const region of c.regions) continentOf[region] = key
  const regions = [...regionSet].sort().map((code) => {
    if (!REGION_ZH[code]) throw new Error(`region ${code} has no Chinese name; add it to REGION_ZH`)
    if (!continentOf[code]) throw new Error(`region ${code} has no continent; add it to CONTINENT`)
    return { code, nameZh: REGION_ZH[code], continent: continentOf[code], continentZh: CONTINENT[continentOf[code]].zh }
  })

  const institutions = geo
    .filter((g) => ranksByCode.has(g.univCode))
    .map((g) => {
      const lat = Number(g.lat), lng = Number(g.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`bad coordinates for ${g.nameEn}`)
      const [x, y] = project(lng, lat)
      const website = websiteByCode.get(g.univCode) || null
      return {
        id: g.univCode, nameEn: g.nameEn, nameZh: nameOverrides.get(g.univCode) || g.nameZhHant || null, region: g.region, lat, lng, x, y,
        schoolId: g.schoolId || null, moeCode: g.moeCode || null, univUp: g.univUp || null, ranks: ranksByCode.get(g.univCode),
        website,
      }
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn))

  const programs = programRows.map((p) => {
    const lat = Number(p.lat), lng = Number(p.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`program ${p.id}: bad coordinates`)
    if (!/^https:\/\//.test(p.sourceUrl)) throw new Error(`program ${p.id}: sourceUrl must be https`)
    if (p.officialUrl && !/^https:\/\//.test(p.officialUrl)) throw new Error(`program ${p.id}: officialUrl must be https`)
    if (!KIND_ZH[p.kind]) throw new Error(`program ${p.id}: unknown kind ${p.kind}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt)) throw new Error(`program ${p.id}: verifiedAt must be YYYY-MM-DD`)
    if (!['high', 'medium', 'low'].includes(p.confidence)) throw new Error(`program ${p.id}: confidence`)
    const [x, y] = project(lng, lat)
    return { ...p, kindZh: KIND_ZH[p.kind], lat, lng, x, y, sinceYear: p.sinceYear ? Number(p.sinceYear) : null }
  })

  const land = landPaths(geojson)
  const payload = {
    version: '',
    generatedAt: new Date().toISOString().slice(0, 10),
    ranking: {
      name: "ShanghaiRanking's Global Ranking of Academic Subjects", nameZh: '軟科世界一流學科排名', year: YEAR, topNMax: TOP_N_MAX,
      url: `https://www.shanghairanking.com/rankings/gras/${YEAR}`, fetchedAt: top[0].fetchedAt,
    },
    sources: {
      geo: { name: 'Wikidata (CC0) + 本站校區底稿', file: geoPath.split('/').pop() },
      land: { name: 'Natural Earth 1:110m Land (public domain)', file: 'ne_110m_land.geojson' },
      programs: { file: programsPath.split('/').pop() },
      websites: { name: '軟科機構頁＋Wikidata P856＋教育部主表，逐條 HTTP 核查', file: websitesPath.split('/').pop() },
    },
    projection: { name: 'equal-earth', width: WIDTH, height: HEIGHT },
    land,
    families,
    subjects: subjects.map((s) => ({ code: s.subjectCode, family: s.familyCode, nameEn: s.subjectNameEn, nameZh: s.subjectNameZhHant, nameZhHans: s.subjectNameZhHans, sourceUrl: s.sourceUrl })),
    regions,
    institutions,
    programs,
  }
  payload.version = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)

  const outDir = join(root, 'public', 'data', 'atlas')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'world-atlas.json'), JSON.stringify(payload))
  const manifest = {
    version: payload.version,
    path: '/data/atlas/world-atlas.json',
    rankingYear: YEAR,
    topNMax: TOP_N_MAX,
    counts: { subjects: payload.subjects.length, families: families.length, regions: regions.length, institutions: institutions.length, programs: programs.length, landPaths: land.length, websites: institutions.filter((i) => i.website).length },
  }
  writeFileSync(join(root, 'src', 'data', 'worldAtlasManifest.ts'),
    `// Generated by scripts/build_world_atlas.mjs. Do not edit by hand.\nexport const worldAtlasManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
  const bytes = Buffer.byteLength(JSON.stringify(payload))
  console.log(`wrote public/data/atlas/world-atlas.json (${(bytes / 1024).toFixed(0)} KiB) version ${payload.version}`)
  console.log(JSON.stringify(manifest.counts))
}

main()
