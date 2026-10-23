import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, 'web', 'dist-demo')
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
}
const SCENARIOS = ['blaze', 'modes', 'ballista', 'targeting', 'attack', 'block', 'planeswalker', 'tokens', 'thoughtseize', 'commander', 'draft', 'tournament']

function serve(dir) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(dir, path)
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const failures = []
let checks = 0
const check = (ok, what) => {
  checks++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures.push(what)
}

// The dashboard reads this marker (site/status.json "demo" layer, see gen-dashboard.mjs).
function writeMarker(status, extra) {
  writeFileSync(join(ROOT, 'web', '.demo.json'), JSON.stringify({ status, ...extra }))
}

const playwrightPath = join(ROOT, 'web', 'node_modules', 'playwright', 'index.mjs')
const { chromium } = await import(pathToFileURL(playwrightPath).href)
const server = await serve(DIR)
const base = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch()

async function open(query = '', seed) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  if (seed) await page.addInitScript((id) => sessionStorage.setItem('nexus_demo_autostart', id), seed)
  await page.goto(base + query)
  return { page, errors }
}

try {
  try {
    {
      const { page, errors } = await open()
      await page.getByRole('heading', { name: /available tables/i }).waitFor({ timeout: 20000 })
      check(true, 'the demo logs in by itself and shows the lobby')
      check((await page.getByText('Friday Commander pod', { exact: false }).count()) > 0, 'lobby lists the extra demo tables')

      await page.getByTestId('demo-tour-toggle').click()
      await page.getByRole('button', { name: /^Ranks and ratings/ }).click()
      await page.getByText('Leaderboard', { exact: false }).first().waitFor({ timeout: 10000 })
      const rows = await page.locator('table tbody tr, [role="row"]').count()
      check(rows >= 10, `ranking lists the roster (${rows} rows)`)
      check((await page.getByTestId('leaderboard-demo-note').count()) === 1, 'ranking says the data is sample data')
      check((await page.getByText('MYTHIC').count()) > 0, 'ranking shows the tiers')
      await page.keyboard.press('Escape')

      await page.getByTestId('demo-tour-toggle').click()
      await page.getByRole('button', { name: /^Deck builder and EDHREC/ }).click()
      await page.getByText('Deck Editor').waitFor({ timeout: 10000 })
      check(true, 'the deck builder opens on the Krenko starter deck')
      await page.getByText('Suggestions', { exact: true }).click()
      const edhrec = await page.getByText(/Krenko, Mob Boss decks/).waitFor({ timeout: 25000 }).then(() => true, () => false)
      if (!edhrec) console.log('warn EDHREC suggestions did not resolve (Scryfall unreachable?)')
      check(errors.length === 0, `no page errors while touring (${errors[0] ?? 'none'})`)
      await page.close()
    }

    for (const id of SCENARIOS) {
      const { page, errors } = await open(`?scenario=${id}`, id)
      const reached = await page
        .waitForFunction(
          (scenario) => {
            const text = document.body.innerText
            if (scenario === 'draft') return /Pick a card from the booster/i.test(text)
            if (scenario === 'tournament') return /View Bracket/i.test(text)
            return /Main Phase|Turn \d/i.test(text)
          },
          id,
          { timeout: 25000 },
        )
        .then(() => true, () => false)
      check(reached && errors.length === 0, `scenario ${id} reaches its screen without page errors${errors[0] ? ` (${errors[0]})` : ''}`)
      await page.close()
    }
  } catch (e) {
    writeMarker('fail', { error: String((e && e.message) || e) })
    console.error('\nverify-demo crashed:', e)
    process.exit(1)
  }
} finally {
  await browser.close()
  server.close()
}

if (failures.length) {
  writeMarker('fail', { failed: failures.length })
  console.error(`\n${failures.length} demo check(s) failed`)
  process.exit(1)
}
writeMarker('pass', { checks })
console.log('\ndemo verified')
