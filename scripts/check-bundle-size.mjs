import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'web/dist/assets'
const KB = 1024
const budgets = [
  { name: 'entry chunk', match: /^index-.*\.js$/, maxGzip: 470 * KB },
  { name: 'stylesheet', match: /^index-.*\.css$/, maxGzip: 100 * KB },
  { name: 'locale chunk', match: /^(de|es|fr|it|ja|pt|ru|zhs)-.*\.js$/, maxGzip: 60 * KB },
]

const files = readdirSync(dir)
let failed = false
for (const b of budgets) {
  const hits = files.filter((f) => b.match.test(f))
  if (hits.length === 0) {
    console.error(`FAIL ${b.name}: no file in ${dir} matches ${b.match}`)
    failed = true
    continue
  }
  for (const f of hits) {
    const size = gzipSync(readFileSync(join(dir, f))).length
    const ok = size <= b.maxGzip
    if (!ok) failed = true
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${b.name} ${f}: ${(size / KB).toFixed(1)} KB gzip (budget ${b.maxGzip / KB} KB)`)
  }
}
process.exit(failed ? 1 : 0)
