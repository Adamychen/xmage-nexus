#!/usr/bin/env node
// Orquestador de todas las capas de test del Mage.Proxy.
// Uso: node scripts/test.mjs [layer...] [--skip=unit,typecheck]
//   (sin argumentos: ejecuta todas las capas en orden)
// Capas: unit, coverage, typecheck, build, java, self-test, human-test, verify,
//        verify-restart, fuzz, e2e, i18n

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { binName, ensureMageArtifacts, log, logError, PORTS, repoRoot, run, waitForPort, waitForPortDown } from './lib.mjs'
import { enforceCoverageGate } from './coverage-gate.mjs'
import { assertCanIsolate, cleanScriptTables, isVerifyIsolateEnabled, restartProxyAndWait } from './verify-isolate.mjs'

const WEB_DIR = path.join(repoRoot, 'web')
const STACK_HINT = 'el stack no está corriendo — ejecuta primero: node scripts/ctl.mjs start'

/**
 * Anti-drift scripts against the real stack. Each one drives the real protocol and exits
 * non-zero on its own failure, but nothing ran them: they were not in any layer, so they only
 * executed when someone remembered. Ordered cheapest-first so a broken fundamental surfaces
 * before the long ones.
 */
const VERIFY_SCRIPTS = [
  // first: it is the most sensitive script (it needs a fresh view within its window and its
  // CONCEDE only lands when the player has priority). Running it after any other script - even
  // multi-tenant-test, which only logs in and out - made it fail all three attempts with
  // "partida congelada tras el CONCEDE", while it passes when it runs on a fresh proxy
  'verify-player-leave.mjs',
  'multi-tenant-test.mjs',
  'verify-wizard-matrix.mjs',
  'verify-hand-permission.mjs',
  'verify-spectator-end.mjs',
  'verify-range-attack.mjs',
  'verify-rollback-vote.mjs',
  'verify-swiss.mjs',
  'verify-tournament-watch.mjs',
  // last: it only logs in and sends reports, but it writes into Mage.Proxy/reports, so keep it
  // after the scripts that need a clean session state
  'verify-report.mjs',
]

const LAYERS = [
  { name: 'unit', desc: 'vitest run (web); shares one run with coverage when both are selected' },
  { name: 'coverage', desc: 'vitest run --coverage (web), coverage gate included' },
  { name: 'typecheck', desc: 'tsc -b --noEmit (web)' },
  { name: 'build', desc: 'tsc -b && vite build (web)' },
  { name: 'java', desc: 'mvn -f Mage.Proxy/pom.xml test (with the fork artifacts in ~/.m2)' },
  { name: 'self-test', desc: 'headless E2E (ws://127.0.0.1:8787)' },
  { name: 'human-test', desc: 'E2E human player vs AI (ws://127.0.0.1:8787)' },
  { name: 'verify', desc: `${VERIFY_SCRIPTS.length} verify/* anti-drift scripts (multi-tenant, permissions, tournaments…)` },
  { name: 'verify-restart', desc: 'verify-reconnect (restarts the proxy: do not mix it with other layers)' },
  { name: 'fuzz', desc: 'fuzz.mjs self-play (20 games by default: nightly, not on every push)' },
  { name: 'e2e', desc: 'playwright test (web)' },
  { name: 'i18n', desc: 'i18n coverage guard (894 keys, allowlist)' },
  { name: 'scripts', desc: 'node --test over scripts/*.test.mjs (dashboard and CI helpers)' },
]
const NAMES = new Set(LAYERS.map((l) => l.name))

function usage() {
  console.log(`
Usage: node scripts/test.mjs [layer...] [--skip=layers]

Layers (default order):
${LAYERS.map((l) => `  ${l.name.padEnd(10)} ${l.desc}`).join('\n')}

  unit and coverage are one vitest run: when both are selected (the default) it runs once,
  with coverage, and each layer reports from it; the coverage gate fails only "coverage".

Options:
  --skip=unit,typecheck   excludes layers (comma-separated)
  --isolate-verify        restarts the proxy before each verify script
                          (or set VERIFY_ISOLATE=1; refuses to mix with self-test/human-test/fuzz)
  --help                  shows this help

Examples:
  node scripts/test.mjs                  # all layers
  node scripts/test.mjs typecheck        # typecheck only
  node scripts/test.mjs unit             # vitest without coverage
  node scripts/test.mjs --skip=unit,e2e  # all except unit and e2e
`)
}

