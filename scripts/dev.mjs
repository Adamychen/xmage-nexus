#!/usr/bin/env node
// Development stack control for Mage.Proxy (server + proxy + vite).
// Direct diagnostics: node scripts/dev.mjs start|stop|status|restart [server|proxy|vite|all]
// To avoid blocking the shell use: node scripts/ctl.mjs start|stop|status|restart [server|proxy|vite|all]

import fs from 'node:fs'
import path from 'node:path'
import { awaitChildListening, buildServerClasspath, daemon, ensureStartable, forkPath, livePid, log, logError, logFileFor, PORTS, portOwnerPid, SERVER_ADD_OPENS, stopPid, tailFile, waitForPortDown } from './lib.mjs'

const arg = process.argv[2] ?? 'status'
const target = process.argv[3] ?? 'all'
const VALID = new Set(['server', 'proxy', 'vite', 'all'])
if (!VALID.has(target)) {
  console.error(`invalid target: ${target} (server|proxy|vite|all)`)
  process.exit(1)
}

/** Lista de componentes a detener/arrancar según target (con sus dependencias). */
function targetsOf() {
  const list = target === 'all' ? ['server', 'proxy', 'vite'] : [target]
  // el proxy guarda la sesión del servidor: reiniciar el servidor sin reiniciar el
  // proxy deja a JBoss Remoting con estado corrupto (NoClassDefFoundError en
  // InternalTransporterServices) y todo connect falla hasta reiniciar el proxy
  if (target === 'server' && !list.includes('proxy')) list.splice(list.indexOf('server') + 1, 0, 'proxy')
  return list
}

/** local-server/ es runtime (gitignored): en CI o máquina nueva solo existe plugins/.
 *  Sin config/config.xml el servidor no arranca → sembrar desde el fork. */
function ensureLocalServerDirs() {
  const dir = `${import.meta.dirname}/../local-server`
  for (const sub of ['config', 'db', 'extensions', 'gamesHistory', 'plugins', 'saved']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true })
  }
  const cfg = path.join(dir, 'config', 'config.xml')
  if (fs.existsSync(cfg)) return
  const pomXml = fs.readFileSync(forkPath('Mage.Server/pom.xml'), 'utf8')
  const pomVer = pomXml.match(/<version>(\d+\.\d+[^<]*)<\/version>/)?.[1] ?? ''
  const seed = fs.readFileSync(forkPath('Mage.Server/release/config/config.xml'), 'utf8')
    .replaceAll('${project.version}', pomVer)
    .replace('serverAddress="0.0.0.0"', 'serverAddress="127.0.0.1"')
    .replace('maxGameThreads="10"', 'maxGameThreads="20"')
  if (seed.includes('${project.version}')) {
    logError('unresolved placeholders in the fork config.xml seed')
    process.exit(1)
  }
  fs.writeFileSync(cfg, seed)
  log(`config seed created: ${cfg} (version ${pomVer})`)
}

/** Each start* returns the child pid, or null when the component cannot be launched. */
function startServer() {
  log('starting XMage server (headless, testMode)…')
  try {
    ensureLocalServerDirs()
    const cp = buildServerClasspath()
    const args = [...SERVER_ADD_OPENS, '-cp', cp, 'mage.server.Main', '-testMode']
    return daemon('server', 'java', args, { cwd: `${import.meta.dirname}/../local-server` })
  } catch (e) {
    logError(e.message)
    return null
  }
}

function startProxy() {
  const jar = `${import.meta.dirname}/../Mage.Proxy/target/mage-proxy-1.4.63.jar`
  if (!fs.existsSync(jar)) {
    logError(`proxy jar missing — run: node scripts/build.mjs`)
    return null
  }
  log('starting proxy…')
  // SIM bots are dev/test-harness only: the release artifacts (Docker, bundle, launcher)
  // start the proxy without --sim, so no deployment ever runs a bot.
  return daemon('proxy', 'java', [...SERVER_ADD_OPENS, '-cp', jar, 'org.mage.proxy.Main', '--sim', 'on'], {
    cwd: `${import.meta.dirname}/../Mage.Proxy`,
  })
}

