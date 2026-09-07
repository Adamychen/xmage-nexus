import { describe, expect, it } from 'vitest'
import { buildDraftLog } from './draftLog'
import { parseDraftLog } from '../decks/parseDck'

describe('draftLog (U9-6)', () => {
  it('builds desktop-format log that parseDraftLog reimports (roundtrip)', () => {
    const text = buildDraftLog({
      draftId: 'draft-1',
      startedAt: new Date('2026-09-08T12:00:00Z'),
      players: ['a', 'b'],
      entries: [
        { setCode: 'M21', packNo: 1, pickNo: 1, booster: ['Lightning Bolt', 'Grizzly Bears'], pick: 'Lightning Bolt' },
        { setCode: 'M21', packNo: 1, pickNo: 2, booster: ['Grizzly Bears', 'Forest'], pick: 'Forest' },
        { setCode: 'M20', packNo: 2, pickNo: 1, booster: ['Shock', 'Mountain'], pick: 'Shock' },
      ],
    })
    expect(text).toContain('Event #: draft-1')
    expect(text).toContain('------ M21 ------')
    expect(text).toContain('------ M20 ------')
    expect(text).toContain('Pack 1 pick 1:')
    expect(text).toContain('--> Lightning Bolt')

    const deck = parseDraftLog(text, 'reimport')
    expect(deck).not.toBeNull()
    const names = deck!.cards.map((c) => `${c.cardName}@${c.setCode}x${c.amount}`).sort()
    expect(names).toEqual(['Forest@M21x1', 'Lightning Bolt@M21x1', 'Shock@M20x1'])
  })

  it('returns empty body with no entries', () => {
    const text = buildDraftLog({ draftId: 'd', startedAt: new Date(), players: [], entries: [] })
    expect(text).toContain('Event #: d')
    expect(parseDraftLog(text)).toBeNull()
  })
})
