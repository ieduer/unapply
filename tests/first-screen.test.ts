// 批 H2（2026-11-12）：首屏瘦身的閘門。批 H1 修好「目錄載入失敗」之後，站長要求繼續把首屏做小。鎖住三件事：
//   1. 首頁以外的頁面都是懶載 chunk，主包不靜態匯入它們；懶載失敗有錯誤邊界接住。
//   2. index.html 的行內腳本提早下載語言字典，它判斷語言的規則與 src/i18n/core.ts 完全相同。
//   3. 本站常用字的字型小子集（public/fonts/huwen-nope.*）：檔案與清單一致、各層互不重疊、不含共用分片第 00 片的基本字元、
//      首頁與作答流程的用字覆蓋率與體積上限。覆蓋率不是 100% 也能運作（沒有的字落到共用分片），但掉太多就失去意義，要重跑產生器。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { i18nManifest } from '../src/data/i18nManifest.ts'
import { siteFont } from '../src/data/siteFont.ts'
import { SITE_FONT_CSS, SITE_FONT_FAMILY } from '../src/data/siteFontCss.ts'
import { LOCALE_STORAGE_KEY, detectLocale, isLocale } from '../src/i18n/core.ts'
import { retryingImport } from '../src/lib/lazyImport.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => fs.readFileSync(new URL(path, root))
const readText = (path: string) => read(path).toString('utf8')

test('主包不靜態匯入首頁以外的頁面；每個懶載頁面都經過 retryingImport；有錯誤邊界', () => {
  const app = readText('src/App.tsx')
  for (const page of ['QuestionRunner', 'ResultPage', 'SchoolDetail', 'ContributePage', 'AboutPage', 'WorldAtlasPage', 'HkMoTwPage', 'OverseasPage', 'GlobalSubtraction', 'SearchPage']) {
    assert.equal(new RegExp(`^import\\s[^\\n]*from '\\./components/${page}'`, 'm').test(app), false, `${page} 不可靜態匯入（會回到主包）`)
    assert.match(app, new RegExp(`retryingImport\\(\\(\\) => import\\('\\./components/${page}'\\)`), `${page} 要經過 retryingImport`)
  }
  assert.match(app, /^import \{ Landing \} from '\.\/components\/Landing'$/m, '首頁留在主包')
  assert.match(app, /<PageErrorBoundary resetKey=\{routeKey\}/)
  // 問卷／結果／詳情頁的 chunk 與資料同時開始下載，不等資料載完
  assert.match(app, /importRoutePage\(route\.name\)/)
})

test('retryingImport：失敗會重試，成功就回傳；重試用完才拋錯', async () => {
  let calls = 0
  const flaky = retryingImport(async () => { calls += 1; if (calls < 3) throw new Error('network'); return { ok: true } }, 2)
  assert.deepEqual(await flaky(), { ok: true })
  assert.equal(calls, 3)
  calls = 0
  const dead = retryingImport(async () => { calls += 1; throw new Error('network') }, 1)
  await assert.rejects(dead(), /network/)
  assert.equal(calls, 2)
})

function earlyLocaleScript(): string {
  const html = readText('index.html')
  const match = /<script data-early-locale>([\s\S]*?)<\/script>/.exec(html)
  assert.ok(match, 'index.html 要有 data-early-locale 行內腳本')
  return match[1]
}

/** 在沙箱裡跑行內腳本，回傳它發出的請求網址與留在 window 上的語言（沒發請求為 null）。 */
function runEarlyLocale(stored: string | null, languages: readonly string[] | undefined, language = ''): { url: string | null; locale: string | null } {
  const requests: string[] = []
  const windowLike: Record<string, unknown> = {
    localStorage: { getItem: (key: string) => (key === LOCALE_STORAGE_KEY ? stored : null) },
    fetch: (url: string) => { requests.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) },
  }
  const context = vm.createContext({ window: windowLike, navigator: { languages, language } })
  vm.runInContext(earlyLocaleScript(), context)
  const early = windowLike.__nopeEarlyLocale as { locale: string; url: string } | undefined
  assert.equal(requests.length, early ? 1 : 0)
  if (early) assert.equal(requests[0], early.url)
  return { url: requests[0] ?? null, locale: early?.locale ?? null }
}

