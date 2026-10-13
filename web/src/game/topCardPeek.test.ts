import { describe, expect, it, vi } from 'vitest'
import { foldTopCardPeek, TOP_CARD_PEEK_NAME, visibleTopCardPeek } from './topCardPeek'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView } from '../net/types'

// The real `LookedAtView` payload is a SimpleCardView pointer, so the peek has to be
// named from the printing. Mocked here to keep the two branches (cached / unknown
// printing) deterministic and offline, the way the client sees them against a server
// whose CDN it cannot always reach.
vi.mock('../cards/cardImages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cards/cardImages')>()
  const trk319 = { name: 'Emrakul, the Aeons Torn', typeLine: 'Legendary Creature — Titan', manaCost: '', imageUrl: null }
  return {
    ...actual,
    peekCardMeta: (set?: string, num?: string) => (set === 'TRK' && num === '319' ? trk319 : null),
    awaitCardMeta: async (set?: string, num?: string) => (set === 'TRK' && num === '319' ? trk319 : null),
  }
})

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

  // Shape taken from fixtures/recorded/top-card-peek.json (Sphinx of Jwar Isle, real
  // server): the group carries a SimpleCardView, not a CardView.
  const pointer = (id: string, set: string, num: string) =>
    ({ id, parentId: id, expansionSetCode: set, cardNumber: num, gameObject: false, isChoosable: false, isSelected: false }) as unknown as CardView

  it('names a pointer payload from the printing, which is all the wire sends', () => {
    const s = foldTopCardPeek(null, view(40, [peek(pointer('top-9', 'TRK', '319'))]), 'g1')
    expect(s?.name).toBe('Emrakul, the Aeons Torn')
    expect(visibleTopCardPeek(s, me(40))?.name).toBe('Emrakul, the Aeons Torn')
  })
  it('leaves the name unknown instead of inventing one when the printing is unknown', () => {
    const s = foldTopCardPeek(null, view(40, [peek(pointer('top-9', 'ZZZ', '1'))]), 'g1')
    expect(s?.name).toBeNull()
    // No name reaches the card either: '?' would land in the alt text and the
    // rendered-card layout.
    expect(visibleTopCardPeek(s, me(40))?.name).toBeUndefined()
  })

  it('keeps the same peek across views that repeat it, so the slot does not repaint', () => {
    const withPeek = view(40, [peek(pointer('top-9', 'TRK', '319'))])
    const s = foldTopCardPeek(null, withPeek, 'g1')
    expect(foldTopCardPeek(s, withPeek, 'g1')).toBe(s)
    // A different library size is a different card: the old peek must not be reused.
    const drawn = foldTopCardPeek(s, view(39, [peek(pointer('top-9', 'TRK', '319'))]), 'g1')
    expect(drawn?.libraryCount).toBe(39)
  })
})
