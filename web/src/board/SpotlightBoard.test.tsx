import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SpotlightBoard from './SpotlightBoard'
import { pileCornerLift, pileCornerReaches } from './pileCorner'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { getState, setSetting } from '../state/store'
import { setState } from '../state/state'
import { outReasonKey, type OutReason } from './outReason'

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function fourPlayerGame(overrides?: Partial<GameView>): GameView {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, isActive: true, hasPriority: true, life: 40, commandList: [] }),
      makePlayer({ playerId: 'p2', name: 'Bob', life: 40, commandList: [] }),
      makePlayer({ playerId: 'p3', name: 'Carol', life: 40, commandList: [] }),
      makePlayer({ playerId: 'p4', name: 'Dave', life: 40, commandList: [] }),
    ],
    myPlayerId: 'p1',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    turn: 3,
    ...overrides,
  })
}

function withBattlefield(game: GameView, playerId: string, cards: Record<string, PermanentView | CardView>): GameView {
  return {
    ...game,
    players: game.players!.map((p) => (p.playerId === playerId ? { ...p, battlefield: cards as unknown as typeof p.battlefield } : p)),
  }
}

function spectatorGame(): GameView {
  const game = fourPlayerGame()
  return {
    ...game,
    myPlayerId: null,
    players: game.players!.map((p) => ({ ...p, controlled: false, isActive: false, hasPriority: false })),
  } as GameView
}

function landOf(id: string): CardView {
  return makeCard({ id, name: 'Forest', parentId: id, cardTypes: ['Land'] } as Partial<CardView> & { name: string })
}

