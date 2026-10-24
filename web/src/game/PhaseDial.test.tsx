import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhaseDial, { DIAL_CORE } from './PhaseDial'
import ActionButton from './ActionButton'
import { DIAL_PHASES } from './phaseSteps'
import { setState } from '../state/state'
import { setLanguage } from '../i18n'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

const dialCss = readFileSync(join(process.cwd(), 'src/game/PhaseDial.css'), 'utf8')

const updatePreferences = vi.fn().mockResolvedValue({ ok: true })
vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  updatePreferences: (...args: unknown[]) => updatePreferences(...args),
}))

describe('PhaseDial', () => {
  beforeEach(() => {
    updatePreferences.mockClear()
    setState({ phaseStops: { yourTurn: { main1: true }, opponentTurn: {} } })
  })
  afterEach(cleanup)

  it('renders one pip per phase, marks the current one and keeps the action in the core', () => {
    const { getByTestId, container } = render(<PhaseDial step="PRECOMBAT_MAIN" action={<button type="button" data-testid="core-action">Pass</button>} />)
    expect(container.querySelectorAll('.phase-dial-pip')).toHaveLength(DIAL_PHASES.length)
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').getAttribute('data-active')).toBe('true')
    expect(getByTestId('phase-bar-step-DRAW').className).toContain('past')
    expect(getByTestId('phase-bar-step-END_TURN').className).not.toContain('past')
    expect(container.querySelector('.phase-dial-core [data-testid="core-action"]')).not.toBeNull()
  })

  it('shows your stops and toggles them from a pip', () => {
    const { getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').querySelector('.stop-dot-you')).not.toBeNull()
    expect(getByTestId('phase-bar-step-DRAW').querySelector('.stop-dot-you')).toBeNull()
    fireEvent.click(getByTestId('phase-bar-step-DRAW'))
    expect(updatePreferences).toHaveBeenCalledWith({ yourTurn: { main1: true, draw: true }, opponentTurn: { draw: false } })
  })

  it('keeps the combat pip active through every combat step and toggles both combat stops', () => {
    const { getByTestId } = render(<PhaseDial step="COMBAT_DAMAGE" action={null} />)
    expect(getByTestId('phase-bar-step-COMBAT').getAttribute('data-active')).toBe('true')
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').className).toContain('past')
    fireEvent.click(getByTestId('phase-bar-step-COMBAT'))
    expect(updatePreferences).toHaveBeenCalledWith({
      yourTurn: { main1: true, beginCombat: true, endCombat: true },
      opponentTurn: { beginCombat: false, endCombat: false },
    })
  })

  it('toggles the opponent turn stop with the context menu', () => {
    const { getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    fireEvent.contextMenu(getByTestId('phase-bar-step-END_TURN'))
    expect(updatePreferences).toHaveBeenCalledWith({ yourTurn: { main1: true }, opponentTurn: { endStep: true } })
  })

  it('flags the dial while you hold priority', () => {
    const { getByTestId, rerender } = render(<PhaseDial step="UPKEEP" action={null} />)
    expect(getByTestId('phase-dial').className).not.toContain('is-mine')
    rerender(<PhaseDial step="UPKEEP" action={null} mine />)
    expect(getByTestId('phase-dial').className).toContain('is-mine')
  })

  it('BRD-14: the centre wraps only between words and cuts a name that does not fit with an ellipsis', () => {
    expect(dialCss).not.toMatch(/overflow-wrap:\s*(anywhere|break-word)/)
    expect(dialCss).not.toMatch(/word-break:\s*break-(all|word)/)
    const nameRule = /\.action-btn-name\s*\{([^}]*)\}/.exec(dialCss)?.[1] ?? ''
    expect(nameRule).toMatch(/text-overflow:\s*ellipsis/)
    expect(nameRule).toMatch(/white-space:\s*nowrap/)
    expect(nameRule).toMatch(/overflow:\s*hidden/)
  })

  it('BRD-14: the waiting label keeps the name in its own span and the whole text in the tooltip', () => {
    setLanguage('en')
    const name = 'BlackMagicWxyz'
    const game = makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, hasPriority: false }),
        makePlayer({ playerId: 'p2', name, hasPriority: true, priorityTimeLeftSecs: 433 }),
      ],
      activePlayerName: name,
      priorityPlayerName: name,
    })
    const { container, getByTestId } = render(
      <PhaseDial step="PRECOMBAT_MAIN" action={<ActionButton game={game} feedback={null} gameId="g" canPass={false} onPass={vi.fn()} onSkip={vi.fn()} variant="dial" />} />,
    )
    const btn = container.querySelector<HTMLButtonElement>('.action-button-container--dial .big-action-btn')!
    expect(getByTestId('action-btn-name').textContent).toBe(name)
    expect(btn.querySelector('.action-btn-label')!.textContent!.trim()).toBe(`Waiting for ${name}`)
    expect(btn.title).toBe(`Waiting for ${name}`)
    expect(getByTestId('waiting-clock').textContent).toContain('07:13 left')
  })

  it('BRD-14: the pips move out with the bigger centre and keep clear of it', () => {
    const { getByTestId, container } = render(<PhaseDial step="UPKEEP" action={null} />)
    const style = getByTestId('phase-dial').style
    const px = (name: string) => parseFloat(style.getPropertyValue(name))
    expect(px('--dial-core')).toBe(DIAL_CORE)
    const cx = px('--dial-cx')
    const cy = px('--dial-cy')
    const pips = [...container.querySelectorAll<HTMLElement>('.phase-dial-pip')].map((p) => ({ x: parseFloat(p.style.left), y: parseFloat(p.style.top) }))
    for (const p of pips) expect(Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThan(DIAL_CORE / 2 + 5 + 19)
    for (const p of pips) {
      expect(p.x - 23).toBeGreaterThanOrEqual(0)
      expect(p.x + 23).toBeLessThanOrEqual(px('--dial-w'))
      expect(p.y - 23).toBeGreaterThanOrEqual(0)
    }
  })
})
