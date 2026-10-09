// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ReportDialog from './ReportDialog'
import { setGateway } from '../net/commands'
import { getState, setState } from '../state/state'
import { clearErrors, recordError } from '../system/errorLog'
import { clearFrames, recordFrame } from '../net/frameBuffer'
import type { Gateway } from '../net/Gateway'

function gatewayReturning(result: { ok: boolean; data?: unknown; error?: string }) {
  const send = vi.fn(async () => ({ type: 'result', action: 'report_issue', requestId: '1', ...result }))
  return { send } as unknown as Gateway
}

function button(testId: string): HTMLButtonElement {
  return screen.getByTestId(testId) as HTMLButtonElement
}

function status(): HTMLElement {
  return screen.getByTestId('report-status')
}

beforeEach(() => {
  clearFrames()
  clearErrors()
  setState({ wsAlive: true, phase: 'game' })
})

afterEach(() => {
  cleanup()
  setGateway(null)
})

describe('ReportDialog', () => {
  it('offers no send when there is nothing to send to, but always offers the copy', () => {
    setState({ wsAlive: false })
    render(<ReportDialog onClose={() => {}} />)

    expect(button('report-send').disabled).toBe(true)
    expect(button('report-copy').disabled).toBe(false)
  })

  it('sends what the player typed, with the state that explains it', async () => {
    const gateway = gatewayReturning({ ok: true, data: { stored: true, id: 'a1b2c3d4' } })
    setGateway(gateway)
    recordError('app', 'TypeError: boom')
    recordFrame({ type: 'event', method: 'GAME_SELECT', messageId: 1, data: { message: 'Announce a target' } })

    render(<ReportDialog onClose={() => {}} />)
    fireEvent.change(screen.getByTestId('report-text'), { target: { value: 'I lost and still had priority' } })
    fireEvent.click(screen.getByTestId('report-send'))

    const calls = (gateway as unknown as { send: { mock: { calls: unknown[][] } } }).send.mock.calls
    expect(calls.length).toBe(1)
    const [action, args] = calls[0] as [string, Record<string, unknown>]
    expect(action).toBe('report_issue')
    expect(args.kind).toBe('bug')
    expect(args.text).toBe('I lost and still had priority')
    expect(String(args.fingerprint)).toContain('typeerror-boom')
    expect((args.errors as unknown[]).length).toBe(1)
    expect((args.bundle as { frames: unknown[] }).frames.length).toBe(1)
    await waitFor(() => expect(status().textContent).toContain('a1b2c3d4'))
  })

  it('sends only the summary when the player unchecks the game data', async () => {
    const gateway = gatewayReturning({ ok: true, data: { stored: true, id: 'x1' } })
    setGateway(gateway)
    recordError('app', 'TypeError: boom')
    render(<ReportDialog onClose={() => {}} />)

    fireEvent.click(screen.getByTestId('report-with-game'))
    fireEvent.click(screen.getByTestId('report-send'))

    await waitFor(() => expect(status().textContent).toContain('x1'))
    const args = (gateway as unknown as { send: { mock: { calls: unknown[][] } } }).send.mock.calls[0][1] as Record<string, unknown>
    expect(args.errors).toEqual([])
    const bundle = args.bundle as { log: unknown[]; frames: unknown[] }
    expect(bundle.log).toEqual([])
    expect(bundle.frames).toEqual([])
    expect(getState().log.some((l) => l.text.includes('report sent'))).toBe(true)
  })

  it('names the reason when the proxy kept the report out, instead of failing at the player', async () => {
    setGateway(gatewayReturning({ ok: true, data: { stored: false, reason: 'quota' } }))
    render(<ReportDialog onClose={() => {}} />)

    fireEvent.click(screen.getByTestId('report-send'))

    await waitFor(() => expect(status().textContent).toContain('quota'))
  })

  it('shows the transport error when there was no channel at all', async () => {
    setGateway(gatewayReturning({ ok: false, error: 'not connected' }))
    render(<ReportDialog onClose={() => {}} />)

    fireEvent.click(screen.getByTestId('report-send'))

    await waitFor(() => expect(status().textContent).toContain('not connected'))
  })

  it('puts the same report on the clipboard when there is nowhere to send it', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ReportDialog initialText="cards are unreadable" onClose={() => {}} />)

    fireEvent.click(screen.getByTestId('report-copy'))

    await waitFor(() => expect(writeText.mock.calls.length).toBe(1))
    const text = (writeText.mock.calls[0] as unknown as string[])[0]
    expect(text).toContain('cards are unreadable')
    expect(text).toContain('Fingerprint:')
    expect(screen.getByTestId('report-dump')).toBeTruthy()
  })

  it('keeps the two kinds apart, because a feeling is not a bug report', () => {
    render(<ReportDialog kind="feedback" onClose={() => {}} />)

    expect(screen.getByTestId('report-tab-feedback').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByTestId('report-tab-bug'))
    expect(screen.getByTestId('report-tab-bug').getAttribute('aria-selected')).toBe('true')
  })
})
