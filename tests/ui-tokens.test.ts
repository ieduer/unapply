// 批 G9 閘門：方角設計記號、單鍵循環切換、首頁版面（站長「不要圓形和橢圓的按鈕；能合併點擊切換的都合併；上方不要留白太多；突出全球學科地圖」）。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { atlasThumb } from '../src/data/atlasThumb.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const components = readdirSync(`${root}/src/components`).filter((f) => f.endsWith('.tsx'))

test('設計記號：@theme 定義 2px（控制項）與 4px（面板）；元件不再用膠囊、橢圓與大圓角，只剩純裝飾圓點與進度條', () => {
  const css = read('src/index.css')
  assert.match(css, /--radius-ctl: 2px;/)
  assert.match(css, /--radius-panel: 4px;/)
  const allowed = [
    'ThemeToggle.tsx:h-3.5 w-3.5 rounded-full',
    'QuestionRunner.tsx:inline-block w-4 h-4 rounded-full',
    'ResultPage.tsx:flex-1 h-2 bg-ink-800 rounded-full',
    'WorldAtlasPage.tsx:block h-1.5 w-full bg-ink-800 rounded-full',
    'ShareCard.tsx:absolute top-6 right-6 w-14 h-14 rounded-full',
  ]
  const found: string[] = []
  for (const f of components) for (const line of read(`src/components/${f}`).split('\n')) {
    for (const m of line.matchAll(/\brounded-(full|2xl|xl|lg|md)\b/g)) {
      const ok = allowed.some((a) => { const [file, frag] = a.split(':'); return file === f && line.includes(frag) })
      if (!ok) found.push(`${f}: ${m[0]} ${line.trim().slice(0, 80)}`)
    }
  }
  assert.deepEqual(found, [])
  for (const f of ['src/App.tsx']) assert.equal(/\brounded-(full|2xl|xl|lg)\b/.test(read(f)), false, f)
})

test('單鍵循環：語言一顆按鈕循環 正體 → 简体 → EN；查學校／查專業、每科取前、港澳臺地區篩選改為 CycleButton', () => {
  const locale = read('src/components/LocaleSwitcher.tsx')
  assert.match(locale, /data-locale-toggle=\{locale\}/)
  assert.equal(/role="group"|aria-pressed/.test(locale), false)
  assert.match(locale, /LOCALES\[\(LOCALES\.indexOf\(locale\) \+ 1\) % LOCALES\.length\]/)
  assert.match(read('src/components/SearchPage.tsx'), /<CycleButton name=\{t\('ui\.search\.modeName'\)\} data="search-mode"/)
  assert.match(read('src/components/WorldAtlasPage.tsx'), /<CycleButton name=\{t\('ui\.world\.topN'\)\}[^>]*data="atlas-topn"/)
  assert.match(read('src/components/HkMoTwPage.tsx'), /<CycleButton name=\{t\('ui\.hkmotw\.regionGroupAria'\)\} data="hkmotw-region"/)
  const zh = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  for (const k of ['ui.cycle.aria', 'ui.locale.toggleAria', 'ui.locale.name.zh-Hant', 'ui.locale.name.zh-Hans', 'ui.locale.name.en', 'ui.search.modeName', 'ui.header.search']) assert.ok(zh[k] && en[k], k)
})

test('首頁：頁頭下不再垂直置中與大 padding；全球學科地圖特色卡（兩欄右欄／手機在起點題前）；三個方角連結磚取代「只瀏覽」那行', () => {
  const landing = read('src/components/Landing.tsx')
  assert.equal(/justify-center gap-8 sm:gap-12 py-10 sm:py-16|data-landing-browse/.test(landing), false)
  assert.match(landing, /pt-4 sm:pt-8/)
  assert.ok(landing.indexOf('<WorldMapFeature') < landing.indexOf('data-landing-origin'))
  assert.ok(landing.indexOf('data-landing-origin') < landing.indexOf('data-landing-tiles'))
  assert.match(landing, /\['search', onSearch\], \['hkmotw', onHkMoTw\], \['overseas', onOverseas\]/)
  assert.match(read('src/components/SiteHeader.tsx'), /data-header-search/)
})

test('地圖縮圖：由 atlas 決定性生成（版本＝內容雜湊）；點數＝機構座標取整去重', () => {
  const version = createHash('sha256').update(atlasThumb.land + atlasThumb.dots.split(' ').join(';')).digest('hex').slice(0, 12)
  assert.equal(atlasThumb.version, version)
  const atlas = JSON.parse(read('public/data/atlas/world-atlas.json')) as { version: string; institutions: { x: number; y: number }[] }
  assert.equal(atlasThumb.atlasVersion, atlas.version)
  assert.equal(atlasThumb.dots.split(' ').length, new Set(atlas.institutions.map((i) => `${Math.round(i.x)},${Math.round(i.y)}`)).size)
  assert.ok(atlasThumb.land.length < 20000)
})
