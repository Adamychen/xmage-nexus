import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCanIsolate, cleanupUsersForScript, isVerifyIsolateEnabled, restartProxyAndWait } from './verify-isolate.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function testMjsSource() {
  return fs.readFileSync(path.join(repoRoot, 'scripts', 'test.mjs'), 'utf8')
}

test('TST-7: flag parsing reads --isolate-verify from argv and VERIFY_ISOLATE=1 from env', () => {
  assert.equal(isVerifyIsolateEnabled(['--isolate-verify']), true)
  assert.equal(isVerifyIsolateEnabled(['--isolate-verify', 'verify']), true)
  assert.equal(isVerifyIsolateEnabled(['verify']), false)
  assert.equal(isVerifyIsolateEnabled([]), false)
  const prev = process.env.VERIFY_ISOLATE
  try {
    process.env.VERIFY_ISOLATE = '1'
    assert.equal(isVerifyIsolateEnabled([]), true)
    delete process.env.VERIFY_ISOLATE
    assert.equal(isVerifyIsolateEnabled([]), false)
  } finally {
    if (prev === undefined) delete process.env.VERIFY_ISOLATE
    else process.env.VERIFY_ISOLATE = prev
  }
})

test('TST-7: isolation refuses to mix with fuzz/self-test/human-test', () => {
  for (const layer of ['fuzz', 'self-test', 'human-test']) {
    assert.throws(() => assertCanIsolate(['verify', layer]), /would kill .* live sessions/)
    assert.throws(() => assertCanIsolate(['verify', 'unit', layer]), /would kill .* live sessions/)
  }
  assert.throws(() => assertCanIsolate(['verify', 'self-test', 'human-test', 'fuzz']), /would kill .* live sessions/)
})

test('TST-7: isolation alone does not refuse', () => {
  assert.equal(assertCanIsolate(['verify']), true)
  assert.equal(assertCanIsolate(['verify', 'unit', 'typecheck']), true)
})

test('TST-7: restartProxyAndWait reports an unreachable proxy with a clear error', async () => {
  const okCtl = () => ({ code: 0, stdout: '', stderr: '' })
  let first = true
  await assert.rejects(
    restartProxyAndWait({
      timeoutMs: 50,
      runCtl: okCtl,
      readyCheck: async () => null,
      pidReader: () => (first ? ((first = false), null) : 7777),
      pollMs: 10,
    }),
    /did not become ready/,
  )
})

test('TST-7: restartProxyAndWait reports a failed ctl restart with a clear error', async () => {
  await assert.rejects(
    restartProxyAndWait({ runCtl: () => ({ code: 1, stdout: '', stderr: 'boom\n' }), readyCheck: async () => null }),
    /proxy restart failed/,
  )
})

test('TST-7: restartProxyAndWait resolves once a new proxy pid exists and /ready answers ok+ready', async () => {
  let restarts = 0
  let first = true
  const ready = await restartProxyAndWait({
    timeoutMs: 5000,
    runCtl: () => {
      restarts++
      return { code: 0, stdout: '', stderr: '' }
    },
    readyCheck: async () => (restarts === 1 ? { ok: true, ready: true, cardDb: 'READY' } : null),
    pidReader: () => (first ? ((first = false), null) : 8888),
    settleMs: 0,
  })
  assert.equal(ready, true)
  assert.equal(restarts, 1)
})

test('TST-7: restartProxyAndWait does not accept /ready from the old proxy (waits for the pid change)', async () => {
  let pid = 1111
  let resolvedAt = null
  const wait = restartProxyAndWait({
    timeoutMs: 5000,
    runCtl: () => ({ code: 0, stdout: '', stderr: '' }),
    readyCheck: async () => ({ ok: true, ready: true, cardDb: 'READY' }),
    pidReader: () => pid,
    pollMs: 20,
    settleMs: 0,
  }).then(() => {
    resolvedAt = Date.now()
  })
  // /ready answers ok from the start, but the pid is still the old proxy: several polls must
  // pass without returning.
  await sleep(100)
  assert.equal(resolvedAt, null, 'must not return while the pid is still the old proxy')
  pid = 2222
  await wait
  assert.ok(resolvedAt !== null, 'resolves after the pid changes')
})

test('TST-7: restartProxyAndWait reports when the old proxy never dies (pid never changes)', async () => {
  await assert.rejects(
    restartProxyAndWait({
      timeoutMs: 60,
      runCtl: () => ({ code: 0, stdout: '', stderr: '' }),
      readyCheck: async () => ({ ok: true, ready: true, cardDb: 'READY' }),
      pidReader: () => 1111,
      pollMs: 10,
    }),
    /never changed|old proxy never died/,
  )
})

test('TST-7: test.mjs case verify invokes the isolate module (source probe)', () => {
  const src = testMjsSource()
  assert.match(src, /from '\.\/verify-isolate\.mjs'/)
  const verifyCase = src.slice(src.indexOf("case 'verify':"), src.indexOf("case 'verify-restart':"))
  assert.match(verifyCase, /isVerifyIsolateEnabled\(process\.argv\.slice\(2\)\)/)
  assert.match(verifyCase, /restartProxyAndWait\(\)/)
  assert.match(verifyCase, /cleanScriptTables\(/)
})

test('TST-7: deterministic cleanup users exist only for scripts whose usernames are fixed', () => {
  assert.deepEqual(cleanupUsersForScript('multi-tenant-test.mjs'), ['mta1', 'mtb2', 'mts3'])
  for (const f of [
    'verify-player-leave.mjs',
    'verify-wizard-matrix.mjs',
    'verify-hand-permission.mjs',
    'verify-spectator-end.mjs',
    'verify-range-attack.mjs',
    'verify-rollback-vote.mjs',
    'verify-swiss.mjs',
    'verify-tournament-watch.mjs',
    'verify-report.mjs',
  ]) {
    assert.equal(cleanupUsersForScript(f), null)
  }
})
