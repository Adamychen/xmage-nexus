import { describe, expect, it } from 'vitest'
import { foldTopCardPeek, TOP_CARD_PEEK_NAME, visibleTopCardPeek } from './topCardPeek'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView } from '../net/types'

const me = (libraryCount: number) => makePlayer({ playerId: 'me', name: 'Alice', controlled: true, libraryCount })
const opp = makePlayer({ playerId: 'opp', name: 'Bob', libraryCount: 30 })
const card = (id: string, name: string) => makeCard({ id, name, parentId: id })
const peek = (c: CardView) => ({ name: TOP_CARD_PEEK_NAME, cards: { [c.id!]: c } })
const view = (libraryCount: number, lookedAt: { name: string; cards: Record<string, CardView> }[] = []) =>
  makeGameView({ myPlayerId: 'me', players: [me(libraryCount), opp], lookedAt })

describe('topCardPeek', () => {
  const island = card('top-1', 'Island')

  it('remembers the peeked card across the views the engine sends without it', () => {
    let s = foldTopCardPeek(null, view(40, [peek(island)]), 'g1')
    for (let i = 0; i < 3; i++) s = foldTopCardPeek(s, view(40), 'g1')
    expect(visibleTopCardPeek(s, me(40))?.name).toBe('Island')
  })

  it('stops showing it once the library changes, and shows the next peek', () => {
    let s = foldTopCardPeek(null, view(40, [peek(island)]), 'g1')
    s = foldTopCardPeek(s, view(39), 'g1')
    expect(visibleTopCardPeek(s, me(39))).toBeNull()
    s = foldTopCardPeek(s, view(39, [peek(card('top-2', 'Forest'))]), 'g1')
    expect(visibleTopCardPeek(s, me(39))?.name).toBe('Forest')
  })

  it('only shows it on the peeking player', () => {
    const s = foldTopCardPeek(null, view(40, [peek(island)]), 'g1')
    expect(visibleTopCardPeek(s, opp)).toBeNull()
  })

  it('ignores other looked-at groups', () => {
    const s = foldTopCardPeek(null, view(40, [{ name: 'Jace, the Mind Sculptor', cards: { 'top-1': island } }]), 'g1')
    expect(s).toBeNull()
  })

  it('forgets the card on a new game or when the game ends', () => {
    const s = foldTopCardPeek(null, view(40, [peek(island)]), 'g1')
    expect(visibleTopCardPeek(foldTopCardPeek(s, view(40), 'g2'), me(40))).toBeNull()
    expect(foldTopCardPeek(s, null, 'g1')).toBeNull()
  })
})
