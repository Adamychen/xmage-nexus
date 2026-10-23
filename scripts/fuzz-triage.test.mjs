import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reportSignature, signaturesOfReports, triage } from './fuzz-triage.mjs'

test('TST-3: a livelock with ~1000 same-state updates is the state-loop signature', () => {
  const s = reportSignature({ kind: 'livelock', sameStateUpdates: 1002, promptsSinceUpdate: 0 })
  assert.equal(s, 'livelock:state-loop')
})

test('TST-3: a livelock with a prompt storm is the prompt-storm signature', () => {
  const s = reportSignature({ kind: 'livelock', sameStateUpdates: 3, promptsSinceUpdate: 512 })
  assert.equal(s, 'livelock:prompt-storm')
})

test('TST-3: signatures group across reports and keep counts', () => {
  const reports = [
    { config: {}, results: [{ anomalies: [{ kind: 'livelock', sameStateUpdates: 1005, promptsSinceUpdate: 0 }] }] },
    { config: {}, results: [{ anomalies: [{ kind: 'livelock', sameStateUpdates: 1009, promptsSinceUpdate: 0 }, { kind: 'wsClosedUnexpectedly', code: 1006 }] }] },
  ]
  const sigs = signaturesOfReports(reports)
  assert.equal(sigs['livelock:state-loop'], 2)
  assert.equal(sigs['wsClosedUnexpectedly'], 1)
})

test('TST-3: a signature in the allowlist is not new; an unseen one is', () => {
  const allowlist = { 'livelock:state-loop': 'known', 'livelock:prompt-storm': 'known' }
  const fresh = triage({ 'livelock:state-loop': 5, 'proxyError': 1 }, allowlist)
  assert.deepEqual(fresh, { proxyError: 1 })
})
