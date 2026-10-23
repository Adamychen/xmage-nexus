#!/usr/bin/env node
// Opt-in isolation for the verify layer. Long-lived stacks degrade: orphaned sessions and
// finished games clog the server's callback channel (AGENTS.md), making the verify scripts
// flaky. When enabled, every verify script starts on a freshly restarted proxy (clean
// server-side session state), refusing to mix with layers that hold live sessions across a
// restart (self-test/human-test/fuzz). Enabled via --isolate-verify or VERIFY_ISOLATE=1.
import { PORTS, log, run, livePid } from './lib.mjs'

const CONFLICT_LAYERS = ['self-test', 'human-test', 'fuzz']
const READY_URL = `http://127.0.0.1:${PORTS.proxyHttp}/ready`
const DEFAULT_RESTART_TIMEOUT_MS = 300_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchReady() {
  try {
    const res = await fetch(READY_URL, { signal: AbortSignal.timeout(3000) })
    return await res.json()
  } catch {
    return null
  }
}

function defaultRunCtl() {
  return run('node', ['scripts/ctl.mjs', 'restart', 'proxy'], { quiet: true })
}

/** True when verify isolation is requested: --isolate-verify flag or VERIFY_ISOLATE=1 env. */
export function isVerifyIsolateEnabled(args = process.argv.slice(2)) {
  return args.includes('--isolate-verify') || process.env.VERIFY_ISOLATE === '1'
}

/**
 * Verifies the selected layers can coexist with isolation. Throws when verify isolation is
 * combined with layers that hold live sessions across a proxy restart (restarting the proxy
 * would kill them); returns true otherwise.
 */
export function assertCanIsolate(selectedLayers) {
  const conflict = selectedLayers.filter((l) => CONFLICT_LAYERS.includes(l))
  if (conflict.length > 0) {
    throw new Error(
      `verify isolation cannot run together with ${conflict.join(', ')}: restarting the proxy before every verify script would kill those layers' live sessions. Run the verify layer alone: node scripts/test.mjs verify --isolate-verify`,
    )
  }
  return true
}

/**
 * Restarts the proxy (`node scripts/ctl.mjs restart proxy`) and waits until a NEW proxy process
 * exists (a different pid than before the restart) and its HTTP /ready answers
 * {"ok":true,"ready":true}. `ctl restart` spawns the new proxy detached, so the old one can
 * keep answering /ready for a while after the command returns; accepting it would land the next
 * script in the dead gap before the new JVM binds the WS port. Throws a clear error when the
 * restart command fails, the old proxy never dies, or the new proxy never becomes ready within
 * the bounded timeout. runCtl/readyCheck/pidReader are injectable so the failure modes are
 * testable without touching a real stack.
 */
export async function restartProxyAndWait({
  timeoutMs = DEFAULT_RESTART_TIMEOUT_MS,
  runCtl = defaultRunCtl,
  readyCheck = fetchReady,
  pidReader = livePid,
  pollMs = 3000,
  settleMs = 1200,
} = {}) {
  const oldPid = pidReader('proxy')
  const restart = runCtl()
  if (restart.code !== 0) {
    const tail = `${restart.stdout}\n${restart.stderr}`.split(/\r?\n/).filter(Boolean).slice(-5).join('\n')
    throw new Error(`proxy restart failed (node scripts/ctl.mjs restart proxy exited ${restart.code}):\n${tail || '(no output)'}`)
  }
  log('[verify-isolate] waiting for the proxy to be ready after restart…')
  const deadline = Date.now() + timeoutMs
  let last = null
  let lastPid = oldPid
  while (Date.now() < deadline) {
    lastPid = pidReader('proxy')
    last = await readyCheck()
    const newPid = lastPid !== null && lastPid !== oldPid
    const ready = last?.ok === true && last?.ready === true
    if (newPid && ready) {
      // /ready can answer marginally before the new proxy's WS port accepts connections; a short
      // settle closes that gap before the caller starts talking to the proxy.
      await sleep(settleMs)
      log(`[verify-isolate] proxy READY (pid=${lastPid}, cardDb=${last.cardDb})`)
      return true
    }
    await sleep(pollMs)
  }
  if (!lastPid || (oldPid !== null && lastPid === oldPid)) {
    const why = !lastPid
      ? 'no proxy process appeared'
      : `the old proxy pid ${oldPid} never changed (the old proxy never died)`
    throw new Error(`proxy restart did not take effect within ${timeoutMs}ms: ${why}`)
  }
  throw new Error(`proxy did not become ready within ${timeoutMs}ms after restart (last /ready response: ${JSON.stringify(last)})`)
}

// Users deterministically known before a script runs. Most verify scripts stamp their
// usernames internally with Date.now() at runtime, so only these can be cleaned from outside
// (clean-tables.mjs needs exact usernames).
const CLEANUP_USERS_BY_SCRIPT = new Map([
  // multi-tenant-test.mjs uses one shared ++seq counter: mta1, mtb2 (isolation) and mts3 (same-account attach).
  ['multi-tenant-test.mjs', ['mta1', 'mtb2', 'mts3']],
])

/** Exact usernames a script will use, or null when they are not deterministically known. */
export function cleanupUsersForScript(file) {
  return CLEANUP_USERS_BY_SCRIPT.get(file) ?? null
}

/** Best-effort server-side table cleanup for a script whose users are deterministically known. */
export function cleanScriptTables(file) {
  const users = cleanupUsersForScript(file)
  if (!users) return
  const res = run('node', ['scripts/clean-tables.mjs', ...users], { quiet: true })
  if (res.code !== 0) {
    const tail = `${res.stdout}\n${res.stderr}`.split(/\r?\n/).filter(Boolean).slice(-3).join('\n')
    log(`[verify-isolate] table cleanup for ${file} failed:\n${tail}`)
  }
}