function parseArgs(args) {
  const opts = { help: false, skip: new Set(), layers: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help' || a === '-h') {
      opts.help = true
    } else if (a.startsWith('--skip=')) {
      a.slice(7).split(',').forEach((s) => s.trim() && opts.skip.add(s.trim()))
    } else if (a === '--skip') {
      const next = args[++i]
      if (next) next.split(',').forEach((s) => s.trim() && opts.skip.add(s.trim()))
    } else if (a === '--isolate-verify') {
      // Consumed by the verify-isolate module (isVerifyIsolateEnabled re-reads raw argv).
    } else {
      opts.layers.push(a)
    }
  }
  return opts
}

/** Comprueba si un puerto del stack está abierto (timeout corto, ~5s). */
async function stackUp(port, label) {
  try {
    await waitForPort(port, 5000)
    return true
  } catch {
    log(`${label} no disponible (puerto ${port})`)
    return false
  }
}

/** Una petición al endpoint HTTP del proxy, o null si no contesta. */
async function proxyHttp(path) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORTS.proxyHttp}${path}`, { signal: AbortSignal.timeout(3000) })
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Waits for `/ready`, not just for the port. A proxy that has just started answers on 8787 while
 * it is still building its card database, and every script then fails with "Proxy is still loading
 * card data, retry in a few seconds" — a real failure that looks exactly like a broken test.
 */
async function waitForReady(timeoutMs = 900_000) {
  const deadline = Date.now() + timeoutMs
  let waited = false
  while (Date.now() < deadline) {
    const ready = await proxyHttp('/ready')
    if (ready?.ready === true) {
      if (waited) log(`proxy READY (cardDb=${ready.cardDb})`)
      return true
    }
    if (!waited) {
      log(`esperando a que el proxy esté READY (cardDb=${ready?.cardDb ?? 'sin respuesta'})…`)
      waited = true
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  logError('el proxy no llegó a READY en el tiempo esperado')
  return false
}

/**
 * The verify/self-test scripts degrade on a stack that has been up for hours: orphaned sessions
 * and finished games clog the server's callback channel (`WATCHGAME` never arrives, the game
 * looks frozen at turn 2 because no view ever comes). It is not a code failure, but it reads
 * exactly like one, so say it out loud instead of letting the next person debug it.
 */
async function warnIfStackStale() {
  const health = await proxyHttp('/health')
  if (!health) return
  const minutes = Math.round((health.uptimeSeconds ?? 0) / 60)
  const sessions = health.sessions ?? 0
  if (minutes >= 60 || sessions >= 20) {
    log(`AVISO: el stack lleva ${minutes} min con ${sessions} sesiones; si las capas verify/self-test`)
    log('       fallan con "sin vistas" o timeouts, reinícialo antes: node scripts/ctl.mjs restart all')
  }
}

/** True when server and proxy answer and the proxy finished building its card database. */
async function stackReady() {
  const upServer = await stackUp(PORTS.server, 'servidor')
  const upProxy = await stackUp(PORTS.proxy, 'proxy')
  if (!upServer || !upProxy) return false
  return waitForReady()
}

/**
 * Runs one verify script and prints its own last line (they all end with a RESULTADO summary),
 * so a failure in the middle of the layer is attributable without digging into the log.
 */
function runVerifyScript(file) {
  const started = Date.now()
  const res = run('node', [`scripts/${file}`], { timeoutMs: 1_200_000, quiet: true })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const last = `${res.stdout}\n${res.stderr}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? ''
  console.log(`  ${res.code === 0 ? '✓' : '✗'} ${file} (${secs}s) ${last}`)
  return res
}

/**
 * The shared vitest run exits non-zero both for a failing test and for a coverage gate that is
 * not met. The unit layer only owns the first: it passes when every test passed, even if the
 * gate failed, and the coverage layer keeps the whole exit code.
 */
