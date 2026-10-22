import { renderHook } from '@testing-library/react'
import type { PlayerView } from '../net/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBattlefieldDissolve, DISSOLVE_CLASS, type DissolveContext } from './useBattlefieldDissolve'
import { getState, setState } from '../state/state'
import { makeCard, makePermanent, makePlayer } from '../__fixtures__/gameViews'

function setFx(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function playerWith(opts: { battlefield?: string[]; graveyard?: string[]; exile?: string[] }): PlayerView {
  const toMap = (ids: string[] = []) => Object.fromEntries(ids.map((id) => [id, makeCard({ name: id, id })]))
  const battlefield = Object.fromEntries(
    (opts.battlefield ?? []).map((id) => [id, makePermanent({ name: id, id })]),
  )
  return makePlayer({
    playerId: 'p1',
    name: 'Alice',
    battlefield,
    graveyard: toMap(opts.graveyard),
    exile: toMap(opts.exile),
  })
}

function board(ids: string[]): HTMLElement {
  const scope = document.createElement('div')
  for (const id of ids) {
    const node = document.createElement('div')
    node.dataset.cardId = id
    node.dataset.tapped = '0'
    node.className = 'card-slot'
    scope.appendChild(node)
  }
  document.body.appendChild(scope)
  return scope
}

function ghosts(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>(`.${DISSOLVE_CLASS}`))
}

describe('useBattlefieldDissolve', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setFx(true)
    setReducedMotion(false)
    setState({ gameId: 'g1' })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as { matchMedia?: unknown }).matchMedia
    document.body.innerHTML = ''
    setState({ gameId: null })
  })

  function removeCard(scope: HTMLElement, id: string) {
    scope.querySelector(`[data-card-id="${id}"]`)?.remove()
  }

  it('spawns a ghost when a card leaves the battlefield for the graveyard', () => {
    const scope = board(['c1', 'c2'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1', 'c2'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ battlefield: ['c2'], graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(1)
    expect(ghosts()[0].getAttribute('aria-hidden')).toBe('true')
    expect(ghosts()[0].dataset.cardId).toBeUndefined()
  })

  it('drops the aura flare and the keyword gain pop from the ghost copy', () => {
    const scope = board(['c1'])
    const card = scope.querySelector<HTMLElement>('[data-card-id="c1"]')!
    card.insertAdjacentHTML('beforeend', '<span class="kw-aura kw-aura--flying"></span><span class="kw-aura-flare kw-aura-flare--flying"></span><span class="keyword-badge kw-coin kw-gained kw-flying"></span>')
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(1)
    expect(ghosts()[0].querySelector('.kw-aura-flare')).toBeNull()
    expect(ghosts()[0].querySelector('.kw-gained')).toBeNull()
    expect(ghosts()[0].querySelector('.kw-aura')).not.toBeNull()
  })

  it('spawns a ghost for an exile destination too', () => {
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ exile: ['c1'] }) })
    expect(ghosts()).toHaveLength(1)
  })

  it('removes the ghost after 400 ms', () => {
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    vi.advanceTimersByTime(399)
    expect(ghosts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(ghosts()).toHaveLength(0)
  })

  it('does not spawn a ghost for a card that vanishes without a graveyard or exile entry', () => {
    const scope = board(['c1', 'c2'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1', 'c2'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ battlefield: ['c2'] }) })
    expect(ghosts()).toHaveLength(0)
  })

  it('does not spawn anything on a full refresh that keeps the battlefield', () => {
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    rerender({ p: playerWith({ battlefield: ['c1'], graveyard: [] }) })
    expect(ghosts()).toHaveLength(0)
  })

  it('does not spawn anything on the first view (no previous snapshot)', () => {
    const scope = board([])
    renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ graveyard: ['c1'] }) } },
    )
    expect(ghosts()).toHaveLength(0)
  })

  it('does not spawn across a game switch', () => {
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ g, p }: { g: string; p: PlayerView }) => useBattlefieldDissolve([scope], g, p),
      { initialProps: { g: 'g1', p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ g: 'g2', p: playerWith({ graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(0)
  })

  it('spawns nothing under reduced motion', () => {
    setReducedMotion(true)
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(0)
  })

  it('spawns nothing when effects are off', () => {
    setFx(false)
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(0)
  })

  it('places the ghost inside the board shell when the zone has one', () => {
    const shell = document.createElement('div')
    shell.className = 'board-shell'
    document.body.appendChild(shell)
    const scope = document.createElement('div')
    shell.appendChild(scope)
    const node = document.createElement('div')
    node.dataset.cardId = 'c1'
    node.dataset.tapped = '0'
    node.className = 'card-slot clickable'
    node.setAttribute('role', 'button')
    scope.appendChild(node)
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    const ghost = shell.querySelector<HTMLElement>(`.${DISSOLVE_CLASS}`)
    expect(ghost).not.toBeNull()
    expect(ghost?.style.position).toBe('absolute')
    expect(ghost?.hasAttribute('role')).toBe(false)
    expect(ghost?.classList.contains('clickable')).toBe(false)
  })

  it('spawns a ghost on the controller board when a stolen card dies to its owner graveyard', () => {
    const scope = board(['c1'])
    const owner = (graveyard: string[]) => makePlayer({
      playerId: 'p2',
      name: 'Bob',
      graveyard: Object.fromEntries(graveyard.map((id) => [id, makeCard({ name: id, id })])),
    })
    const { rerender } = renderHook(
      ({ p, ctx }: { p: PlayerView; ctx: DissolveContext }) => useBattlefieldDissolve([scope], 'g1', p, ctx),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }), ctx: { players: [playerWith({ battlefield: ['c1'] }), owner([])], gameCycle: 10 } } },
    )
    removeCard(scope, 'c1')
    rerender({
      p: playerWith({}),
      ctx: { players: [playerWith({}), owner(['c1'])], gameCycle: 11 },
    })
    expect(ghosts()).toHaveLength(1)
  })

  it('does not spawn a ghost when a rollback reverts a permanent into the graveyard', () => {
    const scope = board(['c1'])
    const { rerender } = renderHook(
      ({ p, ctx }: { p: PlayerView; ctx: DissolveContext }) => useBattlefieldDissolve([scope], 'g1', p, ctx),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }), ctx: { gameCycle: 40 } } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }), ctx: { gameCycle: 12 } })
    expect(ghosts()).toHaveLength(0)
  })

  it('removes its live ghosts on unmount', () => {
    const scope = board(['c1'])
    const { rerender, unmount } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve([scope], 'g1', p),
      { initialProps: { p: playerWith({ battlefield: ['c1'] }) } },
    )
    removeCard(scope, 'c1')
    rerender({ p: playerWith({ graveyard: ['c1'] }) })
    expect(ghosts()).toHaveLength(1)
    unmount()
    expect(ghosts()).toHaveLength(0)
  })

  it('does not re-read the board boxes on a render that brings no new player state', () => {
    const scope = board(['c1', 'c2'])
    const p = playerWith({ battlefield: ['c1', 'c2'] })
    const scopes = [scope]
    const { rerender } = renderHook(
      ({ p }: { p: PlayerView }) => useBattlefieldDissolve(scopes, 'g1', p),
      { initialProps: { p } },
    )
    const read = vi.spyOn(scope.querySelector<HTMLElement>('[data-card-id="c1"]')!, 'getBoundingClientRect')
    rerender({ p })
    expect(read).not.toHaveBeenCalled()
  })
})
