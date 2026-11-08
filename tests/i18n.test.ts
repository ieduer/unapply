// 多語言閘門（批 E1）：三語鍵集合相等、無空值、佔位符與富文本標記一致；zh-Hans 由 zh-Hant 字級轉換且 140 條 fixtures 全過；
// zh-Hant 來源與題庫／維度／科目／省名／起點的倉庫原文逐條相等（防漂移）；程式裡用到的鍵都存在；介面檔沒有未經 t() 的 CJK 字面量；
// 45 題在三語下選項數與 key 不變；manifest 雜湊可重算。語言不進 AnswerMap／A+ 證據：這裡順帶斷言引擎模組不匯入 i18n。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { checkFixtures, t2s } from '../scripts/lib/t2s.mjs'
import { i18nManifest } from '../src/data/i18nManifest.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'
import { SUBJECT_OPTIONS } from '../src/data/programPrefs.ts'
import { originOptions } from '../src/data/origins.ts'
import { installDictionary, translatorFor, detectLocale, LOCALES, type Locale } from '../src/i18n/core.ts'
import { optionLabel, questionTitle, valueLabel } from '../src/lib/i18nLabels.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
const enSource = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
const enPublic = JSON.parse(read('public/i18n/en.json')) as Record<string, string>
const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
const overrides = JSON.parse(read('src/i18n/zh-hans.overrides.json')) as Record<string, string>
const keys = Object.keys(zhHant)
const CJK = /[㐀-䶿一-鿿]/
const signature = (s: string) => {
  const ph = [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
  const tags = [...s.matchAll(/<(a\d|b|n|x|code|br)\/?>/g)].map((m) => m[1]).sort()
  return `${ph.join(',')}|${tags.join(',')}`
}
installDictionary('en', enPublic)
installDictionary('zh-Hans', zhHans)

test('三語鍵集合相等、已排序、無空值；佔位符與富文本標記一致；標記成對且只用允許的標記', () => {
  assert.ok(keys.length >= 1100, `keys ${keys.length}`)
  assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'en')), 'zh-Hant.json 鍵已排序')
  assert.deepEqual(Object.keys(enSource), keys, 'en.json 鍵集合')
  assert.deepEqual(Object.keys(enPublic), keys, 'public/i18n/en.json 鍵集合')
  assert.deepEqual(Object.keys(zhHans), keys, 'public/i18n/zh-Hans.json 鍵集合')
  for (const k of keys) {
    for (const [name, dict] of [['zh-Hant', zhHant], ['en', enSource], ['zh-Hans', zhHans]] as const) {
      assert.equal(typeof dict[k], 'string', `${name} ${k}`)
      assert.ok(dict[k].trim().length > 0, `${name} ${k} 空值`)
      const opens = [...dict[k].matchAll(/<(a\d|b|n|x|code)>/g)].map((m) => m[1])
      const closes = [...dict[k].matchAll(/<\/(a\d|b|n|x|code)>/g)].map((m) => m[1])
      assert.deepEqual(opens, closes, `${name} ${k} 標記不成對`)
      assert.equal(/<(?!\/?(a\d|b|n|x|code)>|br\/>)[a-z]/i.test(dict[k]), false, `${name} ${k} 用了未允許的標記`)
    }
    assert.equal(enSource[k], enPublic[k], `en 來源與懶載檔不一致 ${k}`)
    if (k !== 'ui.world.institutionLabel') assert.equal(signature(zhHant[k]), signature(enSource[k]), `佔位符 ${k}`)
    assert.equal(signature(zhHant[k]), signature(zhHans[k]), `zh-Hans 佔位符 ${k}`)
  }
})

test('zh-Hans＝zh-Hant 逐鍵字級轉換（覆寫表除外），140 條 fixtures 全過；只轉字形不換用詞', () => {
  for (const k of keys) assert.equal(zhHans[k], k in overrides ? overrides[k] : t2s(zhHant[k]), k)
  assert.deepEqual(overrides, { 'meta.htmlLang': 'zh-Hans' })
  const fixtures = JSON.parse(read('tests/fixtures/zh-hans.fixtures.json')) as { count: number; fixtures: unknown[] }
  assert.equal(fixtures.fixtures.length, 140)
  assert.equal(fixtures.count, 140)
  assert.deepEqual(checkFixtures(join(root, 'tests/fixtures/zh-hans.fixtures.json')), [])
  // 用詞不換：臺灣慣用詞在簡體檔仍是同一詞（只換字形）
  assert.equal(t2s('資料'), '资料')
  assert.equal(t2s('程式'), '程式')
  assert.equal(t2s('軟體'), '软体')
  assert.equal(t2s('帶著'), '带着')
  assert.equal(t2s('覆核'), '复核')
  assert.equal(t2s('覆蓋'), '覆盖')
})

