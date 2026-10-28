import { describe, expect, it } from 'vitest'
import type { CardStripMeta } from './ArenaCardStrip'
import { edhPowerLevel } from './edhPowerLevel'

const cases: [string, CardStripMeta, number][] = [
  ['a vanilla creature scores 0', { name: 'Grizzly Bears', typeLine: 'Creature — Bear', oracleText: '' }, 0],
  ['a basic land scores 0', { name: 'Command Tower', typeLine: 'Land', oracleText: "{T}: Add one mana of any color in your commander's color identity." }, 0],
  ['a tutor for any card scores 6', { name: 'Sylvan Scrying', typeLine: 'Sorcery', oracleText: 'Search your library for a land card, reveal it, then shuffle and put that card on top.' }, 6],
  ['a tutor for a basic land scores 1', { name: 'Rampant Growth', typeLine: 'Sorcery', oracleText: 'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.' }, 1],
  ['an extra-turn spell scores 7', { name: 'Time Walk', typeLine: 'Sorcery', oracleText: 'Take an extra turn after this one.' }, 7],
  ['the highest rule wins, not the sum (extra turn and buyback score 7)', { name: 'Test Loop', typeLine: 'Sorcery', oracleText: 'Take an extra turn after this one.\nBuyback {3}' }, 7],
  ['annihilator scores 5', { name: 'Test Annihilator', typeLine: 'Creature — Eldrazi', oracleText: 'Annihilator 2' }, 5],
  ['a mass destroy scores 3 (destroy all beats destroy and can\'t be)', { name: 'Wrath of God', typeLine: 'Sorcery', oracleText: "Destroy all creatures. They can't be regenerated." }, 3],
  ['a mass exile scores 4', { name: 'Test Sweeper', typeLine: 'Sorcery', oracleText: 'Exile all creatures.' }, 4],
  ['exile and all on different lines do not combine into a mass exile (scores 2)', { name: 'Test Split', typeLine: 'Sorcery', oracleText: 'Exile target creature.\nAll creatures get +1/+1 until end of turn.' }, 2],
  ['a keyword with no rules text still scores', { name: 'Test Keyword', typeLine: 'Creature — Eldrazi', oracleText: '', keywords: ['Annihilator'] }, 5],
  ['a name on the 12-point list scores 12', { name: 'Sol Ring', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.' }, 12],
  ['a name on both the 12- and 15-point lists scores 15', { name: 'Splinter Twin', typeLine: 'Enchantment — Aura', oracleText: 'Enchant creature' }, 15],
  ['a game changer scores 20 whatever its text', { name: 'Demonic Tutor', typeLine: 'Sorcery', oracleText: 'Search your library for a card, then shuffle and put that card on top.' }, 20],
  ['a planeswalker scores 6', { name: 'Test Walker', typeLine: 'Legendary Planeswalker — Jace', oracleText: '+1: Draw a card.' }, 6],
  ['a counter targeting a spell scores 1', { name: 'Test Counter', typeLine: 'Instant', oracleText: 'Counter target spell.' }, 1],
  ['a cost reduction that refers to each creature scores 5', { name: 'Test Discount', typeLine: 'Instant', oracleText: 'This spell costs {1} less to cast for each creature you control.' }, 5],
  ['matching ignores case', { name: 'Test Upper', typeLine: 'Sorcery', oracleText: 'EXTRA TURN' }, 7],
  ['mana value does not score', { name: 'Test Dragon', typeLine: 'Creature — Dragon', oracleText: 'Flying', cmc: 9 }, 0],
]

describe('edhPowerLevel', () => {
  it.each(cases)('DCK-15: %s', (_description, meta, level) => {
    expect(edhPowerLevel(meta)).toBe(level)
  })

  it('DCK-15: a card without a name skips the name lists', () => {
    expect(edhPowerLevel({ typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.' })).toBe(0)
  })
})
