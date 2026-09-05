import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PassMenu from './PassMenu'
import { activeSkipOf, SKIPS, CANCEL_SKIP_ACTION } from './skips'
import { reset } from '../state/store'
import { setLanguage } from '../i18n'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

vi.mock('../net/commands', () => ({
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
  updatePreferences: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('skips', () => {
  it('defines 6 one-shot skips and no F6', () => {
    expect(SKIPS.map((s) => s.shortcut)).toEqual(['F4', 'F5', 'F7', 'F9', 'F10', 'F11'])
  })

  it('activeSkipOf reads the server passed* flags', () => {
    expect(activeSkipOf(null)).toBeNull()
    expect(activeSkipOf({})).toBeNull()
    expect(activeSkipOf({ passedAllTurns: true })?.key).toBe('myTurn')
    expect(activeSkipOf({ passedUntilStackResolved: true })?.key).toBe('stack')
  })
})

describe('PassMenu', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
    setLanguage('es')
  })

  function gameWith(meFlags: Record<string, boolean> = {}) {
    return makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, ...meFlags }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
      ],
    })
  }

  it('renders the 6 skips with their shortcuts', () => {
    const { container } = render(<PassMenu game={gameWith()} onSkip={() => {}} />)
    for (const key of ['turn', 'endStep', 'nextMain', 'myTurn', 'stack', 'beforeMine']) {
      expect(container.querySelector(`[data-testid="skip-${key}"]`)).not.toBeNull()
    }
    const keys = Array.from(container.querySelectorAll('.pass-menu-key')).map((k) => k.textContent)
    expect(keys).toEqual(expect.arrayContaining(['F4', 'F5', 'F7', 'F9', 'F10', 'F11']))
  })

  it('hides the cancel button without an active skip', () => {
    const { container } = render(<PassMenu game={gameWith()} onSkip={() => {}} />)
    expect(container.querySelector('[data-testid="skip-cancel"]')).toBeNull()
  })

  it('marks the active skip and offers cancel', () => {
    const onSkip = vi.fn()
    const { container } = render(<PassMenu game={gameWith({ passedAllTurns: true })} onSkip={onSkip} />)
    expect(container.querySelector('[data-testid="skip-myTurn"]')?.classList.contains('is-active')).toBe(true)
    const cancel = container.querySelector('[data-testid="skip-cancel"]')
    expect(cancel).not.toBeNull()
    fireEvent.click(cancel!)
    expect(onSkip).toHaveBeenCalledWith(CANCEL_SKIP_ACTION)
  })

  it('sends the skip action on click', () => {
    const onSkip = vi.fn()
    const { container } = render(<PassMenu game={gameWith()} onSkip={onSkip} />)
    fireEvent.click(container.querySelector('[data-testid="skip-stack"]')!)
    expect(onSkip).toHaveBeenCalledWith('PASS_PRIORITY_UNTIL_STACK_RESOLVED')
  })

  it('keeps hold-priority and auto-pass checks, with stops living only in the header bar', () => {
    const { container } = render(<PassMenu game={gameWith()} onSkip={() => {}} />)
    expect(container.querySelector('.hold-priority-toggle input')).not.toBeNull()
    expect(container.querySelectorAll('.phase-stop-btn').length).toBe(0)
  })
})
