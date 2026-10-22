// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, cleanup } from '@testing-library/react'
import type { PermanentView, PlayerView } from '../net/types'
import BoardZone from './BoardZone'
import { setState } from '../state/store'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

function playerWith(battlefield: Record<string, PermanentView>): PlayerView {
  return makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, battlefield })
}

describe('BoardZone battlefield rendering', () => {
  beforeEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
  })
  afterEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
    cleanup()
  })

  function renderZone(player: PlayerView) {
    setState({ game: makeGameView({ players: [player] }) as never })
    return render(<BoardZone player={player} />)
  }

  it('keeps the host card mounted when an Aura attaches so its new keyword still pops', () => {
    const first = playerWith({ bear: makePermanent({ name: 'Grizzly Bears', id: 'bear', rules: [] }) })
    const { container, rerender } = renderZone(first)
    const second = playerWith({
      bear: makePermanent({ name: 'Grizzly Bears', id: 'bear', rules: ['Flying'], attachments: ['aura-1'] }),
      'aura-1': makePermanent({ name: 'Flight Aura', id: 'aura-1', cardTypes: ['Enchantment'] }),
    })
    setState({ game: makeGameView({ players: [second] }) as never })
    rerender(<BoardZone player={second} />)
    expect(container.querySelector('[data-card-id="bear"] .kw-flying.kw-gained')).not.toBeNull()
    expect(container.querySelector('[data-card-id="bear"] .kw-aura-flare')).not.toBeNull()
  })

  it('reserves no attachment slot for an attachment that is not on this battlefield', () => {
    const player = playerWith({
      bear: makePermanent({ name: 'Grizzly Bears', id: 'bear', attachments: ['foreign-aura'] }),
    })
    const { container } = renderZone(player)
    expect(container.querySelector('.card-attachment-group')).toBeNull()
    expect(container.querySelector('.attachments-list')).toBeNull()
  })

  it('renders the mutated top card once, so data-card-id finds only the host', () => {
    const top = makePermanent({ name: 'Grizzly Bears', id: 'bear', mutated: true })
    const under = makePermanent({ name: 'Hill Giant', id: 'under-1' })
    const player = playerWith({
      bear: { ...top, mutateView: { cards: { bear: top, 'under-1': under } } } as PermanentView,
    })
    const { container } = renderZone(player)
    expect(container.querySelectorAll('[data-card-id="bear"]')).toHaveLength(1)
  })

  it('gives an attached permanent and a mutate part the keyword aura', () => {
    const flyingPart = makePermanent({ name: 'Serra Angel', id: 'part-1', rules: ['Flying'] })
    const flyingAttachment = makePermanent({ name: 'Bestowed Angel', id: 'aura-1', rules: ['Flying'], cardTypes: ['Creature'] })
    const player = playerWith({
      bear: {
        ...makePermanent({ name: 'Grizzly Bears', id: 'bear', mutated: true, attachments: ['aura-1'] }),
        mutateView: { cards: { 'part-1': flyingPart } },
      } as PermanentView,
      'aura-1': flyingAttachment,
    })
    const { container } = renderZone(player)
    expect(container.querySelector('[data-card-id="aura-1"] .kw-aura')).not.toBeNull()
    expect(container.querySelector('[data-card-id="part-1"] .kw-aura')).not.toBeNull()
  })

  it('keeps a running flare when a second keyword lands, then lets the gains expire', () => {
    vi.useFakeTimers()
    try {
      const zoneWithRules = (rules: string[]) => playerWith({ 'gain-bear': makePermanent({ name: 'Grizzly Bears', id: 'gain-bear', rules }) })
      const { container, rerender } = renderZone(zoneWithRules([]))
      rerender(<BoardZone player={zoneWithRules(['Flying'])} />)
      expect(container.querySelector('.kw-aura-flare--flying')).not.toBeNull()
      act(() => { vi.advanceTimersByTime(300) })
      rerender(<BoardZone player={zoneWithRules(['Flying', 'Lifelink'])} />)
      expect(container.querySelector('.kw-aura-flare--flying')).not.toBeNull()
      expect(container.querySelector('[data-card-id="gain-bear"] .kw-flying.kw-gained')).not.toBeNull()
      act(() => { vi.advanceTimersByTime(1000) })
      expect(container.querySelector('.kw-gained')).toBeNull()
      expect(container.querySelector('.kw-aura-flare')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows no keyword badges or icons on a face-down creature the viewer does not control', () => {
    const faceDown = { faceDown: true, rules: ['Flying'], cardIcons: [{ cardIconType: 'ABILITY_FLYING', hint: 'Flying' }] }
    const player = playerWith({
      'hidden-1': makePermanent({ name: 'Morph', id: 'hidden-1', controllerId: 'p2', ...faceDown }),
    })
    const { container } = renderZone(player)
    expect(container.querySelector('[data-card-id="hidden-1"] .keyword-badges')).toBeNull()
    expect(container.querySelector('[data-card-id="hidden-1"] .card-icons')).toBeNull()
  })

  it('still shows keyword badges on a face-down creature the viewer controls', () => {
    const player = playerWith({
      'mine-1': makePermanent({ name: 'Morph', id: 'mine-1', controllerId: 'p1', faceDown: true, rules: ['Flying'] }),
    })
    const { container } = renderZone(player)
    expect(container.querySelector('[data-card-id="mine-1"] .keyword-badges')).not.toBeNull()
  })

  it('keeps a playable land inside its pile so the pile still forms', () => {
    const forest = (id: string) => makePermanent({ name: 'Forest', id, cardTypes: ['Land'] })
    const player = playerWith({ f1: forest('f1'), f2: forest('f2'), f3: forest('f3') })
    setState({ game: makeGameView({ players: [player] }) as never })
    const { container } = render(<BoardZone player={player} playableIds={new Set(['f1'])} />)
    expect(container.querySelectorAll('.stack-group')).toHaveLength(1)
  })

  it('TGT-6: keeps a targeted land out of its pile', () => {
    const forest = (id: string) => makePermanent({ name: 'Forest', id, cardTypes: ['Land'] })
    const player = playerWith({ f1: forest('f1'), f2: forest('f2'), f3: forest('f3'), f4: forest('f4') })
    setState({ game: makeGameView({ players: [player] }) as never })
    const { container } = render(<BoardZone player={player} targetIds={new Set(['f1'])} />)
    expect(container.querySelector('.stack-group [data-card-id="f1"]')).toBeNull()
    expect(container.querySelector('[data-card-id="f1"]')).not.toBeNull()
    expect(container.querySelectorAll('.stack-group [data-card-id]')).toHaveLength(3)
  })
})