test('行內腳本提早下載字典：語言判斷與 core.ts 逐例相同；正體不發請求；網址帶版本佔位符', () => {
  const script = earlyLocaleScript()
  assert.match(script, /'\/i18n\/' \+ locale \+ '\.json\?v=%NOPE_I18N_VERSION%'/)
  assert.match(script, new RegExp(`'${LOCALE_STORAGE_KEY.replace(/\./g, '\\.')}'`))
  const languageLists: (readonly string[])[] = [
    ['zh-CN', 'zh'], ['zh-TW'], ['zh-HK', 'en'], ['zh-MO'], ['zh-SG'], ['zh'], ['zh-Hans-CN'], ['zh-Hant-HK'], ['zh-hans'], ['en-US', 'zh-CN'], ['en'], ['en-GB'],
    ['fr-FR', 'en-US'], ['ja-JP'], ['ja', 'zh-CN'], ['', 'zh-CN'], ['de'], [], ['ko-KR', 'zh-TW'], ['ZH-cn'], ['EN-us'], ['zh-Latn'], ['zh-CN-x-private'],
  ]
  const storedValues: (string | null)[] = [null, 'zh-Hant', 'zh-Hans', 'en', 'fr', '', 'zh-hans']
  let compared = 0
  for (const stored of storedValues) {
    for (const languages of languageLists) {
      // core.ts：已存的合法值優先，否則依瀏覽器語言清單推測
      const expected = isLocale(stored) ? stored : detectLocale(languages.length ? languages : [''])
      const got = runEarlyLocale(stored, languages.length ? languages : undefined, '')
      if (expected === 'zh-Hant') {
        assert.deepEqual(got, { url: null, locale: null }, `stored=${stored} languages=${languages.join(',')}`)
      } else {
        assert.equal(got.locale, expected, `stored=${stored} languages=${languages.join(',')}`)
        assert.equal(got.url, `/i18n/${expected}.json?v=%NOPE_I18N_VERSION%`)
      }
      compared += 1
    }
  }
  assert.ok(compared >= 150, `compared ${compared}`)
  // navigator.languages 不存在時退回 navigator.language
  assert.equal(runEarlyLocale(null, undefined, 'zh-CN').locale, 'zh-Hans')
  assert.equal(runEarlyLocale(null, undefined, 'zh-TW').locale, null)
})

test('提早下載的字典由 loadLocale 接手：語言與網址都相符才用；建置時把佔位符換成 manifest 版本', () => {
  const core = readText('src/i18n/core.ts')
  assert.match(core, /takeEarlyLocale\(locale, url\)/)
  assert.match(core, /early\.locale !== locale \|\| early\.url !== url/)
  // 接手失敗或內容不對就照常下載一次
  assert.match(core, /early\.then\(accept\)\.catch\(\(\) => fetchJson<Dict>\(url\)\.then\(accept\)\)/)
  const config = readText('vite.config.ts')
  assert.match(config, /replaceAll\('%NOPE_I18N_VERSION%', version\)/)
  assert.match(config, /i18nManifest\.ts/)
  assert.match(i18nManifest.version, /^[0-9a-f]{12}$/)
})

const BASIC = new Set<number>([...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i), 0xb7, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x3000, 0x3001, 0x3002, 0x3008, 0x3009, 0x300a, 0x300b, 0xff01, 0xff0c, 0xff1a, 0xff1b, 0xff1f])

function parseRange(range: string): Set<number> {
  const out = new Set<number>()
  for (const part of range.split(',').map((p) => p.trim()).filter(Boolean)) {
    const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/.exec(part)
    assert.ok(match, `unicode-range ${part}`)
    const start = parseInt(match[1], 16)
    const end = match[2] ? parseInt(match[2], 16) : start
    for (let cp = start; cp <= end; cp += 1) out.add(cp)
  }
  return out
}

const faceSets = new Map(siteFont.faces.map((face) => [face.tier as string, parseRange(face.unicodeRange)]))