test('en 無 CJK（白名單：查學校與查詢頁的佔位例——示範可輸入中文、Gaokao 字樣）；meta.htmlLang 三語各自正確', () => {
  const allow = new Set(['ui.result.lookup.placeholder', 'ui.overseas.gaokao.emptyNote', 'ui.search.school.placeholder', 'ui.search.major.placeholder'])
  for (const k of keys) if (!allow.has(k)) assert.equal(CJK.test(enSource[k]), false, `en ${k} 含 CJK：${enSource[k]}`)
  assert.equal(zhHant['meta.htmlLang'], 'zh-Hant')
  assert.equal(zhHans['meta.htmlLang'], 'zh-Hans')
  assert.equal(enSource['meta.htmlLang'], 'en')
})

test('zh-Hant 來源與倉庫原文逐條相等：45 題標題／副標／選項、維度標籤、科目、省名、起點', () => {
  for (const q of allQuestions) {
    assert.equal(zhHant[`q.${q.id}.title`], q.title, `q.${q.id}.title`)
    if (q.subtitle) assert.equal(zhHant[`q.${q.id}.subtitle`], q.subtitle, `q.${q.id}.subtitle`)
    else assert.equal(`q.${q.id}.subtitle` in zhHant, false)
    if (q.id === 'S1' || q.id === 'S2') continue
    for (const opt of q.options) {
      assert.equal(zhHant[`q.${q.id}.opt.${opt.key}.label`], opt.label, `q.${q.id}.opt.${opt.key}.label`)
      if (opt.hint) assert.equal(zhHant[`q.${q.id}.opt.${opt.key}.hint`], opt.hint, `q.${q.id}.opt.${opt.key}.hint`)
    }
  }
  for (const [id, meta] of Object.entries(DIMENSIONS)) {
    assert.equal(zhHant[`dim.${id}.label`], meta.label, `dim.${id}.label`)
    if (id === 'S1' || id === 'S2' || id === 'C5') continue
    for (const value of meta.values) {
      if (id === 'A1') { assert.equal(zhHant[`geo.province.${value}`], value); continue }
      const key = `val.${id}.${value}`
      assert.ok(key in zhHant, key)
      if (CJK.test(value)) assert.equal(zhHant[key], value, key)
    }
  }
  for (const subject of SUBJECT_OPTIONS) assert.equal(zhHant[`subject.${subject.code}`], subject.label)
  for (const option of originOptions) {
    assert.equal(zhHant[`origin.${option.id}.label`], option.label, option.id)
  }
  for (const code of ['CS', 'EE', 'Math', 'Med', 'Econ', 'Law', 'Chn', 'Hist']) assert.ok(`val.C5.subject.${code}` in zhHant)
  assert.equal(zhHant['val.C5.template'], '{subject} {grade}')
  assert.ok('val.S2.*' in zhHant)
})

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}
const srcFiles = walk(join(root, 'src'))

