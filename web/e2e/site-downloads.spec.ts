import { test, expect } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

/**
 * The download panel of the landing page (site/index.html + site/app.js).
 *
 * Issue #12: a release carries 27 assets — one installer per OS plus the JRE,
 * server and proxy tarballs the launcher downloads by itself — and every
 * "Download" button used to open the page listing all of them, which is where
 * the reporter lost track of which file to click. The panel now resolves the
 * current release and offers the files of the visitor's own OS, named with
 * their size.
 *
 * The GitHub API is stubbed with the real v0.4.5 asset names, so the spec is
 * deterministic and needs no network; what it pins is the selection logic and
 * the links, not GitHub. Every case asserts where a button points, so an
 * old-style "everything links to /releases/latest" panel fails here.
 */

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site')

/** Verbatim from `gh api repos/Adamychen/xmage-nexus/releases/latest` (v0.4.5). */
const ASSETS: Array<{ name: string; size: number }> = [
  { name: 'components-manifest.json', size: 4 * 1024 },
  { name: 'latest.json', size: 1 * 1024 },
  { name: 'nexus-jre-linux-x64.tar.gz', size: 33 * 1048576 },
  { name: 'nexus-jre-mac-arm64.tar.gz', size: 29 * 1048576 },
  { name: 'nexus-jre-win-x64.tar.gz', size: 29 * 1048576 },
  { name: 'nexus-proxy-linux-x64.tar.gz', size: 72 * 1048576 },
  { name: 'nexus-proxy-mac-arm64.tar.gz', size: 72 * 1048576 },
  { name: 'nexus-proxy-win-x64.tar.gz', size: 72 * 1048576 },
  { name: 'nexus-proxy-xdhs-linux-x64.tar.gz', size: 71 * 1048576 },
  { name: 'nexus-proxy-xdhs-mac-arm64.tar.gz', size: 71 * 1048576 },
  { name: 'nexus-proxy-xdhs-win-x64.tar.gz', size: 71 * 1048576 },
  { name: 'nexus-server-linux-x64.tar.gz', size: 69 * 1048576 },
  { name: 'nexus-server-mac-arm64.tar.gz', size: 69 * 1048576 },
  { name: 'nexus-server-win-x64.tar.gz', size: 68 * 1048576 },
  { name: 'XMage.Nexus-0.4.5-1.x86_64.rpm', size: 12 * 1048576 },
  { name: 'XMage.Nexus-0.4.5-1.x86_64.rpm.sig', size: 1 * 1024 },
  { name: 'XMage.Nexus.app.tar.gz', size: 11 * 1048576 },
  { name: 'XMage.Nexus.app.tar.gz.sig', size: 1 * 1024 },
  { name: 'XMage.Nexus_0.4.5_aarch64.dmg', size: 12 * 1048576 },
  { name: 'XMage.Nexus_0.4.5_amd64.AppImage', size: 86 * 1048576 },
  { name: 'XMage.Nexus_0.4.5_amd64.AppImage.sig', size: 1 * 1024 },
  { name: 'XMage.Nexus_0.4.5_amd64.deb', size: 12 * 1048576 },
  { name: 'XMage.Nexus_0.4.5_amd64.deb.sig', size: 1 * 1024 },
  { name: 'XMage.Nexus_0.4.5_x64-setup.exe', size: 8 * 1048576 },
  { name: 'XMage.Nexus_0.4.5_x64-setup.exe.sig', size: 1 * 1024 },
  { name: 'XMage.Nexus_0.4.5_x64_en-US.msi', size: 10 * 1048576 },
  { name: 'XMage.Nexus_0.4.5_x64_en-US.msi.sig', size: 1 * 1024 },
]

const MACHINE_ONLY = /nexus-(jre|server|proxy)|\.sig$|latest\.json$|components-manifest\.json$|\.app\.tar\.gz$/