test('字型小子集：檔案存在、位元組與檔名雜湊相符；樣式表與清單一致；各層互不重疊且不含基本字元', () => {
  assert.equal(siteFont.family, SITE_FONT_FAMILY)
  assert.equal(siteFont.css, SITE_FONT_CSS)
  const onDisk = fs.readdirSync(new URL('public/fonts/', root)).filter((name) => name.startsWith('huwen-nope.')).sort()
  const listed = [...siteFont.faces.map((face) => face.file.replace('/fonts/', '')), SITE_FONT_CSS.replace('/fonts/', '')].sort()
  assert.deepEqual(onDisk, listed, 'public/fonts 裡的檔案與清單要一致（重跑 scripts/build_site_font.py 會先清掉舊檔）')
  for (const face of siteFont.faces) {
    const data = read(`public${face.file}`)
    assert.equal(data.byteLength, face.bytes, face.file)
    assert.ok(face.file.includes(`.${createHash('sha256').update(data).digest('hex').slice(0, 10)}.woff2`), `${face.file} 檔名雜湊`)
    assert.equal(data.subarray(0, 4).toString('latin1'), 'wOF2', `${face.file} 是 WOFF2`)
    assert.equal(faceSets.get(face.tier)!.size, face.codepoints, `${face.tier} 字數`)
  }
  const css = readText(`public${SITE_FONT_CSS}`)
  assert.ok(SITE_FONT_CSS.includes(`.${createHash('sha256').update(read(`public${SITE_FONT_CSS}`)).digest('hex').slice(0, 10)}.css`))
  for (const face of siteFont.faces) {
    assert.ok(css.includes(`@font-face{font-family:"${siteFont.family}";src:url("${face.file}") format("woff2");font-style:normal;font-weight:400;font-display:swap;unicode-range:${face.unicodeRange}}`), face.tier)
  }
  assert.equal(css.match(/@font-face/g)?.length, siteFont.faces.length)
  const seen = new Set<number>()
  for (const [tier, set] of faceSets) {
    for (const cp of set) {
      assert.equal(seen.has(cp), false, `${tier} 與前面的層重疊：U+${cp.toString(16)}`)
      assert.equal(BASIC.has(cp), false, `${tier} 含共用分片第 00 片的基本字元 U+${cp.toString(16)}（英文介面會因此去抓中文字的檔）`)
      seen.add(cp)
    }
  }
})

const dictionaries = {
  'zh-Hant': JSON.parse(readText('src/i18n/locales/zh-Hant.json')) as Record<string, string>,
  'zh-Hans': JSON.parse(readText('public/i18n/zh-Hans.json')) as Record<string, string>,
  en: JSON.parse(readText('src/i18n/locales/en.json')) as Record<string, string>,
}

function charsOf(dict: Record<string, string>, prefixes: readonly string[], patterns: readonly string[] = []): Set<number> {
  const out = new Set<number>()
  const regexes = patterns.map((pattern) => new RegExp(pattern))
  for (const [key, value] of Object.entries(dict)) {
    if (!(prefixes.some((prefix) => key === prefix || key.startsWith(prefix)) || regexes.some((regex) => regex.test(key)))) continue
    for (const ch of value.replace(/<\/?[a-z0-9]+\/?>/g, '').replace(/\{\w+\}/g, '')) {
      const cp = ch.codePointAt(0)!
      if (cp >= 0x80 && !BASIC.has(cp)) out.add(cp)
    }
  }
  return out
}

const missing = new Set([...siteFont.missing].map((ch) => ch.codePointAt(0)!))
const union = (...tiers: string[]) => new Set(tiers.flatMap((tier) => [...(faceSets.get(tier) ?? [])]))

test('字型小子集覆蓋率：首頁用字只需「共同＋該文字」兩層（＋符號）；作答流程再加兩層；覆蓋至少 95%', () => {
  const report: string[] = []
  for (const [locale, script] of [['zh-Hant', 'hant'], ['zh-Hans', 'hans']] as const) {
    const landing = [...charsOf(dictionaries[locale], siteFont.keys.landing, siteFont.keys.landingPatterns)].filter((cp) => !missing.has(cp))
    const landingFaces = union('sym', 'l-common', `l-${script}`)
    const landingCovered = landing.filter((cp) => landingFaces.has(cp))
    const questions = [...charsOf(dictionaries[locale], siteFont.keys.questions)].filter((cp) => !missing.has(cp))
    const journeyFaces = union('sym', 'l-common', `l-${script}`, 'q-common', `q-${script}`)
    const questionsCovered = questions.filter((cp) => journeyFaces.has(cp))
    report.push(`${locale}: landing ${landingCovered.length}/${landing.length}, questions ${questionsCovered.length}/${questions.length}`)
    assert.ok(landingCovered.length >= landing.length * 0.95, `${locale} 首頁用字覆蓋 ${landingCovered.length}/${landing.length}：介面文字改了不少，重跑 scripts/build_site_font.py（見檔頭）`)
    assert.ok(questionsCovered.length >= questions.length * 0.95, `${locale} 作答流程用字覆蓋 ${questionsCovered.length}/${questions.length}：重跑 scripts/build_site_font.py`)
  }
  console.log(report.join('; '))
})