test('程式裡的靜態翻譯鍵都存在於 zh-Hant；動態鍵族逐值存在', () => {
  const used = new Set<string>()
  for (const file of srcFiles) {
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/\b(?:t|tOr|tpl|translate)\(\s*'([a-zA-Z][\w.-]*(?:\.[\w*-]+)*)'/g)) used.add(m[1])
    for (const m of source.matchAll(/\bk="([a-zA-Z][\w.*-]*)"/g)) used.add(m[1])
    for (const m of source.matchAll(/prefixKey="([\w.]+)"/g)) used.add(m[1])
    for (const m of source.matchAll(/messageKey: '([\w.]+)'/g)) used.add(m[1])
    for (const m of source.matchAll(/labelKey: '([\w.]+)'/g)) used.add(m[1])
    for (const m of source.matchAll(/noteKey: '([\w.]+)'/g)) used.add(m[1])
  }
  const missing = [...used].filter((k) => !(k in zhHant))
  assert.deepEqual(missing, [], `缺鍵：${missing.join(', ')}`)
  assert.ok(used.size > 300, `static keys ${used.size}`)
  const families: string[] = [
    ...['A', 'E', 'B', 'C', 'S'].map((s) => `section.${s}`),
    ...['綜合', '理工', '師範', '農林', '醫藥', '財經', '政法', '語言', '民族', '藝術', '體育', '軍事'].map((v) => `tag.type.${v}`),
    ...['C9', '985非C9', '211非985', '雙一流非211', '普通本科', '專科'].flatMap((v) => [`tag.level.${v}`, `ui.detail.level.${v}`, `dist.level.${v}`]),
    'dist.level.unknown', 'dist.cityTier.unknown',
    ...['tier1', 'newtier1', 'tier2', 'tier3_below'].flatMap((v) => [`tag.cityTier.${v}`, `ui.detail.tier.${v}`, `dist.cityTier.${v}`]),
    ...['main_city', 'suburb_with_metro', 'suburb', 'separate_freshman'].flatMap((v) => [`tag.campus.${v}`, `ui.detail.campus.${v}`]),
    ...['公辦', '1-3萬', '3-8萬', '8萬+', '民辦待核價', '中外合作待核價'].map((v) => `tag.tuition.${v}`),
    ...['regular_gaokao', 'comprehensive_eval', 'comprehensive_dominant', 'art_exam', 'sports_test', 'military_police', 'navigation_flight'].map((v) => `tag.track.${v}`),
    ...['985', '211', 'doubleFirst', 'tier1', 'newtier1', 'none', 'joiner'].map((v) => `reason.kept.${v}`),
    ...['yes', 'no', 'unknown'].map((v) => `ui.detail.freshman.${v}`),
    ...['yes', 'no'].flatMap((v) => [`ui.detail.env.heating.${v}`, `ui.detail.env.subway.${v}`, `ui.detail.env.coastal.${v}`, `ui.detail.env.highland.${v}`]),
    ...['mild', 'hot', 'humid_hot', 'extreme_hot'].map((v) => `ui.detail.env.summer.${v}`),
    ...['warm', 'mild', 'cold', 'extreme_cold'].map((v) => `ui.detail.env.winter.${v}`),
    ...['low', 'medium', 'high', 'extreme'].map((v) => `ui.detail.env.haze.${v}`),
    ...['high', 'medium', 'low'].flatMap((v) => [`ui.detail.confidence.${v}`, `ui.world.confidence.${v}`, `ui.contribute.confidence.${v}`]),
    ...['verified', 'needs_review', 'blocked', 'not_found', 'unsafe'].map((v) => `ui.overseas.statusCode.${v}`),
    ...['accepted', 'not_accepted', 'conflicting', 'separate_channel', 'mentioned', 'not_stated'].map((v) => `ui.overseas.gaokao.${v}`),
    ...['high', 'medium'].map((v) => `ui.overseas.confidence.${v}`),
    ...['campus_location', 'tuition_fee', 'dormitory', 'management_rules', 'academic_major', 'employment', 'mobility_transfer', 'accessibility', 'food_safety', 'student_life', 'other'].map((v) => `ui.contribute.category.${v}`),
    ...['official', 'school', 'student', 'news', 'map', 'github', 'other'].map((v) => `ui.contribute.sourceType.${v}`),
    ...['verified', 'syncing', 'rejected', 'pending', 'idle'].map((v) => `ui.aplus.${v}`),
    ...originOptions.map((o) => `origin.${o.id}.label`),
    ...['P0', 'P1', 'P2'].map((v) => `ui.tier.${v}`),
    ...['fellowship_to_hire', 'fellowship_grant', 'employer_degree', 'degree_apprenticeship', 'talent_program_with_degree', 'research_trainee', 'youth_internship_camp', 'apprenticeship', 'apprenticeship_mixed', 'direct_hire_school_leaver', 'sponsored_training_to_hire'].map((v) => `ui.world.program.kind.${v}`),
    ...['united-states', 'united-kingdom', 'canada', 'germany', 'china', 'switzerland', 'japan', 'hong-kong', 'south-korea'].map((v) => `ui.world.program.country.${v}`),
    ...['yes', 'no', 'partial'].map((v) => `ui.world.program.degree.${v}`),
    'ui.world.program.degreeBadge', 'ui.world.program.degreeBadge.partial', 'ui.tier.aria',
  ]
  const missingFamilies = families.filter((k) => !(k in zhHant))
  assert.deepEqual(missingFamilies, [], `動態鍵缺：${missingFamilies.join(', ')}`)
})

