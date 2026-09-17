#!/usr/bin/env node
// Matriz navegador × resolución de la regresión visual de la galería P3
// (plan4 §2 P3 / §8.1). Ejecuta el spec opt-in `e2e/gallery.spec.ts` con
// E2E_VISUAL=1 por cada combinación, en serie y con el binario local de web/.
//
// Uso:
//   node scripts/gallery-visual.mjs                                  # verifica la matriz por defecto
//   node scripts/gallery-visual.mjs --update                         # regenera baselines
//   node scripts/gallery-visual.mjs --browser=webkit --viewport=1366x768
//   node scripts/gallery-visual.mjs --dry-run
//
// Baselines: web/e2e/gallery.spec.ts-snapshots/<entrada>-<WxH>-<navegador>-<plataforma>.png
// (p. ej. frame-mutate-1920x1080-webkit-darwin.png). Son POR PLATAFORMA: los
// PNG generados en macOS (darwin) no sirven en linux/win32 y viceversa.

import path from 'node:path'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { log, logError, repoRoot } from './lib.mjs'

const WEB_DIR = path.join(repoRoot, 'web')
const SPEC = 'e2e/gallery.spec.ts'
const SNAPSHOT_DIR = path.join(WEB_DIR, 'e2e', 'gallery.spec.ts-snapshots')
const PLAYWRIGHT_BIN = path.join(
  WEB_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
)
const BROWSERS = ['chromium', 'webkit']
const DEFAULT_VIEWPORTS = ['1366x768', '1920x1080', '2560x1440']
const RUN_TIMEOUT_MS = 15 * 60 * 1000
const LIST_TIMEOUT_MS = 60 * 1000

function usage() {
  console.log(`
Uso: node scripts/gallery-visual.mjs [opciones]

Matriz navegador × resolución de la galería (#/gallery):
  ${BROWSERS.join(', ')} × ${DEFAULT_VIEWPORTS.join(', ')}  (${BROWSERS.length * DEFAULT_VIEWPORTS.length} combinaciones)

Opciones:
  --update              regenera los baselines (--update-snapshots)
  --browser=a,b         limita los navegadores (chromium, webkit)
  --viewport=AxB,CxD    limita las resoluciones (p. ej. 1366x768,1920x1080)
  --dry-run             imprime los comandos sin ejecutarlos
  --help                muestra esta ayuda

Ejemplos:
  node scripts/gallery-visual.mjs
  node scripts/gallery-visual.mjs --update
  node scripts/gallery-visual.mjs --browser=webkit --viewport=1366x768
`)
}

function parseArgs(args) {
  const opts = { update: false, dryRun: false, help: false, browsers: null, viewports: null }
  for (const a of args) {
    if (a === '--update') opts.update = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--browser=')) opts.browsers = a.slice('--browser='.length).split(',').map((s) => s.trim()).filter(Boolean)
    else if (a.startsWith('--viewport=')) opts.viewports = a.slice('--viewport='.length).split(',').map((s) => s.trim()).filter(Boolean)
    else {
      logError(`opción desconocida: ${a}`)
      usage()
      process.exit(1)
    }
  }
  return opts
}

function validate(opts) {
  const browsers = opts.browsers ?? BROWSERS
  if (browsers.length === 0) {
    logError('--browser= no puede quedar vacío')
    process.exit(1)
  }
  for (const b of browsers) {
    if (!BROWSERS.includes(b)) {
      logError(`navegador inválido: ${b} (admitidos: ${BROWSERS.join(', ')})`)
      process.exit(1)
    }
  }
  const viewports = opts.viewports ?? DEFAULT_VIEWPORTS
  if (viewports.length === 0) {
    logError('--viewport= no puede quedar vacío')
    process.exit(1)
  }
  for (const v of viewports) {
    if (!/^\d+x\d+$/.test(v)) {
      logError(`resolución inválida: ${v} (formato AxB, p. ej. 1366x768)`)
      process.exit(1)
    }
  }
  return { browsers: [...new Set(browsers)], viewports: [...new Set(viewports)] }
}

/**
 * Navegadores instalados según `playwright install --list` (null si no se pudo
 * consultar: p. ej. binario roto). `chromium_headless_shell` cuenta como
 * chromium (instalaciones con --only-shell).
 */