test('字型小子集體積上限：首頁每種文字兩層合計 ≤ 200 KiB；全部 ≤ 700 KiB', () => {
  const bytes = Object.fromEntries(siteFont.faces.map((face) => [face.tier, face.bytes])) as Record<string, number>
  for (const script of ['hant', 'hans']) {
    const landing = bytes['l-common'] + bytes[`l-${script}`] + (bytes.sym ?? 0)
    assert.ok(landing <= 200 * 1024, `landing ${script} ${landing}`)
  }
  assert.ok(siteFont.faces.reduce((n, face) => n + face.bytes, 0) <= 700 * 1024)
})

test('字型小子集的接法：字族排在共用分片之前（兩種語言設定都是）；樣式表由 fontLoading 在資料之後插入', () => {
  const css = readText('src/index.css')
  const families = [...css.matchAll(/--font-serif:\s*([^;]+);/g)].map((match) => match[1])
  assert.equal(families.length, 2)
  for (const value of families) assert.ok(value.startsWith(`"${SITE_FONT_FAMILY}", "HuWenMingChao", `), value)
  const loader = readText('src/lib/fontLoading.ts')
  assert.match(loader, /whenCriticalLoadsSettle\(\)\.then\(\(\) => \{[\s\S]*insertStylesheet\('site', SITE_FONT_CSS, false\)[\s\S]*insertStylesheet\('huwen', HUWEN_FONT_CSS, true\)/)
  // 執行期只匯入樣式表路徑，不把整份清單（unicode-range 字串）帶進前端包
  assert.equal(/from '\.\.\/data\/siteFont'/.test(loader), false)
  // 共用樣式（與 path 共用）不提這個字族
  assert.equal(readText('src/shared-ui/theme.css').includes(SITE_FONT_FAMILY), false)
})

test('載入進度不倒退：兩個檔一開始就登記總量，交錯回報時百分比只增不減', async () => {
  const { getCatalogProgress, reportCatalogProgress, resetCatalogProgress } = await import('../src/lib/loadProgress.ts')
  resetCatalogProgress('schools'); resetCatalogProgress('programs')
  // 載入器的做法：開始下載前各自登記 0／總量
  reportCatalogProgress('schools', 0, 2500, 0)
  reportCatalogProgress('programs', 0, 1000, 0)
  const seen: number[] = [getCatalogProgress().percent ?? -1]
  for (const [key, loaded, total] of [['schools', 500, 2500], ['programs', 100, 1000], ['schools', 1500, 2500], ['programs', 900, 1000], ['schools', 2500, 2500], ['programs', 1000, 1000]] as const) {
    reportCatalogProgress(key, loaded, total, 0)
    seen.push(getCatalogProgress().percent ?? -1)
  }
  assert.deepEqual(seen, [0, 14, 17, 45, 68, 97, 100])
  assert.ok(seen.every((value, index) => index === 0 || value >= seen[index - 1]))
  resetCatalogProgress('schools'); resetCatalogProgress('programs')
  // 兩個載入器都在發出請求之前登記
  const schools = readText('src/lib/runtimeData.ts')
  assert.ok(schools.indexOf('reportCatalogProgress(progressKey, 0, total, 0)') > 0 && schools.indexOf('reportCatalogProgress(progressKey, 0, total, 0)') < schools.indexOf('schoolsPromise = trackCriticalLoad('))
  const programs = readText('src/lib/programsData.ts')
  assert.ok(programs.indexOf('reportCatalogProgress(INDEX_PROGRESS_KEY, 0, programsManifest.indexBytes, 0)') > 0 && programs.indexOf('reportCatalogProgress(INDEX_PROGRESS_KEY, 0, programsManifest.indexBytes, 0)') < programs.indexOf('indexPromise = trackCriticalLoad('))
})
