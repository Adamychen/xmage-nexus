import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_LEAVE_MS, useBoardPresenter } from './useBoardPresenter'
import type { CardView, GameView, PlayerView } from '../net/types'

describe('useBoardPresenter preview leaving', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const card = { name: 'Lightning Bolt', manaValue: 1 } as CardView
  const rect = { left: 0, top: 0, right: 90, bottom: 126, width: 90, height: 126 } as DOMRect

  it('keeps the preview mounted in leaving phase, then clears it', () => {
    const { result } = renderHook(() => useBoardPresenter({ game: null }))

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.floatingCard).toBe(card)
    expect(result.current.previewLeaving).toBe(false)

    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewLeaving).toBe(true)
    expect(result.current.floatingCard).toBe(card)
    expect(result.current.anchorRect).toBe(rect)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.floatingCard).toBeNull()
    expect(result.current.anchorRect).toBeNull()
    expect(result.current.previewLeaving).toBe(false)
  })

  it('cancels leaving when hovering again before the timeout', () => {    const onCardHover = vi.fn()
    const { result } = renderHook(() => useBoardPresenter({ game: null, onCardHover }))

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewLeaving).toBe(true)

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.previewLeaving).toBe(false)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.floatingCard).toBe(card)
    expect(onCardHover).not.toHaveBeenCalledWith(null)
  })

  it('tracks whether the hover comes from the hand', () => {
    const { result } = renderHook(() => useBoardPresenter({ game: null }))
    expect(result.current.previewFromHand).toBe(false)

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.previewFromHand).toBe(false)

    act(() => {
      result.current.handleCardHover(card, rect, { fromHand: true })
    })
    expect(result.current.previewFromHand).toBe(true)

    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewFromHand).toBe(true)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.previewFromHand).toBe(false)
  })
})

describe('useBoardPresenter clears stale hovers against the game view', () => {
  const rect = { left: 0, top: 0, right: 90, bottom: 126, width: 90, height: 126 } as DOMRect

  const permAlive = {
    id: 'perm-1', name: 'Grizzly Bears', cardTypes: ['CREATURE'],
    tapped: false, damage: 0, summoningSickness: false,
  } as unknown as CardView
  const permUpdated = {
    id: 'perm-1', name: 'Grizzly Bears', cardTypes: ['CREATURE'],
    tapped: true, damage: 2, summoningSickness: false,
  } as unknown as CardView
  const permDead = { id: 'perm-1', name: 'Grizzly Bears', cardTypes: ['CREATURE'] } as unknown as CardView
  const handCard1 = { id: 'h-1', name: 'Lightning Bolt', cardTypes: ['INSTANT'] } as unknown as CardView
  const handCard1b = {
    id: 'h-1', name: 'Lightning Bolt', cardTypes: ['INSTANT'], targets: ['perm-1'],
  } as unknown as CardView

  const me = (battlefield: Record<string, unknown> = {}, graveyard: Record<string, unknown> = {}) =>
    ({ playerId: 'p1', name: 'Me', controlled: true, battlefield, graveyard }) as unknown as PlayerView

  const makeGame = (players: PlayerView[] = [], extra: Record<string, unknown> = {}) =>
    ({ players, ...extra }) as unknown as GameView

  it('clears the preview when the hovered battlefield permanent dies', () => {
    const onCardHover = vi.fn()
    const { result, rerender } = renderHook(
      ({ game }) => useBoardPresenter({ game, onCardHover }),
      { initialProps: { game: makeGame([me({ 'perm-1': permAlive })]) } },
    )

    act(() => {
      result.current.handleCardHover(permAlive, rect)
    })
    expect(result.current.floatingCard).toBe(permAlive)

    // La criatura muere: desaparece del campo y aterriza en el cementerio
    rerender({ game: makeGame([me({}, { 'perm-1': permDead })]) })
    expect(result.current.floatingCard).toBeNull()
    expect(result.current.anchorRect).toBeNull()
    expect(onCardHover).toHaveBeenCalledWith(null)
  })

  it('keeps and refreshes the preview while the permanent stays on the battlefield', () => {
    const onCardHover = vi.fn()
    const { result, rerender } = renderHook(
      ({ game }) => useBoardPresenter({ game, onCardHover }),
      { initialProps: { game: makeGame([me({ 'perm-1': permAlive })]) } },
    )

    act(() => {
      result.current.handleCardHover(permAlive, rect)
    })

    // Update con la misma carta (girada, con daño): mismo id → refresco, no clear
    rerender({ game: makeGame([me({ 'perm-1': permUpdated })]) })
    expect(result.current.floatingCard).toBe(permUpdated)
    expect(result.current.anchorRect).toBe(rect)
    expect(onCardHover).not.toHaveBeenCalledWith(null)
  })

  it('keeps a hand-card hover while the card is still in hand', () => {
    const { result, rerender } = renderHook(
      ({ game }) => useBoardPresenter({ game }),
      { initialProps: { game: makeGame([], { myHand: { 'h-1': handCard1 } }) } },
    )

    act(() => {
      result.current.handleCardHover(handCard1, rect, { fromHand: true })
    })
    expect(result.current.floatingCard).toBe(handCard1)

    // Update que reenvía la mano (nuevo objeto, mismo id)
    rerender({ game: makeGame([], { myHand: { 'h-1': handCard1b } }) })
    expect(result.current.floatingCard).toBe(handCard1b)
    expect(result.current.previewFromHand).toBe(true)
  })

  it('clears the preview when the id exists nowhere in the game', () => {
    const { result, rerender } = renderHook(
      ({ game }) => useBoardPresenter({ game }),
      { initialProps: { game: makeGame([], { myHand: { 'h-1': handCard1 } }) } },
    )

    act(() => {
      result.current.handleCardHover(handCard1, rect)
    })
    expect(result.current.floatingCard).toBe(handCard1)

    rerender({ game: makeGame([], { myHand: {} }) })
    expect(result.current.floatingCard).toBeNull()
    expect(result.current.anchorRect).toBeNull()
  })

  it('leaves id-less cards untouched (defensive no-flicker)', () => {
    const noId = { name: 'Fixture Card' } as CardView
    const { result, rerender } = renderHook(
      ({ game }) => useBoardPresenter({ game }),
      { initialProps: { game: makeGame([me({})]) } },
    )

    act(() => {
      result.current.handleCardHover(noId, rect)
    })
    expect(result.current.floatingCard).toBe(noId)

    rerender({ game: makeGame([me({})]) })
    expect(result.current.floatingCard).toBe(noId)
  })
})
