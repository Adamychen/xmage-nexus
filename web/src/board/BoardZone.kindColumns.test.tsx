// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { PermanentView, PlayerView } from '../net/types'
import BoardZone from './BoardZone'
import { setState } from '../state/store'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

function playerWith(battlefield: Record<string, PermanentView>): PlayerView {
  return makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, battlefield })
}

function bf(...perms: PermanentView[]): Record<string, PermanentView> {
  return Object.fromEntries(perms.map((p) => [p.id as string, p]))
}

function renderZone(player: PlayerView, kindColumns?: boolean) {
  setState({ game: makeGameView({ players: [player] }) as never })
  return render(<BoardZone player={player} kindColumns={kindColumns} />)
}

function ids(el: Element | null): string[] {
  return Array.from(el?.querySelectorAll('[data-card-id]') ?? []).map((n) => n.getAttribute('data-card-id') ?? '')
}

describe('BoardZone kind columns', () => {
  afterEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
    cleanup()
  })

  const plains = makePermanent({ name: 'Plains', id: 'plains', cardTypes: ['Land'] })
  const solRing = makePermanent({ name: 'Sol Ring', id: 'solring', cardTypes: ['Artifact'] })
  const treasure = makePermanent({ name: 'Treasure', id: 'treasure', cardTypes: ['Artifact'], isToken: true })
  const arbor = makePermanent({ name: 'Dryad Arbor', id: 'arbor', cardTypes: ['Creature', 'Land'], power: '1', toughness: '1' })
  const bears = makePermanent({ name: 'Grizzly Bears', id: 'bears' })
  const walker = makePermanent({ name: 'Jace', id: 'walker', cardTypes: ['Planeswalker'] })

  it('BRD-1: lands sit left of the other permanents', () => {
    const { container } = renderZone(playerWith(bf(plains, solRing)), true)
    const lands = container.querySelector('[data-testid="lands-band"]')!
    const others = container.querySelector('[data-testid="others-band"]')!
    expect(lands).not.toBeNull()
    expect(others).not.toBeNull()
    expect(lands.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ids(lands)).toEqual(['plains'])
    expect(ids(others)).toEqual(['solring'])
  })

  it('BRD-1: an empty band is not rendered and the other one takes the row', () => {
    const onlyLands = renderZone(playerWith(bf(plains)), true)
    expect(onlyLands.container.querySelector('[data-testid="lands-band"]')).not.toBeNull()
    expect(onlyLands.container.querySelector('[data-testid="others-band"]')).toBeNull()
    onlyLands.unmount()
    const onlyOthers = renderZone(playerWith(bf(solRing)), true)
    expect(onlyOthers.container.querySelector('[data-testid="lands-band"]')).toBeNull()
    expect(onlyOthers.container.querySelector('[data-testid="others-band"]')).not.toBeNull()
  })

  it('BRD-1: a Treasure token goes to the right with the other permanents', () => {
    const { container } = renderZone(playerWith(bf(plains, treasure)), true)
    const lands = container.querySelector('[data-testid="lands-band"]')!
    const others = container.querySelector('[data-testid="others-band"]')!
    expect(ids(lands)).toEqual(['plains'])
    expect(ids(others)).toEqual(['treasure'])
  })

  it('BRD-1: a creature land stays with the creatures, not with the lands', () => {
    const { container } = renderZone(playerWith(bf(plains, arbor)), true)
    expect(ids(container.querySelector('.creatures-band'))).toEqual(['arbor'])
    expect(ids(container.querySelector('[data-testid="lands-band"]'))).toEqual(['plains'])
    expect(container.querySelector('[data-testid="others-band"]')).toBeNull()
  })

  it('BRD-1: without kindColumns the permanents stay in one band', () => {
    const { container } = renderZone(playerWith(bf(plains, solRing, treasure)))
    expect(container.querySelector('[data-testid="lands-band"]')).toBeNull()
    expect(container.querySelector('[data-testid="others-band"]')).toBeNull()
    const band = container.querySelector('.permanents-band')!
    expect(ids(band)).toEqual(['plains', 'solring', 'treasure'])
  })

  it('BRD-2: the marquee becomes a column outside the creatures row with kindColumns', () => {
    const { container } = renderZone(playerWith(bf(bears, walker)), true)
    const column = container.querySelector('.bz-marquee--column')!
    expect(column).not.toBeNull()
    expect(column.closest('.bz-creatures-row')).toBeNull()
    expect(column.parentElement?.classList.contains('board-zone')).toBe(true)
    expect(container.querySelector('.board-zone')?.classList.contains('has-marquee-column')).toBe(true)
    expect(ids(column)).toEqual(['walker'])
  })

  it('BRD-2: two marquee permanents share the one column', () => {
    const second = makePermanent({ name: 'Liliana', id: 'liliana', cardTypes: ['Planeswalker'] })
    const { container } = renderZone(playerWith(bf(bears, walker, second)), true)
    expect(ids(container.querySelector('.bz-marquee--column'))).toEqual(['walker', 'liliana'])
    expect(container.querySelectorAll('.bz-marquee').length).toBe(1)
  })

  it('BRD-2: a seat without marquee permanents has no column and keeps full-width rows', () => {
    const { container } = renderZone(playerWith(bf(bears, plains)), true)
    expect(container.querySelector('.bz-marquee')).toBeNull()
    expect(container.querySelector('.board-zone')?.classList.contains('has-marquee-column')).toBe(false)
  })

  it('BRD-2: without kindColumns the marquee stays at the end of the creatures row', () => {
    const { container } = renderZone(playerWith(bf(bears, walker)))
    const marquee = container.querySelector('.bz-creatures-row .bz-marquee')
    expect(marquee).not.toBeNull()
    expect(container.querySelector('.bz-marquee--column')).toBeNull()
    expect(container.querySelector('.board-zone')?.classList.contains('has-marquee-column')).toBe(false)
  })
})