function startVite() {
  // se lanza el binario de vite con node directamente (sin npm.cmd ni shells):
  // así el pidfile apunta al proceso real y la salida va a .run/
  const viteBin = path.join(import.meta.dirname, '..', 'web', 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteBin)) {
    logError(`vite missing from node_modules — run: npm install (in web)`)
    return null
  }
  log('starting vite dev…')
  return daemon('vite', 'node', [viteBin, 'dev'], { cwd: `${import.meta.dirname}/../web` })
}

async function stopTargets(list) {
  // orden inverso de arranque: vite primero, proxy, servidor al final
  if (list.includes('vite')) await stopPid('vite')
  if (list.includes('proxy')) await stopPid('proxy')
  if (list.includes('server')) await stopPid('server')
}

const PORT_OF = {
  server: [PORTS.server, 'XMage server'],
  proxy: [PORTS.proxy, 'proxy WebSocket'],
  vite: [PORTS.vite, 'Vite'],
}

/**
 * Waits for the ports of the listed components to stop answering, instead of sleeping a fixed
 * 1.5 s and hoping. The proxy's shutdown hook walks every session before it releases the port, so
 * with a few sessions alive the old process still held 8787 when the new one started: the new
 * WebSocket server failed to bind (`BindException: Address already in use`) but the process stayed
 * up anyway. A port still held after the wait is an error: starting on top of it is never right.
 */
async function waitForPortsDown(list) {
  for (const name of ['proxy', 'server', 'vite']) {
    if (!list.includes(name)) continue
    const [port, label] = PORT_OF[name]
    try {
      await waitForPortDown(port, 60_000)
    } catch (e) {
      const owner = portOwnerPid(port)
      throw new Error(`${label}: ${e.message}${owner ? ` — held by pid ${owner}` : ''}. Not starting on top of it`)
    }
  }
}

function status() {
  const rows = []
  for (const name of ['server', 'proxy', 'vite']) {
    const pid = livePid(name)
    rows.push({ name, pid, state: pid ? 'RUNNING' : 'stopped' })
  }
  console.table(rows)
  for (const name of ['server', 'proxy', 'vite']) {
    const logs = logFileFor(name)
    if (logs.length) tailFile(name, logs[0], 6)
  }
}

/**
 * Stops the component, refuses to start if its port still answers (someone else owns it), starts
 * it and waits until the port is served by the child it just started (failing at once if that
 * child dies on the way, e.g. a BindException).
 */
async function startComponent(name, timeoutMs, start) {
  const [port, label] = PORT_OF[name]
  await stopPid(name)
  await ensureStartable({ port, label })
  const pid = start()
  if (!pid) throw new Error(`${label} could not be started`)
  await awaitChildListening({ pid, port, label, timeoutMs })
  log(`${label} OK (port ${port})`)
}

async function startAll(only) {
  const list = only ?? targetsOf()
  // CI (cold runner) does the full card scan on first run, so the default wait is generous;
  // locally the DB is cached and this is never noticed.
  if (list.includes('server')) await startComponent('server', Number(process.env.NEXUS_SERVER_WAIT_MS ?? 600_000), startServer)
  if (list.includes('proxy')) await startComponent('proxy', 30_000, startProxy)
  if (list.includes('vite')) await startComponent('vite', 60_000, startVite)
  status()
}

async function main() {
  switch (arg) {
    case 'start':
      await startAll()
      break
    case 'stop':
      await stopTargets(targetsOf())
      break
    case 'restart': {
      const list = targetsOf()
      await stopTargets(list)
      await waitForPortsDown(list)
      await startAll(list)
      break
    }
    case 'status':
      status()
      break
    default:
      console.error('usage: node scripts/dev.mjs start|stop|status|restart [server|proxy|vite|all]')
      process.exit(1)
  }
}

try {
  await main()
} catch (e) {
  logError(e.message)
  process.exit(1)
}
