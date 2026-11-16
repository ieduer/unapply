// 分享圖只內嵌用得到的字型分片（src/lib/shareFonts.ts，2026-11-16）。這裡測不依賴瀏覽器的部分：
// unicode-range 解析、字元涵蓋判斷、@font-face 的比對鍵與網址解析，以及接線沒有被改回去。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { firstFontUrl, fontFaceKey, parseUnicodeRange, rangesCoverAny } from '../src/lib/shareFonts.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('unicode-range：單點、區間、萬用字元都解析得出來', () => {
  assert.deepEqual(parseUnicodeRange('U+4E00-4E05, U+26, u+4??'), [
    { start: 0x4e00, end: 0x4e05 },
    { start: 0x26, end: 0x26 },
    { start: 0x400, end: 0x4ff },
  ])
  assert.deepEqual(parseUnicodeRange('garbage, U+zz'), [])
})

test('字元涵蓋：有一個字落在分片範圍內就算用得到；沒寫範圍的字型涵蓋全部', () => {
  const ranges = parseUnicodeRange('U+4E00-4E05, U+26')
  assert.equal(rangesCoverAny(ranges, [0x4f60, 0x4e03]), true)
  assert.equal(rangesCoverAny(ranges, [0x4f60]), false)
  assert.equal(rangesCoverAny([], [0x41]), true)
})

test('比對鍵：引號、大小寫、空白、normal／bold 關鍵字不影響比對', () => {
  assert.equal(
    fontFaceKey('"HuWenMingChaoNope"', 'normal', 'normal', 'U+4E00-4E05, U+26'),
    fontFaceKey('HuWenMingChaoNope', '400', '', 'u+4e00-4e05,u+26'),
  )
  assert.equal(fontFaceKey('IBM Plex Mono', 'bold', 'normal', ''), fontFaceKey("'ibm plex mono'", '700', 'normal', 'U+0-10FFFF'))
  assert.notEqual(fontFaceKey('A', '400', 'normal', 'U+26'), fontFaceKey('A', '500', 'normal', 'U+26'))
})

test('字型網址：相對路徑按樣式表位置解析；data: 不重複內嵌', () => {
  assert.equal(
    firstFontUrl('url("HuWenMingChao.12.woff2") format("woff2")', 'https://mx.bdfz.net/fonts/huwen/v1/HuWenMingChao.css'),
    'https://mx.bdfz.net/fonts/huwen/v1/HuWenMingChao.12.woff2',
  )
  assert.equal(firstFontUrl('url(/fonts/huwen-nope.a.woff2) format("woff2")', 'https://nope.bdfz.net/fonts/huwen-nope.css'), 'https://nope.bdfz.net/fonts/huwen-nope.a.woff2')
  assert.equal(firstFontUrl('url(https://fonts.gstatic.com/s/a.woff2) format("woff2")', 'https://fonts.googleapis.com/css2'), 'https://fonts.gstatic.com/s/a.woff2')
  assert.equal(firstFontUrl('url(data:font/woff2;base64,AAAA)', 'https://example.org/'), null)
  assert.equal(firstFontUrl('local("Songti TC")', 'https://example.org/'), null)
})

test('接線：分享圖用自己的字型樣式、不對資源加時間戳重抓、四角用目前色系的畫布色；跨來源的字型樣式表都以 CORS 載入', () => {
  const share = read('src/lib/share.ts')
  assert.match(share, /fontEmbedCSS/)
  assert.doesNotMatch(share, /cacheBust/)
  assert.doesNotMatch(share, /backgroundColor: '#/)
  assert.match(share, /--color-ink-950/)
  const loader = read('src/lib/fontLoading.ts')
  assert.match(loader, /insertStylesheet\('huwen', HUWEN_FONT_CSS, true\)/)
  assert.match(loader, /insertStylesheet\('google', GOOGLE_FONT_CSS, true\)/)
  // 兩個出圖的地方都走同一個函式
  for (const page of ['ResultPage', 'GlobalSubtraction']) assert.match(read(`src/components/${page}.tsx`), /generateShareImage\(shareRef\.current/, page)
})
