#!/usr/bin/env node
// Helpers compartidos para las herramientas de desarrollo del Mage.Proxy.
// Multiplataforma: Windows, macOS, Linux (incl. WSL).

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const runDir = path.join(repoRoot, '.run')

/** Versión XMage del fork (coincide con los artefactos org.mage del ~/.m2). */
export const XMAGE_VERSION = '1.4.62'

/**
 * Fork XDHS (xenohedron, servidor mage.xdhs.net): segunda versión soportada por
 * el proxy. Los artefactos org.mage:1.5.8 se instalan aparte en ~/.m2 desde un
 * checkout parcheado con patches/xdhs/ (ver patches/xdhs/README.md).
 */
export const XDHS_TAG = '1.5.8-XDHS-r1'
export const XDHS_VERSION = '1.5.8'

/**
 * Resuelve el checkout del fork XMage (motor + servidor + plugins).
 * Orden: NEXUS_FORK_DIR → ../xmage-fork → este mismo repo (mientras el fork
 * siga vendido aquí). Lanza error con instrucciones si no hay fork en ninguno.
 */
export function forkDir() {
  if (process.env.NEXUS_FORK_DIR) return path.resolve(process.env.NEXUS_FORK_DIR)
  const sibling = path.resolve(repoRoot, '..', 'xmage-fork')
  if (fs.existsSync(path.join(sibling, 'Mage', 'pom.xml'))) return sibling
  if (fs.existsSync(path.join(repoRoot, 'Mage', 'pom.xml'))) return repoRoot
  throw new Error(
    'No encuentro el fork XMage. Clónalo con: git clone https://github.com/Adamychen/xmage-nexus.git -b nexus ../xmage-fork  (o define NEXUS_FORK_DIR)',
  )
}

/** Ruta absoluta dentro del fork: forkPath('Mage/target/classes'). */
export function forkPath(rel) {
  return path.join(forkDir(), rel)
}

/** ¿Están los artefactos org.mage instalados en ~/.m2? */
export function mageArtifactsPresent() {
  return fs.existsSync(path.join(os.homedir(), '.m2', 'repository', 'org', 'mage', 'mage', XMAGE_VERSION, `mage-${XMAGE_VERSION}.jar`))
}

const mageStampFile = () => path.join(os.homedir(), '.m2', 'repository', 'org', 'mage', '.nexus-fork-commit')

/** Commit HEAD del checkout del fork (null si no es un repo git). */
export function forkCommit() {
  const res = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: forkDir(), encoding: 'utf8' })
  return res.status === 0 ? res.stdout.trim() : null
}

/**
 * Garantiza mage/mage-common/mage-sets en ~/.m2 (dependencias del build del
 * proxy) y que correspondan al commit actual del fork: si faltan o el sello
 * `.nexus-fork-commit` no coincide (p. ej. caché de Maven de CI), reinstala.
 */
export function ensureMageArtifacts() {
  const commit = forkCommit()
  let stamped = null
  try { stamped = fs.readFileSync(mageStampFile(), 'utf8').trim() } catch {}
  if (mageArtifactsPresent() && (!commit || stamped === commit)) return
  log(mageArtifactsPresent()
    ? `artefactos org.mage de otro commit del fork (${stamped ?? 'sin sello'} ≠ ${commit}) — reinstalando…`
    : 'artefactos org.mage ausentes en ~/.m2 — instalando desde el fork…')
  const res = mvn(['-q', '-pl', 'Mage.Common,Mage,Mage.Sets,Mage.Server', '-am', 'install', '-DskipTests'], {
    cwd: forkDir(),
    timeoutMs: 1_800_000,
    quiet: true,
  })
  if (res.code !== 0) {
    throw new Error(`mvn install del fork falló: ${res.stderr.slice(0, 400)}`)
  }
  stampMageArtifacts(commit)
}

/** Registra en ~/.m2 el commit del fork del que salen los artefactos org.mage. */
export function stampMageArtifacts(commit = forkCommit()) {
  if (commit) fs.writeFileSync(mageStampFile(), commit + '\n')
}

export const PORTS = {
  server: 17171,
  proxy: 8787,
  proxyHttp: 8788,
  vite: 5173,
}

export const MODULE_CLASSES = [
  'Mage/target/classes',
  'Mage.Common/target/classes',
  'Mage.Sets/target/classes',
  'Mage.Server/target/classes',
  'Mage.Server.Plugins/Mage.Player.AI/target/classes',
]