test('介面檔沒有未經 t() 的 CJK 字面量（資料檔、引擎、shared-ui、契約行除外）', () => {
  const whitelist = [/\/src\/data\//, /\/src\/shared-ui\//, /\/src\/engine\//, /\/src\/lib\/schoolProfile\.ts$/, /\/src\/lib\/schoolName\.ts$/, /\/src\/lib\/learningEvidence\.ts$/, /\/src\/i18n\/locales\//]
  const offenders: string[] = []
  for (const file of srcFiles) {
    if (whitelist.some((re) => re.test(file))) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    let inBlock = false
    lines.forEach((raw, index) => {
      let line = raw
      if (/\/\/ i18n-(contract|literal)\s*$/.test(line)) return
      // 去掉區塊註解與行註解（http:// 之類不算註解）
      if (inBlock) { const end = line.indexOf('*/'); if (end === -1) return; line = line.slice(end + 2); inBlock = false }
      line = line.replace(/\/\*.*?\*\//g, '')
      const open = line.indexOf('/*')
      if (open !== -1) { line = line.slice(0, open); inBlock = true }
      line = line.replace(/(^|[^:'"`\w])\/\/.*$/, '$1')
      if (CJK.test(line)) offenders.push(`${file.replace(root, '')}:${index + 1}: ${line.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(offenders, [], `未翻譯字面量：\n${offenders.join('\n')}`)
})

test('45 題在三語下選項數與 key 不變，標題與選項文字非空且非鍵名；A1 省名在 en 為拼音', () => {
  assert.equal(allQuestions.length, 45)
  const expectedOptions = Object.fromEntries(allQuestions.map((q) => [q.id, q.options.map((o) => o.key)]))
  assert.equal(expectedOptions.S1.length, 20)
  assert.equal(expectedOptions.S2.length, 92)
  for (const locale of LOCALES) {
    const { t } = translatorFor(locale)
    for (const q of allQuestions) {
      assert.deepEqual(q.options.map((o) => o.key), expectedOptions[q.id], `${locale} ${q.id} option keys`)
      const title = t(`q.${q.id}.title`)
      assert.ok(title && !title.startsWith('q.'), `${locale} ${q.id} title`)
      for (const o of q.options) {
        const key = q.id === 'S1' || q.id === 'S2' ? null : `q.${q.id}.opt.${o.key}.label`
        if (key) { const label = t(key); assert.ok(label && !label.startsWith('q.'), `${locale} ${key}`) }
      }
    }
    assert.equal(t('geo.province.陝西'), locale === 'en' ? 'Shaanxi' : locale === 'zh-Hans' ? '陕西' : '陝西')
    assert.equal(t('val.A3.雙一流非211').length > 0, true)
  }
  // 展示層小工具在來源語言下與倉庫原文一致
  assert.equal(questionTitle('A1'), allQuestions[0].title)
  assert.equal(optionLabel('A1', 'jingjin'), '北京／天津')
  assert.equal(optionLabel('S1', 'PCB'), '物理＋化學＋生物')
  assert.equal(valueLabel('A2', 'tier1'), '一線城市')
  assert.equal(valueLabel('C5', 'CS:A+'), '計算機 A+')
  assert.equal(valueLabel('B1', '上床下桌'), '上床下桌')
})

test('manifest：鍵數、雜湊可重算、懶載兩語；主包只帶 zh-Hant', () => {
  assert.equal(i18nManifest.counts.keys, keys.length)
  assert.deepEqual([...i18nManifest.lazyLocales], ['zh-Hans', 'en'])
  assert.equal(i18nManifest.sourceLocale, 'zh-Hant')
  const zhHantJson = JSON.stringify(Object.fromEntries(keys.map((k) => [k, zhHant[k]])))
  const zhHansJson = read('public/i18n/zh-Hans.json').trimEnd()
  const enJson = read('public/i18n/en.json').trimEnd()
  const version = createHash('sha256').update(zhHantJson).update('\n').update(zhHansJson).update('\n').update(enJson).digest('hex').slice(0, 12)
  assert.equal(i18nManifest.version, version)
  assert.equal(i18nManifest.basePath, '/i18n')
  assert.ok(i18nManifest.counts.gzipBytes.en < 40 * 1024)
})

test('語言推測：zh-TW／zh-HK／zh-MO／zh-Hant→zh-Hant；zh-CN／zh-SG／zh-Hans→zh-Hans；en→en；其餘 zh-Hant', () => {
  const cases: [string[], Locale][] = [[['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-MO'], 'zh-Hant'], [['zh-Hant-TW'], 'zh-Hant'], [['zh-CN'], 'zh-Hans'], [['zh-SG'], 'zh-Hans'], [['zh-Hans-CN'], 'zh-Hans'], [['en-US', 'zh-CN'], 'en'], [['en'], 'en'], [['ja-JP'], 'zh-Hant'], [['zh'], 'zh-Hant'], [[], 'zh-Hant'], [['fr', 'en-GB'], 'en']]
  for (const [languages, expected] of cases) assert.equal(detectLocale(languages), expected, languages.join(','))
})

test('語言不進引擎：engine／data／schoolProfile／admissionAuthorities／Function 不匯入 i18n', () => {
  const guarded = [...walk(join(root, 'src/engine')), ...walk(join(root, 'src/data')), join(root, 'src/lib/schoolProfile.ts'), join(root, 'functions/api/learning/[action].ts')]
  for (const file of guarded) assert.equal(/from '[./]*\/i18n\//.test(readFileSync(file, 'utf8')), false, file)
})
