import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhaseDial, { DIAL_CORE, dialPipPoint, dialSatPoint } from './PhaseDial'
import ActionButton from './ActionButton'
import { DIAL_COMBAT_STEPS, DIAL_PHASES } from './phaseSteps'
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

  it('BRD-22: the five combat circles sit beside the combat pip in order, each named in full', () => {
    setLanguage('en')
    const { container, getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    const sats = [...container.querySelectorAll<HTMLElement>('.phase-dial-sat')]
    expect(sats.map((el) => el.getAttribute('data-testid'))).toEqual(DIAL_COMBAT_STEPS.map((s) => `phase-dial-sat-${s.key}`))
    expect(sats.map((el) => el.getAttribute('aria-label'))).toEqual(['Begin Combat', 'Attackers', 'Blockers', 'Combat Damage', 'End Combat'])
    expect(getByTestId('phase-dial-sat-DECLARE_ATTACKERS').title).toBe('Attackers')
    expect(getByTestId('phase-dial-sat-COMBAT_DAMAGE').title).toBe('Combat Damage')
    expect(getByTestId('phase-dial-sat-BEGIN_COMBAT').title).toContain('Begin Combat')
  })

  it('BRD-22: each combat circle carries its short mark', () => {
    const { container } = render(<PhaseDial step="UPKEEP" action={null} />)
    const marks = [...container.querySelectorAll('.phase-dial-sat')].map((el) => el.querySelector('.phase-dial-sat-label')!.textContent)
    expect(marks).toEqual(['BC', 'AT', 'BL', 'DM', 'EC'])
  })

  it('BRD-22: during combat the phase name also names the step, outside combat it stays the phase name', () => {
    setLanguage('en')
    const combat = render(<PhaseDial step="DECLARE_BLOCKERS" action={null} />)
    expect(combat.getByTestId('phase-dial-name').textContent).toBe('Combat · Blockers')
    combat.unmount()
    const damage = render(<PhaseDial step="FIRST_COMBAT_DAMAGE" action={null} />)
    expect(damage.getByTestId('phase-dial-name').textContent).toBe('Combat · Combat Damage')
    damage.unmount()
    const main = render(<PhaseDial step="PRECOMBAT_MAIN" action={null} />)
    expect(main.getByTestId('phase-dial-name').textContent).toBe('Main Phase 1')
  })

  it('BRD-22: the beginning and end of combat circles toggle their stops, the other three are not buttons', () => {
    const { getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    for (const key of ['DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'COMBAT_DAMAGE']) {
      const el = getByTestId(`phase-dial-sat-${key}`)
      expect(el.tagName).toBe('SPAN')
      expect(el.getAttribute('role')).toBe('img')
    }
    fireEvent.click(getByTestId('phase-dial-sat-BEGIN_COMBAT'))
    expect(updatePreferences).toHaveBeenLastCalledWith({ yourTurn: { main1: true, beginCombat: true }, opponentTurn: { beginCombat: false } })
    fireEvent.contextMenu(getByTestId('phase-dial-sat-END_COMBAT'))
    expect(updatePreferences).toHaveBeenLastCalledWith({
      yourTurn: { main1: true, beginCombat: true },
      opponentTurn: { beginCombat: false, endCombat: true },
    })
  })

  it('BRD-22: during declare blockers the blockers circle is lit, the earlier combat steps are dimmed and the combat pip stays lit', () => {
    const { container, getByTestId } = render(<PhaseDial step="DECLARE_BLOCKERS" action={null} />)
    expect(satStates(container)).toEqual({ BEGIN_COMBAT: 'past', DECLARE_ATTACKERS: 'past', DECLARE_BLOCKERS: 'active', COMBAT_DAMAGE: 'none', END_COMBAT: 'none' })
    expect(getByTestId('phase-dial-sat-DECLARE_BLOCKERS').getAttribute('aria-current')).toBe('step')
    expect(getByTestId('phase-bar-step-COMBAT').getAttribute('data-active')).toBe('true')
  })

  it('BRD-22: the first strike and regular damage steps both light the combat damage circle', () => {
    const first = render(<PhaseDial step="FIRST_COMBAT_DAMAGE" action={null} />)
    expect(satStates(first.container)).toEqual({ BEGIN_COMBAT: 'past', DECLARE_ATTACKERS: 'past', DECLARE_BLOCKERS: 'past', COMBAT_DAMAGE: 'active', END_COMBAT: 'none' })
    first.unmount()
    const regular = render(<PhaseDial step="COMBAT_DAMAGE" action={null} />)
    expect(satStates(regular.container)).toEqual({ BEGIN_COMBAT: 'past', DECLARE_ATTACKERS: 'past', DECLARE_BLOCKERS: 'past', COMBAT_DAMAGE: 'active', END_COMBAT: 'none' })
  })

  it('BRD-22: outside combat no circle is lit or dimmed, and after combat all five are dimmed', () => {
    const before = render(<PhaseDial step="PRECOMBAT_MAIN" action={null} />)
    expect(Object.values(satStates(before.container))).toEqual(['none', 'none', 'none', 'none', 'none'])
    before.unmount()
    const after = render(<PhaseDial step="POSTCOMBAT_MAIN" action={null} />)
    expect(Object.values(satStates(after.container))).toEqual(['past', 'past', 'past', 'past', 'past'])
  })

  it('BRD-22: the combat circles never overlap each other, a pip or the centre, and stay inside the dial box', () => {
    const { getByTestId } = render(<PhaseDial step="DECLARE_BLOCKERS" action={null} />)
    const style = getByTestId('phase-dial').style
    const px = (name: string) => parseFloat(style.getPropertyValue(name))
    const cx = px('--dial-cx')
    const cy = px('--dial-cy')
    const sats = DIAL_COMBAT_STEPS.map((_, i) => dialSatPoint(i))
    const pips = DIAL_PHASES.map((_, i) => dialPipPoint(i, DIAL_PHASES.length))
    const satRadius = 13
    for (const [i, s] of sats.entries()) {
      expect(Math.hypot(s.x - cx, s.y - cy), `${DIAL_COMBAT_STEPS[i].key} clears the centre`).toBeGreaterThan(DIAL_CORE / 2 + 5 + satRadius + 4)
      expect(s.x - satRadius, `${DIAL_COMBAT_STEPS[i].key} inside the left edge`).toBeGreaterThanOrEqual(0)
      expect(s.x + satRadius, `${DIAL_COMBAT_STEPS[i].key} inside the right edge`).toBeLessThanOrEqual(px('--dial-w'))
      expect(s.y - satRadius, `${DIAL_COMBAT_STEPS[i].key} inside the top edge`).toBeGreaterThanOrEqual(0)
      expect(s.y + satRadius, `${DIAL_COMBAT_STEPS[i].key} inside the bottom edge`).toBeLessThanOrEqual(px('--dial-h'))
      for (const p of pips) expect(Math.hypot(s.x - p.x, s.y - p.y), `${DIAL_COMBAT_STEPS[i].key} clears every pip`).toBeGreaterThanOrEqual(satRadius + 19 + 4)
      for (const [j, o] of sats.entries()) {
        if (j > i) expect(Math.hypot(s.x - o.x, s.y - o.y), `${DIAL_COMBAT_STEPS[i].key} clears ${DIAL_COMBAT_STEPS[j].key}`).toBeGreaterThanOrEqual(2 * satRadius + 4)
      }
    }
  })
})

function satStates(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    DIAL_COMBAT_STEPS.map((s) => {
      const el = container.querySelector(`[data-testid="phase-dial-sat-${s.key}"]`)!
      return [s.key, el.classList.contains('active') ? 'active' : el.classList.contains('past') ? 'past' : 'none']
    }),
  )
}