export function vitestVerdict(vitest, layer) {
  if (layer === 'coverage' || vitest.code === 0) return vitest
  const out = `${vitest.stdout}\n${vitest.stderr}`
  const gateOnly = /does not meet (?:global )?threshold/.test(out) && !/^\s*(?:Tests|Test Files)\b.*\bfailed\b|^\s*Errors\b/m.test(out)
  return gateOnly ? { code: 0, stdout: vitest.stdout, stderr: '' } : vitest
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    usage()
    process.exit(0)
  }

  for (const l of opts.layers) {
    if (!NAMES.has(l)) {
      logError(`capa inválida: ${l}`)
      usage()
      process.exit(1)
    }
  }

  let selected = opts.layers.length ? opts.layers : LAYERS.map((l) => l.name)
  selected = selected.filter((l) => !opts.skip.has(l))
  if (selected.length === 0) {
    log('no hay capas que ejecutar (todas excluidas con --skip)')
    log('RESULTADO: 0 pass, 0 fail, 0 skip (0.0s)')
    process.exit(0)
  }

  log(`capas a ejecutar: ${selected.join(', ')}`)
  if (isVerifyIsolateEnabled(process.argv.slice(2))) {
    try {
      assertCanIsolate(selected)
    } catch (e) {
      logError(e.message)
      process.exit(1)
    }
  }
  const startedAt = Date.now()
  const results = []
  let fails = 0
  const vitestCommand = selected.includes('coverage') ? 'test:coverage' : 'test'
  let vitestRun = null

  // warm-up del stack antes de las capas E2E que requieren proxy (self-test/human-test):
  // la PRIMERA partida tras un arranque en frío del servidor puede perder el socket de
  // callbacks (SESSION CALLBACK EXCEPTION) y tumbarse un WATCHGAME/GAME_INIT; una partida
  // descartable la "tripa" fuera de los tests (no afecta al conteo de la suite).
  // En modo fake (e2e) no se necesita el stack, así que se omite el warmup.
  const stackE2eLayers = selected.filter((l) => l === 'self-test' || l === 'human-test')
  const stackVerifyLayers = selected.filter((l) => l === 'verify' || l === 'verify-restart' || l === 'fuzz')
  if (stackE2eLayers.length > 0 || stackVerifyLayers.length > 0) {
    await warnIfStackStale()
  }
  if (stackE2eLayers.length > 0) {
    const upServer = await stackUp(PORTS.server, 'servidor')
    if (upServer) {
      const warmStart = Date.now()
      const warm = run('node', ['scripts/warmup.mjs'], { quiet: true })
      const warmSecs = ((Date.now() - warmStart) / 1000).toFixed(1)
      const warmOut = `${(warm.stdout + warm.stderr).trim().split(/\r?\n/).filter(Boolean).pop() ?? ''}`
      if (warm.code === 0) {
        log(`${warmOut || '[warmup] OK'} (${warmSecs}s)`)
      } else {
        log(`[warmup] falló (${warmSecs}s) — los tests seguirán con sus reintentos: ${warmOut}`)
      }
    }
  }

  for (const name of selected) {
    const layerStart = Date.now()
    let res = null
    let note = ''

    switch (name) {
      case 'unit':
      case 'coverage':
        if (vitestRun) note = ' (shared vitest run)'
        vitestRun ??= run(binName('npm'), ['--prefix', 'web', 'run', vitestCommand])
        res = vitestVerdict(vitestRun, name)
        // Coverage no-regression gate: the vitest thresholds catch a drop below the floor, not a
        // drift above it. Only the coverage layer owns this gate (the unit layer passes when the
        // tests pass even if the gate failed), and only when vitest itself passed: on a failed
        // run the summary can be partial.
        if (name === 'coverage' && res.code === 0) {
          const gate = enforceCoverageGate()
          if (!gate.ok) {
            res = { code: 1, stdout: '', stderr: gate.message }
          } else if (gate.recordedBaseline) {
            log(gate.message)
          }
        }
        break
      case 'typecheck':
        res = run(binName('npm'), ['--prefix', 'web', 'run', 'typecheck'])
        break
      case 'build':
        res = run(binName('npm'), ['--prefix', 'web', 'run', 'build'])
        break
      case 'java':
        ensureMageArtifacts()
        res = run(binName('mvn'), ['-f', 'Mage.Proxy/pom.xml', 'test'])
        if (res.code !== 0) {
          try {
            const dir = path.join(repoRoot, 'Mage.Proxy', 'target', 'surefire-reports')
            for (const f of fs.readdirSync(dir)) {
              if (!f.endsWith('.xml')) continue
              const txt = fs.readFileSync(path.join(dir, f), 'utf8')
              const name = (txt.match(/<testsuite[^>]*\bname="([^"]+)"/) || [])[1]
              const attr = (n) => Number((txt.match(new RegExp(`\\b${n}="(\\d+)"`)) || [])[1] ?? 0)
              const bad = attr('failures') + attr('errors')
              if (name && bad > 0) console.log(`  ✗ ${name} (failures=${attr('failures')}, errors=${attr('errors')})`)
            }
          } catch { /* sin surefire-reports */ }
        }
        break
      case 'self-test': {
        if (!(await stackReady())) {
          res = { code: 1, stdout: '', stderr: STACK_HINT }
        } else {
          res = run('node', ['scripts/self-test.mjs'])
        }
        break
      }
      case 'human-test': {
        if (!(await stackReady())) {
          res = { code: 1, stdout: '', stderr: STACK_HINT }
        } else {
          res = run('node', ['scripts/human-test.mjs'])
        }
        break
      }
      case 'e2e': {
        // en modo fake (default) playwright arranca vite solo (webServer en
        // playwright.config.ts). Solo se requiere vite pre-existente en modo real.
        const isReal = process.env.E2E_BACKEND === 'real'
        if (isReal) {
          const upVite = await stackUp(PORTS.vite, 'vite')
          if (!upVite) {
            res = { code: 1, stdout: '', stderr: STACK_HINT }
            break
          }
        }
        // el e2e por defecto corre en FAKE (FixtureServer en puerto dinámico,
        // un servidor por test, en paralelo). No se toca el proxy (8787) —
        // ambos pueden correr simultáneamente.
        res = run(binName('npx'), ['playwright', 'test'], { cwd: WEB_DIR, timeoutMs: 3_600_000 })
        break
      }
      case 'verify': {
        if (!(await stackReady())) {
          res = { code: 1, stdout: '', stderr: STACK_HINT }
          break
        }
        const failed = []
        const isolate = isVerifyIsolateEnabled(process.argv.slice(2))
        for (const file of VERIFY_SCRIPTS) {
          if (isolate) {
            try {
              await restartProxyAndWait()
            } catch (e) {
              console.log(`  ✗ ${file} — isolation restart failed: ${e.message}`)
              failed.push(file)
              continue
            }
          }
          if (runVerifyScript(file).code !== 0) failed.push(file)
          if (isolate) cleanScriptTables(file)
        }
        res = failed.length
          ? { code: 1, stdout: '', stderr: `${failed.length} de ${VERIFY_SCRIPTS.length} verify scripts fallaron: ${failed.join(', ')}` }
          : { code: 0, stdout: '', stderr: '' }
        break
      }
      case 'verify-restart': {
        // Reanuda/restaura tras reiniciar el proxy: deja el stack en otro estado y tarda minutos,
        // así que vive en su propia capa y no se mezcla con self-test/human-test/verify.
        if (!(await stackReady())) {
          res = { code: 1, stdout: '', stderr: STACK_HINT }
          break
        }
        res = runVerifyScript('verify-reconnect.mjs')
        break
      }
      case 'fuzz': {
        if (!(await stackReady())) {
          res = { code: 1, stdout: '', stderr: STACK_HINT }
          break
        }
        res = run('node', ['scripts/fuzz.mjs'], { timeoutMs: 3_600_000 })
        break
      }
      case 'i18n':
        res = run('node', ['scripts/i18n-coverage.mjs'])
        break
      case 'scripts': {
        const files = fs.readdirSync(path.join(repoRoot, 'scripts')).filter((f) => f.endsWith('.test.mjs')).sort()
        res = run('node', ['--test', ...files.map((f) => `scripts/${f}`)], { timeoutMs: 600_000 })
        break
      }
    }

    const seconds = ((Date.now() - layerStart) / 1000).toFixed(1)
    if (res.code === 0) {
      results.push({ name, status: 'pass' })
      console.log(`[PASS] ${name} (${note ? 'shared run' : `${seconds}s`})`)
    } else {
      fails++
      results.push({ name, status: 'fail' })
      console.log(`[FAIL] ${name} (${note ? 'shared run' : `${seconds}s`})`)
      const lines = `${res.stderr ?? ''}\n${res.stdout ?? ''}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (lines.length) {
        console.log('  salida de error:')
        lines.slice(-12).forEach((l) => console.log(`    ${l}`))
      }
    }
  }

  const total = ((Date.now() - startedAt) / 1000).toFixed(1)
  const pass = results.filter((r) => r.status === 'pass').length
  log(`RESULTADO: ${pass} pass, ${fails} fail (${total}s)`)
  process.exit(fails === 0 ? 0 : 1)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) await main()