let server: http.Server
let origin = ''

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0]
    const file = url === '/' ? 'index.html' : url.replace(/^\//, '')
    const p = path.join(SITE_DIR, file)
    if (!p.startsWith(SITE_DIR) || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const type = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : 'text/html'
    res.writeHead(200, { 'content-type': type })
    res.end(fs.readFileSync(p))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** Opens the landing page under a given OS and waits for the release data. */
async function openAs(browser: import('@playwright/test').Browser, userAgent: string, apiStatus = 200) {
  const page = await browser.newPage({ userAgent })
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  let apiCalls = 0
  await page.route('**api.github.com/**', (route) => {
    apiCalls++
    if (apiStatus !== 200) return route.fulfill({ status: apiStatus, body: 'rate limited' })
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tag_name: 'v0.4.5', assets: ASSETS.map((a) => ({ ...a, browser_download_url: `https://github.com/Adamychen/xmage-nexus/releases/download/v0.4.5/${a.name}` })) }),
    })
  })
  await page.goto(`${origin}/`)
  return { page, pageErrors, apiCalls: () => apiCalls }
}

const OS_CASES = [
  {
    os: 'Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    primary: 'XMage.Nexus_0.4.5_x64-setup.exe',
    others: ['XMage.Nexus_0.4.5_x64_en-US.msi'],
  },
  {
    os: 'macOS',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    primary: 'XMage.Nexus_0.4.5_aarch64.dmg',
    others: [],
  },
  {
    os: 'Linux',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    primary: 'XMage.Nexus_0.4.5_amd64.AppImage',
    others: ['XMage.Nexus_0.4.5_amd64.deb', 'XMage.Nexus-0.4.5-1.x86_64.rpm'],
  },
]

for (const c of OS_CASES) {
  test(`the download panel offers only ${c.os} installers @site`, async ({ browser }) => {
    const { page, pageErrors } = await openAs(browser, c.userAgent)
    await expect(page.locator('.download-card').filter({ hasText: 'MB' }).first()).toBeVisible({ timeout: 10_000 })

    const cards = await page.$$eval('.download-card', (els) => els.map((e) => ({ href: e.getAttribute('href') || '', text: e.textContent || '' })))

    // The primary button is the visitor's own installer, named with its size.
    const primary = cards.filter((k) => k.href.endsWith(`/${c.primary}`))
    expect(primary).toHaveLength(1)
    expect(primary[0].text).toContain(c.primary)
    expect(primary[0].text).toMatch(/\d+(?:\.\d)? MB/)

    // Nothing machine-only is offered, and no foreign-OS installer either.
    const offered = cards.map((k) => k.href).filter((h) => h.includes('/releases/download/'))
    expect(offered.filter((h) => MACHINE_ONLY.test(h))).toEqual([])
    expect(offered).toHaveLength(1)

    // Secondary formats for the same OS stay reachable, but small.
    const extras = await page.$$eval('.dl-extra-link', (els) => els.map((e) => e.textContent || ''))
    expect(extras).toHaveLength(c.others.length)
    for (const name of c.others) {
      expect(extras.some((t) => t.includes(name))).toBe(true)
    }

    expect(pageErrors).toEqual([])
    await page.context().close()
  })
}

test('a rate-limited GitHub API falls back to the release page @site', async ({ browser }) => {
  const { page, pageErrors } = await openAs(browser, OS_CASES[0].userAgent, 403)
  await expect(page.locator('.download-card').first()).toBeVisible()
  const cards = await page.$$eval('.download-card', (els) => els.map((e) => e.getAttribute('href') || ''))
  // Play + the three OS cards + "all versions". Without the API the OS cards go
  // to the release page (the old behaviour): degraded, but nothing broken.
  expect(cards).toHaveLength(5)
  expect(cards.filter((h) => h.includes('/releases/latest'))).toHaveLength(3)
  expect(pageErrors).toEqual([])
  await page.context().close()
})

test('the release assets are fetched once per tab @site', async ({ browser }) => {
  const { page, apiCalls } = await openAs(browser, OS_CASES[0].userAgent)
  await expect(page.locator('.dl-file').first()).toBeVisible({ timeout: 10_000 })
  await page.reload()
  await expect(page.locator('.dl-file').first()).toBeVisible({ timeout: 10_000 })
  expect(apiCalls()).toBe(1)
  await page.context().close()
})