describe('SpotlightBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    setSetting('boardSpotlightPanel', 22)
  })
  afterEach(() => {
    setState({ gameId: null, outReasons: {} })
    cleanup()
    vi.unstubAllGlobals()
  })

  it('BRD-6: the main area holds the main seat and the panel one copy per other seat in turn order after the player', () => {
    const { getByTestId, container } = render(
      <SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />,
    )
    const main = getByTestId('spotlight-main')
    expect(main.getAttribute('data-main-seat')).toBe('p2')
    expect(main.querySelector('[data-player-id="p2"]')).not.toBeNull()
    const panel = getByTestId('spotlight-panel')
    const copies = Array.from(panel.querySelectorAll('[data-copy-player]')).map((el) => el.getAttribute('data-copy-player'))
    expect(copies).toEqual(['p4', 'p3', 'p1'])
    expect(container.querySelectorAll('[data-copy-player="p2"]').length).toBe(0)
  })

  it('BRD-6: every board, main or copy, is laid out like the own board', () => {
    const { container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelectorAll('.zone-top').length).toBe(0)
    expect(container.querySelectorAll('.spotlight-seat > .zone-bottom').length).toBe(4)
  })

  function withCarol(carol: Partial<PlayerView>): GameView {
    return fourPlayerGame({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', life: 40, commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', life: 40, commandList: [], ...carol }),
        makePlayer({ playerId: 'p4', name: 'Dave', life: 40, commandList: [] }),
      ],
    })
  }

  const listEntries = (list: HTMLElement) =>
    [...list.children].map((el) => {
      const copy = el.querySelector('[data-copy-player]')?.getAttribute('data-copy-player')
      return copy ?? `head:${el.querySelector('[data-testid^="spotlight-head-"]')?.getAttribute('data-testid')?.slice(15)}`
    })

  const logged = (reason: OutReason) => setState({ gameId: 'g1', outReasons: { [outReasonKey('g1', 'Carol')]: reason } })

  it.each([
    ['concedes', { life: 40, hasLeft: true }, 'conceded', 'conceded', 'ha concedido'],
    ['dies', { life: 0, hasLeft: true }, 'died', 'died', 'ha muerto'],
    ['loses to an effect', { life: 12, hasLeft: true }, 'died', 'died', 'ha muerto'],
    ['quits the match', { life: 23, hasLeft: true }, 'left', 'left', 'ha abandonado la partida'],
    ['is out with no log line (0 life)', { life: 0, hasLeft: true }, null, 'died', 'ha muerto'],
    ['is out with no log line', { life: 23, hasLeft: true }, null, 'left', 'ha abandonado la partida'],
  ] as const)('BRD-6, BRD-30: a player who %s keeps the turn-order place folded to the head that says why, with no board', (_case, carol, reason, out, status) => {
    if (reason) logged(reason)
    const alive = render(<SpotlightBoard game={withCarol({})} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const aliveOrder = listEntries(alive.getByTestId('spotlight-panel-list'))
    alive.unmount()
    const { getByTestId, queryByTestId } = render(<SpotlightBoard game={withCarol(carol)} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(listEntries(getByTestId('spotlight-panel-list'))).toEqual(aliveOrder.map((id) => (id === 'p3' ? 'head:p3' : id)))
    expect(queryByTestId('spotlight-copy-p3')).toBeNull()
    const head = getByTestId('spotlight-head-p3')
    expect(head.classList.contains('is-out')).toBe(true)
    expect(head.getAttribute('data-out')).toBe(out)
    expect(head.querySelector('.spotlight-copy-head-name')?.textContent).toBe('Carol')
    expect(head.querySelector('.spotlight-copy-head-status')?.textContent).toBe(status)
    expect(head.querySelector('.spotlight-copy-head-life')).toBeNull()
  })

  it('BRD-30: the folded head is not a button and never swaps the main board', () => {
    const picked: string[] = []
    const { getByTestId } = render(<SpotlightBoard game={withCarol({ hasLeft: true })} homeId="p1" mainId="p2" onSelectSeat={(id) => picked.push(id)} />)
    const head = getByTestId('spotlight-head-p3')
    expect(head.tagName).not.toBe('BUTTON')
    fireEvent.click(head)
    expect(picked).toEqual([])
  })

  it('BRD-30: the own seat stays a copy even when the player is out', () => {
    const game = withCarol({})
    const meOut = { ...game, players: game.players!.map((p) => (p.playerId === 'p1' ? { ...p, hasLeft: true } : p)) }
    const { queryByTestId } = render(<SpotlightBoard game={meOut} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(queryByTestId('spotlight-copy-p1')).not.toBeNull()
  })

  it('BRD-30: the seat folds as soon as a new game view marks the player out', () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <SpotlightBoard game={withCarol({})} homeId="p1" mainId="p2" onSelectSeat={() => {}} />,
    )
    expect(queryByTestId('spotlight-copy-p3')).not.toBeNull()
    rerender(<SpotlightBoard game={withCarol({ hasLeft: true })} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(queryByTestId('spotlight-copy-p3')).toBeNull()
    expect(getByTestId('spotlight-head-p3').classList.contains('is-out')).toBe(true)
  })

  it('BRD-31: every copy has the name and life of its player above it, outside the scaled board', () => {
    const { getByTestId } = render(<SpotlightBoard game={withCarol({ life: 17 })} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const panel = getByTestId('spotlight-panel')
    for (const [id, name, life] of [['p3', 'Carol', '17'], ['p4', 'Dave', '40'], ['p1', 'Alice', '20']]) {
      const head = getByTestId(`spotlight-head-${id}`)
      expect(head.querySelector('.spotlight-copy-head-name')?.textContent).toBe(name)
      expect(head.querySelector('.spotlight-copy-head-life')?.textContent).toBe(life)
      expect(head.closest('[data-copy-player]')).toBeNull()
      expect(panel.contains(head)).toBe(true)
    }
    expect(panel.querySelector('[data-testid="spotlight-head-p2"]')).toBeNull()
  })

  it('BRD-31: the head follows the life in each new game view and marks the player whose turn it is', () => {
    const { getByTestId, rerender } = render(<SpotlightBoard game={withCarol({})} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(getByTestId('spotlight-head-p3').classList.contains('is-active')).toBe(false)
    rerender(<SpotlightBoard game={{ ...withCarol({ life: 31 }), activePlayerId: 'p3' }} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const head = getByTestId('spotlight-head-p3')
    expect(head.querySelector('.spotlight-copy-head-life')?.textContent).toBe('31')
    expect(head.classList.contains('is-active')).toBe(true)
    expect(head.querySelector('.spotlight-copy-head-turn')).not.toBeNull()
    expect(getByTestId('spotlight-head-p4').querySelector('.spotlight-copy-head-turn')).toBeNull()
  })

  it('BRD-6: every copy box takes the main area proportions once the main area is measured', () => {
    class SizedResizeObserver {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {
        this.cb([{ contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', SizedResizeObserver)
    const { getByTestId } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const panel = getByTestId('spotlight-panel')
    expect(panel.classList.contains('has-copy-ratio')).toBe(true)
    expect(panel.style.getPropertyValue('--copy-ratio')).toBe('1.5000')
  })

  it('BRD-31: a click on the head brings that seat to the main area', () => {
    const picked: string[] = []
    const { getByTestId } = render(<SpotlightBoard game={withCarol({})} homeId="p1" mainId="p2" onSelectSeat={(id) => picked.push(id)} />)
    fireEvent.click(getByTestId('spotlight-head-p4'))
    expect(picked).toEqual(['p4'])
  })

  it('BRD-7: clicking a copy asks to bring that seat to the main area', () => {
    const picked: string[] = []
    const { container } = render(
      <SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={(id) => picked.push(id)} />,
    )
    fireEvent.click(container.querySelector('[data-testid="spotlight-copy-p4"]') as HTMLElement)
    expect(picked).toEqual(['p4'])
  })

  it('BRD-7: clicking a card the prompt can target in a copy picks it and does not swap', () => {
    const picked: string[] = []
    const targeted: string[] = []
    const game = withBattlefield(fourPlayerGame(), 'p4', { 'b-4': landOf('b-4') })
    const { container } = render(
      <SpotlightBoard
        game={game}
        homeId="p1"
      mainId="p2"
        targetIds={['b-4']}
        onTargetClick={(id) => targeted.push(id)}
        onSelectSeat={(id) => picked.push(id)}
      />,
    )
    const card = container.querySelector('[data-testid="spotlight-copy-p4"] [data-card-id="b-4"]') as HTMLElement
    expect(card).not.toBeNull()
    fireEvent.click(card)
    expect(targeted).toEqual(['b-4'])
    expect(picked).toEqual([])
  })

  it('BRD-8: while the prompt asks for a player, a click anywhere on that player\'s copy picks them and does not swap', () => {
    const picked: string[] = []
    const targeted: string[] = []
    const { container } = render(
      <SpotlightBoard
        game={fourPlayerGame()}
        homeId="p1"
        mainId="p1"
        targetIds={['p3', 'p4']}
        onTargetClick={(id) => targeted.push(id)}
        onSelectSeat={(id) => picked.push(id)}
      />,
    )
    fireEvent.click(container.querySelector('[data-testid="spotlight-copy-p4"]') as HTMLElement)
    expect(targeted).toEqual(['p4'])
    expect(picked).toEqual([])
    fireEvent.click(container.querySelector('[data-testid="spotlight-head-p3"]') as HTMLElement)
    expect(targeted).toEqual(['p4', 'p3'])
    expect(picked).toEqual([])
    fireEvent.click(container.querySelector('[data-testid="spotlight-copy-p2"]') as HTMLElement)
    fireEvent.click(container.querySelector('[data-testid="spotlight-head-p2"]') as HTMLElement)
    expect(picked).toEqual(['p2', 'p2'])
    expect(targeted).toEqual(['p4', 'p3'])
  })

  it('BRD-7: the main board mode has no focus buttons', () => {
    const { container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelectorAll('[data-testid^="seat-focus-"]').length).toBe(0)
    expect(container.querySelectorAll('.seat-focus-btn, .seat-focus-all').length).toBe(0)
  })

  it('BRD-7: a hidden card stays hidden in the main area and in a copy', () => {
    const game = withBattlefield(fourPlayerGame(), 'p4', {
      'b-secret': makeCard({ id: 'b-secret', name: 'Secret Relic', parentId: 'b-secret', faceDown: true } as Partial<CardView> & { name: string }),
    })
    const withHidden = {
      ...game,
      opponentHands: { Bob: { 'oh-1': makeCard({ id: 'oh-1', name: 'Secret Hand Card', parentId: 'oh-1', faceDown: true } as Partial<CardView> & { name: string }) } },
    } as GameView
    const bob = withHidden.players!.find((p) => p.playerId === 'p2') as unknown as Record<string, unknown>
    bob['handCount'] = 1
    const { container } = render(<SpotlightBoard game={withHidden} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-main"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-copy-p4"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Secret Relic')
    expect(container.textContent).not.toContain('Secret Hand Card')
  })

  it('BRD-6: a spectator sees no hand bar and every seat drawn as an opponent board', () => {
    const { container, getByTestId } = render(
      <SpotlightBoard game={spectatorGame()} homeId="p4" mainId="p4" onSelectSeat={() => {}} />,
    )
    expect(container.querySelector('[data-testid="hand-bar"]')).toBeNull()
    expect(container.querySelectorAll('.spotlight-seat > .zone-bottom').length).toBe(4)
    expect(getByTestId('spotlight-main').getAttribute('data-main-seat')).toBe('p4')
    const copies = Array.from(getByTestId('spotlight-panel').querySelectorAll('[data-copy-player]')).map((el) => el.getAttribute('data-copy-player'))
    expect(copies).toEqual(['p3', 'p2', 'p1'])
  })

  it('BRD-7: a spectator\'s click on a copy brings that seat to the main area', () => {
    const picked: string[] = []
    const { container } = render(
      <SpotlightBoard game={spectatorGame()} homeId="p4" mainId="p4" onSelectSeat={(id) => picked.push(id)} />,
    )
    fireEvent.click(container.querySelector('[data-testid="spotlight-copy-p2"]') as HTMLElement)
    expect(picked).toEqual(['p2'])
  })

  it('BRD-7: a hidden card stays hidden for a spectator in the main area and in a copy', () => {
    const game = withBattlefield(spectatorGame(), 'p4', {
      'b-secret': makeCard({ id: 'b-secret', name: 'Secret Relic', parentId: 'b-secret', faceDown: true } as Partial<CardView> & { name: string }),
    })
    const { container, rerender } = render(<SpotlightBoard game={game} homeId="p4" mainId="p4" onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-main"] .card-slot.face-down')).not.toBeNull()
    expect(container.textContent).not.toContain('Secret Relic')
    rerender(<SpotlightBoard game={game} homeId="p4" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-copy-p4"] .card-slot.face-down')).not.toBeNull()
    expect(container.textContent).not.toContain('Secret Relic')
  })

  it('BRD-11: the phase strip slot is the first row of the board, above the main area and the panel', () => {
    setSetting('gameUi', 'v1')
    const { getByTestId } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const board = getByTestId('spotlight-board')
    expect(board.firstElementChild?.classList.contains('board-shell-divider')).toBe(true)
    const body = board.querySelector('.spotlight-body')
    expect(body).not.toBeNull()
    expect(body!.contains(getByTestId('spotlight-main'))).toBe(true)
    expect(body!.contains(getByTestId('spotlight-panel'))).toBe(true)
    expect(board.firstElementChild!.nextElementSibling).toBe(body)
  })

  it('BRD-11: the board divider takes no room when no strip is portaled into it', () => {
    setSetting('gameUi', 'v2')
    const { getByTestId, container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelector('.board-shell-divider')).toBeNull()
    expect(getByTestId('spotlight-board').firstElementChild?.classList.contains('spotlight-body')).toBe(true)
    setSetting('gameUi', 'v1')
  })

  it('BRD-13: dragging the panel edge sets the panel width setting within 15 to 35 percent', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const { getByTestId, container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const body = container.querySelector<HTMLElement>('.spotlight-body')!
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1000, width: 1000, top: 0, bottom: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    const handle = getByTestId('spotlight-panel-handle')
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 780 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 800 })
    expect(getState().settings.boardSpotlightPanel).toBe(20)
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0 })
    expect(getState().settings.boardSpotlightPanel).toBe(35)
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 999 })
    expect(getState().settings.boardSpotlightPanel).toBe(15)
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 900 })
    expect(getState().settings.boardSpotlightPanel).toBe(15)
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0 })
    expect(getState().settings.boardSpotlightPanel).toBe(15)
    vi.unstubAllGlobals()
  })

  it('BRD-13: the arrow keys on the panel edge change the width by one percent', () => {
    const { getByTestId } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const handle = getByTestId('spotlight-panel-handle')
    expect(handle.getAttribute('aria-valuenow')).toBe('22')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(getState().settings.boardSpotlightPanel).toBe(23)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(getState().settings.boardSpotlightPanel).toBe(21)
  })

  it('BRD-8: a copy rings while the prompt can target its player or a card on its board', () => {
    const game = withBattlefield(fourPlayerGame(), 'p4', { 'b-4': landOf('b-4') })
    const { container, rerender } = render(
      <SpotlightBoard game={game} homeId="p1" mainId="p2" targetIds={['b-4']} onSelectSeat={() => {}} />,
    )
    expect(container.querySelector('[data-testid="spotlight-copy-p4"]')!.classList.contains('target-zone')).toBe(true)
    expect(container.querySelector('[data-testid="spotlight-copy-p3"]')!.classList.contains('target-zone')).toBe(false)

    rerender(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" targetIds={['p3']} onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-copy-p3"]')!.classList.contains('target-zone')).toBe(true)
    expect(container.querySelector('[data-testid="spotlight-copy-p4"]')!.classList.contains('target-zone')).toBe(false)
  })

  it('BRD-8: the main seat never rings as a copy', () => {
    const { container } = render(
      <SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" targetIds={['p2']} onSelectSeat={() => {}} />,
    )
    expect(container.querySelectorAll('.spotlight-copy-slot.target-zone').length).toBe(0)
    expect(container.querySelector('[data-testid="spotlight-main"] .spotlight-copy-slot')).toBeNull()
    expect(container.querySelector('[data-testid="spotlight-main"] .spotlight-copy-pulse')).toBeNull()
  })

  it('BRD-8: a copy pulses when a permanent enters its battlefield and not when nothing changes', () => {
    const { container, rerender } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-copy-p4"] .spotlight-copy-pulse')).toBeNull()

    const entered = withBattlefield(fourPlayerGame(), 'p4', { 'b-4': landOf('b-4') })
    rerender(<SpotlightBoard game={entered} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const pulse = container.querySelector('[data-testid="spotlight-copy-p4"] .spotlight-copy-pulse')
    expect(pulse).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-copy-p3"] .spotlight-copy-pulse')).toBeNull()
    expect(container.querySelector('[data-testid="spotlight-panel"] .spotlight-copy-pulse')).toBe(pulse)

    rerender(<SpotlightBoard game={withBattlefield(fourPlayerGame(), 'p4', { 'b-4': landOf('b-4') })} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    expect(container.querySelector('[data-testid="spotlight-copy-p4"] .spotlight-copy-pulse')).toBe(pulse)
  })

  it('BRD-8: no pulse when effects are off', () => {
    setSetting('effects', false)
    try {
      const { container, rerender } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
      rerender(<SpotlightBoard game={withBattlefield(fourPlayerGame(), 'p4', { 'b-4': landOf('b-4') })} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
      expect(container.querySelectorAll('.spotlight-copy-pulse').length).toBe(0)
    } finally {
      setSetting('effects', true)
    }
  })

  it('BRD-12: every board in the main board mode shows its piles as cards in its corner and no pile chips', () => {
    setSetting('gameUi', 'v2')
    try {
      const { container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
      const corners = container.querySelectorAll('[data-testid="pile-corner"]')
      expect(corners.length).toBe(4)
      corners.forEach((corner) => expect(corner.querySelectorAll('[data-testid^="pile-card-"]').length).toBe(3))
      expect(container.querySelectorAll('.library-chip, .graveyard-chip, .exile-chip, .library-stack, .graveyard-stack, .exile-stack').length).toBe(0)
    } finally {
      setSetting('gameUi', 'v1')
    }
  })

  it('BRD-39: with the v1 chrome every board, main and copies, gets the Arena frame with captioned piles', () => {
    setSetting('gameUi', 'v1')
    const { container } = render(<SpotlightBoard game={fourPlayerGame()} homeId="p1" mainId="p2" onSelectSeat={() => {}} />)
    const rows = container.querySelectorAll('[data-testid="arena-own-row"]')
    expect(rows.length).toBe(4)
    rows.forEach((row) => expect(row.querySelectorAll('[data-testid="pile-caption"]').length).toBe(3))
    expect(container.querySelectorAll('[data-testid="pile-corner"]').length).toBe(0)
    expect(container.querySelectorAll('[data-testid="arena-own-chip"] .player-info-bar.is-bare').length).toBe(4)
  })
})

describe('pile corner geometry (BRD-12)', () => {
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom })
  const corner = box(900, 700, 1000, 760)

  it('BRD-12: a corner with no hand card above it rests flush with the zone bottom', () => {
    expect(pileCornerLift(800, corner, [])).toBe(0)
    expect(pileCornerLift(800, corner, [box(0, 100, 400, 300)])).toBe(0)
    expect(pileCornerLift(800, corner, [box(0, 700, 400, 800)])).toBe(0)
  })

  it('BRD-12: a corner lifts just clear of the hand card it overlaps at its resting place', () => {
    expect(pileCornerLift(800, corner, [box(850, 760, 1050, 900)])).toBe(40)
    expect(pileCornerLift(800, corner, [box(850, 720, 1050, 900), box(850, 740, 1050, 900)])).toBe(80)
  })

  it('BRD-12: a hand card beside the corner does not lift it', () => {
    expect(pileCornerLift(800, corner, [box(1010, 700, 1200, 900)])).toBe(0)
  })

  it('BRD-12: the corner reaches a row when its top sits above the row bottom', () => {
    const row = box(0, 500, 1000, 720)
    expect(pileCornerReaches(corner, row)).toBe(true)
    expect(pileCornerReaches(box(900, 720, 1000, 800), row)).toBe(false)
  })
})