function installedBrowsers() {
  const res = spawnSync(PLAYWRIGHT_BIN, ['install', '--list'], {
    cwd: WEB_DIR,
    encoding: 'utf8',
    timeout: LIST_TIMEOUT_MS,
    windowsHide: true,
  })
  if (res.error || res.status !== 0) return null
  const found = new Set()
  for (const line of (res.stdout ?? '').split(/\r?\n/)) {
    const m = /^(chromium|webkit)(?:_headless_shell)?-\d+/.exec(path.basename(line.trim()))
    if (m) found.add(m[1])
  }
  return found
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    usage()
    process.exit(0)
  }

  if (!fs.existsSync(PLAYWRIGHT_BIN)) {
    logError(`no encuentro el binario local de Playwright: ${PLAYWRIGHT_BIN}`)
    logError('instala las dependencias de web/ con: npm --prefix web install')
    process.exit(1)
  }

  const { browsers, viewports } = validate(opts)
  const combos = browsers.flatMap((browser) => viewports.map((viewport) => ({ browser, viewport })))
  const installed = installedBrowsers()
  if (installed === null) {
    log('AVISO: no se pudo consultar los navegadores instalados (playwright install --list) — se ejecutará la matriz igualmente')
  } else {
    log(`navegadores instalados: ${[...installed].sort().join(', ') || 'ninguno'}`)
  }
  log(opts.update ? `matriz a regenerar: ${combos.length} combinaciones` : `matriz a verificar: ${combos.length} combinaciones`)

  if (opts.dryRun) {
    for (const { browser, viewport } of combos) {
      const missing = installed !== null && !installed.has(browser)
      const args = ['test', SPEC, ...(opts.update ? ['--update-snapshots'] : [])]
      console.log(`\n[DRY-RUN] ${browser} ${viewport}${missing ? ` — navegador NO instalado (npx playwright install ${browser})` : ''}`)
      console.log(`  cwd: ${WEB_DIR}`)
      console.log(`  cmd: E2E_VISUAL=1 E2E_BROWSER=${browser} E2E_VIEWPORT=${viewport} ${PLAYWRIGHT_BIN} ${args.join(' ')}`)
      console.log(`  baselines: ${path.relative(repoRoot, SNAPSHOT_DIR)}/*-${viewport}-${browser}-${process.platform}.png`)
    }
    log(`RESULTADO (dry-run): ${combos.length} combinaciones, 0 ejecutadas`)
    return
  }

  const startedAt = Date.now()
  const results = []
  for (const { browser, viewport } of combos) {
    const label = `${browser} ${viewport}`
    if (installed !== null && !installed.has(browser)) {
      results.push({ label, status: 'fail' })
      logError(`[FAIL] ${label} — navegador no instalado: ejecuta npx playwright install ${browser} (desde web/)`)
      continue
    }

    const args = ['test', SPEC, ...(opts.update ? ['--update-snapshots'] : [])]
    const env = { ...process.env, E2E_VISUAL: '1', E2E_BROWSER: browser, E2E_VIEWPORT: viewport }
    log(`[RUN ] ${label} — playwright test ${SPEC}${opts.update ? ' --update-snapshots' : ''}`)
    const t0 = Date.now()
    const res = spawnSync(PLAYWRIGHT_BIN, args, {
      cwd: WEB_DIR,
      stdio: 'inherit',
      env,
      timeout: RUN_TIMEOUT_MS,
      windowsHide: true,
    })
    const secs = ((Date.now() - t0) / 1000).toFixed(1)

    if (res.error) {
      results.push({ label, status: 'fail' })
      logError(
        `[FAIL] ${label} (${secs}s) — ${res.error.code === 'ETIMEDOUT' ? `timeout de ${RUN_TIMEOUT_MS / 60_000} min` : res.error.message}`,
      )
    } else if (res.status === 0) {
      results.push({ label, status: 'pass' })
      log(`[PASS] ${label} (${secs}s)`)
    } else {
      results.push({ label, status: 'fail' })
      logError(`[FAIL] ${label} (${secs}s) — playwright terminó con código ${res.status}`)
    }
  }

  const total = ((Date.now() - startedAt) / 1000).toFixed(1)
  const pass = results.filter((r) => r.status === 'pass').length
  const fail = results.length - pass
  console.log('')
  log('resumen por combinación:')
  for (const r of results) console.log(`  [${r.status === 'pass' ? 'PASS' : 'FAIL'}] ${r.label}`)
  log(`RESULTADO: ${pass} pass, ${fail} fail (${total}s)`)
  if (fail > 0 && !opts.update) {
    log('pista: si los baselines no existen todavía para estas combinaciones, regéneralos con: node scripts/gallery-visual.mjs --update')
  }
  process.exit(fail === 0 ? 0 : 1)
}

await main()
