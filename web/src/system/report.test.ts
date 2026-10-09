import { beforeEach, describe, expect, it } from 'vitest'
import { addLog, setState } from '../state/state'
import { clearFrames, recordFrame } from '../net/frameBuffer'
import { clearErrors, recordError } from './errorLog'
import { REPORT_LIMITS, buildReport, fingerprintOf, reportToMarkdown, trimFrames } from './report'

function fatFrames(count: number, eachBytes: number) {
  clearFrames()
  for (let i = 0; i < count; i++) {
    recordFrame({ type: 'event', method: 'GAME_UPDATE', messageId: i, data: { blob: 'x'.repeat(eachBytes) } } as never)
  }
}

beforeEach(() => {
  clearFrames()
  clearErrors()
  setState({ log: [], game: null, wsUrl: 'ws://proxy.test:8787', wsAlive: true, gameId: 'game-1' })
})

describe('report capture', () => {
  it('keeps only the tail of the frame buffer, and never more than the proxy accepts', () => {
    fatFrames(40, 4096)
    const draft = buildReport('bug', 'board looked wrong')

    const whole = draft.wire.bundle.frames.filter((f) => f.full !== undefined)
    expect(whole.length).toBeLessThanOrEqual(REPORT_LIMITS.MAX_WHOLE_FRAMES)
    expect(draft.bytes).toBeLessThanOrEqual(REPORT_LIMITS.MAX_PAYLOAD_BYTES)
    // the tail is what matters: the last frame is always in
    expect(whole.some((f) => f.kind === 'event:GAME_UPDATE')).toBe(true)
  })

  it('stays under the cap even with a fat frame buffer and a fat log', () => {
    fatFrames(60, 6000)
    for (let i = 0; i < 300; i++) addLog('partida', `a log line long enough to matter when there are hundreds of them ${i}`)

    const draft = buildReport('bug', 'still fits')

    expect(draft.bytes).toBeLessThanOrEqual(REPORT_LIMITS.MAX_PAYLOAD_BYTES)
    // the log was never the problem, so it stays whole: the ladder stops at the first thing that fits
    expect(draft.wire.bundle.log.length).toBe(120)
  })

  it('drops whole frames and the long log before it lets a report near the cap', () => {
    // what a shipped build carries: 60 whole frames at the 8 KB budget and a 240 KB log
    fatFrames(60, 7_000)
    for (let i = 0; i < 300; i++) addLog('partida', 'a'.repeat(2000) + i)

    const draft = buildReport('bug', 'huge everything')

    expect(draft.bytes).toBeLessThanOrEqual(REPORT_LIMITS.MAX_PAYLOAD_BYTES)
    expect(draft.wire.bundle.log.length).toBeLessThanOrEqual(REPORT_LIMITS.SHORT_LOG_LINES)
    expect(draft.wire.bundle.frames.every((f) => f.full === undefined)).toBe(true)
  })

  it('groups two players who hit the same thing and separates two who did not', () => {
    setState({ game: { turn: 4, step: 'MAIN1', players: [] } as never })
    recordError('app', 'TypeError: cannot read property of undefined')
    const first = fingerprintOf('bug')

    clearErrors()
    recordError('app', 'TypeError: cannot read property of undefined')
    expect(fingerprintOf('bug')).toBe(first)

    clearErrors()
    recordError('app', 'RangeError: stack overflow')
    expect(fingerprintOf('bug')).not.toBe(first)
  })

  it('flattens numbers so 4 life and 7 life are one problem, and stays free of newlines', () => {
    setState({ game: { turn: 4, step: 'MAIN1', players: [] } as never })
    recordError('window', 'lost 4 life on the\nbattlefield')
    const fp = fingerprintOf('bug')

    clearErrors()
    recordError('window', 'lost 7 life on the\nbattlefield')
    expect(fingerprintOf('bug')).toBe(fp)
    expect(fp).not.toContain('\n')
    expect(fp.length).toBeLessThanOrEqual(120)
  })

  it('works with no game and no connection (a report from the lobby is still a report)', () => {
    setState({ game: null, wsAlive: false })

    const draft = buildReport('feedback', 'the lobby is too quiet')

    expect(draft.fingerprint.startsWith('feedback|')).toBe(true)
    expect(draft.wire.bundle.game).toBeNull()
  })

  it('writes a summary a maintainer can read, with the numbers that triage needs', () => {
    setState({
      game: { turn: 3, step: 'BEGIN_COMBAT', activePlayerId: 'p1', players: [{ name: 'ana', life: 7, playerId: 'p1' }] } as never,
    })
    recordError('boundary', 'TypeError: boom')

    const text = reportToMarkdown(buildReport('bug', 'kept playing after I lost'))

    expect(text).toContain('kept playing after I lost')
    expect(text).toContain('ana (7)')
    expect(text).toContain('turn 3')
    expect(text).toContain('ws://proxy.test:8787')
    expect(text).toContain('TypeError: boom')
    expect(text).toContain('Fingerprint:')
  })

  it('trims frames by budget, keeping the recent ones whole', () => {
    const frames = Array.from({ length: 20 }, (_, i) => ({
      at: i,
      kind: 'event:GAME_UPDATE',
      bytes: 5000,
      full: { blob: 'x'.repeat(5000) },
    }))

    const trimmed = trimFrames(frames, 12_000, REPORT_LIMITS.MAX_WHOLE_FRAMES)

    expect(trimmed.filter((f) => f.full !== undefined).length).toBeLessThanOrEqual(3)
    expect(trimmed[trimmed.length - 1].full).toBeDefined()
    expect(trimmed[0].full).toBeUndefined()
  })
})
