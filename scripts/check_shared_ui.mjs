#!/usr/bin/env node
// nope.bdfz.net 與 path.bdfz.net 共用同一套版面基礎。這個檢查確保共用檔沒有被單邊改動：
//   node scripts/check_shared_ui.mjs          核對本倉庫的共用檔與 manifest 一致；姊妹倉庫在旁邊時一併比對
//   node scripts/check_shared_ui.mjs --write  改完共用檔後重寫 manifest（然後把同樣的檔案複製到姊妹倉庫）
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = [
  'src/shared-ui/theme.css',
  'src/shared-ui/theme.ts',
  'src/shared-ui/ThemeCustomizer.tsx',
  'tests/theme-contrast.test.ts',
  'scripts/check_shared_ui.mjs',
]
const SIBLING = { unapply: 'minus-life', 'minus-life': 'unapply' }
const manifestPath = join(root, 'src/shared-ui/manifest.json')
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const current = Object.fromEntries(FILES.map((file) => [file, hash(join(root, file))]))

if (process.argv.includes('--write')) {
  writeFileSync(manifestPath, JSON.stringify({ files: current }, null, 2) + '\n')
  console.log('shared-ui manifest written')
  process.exit(0)
}

const problems = []
const recorded = JSON.parse(readFileSync(manifestPath, 'utf8')).files
for (const file of FILES) {
  if (recorded[file] !== current[file]) problems.push(`${file} 與 manifest 不一致（改了共用檔要跑 --write 並同步姊妹站）`)
}

const siblingRoot = join(root, '..', SIBLING[basename(root)] ?? '')
if (SIBLING[basename(root)] && existsSync(join(siblingRoot, 'src/shared-ui/manifest.json'))) {
  for (const file of FILES) {
    const other = join(siblingRoot, file)
    if (!existsSync(other) || hash(other) !== current[file]) problems.push(`${file} 與姊妹站 ${SIBLING[basename(root)]} 不同`)
  }
} else {
  console.log('sibling checkout not found; compared against manifest only')
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`shared-ui ok: ${FILES.length} files identical`)