/** Módulos plugin del servidor que se compilan e instalan en local-server/plugins/. */
export const PLUGIN_MODULES = [
  'Mage.Server.Plugins/Mage.Player.AI',
  'Mage.Server.Plugins/Mage.Player.AI.MAD',
  'Mage.Server.Plugins/Mage.Player.AI.DraftBot',
  'Mage.Server.Plugins/Mage.Player.Human',
  'Mage.Server.Plugins/Mage.Game.TwoPlayerDuel',
  'Mage.Server.Plugins/Mage.Deck.Constructed',
]

export const SERVER_ADD_OPENS = [
  '--add-opens=java.base/java.io=ALL-UNNAMED',
  '--add-opens=java.base/java.util=ALL-UNNAMED',
  '--add-opens=java.base/java.lang=ALL-UNNAMED',
  '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
  '--add-opens=java.base/java.text=ALL-UNNAMED',
]

function ensureRunDir() {
  fs.mkdirSync(runDir, { recursive: true })
}

export function log(...args) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args)
}

export function logError(...args) {
  console.error(`[${new Date().toLocaleTimeString()}] ERROR`, ...args)
}

export function pidFile(name) {
  return path.join(runDir, `${name}.pid`)
}

export function outFile(name) {
  return path.join(runDir, `${name}.out.log`)
}

export function errFile(name) {
  return path.join(runDir, `${name}.err.log`)
}

export function savePid(name, pid) {
  ensureRunDir()
  fs.writeFileSync(pidFile(name), String(pid))
}

export function readPid(name) {
  try {
    return parseInt(fs.readFileSync(pidFile(name), 'utf8').trim(), 10)
  } catch {
    return null
  }
}

export function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function stopPid(name, { force = true } = {}) {
  const pid = readPid(name)
  if (pid && isAlive(pid)) {
    try {
      if (process.platform === 'win32') {
        const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
        if (result.status !== 0) throw new Error(`taskkill exit code ${result.status}`)
      } else {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
      }
      log(`${name} detenido (pid ${pid})`)
    } catch (e) {
      logError(`no se pudo detener ${name}: ${e.message}`)
    }
  }
  try {
    fs.unlinkSync(pidFile(name))
  } catch {
    /* noop */
  }
}

export function binName(name) {
  // mvn/npm/gradle usan .cmd en Windows; en Mac/Linux/WSL el binario plano
  return process.platform === 'win32' ? `${name}.cmd` : name
}

/**
 * Resuelve el binario de Java real (no el stub de macOS que falla si no hay
 * JDK registrado en java_home). El daemon hereda el entorno del proceso que
 * lanza los scripts, así que si JAVA_HOME está en el PATH de la shell de
 * arranque no es suficiente: se usa la ruta absoluta al binario.
 */
export function javaBin() {
  const candidates = [process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : '']
  if (process.platform === 'darwin') {
    // Homebrew JDKs suelen estar en /opt/homebrew/opt (Apple Silicon) o /usr/local/opt (Intel)
    for (const home of ['/opt/homebrew/opt', '/usr/local/opt']) {
      candidates.push(`${home}/openjdk@17/bin/java`, `${home}/openjdk/bin/java`, `${home}/openjdk@21/bin/java`, `${home}/openjdk@11/bin/java`)
    }
  }
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  const probe = spawnSync('sh', ['-c', 'command -v java'], { encoding: 'utf8' })
  if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim()
  return 'java'
}

/** Límite actual de descriptores de archivo (soft) o null si no se puede medir. */
function nofileLimit() {
  try {
    const res = spawnSync('sh', ['-c', 'ulimit -n'], { encoding: 'utf8' })
    const n = Number((res.stdout ?? '').trim())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Lanza un proceso en segundo plano (detached) con salida redirigida a .run/.
 * Devuelve el PID.
 */
export function daemon(name, cmd, args, { cwd } = {}) {
  ensureRunDir()
  const out = fs.openSync(outFile(name), 'a')
  const err = fs.openSync(errFile(name), 'a')
  // el stub de macOS (/usr/bin/java) falla si el JDK no está registrado en java_home
  if (cmd === 'java') cmd = javaBin()
  // un límite bajo de descriptores puede tumbar los sockets de callbacks del
  // servidor bajo carga (SESSION CALLBACK EXCEPTION - Unable to create socket)
  const limit = nofileLimit()
  if (limit !== null && limit < 10240) {
    log(`AVISO: límite de descriptores bajo (ulimit -n = ${limit}) — sube el soft limit con "ulimit -n 65536" en tu shell antes de arrancar el stack`)
  }
  // los binarios .cmd/.bat de Windows no se pueden spawnear directamente
  const useShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd)
  const child = spawn(cmd, args, {
    cwd: cwd ?? repoRoot,
    detached: true,
    shell: useShell,
    stdio: ['ignore', out, err],
  })
  child.unref()
  fs.closeSync(out)
  fs.closeSync(err)
  savePid(name, child.pid)
  log(`${name} lanzado (pid ${child.pid})`)
  return child.pid
}

/** Espera a que un puerto TCP acepte conexiones (IPv4 e IPv6). */
export function waitForPort(port, timeoutMs = 30000) {
  const hosts = ['127.0.0.1', '::1', 'localhost']
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (hostIndex) => {
      const host = hosts[hostIndex]
      const socket = net.connect({ host, port })
      socket.setTimeout(1500)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => {
        socket.destroy()
        if (hostIndex + 1 < hosts.length) {
          tick(hostIndex + 1)
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`el puerto ${port} no acepta conexiones tras ${timeoutMs}ms`))
        } else {
          setTimeout(() => tick(0), 750)
        }
      })
      socket.once('timeout', () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`el puerto ${port} no acepta conexiones tras ${timeoutMs}ms`))
        } else {
          setTimeout(() => tick(0), 750)
        }
      })
    }
    tick(0)
  })
}

