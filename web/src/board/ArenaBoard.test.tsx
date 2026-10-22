import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ArenaBoard from './ArenaBoard'
import { setSeatFocus, setSetting } from '../state/store'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView } from '../net/types'

describe('ArenaBoard', () => {
  afterEach(() => cleanup())

  function makeCommander(id: string, name: string): CardView {
    return {
      id,
      name,
      manaValue: 3,
      expansionSetCode: 'TEST',
      cardNumber: '1',
      mageObjectType: 'COMMANDER',
    } as unknown as CardView
  }

  function multiplayerGame(overrides?: Partial<GameView>): GameView {
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
        makePlayer({ playerId: 'p2', name: 'Bob', life: 40, commandList: [makeCommander('cmd-bob', 'Urza')] }),
        makePlayer({ playerId: 'p3', name: 'Carol', life: 40, commandList: [makeCommander('cmd-carol', 'Edgar Markov')] }),
      ],
      activePlayerId: 'p1',
      activePlayerName: 'Alice',
      turn: 3,
      ...overrides,
    })
  }

  it('renders one compact opponent column per rival and my full-width zone below', () => {
    const game = multiplayerGame()
    const { container, getByTestId } = render(<ArenaBoard game={game} />)
    expect(getByTestId('arena-board')).not.toBeNull()
    const cells = container.querySelectorAll('.arena-opp-cell')
    expect(cells.length).toBe(2)
    // rivales compactos, orientados como zona superior (estado arriba,
    // criaturas pegadas al divisor — formato espejo correcto)
    const oppZones = container.querySelectorAll('.arena-opp-cell .board-zone')
    expect(oppZones.length).toBe(2)
    oppZones.forEach((z) => {
      expect(z.classList.contains('compact-pod')).toBe(true)
      expect(z.classList.contains('zone-top')).toBe(true)
      expect(z.classList.contains('opponent-zone')).toBe(true)
    })
    // mi zona: player-zone a ancho completo, sin compactar, fuera de celdas
    const myZone = container.querySelector('.arena-board > .player-zone')
    expect(myZone).not.toBeNull()
    expect(myZone!.classList.contains('compact-pod')).toBe(false)
    expect(myZone!.classList.contains('mirrored')).toBe(false)
  })

  it('caps the opponent row at 3 rivals (Commander de 4 jugadores)', () => {
    const game = multiplayerGame({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', commandList: [] }),
        makePlayer({ playerId: 'p5', name: 'Eve', commandList: [] }),
      ],
    })
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell').length).toBe(3)
  })

  it('renders my hand in the overlay hand-bar (not in my zone)', () => {
    const game = multiplayerGame({
      myPlayerId: 'p1',
      myHand: {
        'h-1': makeCard({ id: 'h-1', name: 'Lightning Bolt', parentId: 'h-1' }),
        'h-2': makeCard({ id: 'h-2', name: 'Counterspell', parentId: 'h-2' }),
      },
    })
    const { container, getByTestId } = render(<ArenaBoard game={game} />)
    const bar = getByTestId('hand-bar')
    expect(bar.querySelectorAll('.hand-card-slot').length).toBe(2)
    expect(bar.parentElement?.classList.contains('arena-board')).toBe(true)
    expect(container.querySelector('.player-zone .hand-card-slot')).toBeNull()
  })

  it('keeps opponent mini-hands inside their columns', () => {
    setSetting('gameUi', 'v1')
    const game = multiplayerGame({
      myPlayerId: 'p1',
      opponentHands: {
        Bob: { 'oh-1': { id: 'oh-1' } },
        Carol: { 'oh-2': { id: 'oh-2' } },
      },
    })
    const bob = game.players![1] as unknown as Record<string, unknown>
    bob['handCount'] = 1
    const carol = game.players![2] as unknown as Record<string, unknown>
    carol['handCount'] = 1
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell .hand-card-slot').length).toBe(2)
    expect(container.querySelectorAll('.board-zone .hand-zone.compact').length).toBe(2)
    setSetting('gameUi', 'v2')
  })

  it('HND-9: v2: a visible hand is opened from its badge instead of a face-down stack', () => {
    setSetting('gameUi', 'v2')
    const game = multiplayerGame({
      myPlayerId: 'p1',
      opponentHands: { Bob: { 'oh-1': { id: 'oh-1' } } },
    })
    const bob = game.players![1] as unknown as Record<string, unknown>
    bob['handCount'] = 2
    const { container, getAllByTestId } = render(<ArenaBoard game={game} />)
    expect(container.querySelector('.arena-opp-cell [data-testid="opp-hand-stack"]')).toBeNull()
    const badge = getAllByTestId('pp-hand-count').find((el) => el.classList.contains('is-viewable'))
    expect(badge?.textContent).toContain('1/2')
    fireEvent.click(badge as Element)
    expect(container.ownerDocument.querySelector('[data-testid="hand-viewer"]')).not.toBeNull()
  })

  it('spectator: rivales arriba (hasta 3) y un jugador abajo, como los otros modos', () => {
    const game = makeGameView({
      activePlayerId: 'p2',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', controlled: false, commandList: [] }),
      ],
    })
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell').length).toBe(3)
    const bottom = container.querySelector('.arena-board > .board-zone')
    expect(bottom).not.toBeNull()
    expect(container.querySelector('[data-testid="hand-bar"]')).toBeNull()
  })

  describe('seat focus', () => {
    beforeEach(() => {
      setSeatFocus(null)
      setSetting('effects', true)
    })

    function withBattlefield(game: GameView, playerId: string, cards: Record<string, CardView>): GameView {
      return {
        ...game,
        players: game.players!.map((p) => (p.playerId === playerId ? { ...p, battlefield: cards as unknown as typeof p.battlefield } : p)),
      }
    }

    function landOf(id: string): CardView {
      return makeCard({ id, name: 'Forest', parentId: id, cardTypes: ['Land'] } as Partial<CardView> & { name: string })
    }

    it('BRD-3: each live opponent status row has a focus button, and a lone opponent has none', () => {
      const { getByTestId, queryByTestId } = render(<ArenaBoard game={multiplayerGame()} />)
      expect(getByTestId('seat-focus-p2')).not.toBeNull()
      expect(getByTestId('seat-focus-p3')).not.toBeNull()
      expect(getByTestId('seat-focus-p2').getAttribute('aria-pressed')).toBe('false')
      expect(queryByTestId('seat-focus-all')).toBeNull()
      cleanup()
      const oneLeft = multiplayerGame({
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob', hasLeft: true, life: 0 }),
          makePlayer({ playerId: 'p3', name: 'Carol' }),
        ],
      })
      const { queryByTestId: queryOne } = render(<ArenaBoard game={oneLeft} />)
      expect(queryOne('seat-focus-p3')).toBeNull()
    })

    it('BRD-3: focusing a seat gives it the opponents row and shrinks the others to status strips', () => {
      const game = withBattlefield(multiplayerGame(), 'p2', { 'b-1': landOf('b-1') })
      const { container, getByTestId } = render(<ArenaBoard game={game} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      expect(getByTestId('seat-focus-p2').getAttribute('aria-pressed')).toBe('true')
      const focusedCell = container.querySelector('.arena-opp-cell.seat-focus-on')
      expect(focusedCell?.querySelector('[data-player-id="p2"]')).not.toBeNull()
      expect(focusedCell?.querySelector('[data-seat-mode="status"]')).toBeNull()
      const strip = container.querySelector('[data-seat-mode="status"][data-player-id="p3"]')
      expect(strip).not.toBeNull()
      expect(container.querySelector('.arena-opp-cell.seat-focus-shrunk [data-player-id="p3"]')).toBe(strip)
      expect(strip?.querySelector('.bz-band, .bz-permanents-row, .bz-creatures-row')).toBeNull()
      expect(strip?.querySelector('[data-testid="pp-stats"]')).not.toBeNull()
      expect(getByTestId('seat-focus-all')).not.toBeNull()
    })

    it('BRD-3: shrunk seats never show their hand or battlefield cards', () => {
      const game = withBattlefield(multiplayerGame(), 'p3', { 'b-9': landOf('b-9') })
      const withHidden = { ...game, opponentHands: { Carol: { 'oh-9': { id: 'oh-9', name: 'Secret', faceDown: true } } } } as GameView
      const { container, getByTestId } = render(<ArenaBoard game={withHidden} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      const strip = container.querySelector('[data-seat-mode="status"][data-player-id="p3"]')
      expect(strip?.querySelector('.hand-card-slot')).toBeNull()
      expect(strip?.querySelector('.card-slot')).toBeNull()
      expect(strip?.querySelector('.hand-zone')).toBeNull()
      expect(strip?.querySelector('[data-testid="pp-hand-count"]')).not.toBeNull()
    })

    it('BRD-3: the focused seat button and All boards restore equal columns', () => {
      const { container, getByTestId, queryByTestId } = render(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p3'))
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p2"]')).not.toBeNull()
      fireEvent.click(getByTestId('seat-focus-p3'))
      expect(container.querySelector('[data-seat-mode="status"]')).toBeNull()
      expect(container.querySelectorAll('.arena-opp-cell.seat-focus-on, .arena-opp-cell.seat-focus-shrunk').length).toBe(0)
      fireEvent.click(getByTestId('seat-focus-p2'))
      fireEvent.click(getByTestId('seat-focus-all'))
      expect(container.querySelector('[data-seat-mode="status"]')).toBeNull()
      expect(queryByTestId('seat-focus-all')).toBeNull()
    })

    it('BRD-3: focusing a shrunk seat moves the focus there', () => {
      const { container, getByTestId } = render(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      fireEvent.click(getByTestId('seat-focus-p3'))
      expect(getByTestId('seat-focus-p3').getAttribute('aria-pressed')).toBe('true')
      expect(container.querySelector('.arena-opp-cell.seat-focus-on [data-player-id="p3"]')).not.toBeNull()
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p2"]')).not.toBeNull()
    })

    it('BRD-3: a click on the portrait of a shrunk seat still targets the player and keeps the focus', () => {
      const targets: string[] = []
      const game = multiplayerGame({ activePlayerId: 'p1' })
      const { container, getByTestId } = render(
        <ArenaBoard game={game} targetIds={['p3']} onTargetClick={(id) => targets.push(id)} />,
      )
      fireEvent.click(getByTestId('seat-focus-p2'))
      const portrait = container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .player-avatar') as HTMLElement
      fireEvent.click(portrait)
      expect(targets).toEqual(['p3'])
      expect(getByTestId('seat-focus-p2').getAttribute('aria-pressed')).toBe('true')
    })

    it('BRD-4: a shrunk seat rings like a target zone when the prompt can target its battlefield', () => {
      const game = withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })
      const { container, getByTestId } = render(<ArenaBoard game={game} targetIds={['b-1']} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p3"]')?.classList.contains('target-zone')).toBe(true)
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p2"]')).toBeNull()
    })

    it('BRD-4: a shrunk seat is not ringed when the prompt targets nothing on it', () => {
      const game = withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })
      const { container, getByTestId } = render(<ArenaBoard game={game} targetIds={['b-other']} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p3"]')?.classList.contains('target-zone')).toBe(false)
    })

    it('BRD-4: a shrunk seat pulses once when a permanent enters its battlefield', () => {
      const { container, getByTestId, rerender } = render(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .seat-strip-pulse')).toBeNull()
      const entered = withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })
      rerender(<ArenaBoard game={entered} />)
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .seat-strip-pulse')).not.toBeNull()
    })

    it('BRD-4: a shrunk seat pulses when a permanent leaves its battlefield', () => {
      const before = withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })
      const { container, getByTestId, rerender } = render(<ArenaBoard game={before} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      rerender(<ArenaBoard game={multiplayerGame()} />)
      expect(container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .seat-strip-pulse')).not.toBeNull()
    })

    it('BRD-4: a change made while the seat was whole does not pulse it when it shrinks', () => {
      const before = withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })
      const { container, getByTestId, rerender } = render(<ArenaBoard game={before} />)
      rerender(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      expect(container.querySelector('.seat-strip-pulse')).toBeNull()
    })

    it('BRD-4: a click on the info bar of a targetable shrunk seat picks the target and keeps the focus', () => {
      const targets: string[] = []
      const { container, getByTestId } = render(
        <ArenaBoard game={multiplayerGame()} targetIds={['p3']} onTargetClick={(id) => targets.push(id)} />,
      )
      fireEvent.click(getByTestId('seat-focus-p2'))
      const name = container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .player-name') as HTMLElement
      fireEvent.click(name)
      expect(targets).toEqual(['p3'])
      expect(getByTestId('seat-focus-p2').getAttribute('aria-pressed')).toBe('true')
      expect(getByTestId('seat-focus-p3').getAttribute('aria-pressed')).toBe('false')
    })

    it('BRD-4: a click on the info bar of a shrunk seat that is not a target focuses it', () => {
      const { container, getByTestId } = render(<ArenaBoard game={multiplayerGame()} targetIds={[]} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      const name = container.querySelector('[data-seat-mode="status"][data-player-id="p3"] .player-name') as HTMLElement
      fireEvent.click(name)
      expect(getByTestId('seat-focus-p3').getAttribute('aria-pressed')).toBe('true')
    })

    it('BRD-4: the pulse is off with effects turned off', () => {
      setSetting('effects', false)
      const { container, getByTestId, rerender } = render(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      rerender(<ArenaBoard game={withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })} />)
      expect(container.querySelector('.seat-strip-pulse')).toBeNull()
      setSetting('effects', true)
    })

    it('BRD-4: the pulse is off under reduced motion', () => {
      const original = window.matchMedia
      window.matchMedia = ((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      try {
        const { container, getByTestId, rerender } = render(<ArenaBoard game={multiplayerGame()} />)
        fireEvent.click(getByTestId('seat-focus-p2'))
        rerender(<ArenaBoard game={withBattlefield(multiplayerGame(), 'p3', { 'b-1': landOf('b-1') })} />)
        expect(container.querySelector('.seat-strip-pulse')).toBeNull()
      } finally {
        window.matchMedia = original
      }
    })

    it('BRD-4: clicking a shrunk strip outside its portrait focuses that seat', () => {
      const { container, getByTestId } = render(<ArenaBoard game={multiplayerGame()} />)
      fireEvent.click(getByTestId('seat-focus-p2'))
      const strip = container.querySelector('[data-seat-mode="status"][data-player-id="p3"]') as HTMLElement
      fireEvent.click(strip)
      expect(getByTestId('seat-focus-p3').getAttribute('aria-pressed')).toBe('true')
    })
  })
})
