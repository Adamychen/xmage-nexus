import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PodBoard from './PodBoard'
import TurnOrderRing from './TurnOrderRing'
import CommanderDamageMatrix, { COMMANDER_LETHAL } from '../game/CommanderDamageMatrix'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView } from '../net/types'

describe('PodBoard', () => {
  afterEach(() => cleanup())

  function makeCommander(id: string, name: string, castCount = 0): CardView {
    return {
      id,
      name,
      manaValue: 3,
      expansionSetCode: 'TEST',
      cardNumber: '1',
      mageObjectType: 'COMMANDER',
      castCount,
    } as unknown as CardView
  }

  function fourPlayerGame(overrides?: Partial<GameView>): GameView {
    return makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          controlled: true,
          isActive: true,
          hasPriority: true,
          life: 40,
          commandList: [makeCommander('cmd-alice', 'Atraxa, Praetors Voice')],
        }),
        makePlayer({
          playerId: 'p2',
          name: 'Bob',
          life: 40,
          commandList: [makeCommander('cmd-bob', 'Urza, Lord High Artificer')],
        }),
        makePlayer({
          playerId: 'p3',
          name: 'Carol',
          life: 40,
          commandList: [makeCommander('cmd-carol', 'Edgar Markov')],
        }),
        makePlayer({
          playerId: 'p4',
          name: 'Dave',
          life: 40,
          commandList: [makeCommander('cmd-dave', 'Krenko, Mob Boss')],
        }),
      ],
      activePlayerId: 'p1',
      activePlayerName: 'Alice',
      turn: 5,
      ...overrides,
    })
  }

  it('renders 4-player pod with all zones and CommandZones', () => {
    const game = fourPlayerGame()
    const { container, getByTestId } = render(<PodBoard game={game} />)
    expect(getByTestId('pod-board')).not.toBeNull()
    expect(getByTestId('pod-board-main')).not.toBeNull()
    const podCells = container.querySelectorAll('.pod-cell')
    expect(podCells.length).toBe(4)
    const boardZones = container.querySelectorAll('.board-zone')
    expect(boardZones.length).toBe(4)
    const commanderZones = container.querySelectorAll('.command-zone')
    expect(commanderZones.length).toBe(4)
  })

  it('renders TurnOrderRing with 4 seats and highlights active', () => {
    const game = fourPlayerGame({ activePlayerId: 'p3' })
    const { getByTestId, container } = render(<PodBoard game={game} />)
    const ring = getByTestId('turn-order-ring')
    expect(ring).not.toBeNull()
    expect(ring.classList.contains('count-4')).toBe(true)
    const activeSeat = getByTestId('tor-seat-p3')
    expect(activeSeat.classList.contains('is-active')).toBe(true)
    expect(activeSeat.getAttribute('data-active')).toBe('true')
    const inactiveSeat = getByTestId('tor-seat-p1')
    expect(inactiveSeat.classList.contains('is-active')).toBe(false)
    const seats = container.querySelectorAll('.tor-seat')
    expect(seats.length).toBe(4)
  })

  it('TurnOrderRing shows progression around the pod', () => {
    const game = fourPlayerGame({ activePlayerId: 'p2' })
    const { getByTestId } = render(<PodBoard game={game} />)
    const arrow = getByTestId('tor-arrow-p2-p3')
    expect(arrow.classList.contains('is-active-edge')).toBe(true)
    const nonActiveArrow = getByTestId('tor-arrow-p1-p2')
    expect(nonActiveArrow.classList.contains('is-active-edge')).toBe(false)
  })

  it('renders CommanderDamageMatrix overlay when commanders exist', () => {
    const game = fourPlayerGame()
    const { getByTestId } = render(<PodBoard game={game} />)
    const matrix = getByTestId('commander-damage-matrix')
    expect(matrix).not.toBeNull()
    const table = getByTestId('cdm-table')
    expect(table).not.toBeNull()
    const headerCells = table.querySelectorAll('.cdm-commander-head')
    expect(headerCells.length).toBe(4)
    const rows = table.querySelectorAll('tbody tr')
    expect(rows.length).toBe(4)
  })

  it('CommanderDamageMatrix parses injected commanderDamage and highlights lethal 21', () => {
    const game = makeGameView({
      activePlayerId: 'p1',
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          controlled: true,
          commandList: [makeCommander('cmd-alice', 'Atraxa')],
        }),
        makePlayer({
          playerId: 'p2',
          name: 'Bob',
          commandList: [makeCommander('cmd-bob', 'Urza')],
        } as any),
        makePlayer({
          playerId: 'p3',
          name: 'Carol',
          commandList: [makeCommander('cmd-carol', 'Edgar')],
        } as any),
        makePlayer({
          playerId: 'p4',
          name: 'Dave',
          commandList: [makeCommander('cmd-dave', 'Krenko')],
        } as any),
      ],
    })
    // Inject synthetic commanderDamage on Bob: damage from Alice's commander = 21 lethal, from Carol = 14
    const bob = game.players![1] as unknown as Record<string, unknown>
    bob['commanderDamage'] = { 'cmd-alice': 21, 'cmd-carol': 14, 'cmd-dave': 5 }
    const alice = game.players![0] as unknown as Record<string, unknown>
    alice['commanderDamage'] = { 'cmd-bob': 3 }
    const { getByTestId } = render(<CommanderDamageMatrix game={game} />)
    const lethalCell = getByTestId('cdm-cell-p2-cmd-alice')
    expect(lethalCell.textContent?.trim()).toBe('21')
    expect(lethalCell.classList.contains('is-lethal')).toBe(true)
    expect(lethalCell.getAttribute('data-lethal')).toBe('true')
    const warningCell = getByTestId('cdm-cell-p2-cmd-carol')
    expect(warningCell.textContent?.trim()).toBe('14')
    expect(warningCell.classList.contains('is-warning')).toBe(false)
    const highWarning = 16
    bob['commanderDamage'] = { 'cmd-carol': highWarning }
    cleanup()
    const { getByTestId: get2 } = render(<CommanderDamageMatrix game={game} />)
    const warnCell = get2('cdm-cell-p2-cmd-carol')
    expect(warnCell.classList.contains('is-warning')).toBe(true)
    expect(COMMANDER_LETHAL).toBe(21)
  })

  it('parses commander damage from card rules string fallback', () => {
    const atraxaWithRule = {
      id: 'cmd-alice',
      name: 'Atraxa, Praetors Voice',
      manaValue: 4,
      expansionSetCode: 'TEST',
      cardNumber: '1',
      mageObjectType: 'COMMANDER',
      rules: ['<b>Commander</b> did 7 combat damage to player Bob.'],
    } as unknown as CardView
    const game = makeGameView({
      activePlayerId: 'p1',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [atraxaWithRule] }),
        makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', commandList: [] }),
      ],
    })
    const { getByTestId } = render(<CommanderDamageMatrix game={game} />)
    const cell = getByTestId('cdm-cell-p2-cmd-alice')
    expect(cell.textContent?.trim()).toBe('7')
  })

  it('shows — for own commander (self damage not counted)', () => {
    const game = fourPlayerGame()
    const { getByTestId } = render(<CommanderDamageMatrix game={game} />)
    const selfCell = getByTestId('cdm-cell-p1-cmd-alice')
    expect(selfCell.textContent?.trim()).toBe('—')
    expect(selfCell.classList.contains('is-self')).toBe(true)
  })

  it('handles spectator mode with 4 players (no controlled)', () => {
    const game = makeGameView({
      activePlayerId: 'p2',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: false, commandList: [makeCommander('cmd-a', 'A')] }),
        makePlayer({ playerId: 'p2', name: 'Bob', controlled: false, commandList: [makeCommander('cmd-b', 'B')] }),
        makePlayer({ playerId: 'p3', name: 'Carol', controlled: false, commandList: [makeCommander('cmd-c', 'C')] }),
        makePlayer({ playerId: 'p4', name: 'Dave', controlled: false, commandList: [makeCommander('cmd-d', 'D')] }),
      ],
    })
    const { container, getByTestId } = render(<PodBoard game={game} />)
    expect(getByTestId('pod-board').classList.contains('is-spectator')).toBe(true)
    const zones = container.querySelectorAll('.board-zone')
    expect(zones.length).toBe(4)
    const seats = getByTestId('turn-order-ring').querySelectorAll('.tor-seat')
    expect(seats.length).toBe(4)
    const active = getByTestId('tor-seat-p2')
    expect(active.classList.contains('is-active')).toBe(true)
  })

  it('clamps to max 4 players (XMage hard limit)', () => {
    const game = makeGameView({
      activePlayerId: 'p1',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', commandList: [] }),
        makePlayer({ playerId: 'p5', name: 'Eve', commandList: [] }),
      ],
    })
    const { container, getByTestId } = render(<PodBoard game={game} />)
    const seats = getByTestId('turn-order-ring').querySelectorAll('.tor-seat')
    expect(seats.length).toBe(4)
    const podCells = container.querySelectorAll('.pod-cell')
    expect(podCells.length).toBe(4)
  })

  it('renders gracefully with no commanders (empty matrix)', () => {
    const game = makeGameView({
      activePlayerId: 'p1',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
      ],
    })
    const { getByTestId, container } = render(<PodBoard game={game} />)
    expect(getByTestId('pod-board')).not.toBeNull()
    const emptyMatrix = container.querySelector('.commander-damage-matrix.is-empty')
    expect(emptyMatrix).toBeNull()
    const direct = render(<CommanderDamageMatrix game={game} />)
    expect(direct.getByTestId('commander-damage-matrix').classList.contains('is-empty')).toBe(true)
  })

  it('TurnOrderRing standalone handles 3 players circular layout', () => {
    const players = [
      makePlayer({ playerId: 'p1', name: 'Alice', commandList: [] }),
      makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
      makePlayer({ playerId: 'p3', name: 'Carol', commandList: [] }),
    ]
    const { getByTestId, container } = render(<TurnOrderRing players={players} activePlayerId="p2" />)
    const ring = getByTestId('turn-order-ring')
    expect(ring.classList.contains('count-3')).toBe(true)
    expect(container.querySelectorAll('.tor-seat').length).toBe(3)
    expect(getByTestId('tor-seat-p2').classList.contains('is-active')).toBe(true)
  })

  it('does not render ring when no players', () => {
    const { container } = render(<TurnOrderRing players={[]} activePlayerId="" />)
    expect(container.firstChild).toBeNull()
  })
})