/** Espera a que un puerto deje de aceptar conexiones (proceso parado). */
export function waitForPortDown(port, timeoutMs = 30000) {
  const hosts = ['127.0.0.1', '::1', 'localhost']
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (hostIndex) => {
      const host = hosts[hostIndex]
      const socket = net.connect({ host, port })
      socket.setTimeout(1500)
      socket.once('connect', () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`el puerto ${port} sigue aceptando conexiones tras ${timeoutMs}ms`))
        } else {
          setTimeout(() => tick(0), 750)
        }
      })
      socket.once('error', () => {
        socket.destroy()
        if (hostIndex + 1 < hosts.length) {
          tick(hostIndex + 1)
        } else {
          resolve(true)
        }
      })
      socket.once('timeout', () => {
        socket.destroy()
        if (hostIndex + 1 < hosts.length) {
          tick(hostIndex + 1)
        } else {
          resolve(true)
        }
      })
    }
    tick(0)
  })
}

/** Ejecuta un comando en primer plano y devuelve { code, stdout, stderr }. */
export function run(cmd, args, { cwd = repoRoot, timeoutMs = 600_000, quiet = false, env } = {}) {
  const started = Date.now()
  try {
    const res = spawnSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      shell: true,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const code = res.status ?? 1
    return { code, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
  } catch (e) {
    return { code: 1, stdout: '', stderr: e.message }
  } finally {
    if (!quiet) log(`  ${cmd} ${args.join(' ')} — ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }
}

/** Ejecuta mvn con opciones comunes. */
export function mvn(args, opts = {}) {
  return run(binName('mvn'), args, opts)
}

/**
 * Classpath del servidor: deps de runtime (sin org.mage, para evitar jars
 * viciados del .m2) + los target/classes frescos de los módulos.
 * Se regenera solo si cambió algún pom (caché en .run/server-deps.txt).
 */
export function buildServerClasspath() {
  const cpFile = path.join(runDir, 'server-deps.txt')
  ensureRunDir()
  const poms = [
    'Mage.Server/pom.xml',
    'Mage/pom.xml',
    'Mage.Common/pom.xml',
    'Mage.Sets/pom.xml',
    'Mage.Server.Plugins/Mage.Player.AI/pom.xml',
  ].map((p) => forkPath(p))

  let cached = false
  try {
    const stat = fs.statSync(cpFile)
    cached = poms.every((p) => fs.statSync(p).mtimeMs < stat.mtimeMs)
  } catch {
    cached = false
  }

  if (!cached) {
    const res = mvn(['-q', '-pl', 'Mage.Server', 'dependency:build-classpath', `-Dmdep.outputFile=${cpFile}`], {
      cwd: forkDir(),
      quiet: true,
    })
    if (res.code !== 0) {
      throw new Error(`mvn dependency:build-classpath falló: ${res.stderr.slice(0, 400)}`)
    }
  }

  const deps = fs
    .readFileSync(cpFile, 'utf8')
    .trim()
    .split(path.delimiter)
    .filter((p) => p && !/([\\/])org([\\/])mage([\\/])/.test(p))

  const classes = MODULE_CLASSES.map((p) => {
    const abs = forkPath(p)
    if (!fs.existsSync(abs)) {
      throw new Error(`falta ${abs} — ejecuta: node scripts/build.mjs`)
    }
    return abs
  })

  return classes.concat(deps).join(path.delimiter)
}

/** Copia los jars de los módulos plugin (del fork) a local-server/plugins/. */
export function copyPluginJars() {
  const pluginsDir = path.join(repoRoot, 'local-server', 'plugins')
  fs.mkdirSync(pluginsDir, { recursive: true })
  const root = forkPath('Mage.Server.Plugins')
  let count = 0
  for (const moduleDir of fs.readdirSync(root)) {
    const target = path.join(root, moduleDir, 'target')
    if (!fs.existsSync(target)) continue
    for (const file of fs.readdirSync(target)) {
      if (!file.endsWith('.jar')) continue
      if (/(sources|javadoc|original-)/.test(file)) continue
      fs.copyFileSync(path.join(target, file), path.join(pluginsDir, file))
      count++
    }
  }
  log(`plugins copiados a local-server/plugins/ (${count} jars)`)
  return count
}

/** Cola (tail) de un fichero con formato de cabecera. */
export function tailFile(label, file, lines = 25) {
  console.log(`\n===== ${label} (${file}) =====`)
  try {
    const content = fs.readFileSync(file, 'utf8')
    const parts = content.trimEnd().split(/\r?\n/)
    console.log(parts.slice(-lines).join('\n'))
  } catch {
    console.log('(sin contenido)')
  }
}

/** Fichero de log de un componente, con fallback a ubicaciones antiguas. */
export function logFileFor(component) {
  const candidates = {
    server: [path.join(runDir, 'server.out.log'), path.join(repoRoot, 'local-server', 'mageserver.log')],
    proxy: [path.join(runDir, 'proxy.out.log'), path.join(runDir, 'proxy.err.log'), path.join(repoRoot, 'Mage.Proxy', 'proxy.out.log'), path.join(repoRoot, 'Mage.Proxy', 'proxy.err.log')],
    vite: [path.join(runDir, 'vite.out.log'), path.join(repoRoot, 'Mage.Proxy', 'web', 'vite.log')],
  }
  const list = candidates[component] ?? []
  return list.filter((f) => fs.existsSync(f))
}

/**
 * Minimal WebSocket client for the proxy JSON protocol, shared by the verify
 * scripts: `call(action, args, ms)` matches the `result` by its echoed
 * requestId (resolving { ok: false, error: 'timeout' } on expiry),
 * `wait(pred, ms, label)` resolves on the next dispatch that matches, and
 * `close()` drops the socket. `onMessage(conn, m)` sees every event after
 * conn.gameId is auto-filled; `autoAnswer(conn, m)` then answers prompts.
 * Dispatch order (gameId → onMessage → autoAnswer → waiters) mirrors the
 * per-script scaffolding these scripts used to duplicate.
 */
export function wsConn(url, { name = '', autoAnswer = null, onMessage = null, gameIdOn, callTimeoutMs = 15000, init = null } = {}) {
  const isStartEvent = gameIdOn ?? ((m) => !!m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_')))
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    const waiters = []
    const conn = { ws, name, view: null, gameId: null }
    if (init) Object.assign(conn, init)
    let rid = 0

    conn.call = (action, args, ms = callTimeoutMs) =>
      new Promise((res) => {
        const id = `${name}-${++rid}`
        const timer = setTimeout(() => {
          pending.delete(id)
          res({ ok: false, error: 'timeout' })
        }, ms)
        pending.set(id, (m) => {
          clearTimeout(timer)
          res(m)
        })
        try {
          ws.send(JSON.stringify({ requestId: id, action, args }))
        } catch {
          clearTimeout(timer)
          pending.delete(id)
          res({ ok: false, error: 'send-fail' })
        }
      })

    conn.wait = (pred, ms, label) =>
      new Promise((resolveWait, rejectWait) => {
        const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${label}${name ? ` (${name})` : ''}`)), ms)
        waiters.push((m) => {
          if (pred(m)) {
            clearTimeout(timer)
            resolveWait(m)
            return true
          }
          return false
        })
      })

    conn.close = () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }

    ws.onopen = () => resolve(conn)
    ws.onerror = () => reject(new Error('could not connect to the proxy'))
    ws.onmessage = (raw) => {
      let m
      try {
        m = JSON.parse(String(raw.data ?? raw))
      } catch {
        return
      }
      if (m.requestId && pending.has(m.requestId)) {
        pending.get(m.requestId)(m)
        pending.delete(m.requestId)
        return
      }
      if (m.requestId || m.type === 'lobby' || m.type === 'error') return
      if (!conn.gameId && isStartEvent(m)) conn.gameId = String(m.objectId)
      if (onMessage) onMessage(conn, m)
      if (autoAnswer) autoAnswer(conn, m)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  })
}
