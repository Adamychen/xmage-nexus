// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BoardZone from './BoardZone'
import { commanderInfoRule, makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { setSetting, setState } from '../state/store'
import type { CardView, PlayerView } from '../net/types'

const atraxa = (): CardView =>
  makeCard({
    id: 'cmd-atraxa',
    name: "Atraxa, Praetors' Voice",
    mageObjectType: 'COMMANDER',
    manaCostLeftStr: ['{G}', '{W}', '{U}', '{B}'],
    cardTypes: ['CREATURE'],
    rules: [commanderInfoRule(1)],
  })

const emblem = (): CardView => ({ id: 'emb-1', name: 'Emblem Teferi', displayName: 'Emblem - Teferi', mageObjectType: 'EMBLEM', manaValue: 0 }) as CardView

function own(over: Partial<PlayerView> = {}): PlayerView {
  return makePlayer({
    playerId: 'p1',
    name: 'Dario',
    controlled: true,
    life: 31,
    libraryCount: 71,
    graveyard: { 'g-1': makeCard({ id: 'g-1', name: 'Ponder' }) },
    ...over,
  })
}

function renderOwn(player: PlayerView, extra: Record<string, unknown> = {}) {
  setState({ game: makeGameView({ players: [player], myPlayerId: player.playerId }) as never })
  return render(<BoardZone player={player} position="bottom" isControlled kindColumns arenaOwn {...extra} />)
}

describe('BoardZone on the own Arena board', () => {
  beforeEach(() => setSetting('gameUi', 'v1'))
  afterEach(() => {
    setSetting('gameUi', 'v2')
    setState({ game: null, gameId: null })
    cleanup()
  })

  it('BRD-32: the chip has no frame and the piles sit in the bottom row with their captions', () => {
    const { container } = renderOwn(own())
    expect(container.querySelector('.board-zone.arena-own')).not.toBeNull()
    expect(container.querySelector('[data-testid="arena-own-chip"] .player-info-bar.is-bare')).not.toBeNull()
    const row = container.querySelector('[data-testid="arena-own-row"]')!
    const captions = Array.from(row.querySelectorAll('[data-testid="pile-caption"]')).map((el) => el.textContent?.replace(/\s+/g, ' ').trim())
    expect(captions).toHaveLength(3)
    expect(captions[0]).toMatch(/71$/)
    expect(captions[1]).toMatch(/1$/)
    expect(captions[2]).toMatch(/0$/)
    expect(container.querySelector('.library-chip, .graveyard-chip, .exile-chip')).toBeNull()
  })

  it('BRD-32: the floating mana sits in the bottom row, not on the chip', () => {
    const { container } = renderOwn(own({ manaPool: { red: 0, green: 2, blue: 1, white: 0, black: 0, colorless: 0 } }))
    const pool = container.querySelector('[data-testid="arena-own-pool"] .mana-inline')!
    expect(pool).not.toBeNull()
    expect(pool.classList.contains('is-empty')).toBe(false)
    expect(container.querySelector('[data-testid="arena-own-chip"] .mana-inline')).toBeNull()
  })

  it('BRD-32: the chip keeps its counters in a column beside the life and the clock on its own line', () => {
    const { container } = renderOwn(own({ timerActive: true, priorityTimeLeftSecs: 600, counters: [{ name: 'poison', count: 4 }] }))
    const chip = container.querySelector('[data-testid="arena-own-chip"] .player-info-bar')!
    expect(chip.querySelector(':scope > [data-testid="bare-counters"] [data-counter="poison"]')).not.toBeNull()
    expect(chip.querySelector('.player-counters [data-counter="poison"]')).toBeNull()
    expect(chip.querySelector(':scope > [data-testid="bare-timer"] .player-timer-badge')).not.toBeNull()
    expect(chip.querySelector('.player-counters .player-timer-badge')).toBeNull()
  })

  it('BRD-32: without the Arena own flag the board keeps its status row', () => {
    const player = own()
    setState({ game: makeGameView({ players: [player] }) as never })
    const { container } = render(<BoardZone player={player} position="bottom" isControlled kindColumns />)
    expect(container.querySelector('[data-testid="arena-own-row"]')).toBeNull()
    expect(container.querySelector('.player-info-bar.is-bare')).toBeNull()
  })

  it('BRD-36: an Arena opponent column shows its piles with captions instead of chips', () => {
    const opp = makePlayer({ playerId: 'p2', name: 'Kiko', libraryCount: 64, graveyard: { 'g-9': makeCard({ id: 'g-9', name: 'Shock' }) } })
    setState({ game: makeGameView({ players: [opp] }) as never })
    const { container } = render(<BoardZone player={opp} position="top" isControlled={false} kindColumns compactPod bareChip />)
    const piles = container.querySelector('[data-testid="arena-opp-piles"]')!
    expect(piles).not.toBeNull()
    expect(piles.querySelectorAll('[data-testid="pile-caption"]')).toHaveLength(3)
    expect(piles.querySelector('[data-testid="pile-card-library"]')?.getAttribute('data-count')).toBe('64')
    expect(container.querySelector('.library-chip, .graveyard-chip, .exile-chip')).toBeNull()
  })

  it('BRD-40: an Arena opponent draws its uncast commander beside its hand, not in the creatures row', () => {
    const opp = makePlayer({ playerId: 'p2', name: 'Kiko', libraryCount: 64, commandList: [atraxa()] })
    setState({ game: makeGameView({ players: [opp] }) as never })
    const { container } = render(<BoardZone player={opp} position="top" isControlled={false} kindColumns compactPod bareChip />)
    const beside = container.querySelector('.bz-status-row [data-testid="arena-opp-commander"]')!
    expect(beside).not.toBeNull()
    expect(beside.querySelector('[data-card-id="cmd-atraxa"]')).not.toBeNull()
    expect(container.querySelector('.bz-commander')).toBeNull()
  })

  it('BRD-36: without the Arena flag an opponent keeps its chips', () => {
    const opp = makePlayer({ playerId: 'p2', name: 'Kiko', libraryCount: 64 })
    setState({ game: makeGameView({ players: [opp] }) as never })
    const { container } = render(<BoardZone player={opp} position="top" isControlled={false} kindColumns compactPod />)
    expect(container.querySelector('[data-testid="arena-opp-piles"]')).toBeNull()
    expect(container.querySelector('.library-chip')).not.toBeNull()
  })

  it('BRD-39: an opponent board in the Arena frame gets the frameless chip, the piles row and its hand as a fan', () => {
    const backs = Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`b-${i}`, makeCard({ id: `b-${i}`, name: '', faceDown: true })]))
    const opp = makePlayer({ playerId: 'p2', name: 'Marta', libraryCount: 69 })
    setState({ game: makeGameView({ players: [opp], opponentHands: { Marta: backs } as never }) as never })
    const { container } = render(<BoardZone player={opp} position="bottom" isControlled={false} kindColumns arenaOwn stackHand mirrored pileCards />)
    expect(container.querySelector('[data-testid="arena-own-chip"] .player-info-bar.is-bare')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="arena-own-row"] [data-testid="pile-caption"]')).toHaveLength(3)
    expect(container.querySelector('[data-testid="pile-corner"]')).toBeNull()
  })

  it('BRD-32: an opponent chip on the Arena layout has no frame', () => {
    const opp = makePlayer({ playerId: 'p2', name: 'Kiko' })
    setState({ game: makeGameView({ players: [opp] }) as never })
    const { container } = render(<BoardZone player={opp} position="top" isControlled={false} kindColumns compactPod bareChip />)
    expect(container.querySelector('.player-info-bar.is-bare')).not.toBeNull()
  })

  it('BRD-34: the uncast commander leaves the board for the hand, emblems stay in the bottom row', () => {
    const { container } = renderOwn(own({ commandList: [atraxa(), emblem()] }))
    const zone = container.querySelector('[data-testid="arena-own-commander"]')!
    expect(zone).not.toBeNull()
    expect(zone.querySelector('[data-card-id="cmd-atraxa"]')).toBeNull()
    expect(container.querySelector('.bz-commander [data-card-id="cmd-atraxa"]')).toBeNull()
  })

  it('BRD-34: with the hand as a row the commander stays on the board', () => {
    setSetting('handRow', true)
    try {
      const { container } = renderOwn(own({ commandList: [atraxa()] }))
      expect(container.querySelector('[data-testid="arena-own-commander"] [data-card-id="cmd-atraxa"]')).not.toBeNull()
    } finally {
      setSetting('handRow', false)
    }
  })
})
