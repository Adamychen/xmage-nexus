import { describe, expect, it } from 'vitest'
import { adviseDraftPick, poolProfile, type AdvisorCard } from './draftAdvisor'

let n = 0
function card(over: Partial<AdvisorCard>): AdvisorCard {
  n++
  return { id: `c${n}`, cmc: 3, colors: [], typeLine: 'Creature — Elf', rarity: 'common', ...over }
}

const redPool = (count: number) =>
  Array.from({ length: count }, (_, i) => card({ colors: ['R'], cmc: (i % 4) + 2, typeLine: i % 3 === 0 ? 'Instant' : 'Creature — Goblin' }))

describe('poolProfile', () => {
  it('names the two colours the pool is actually in, and only after a few picks', () => {
    expect(poolProfile(redPool(3)).mainColors).toEqual([])
    const picks = [...redPool(5), card({ colors: ['G'] }), card({ colors: ['G'] }), card({ colors: ['U'] })]
    expect(poolProfile(picks).mainColors).toEqual(['R', 'G'])
  })

  it('counts creatures per curve slot and ignores lands', () => {
    const profile = poolProfile([
      card({ cmc: 2 }),
      card({ cmc: 2 }),
      card({ cmc: 7 }),
      card({ cmc: 0, typeLine: 'Land' }),
    ])
    expect(profile.creatures).toBe(3)
    expect(profile.curve[2]).toBe(2)
    expect(profile.curve[6]).toBe(1)
  })
})

describe('adviseDraftPick', () => {
  it('prefers a card in your colours once you are committed', () => {
    const picks = redPool(10)
    const onColor = card({ colors: ['R'], cmc: 2 })
    const offColor = card({ colors: ['B'], cmc: 2 })
    const ranked = adviseDraftPick([offColor, onColor], picks)
    expect(ranked[0].id).toBe(onColor.id)
    expect(ranked[0].reasons).toContain('on_colors')
    expect(ranked[1].reasons).toContain('off_colors')
  })

  it('lets raw power win in the first picks, before colours mean anything', () => {
    const rare = card({ rarity: 'rare', colors: ['U'] })
    const common = card({ rarity: 'common', colors: ['R'] })
    const ranked = adviseDraftPick([common, rare], [])
    expect(ranked[0].id).toBe(rare.id)
    expect(ranked[0].reasons).toContain('rare')
  })

  it('rewards the creature slot the pool is missing', () => {
    const picks = [card({ cmc: 3 }), card({ cmc: 3 }), card({ cmc: 3 }), card({ cmc: 3 })]
    const twoDrop = card({ cmc: 2 })
    const threeDrop = card({ cmc: 3 })
    const ranked = adviseDraftPick([threeDrop, twoDrop], picks)
    expect(ranked[0].id).toBe(twoDrop.id)
    expect(ranked[0].reasons).toContain('curve')
  })

  it('asks for creatures when the pool is light on them', () => {
    const picks = Array.from({ length: 9 }, () => card({ typeLine: 'Instant', colors: ['R'] }))
    const creature = card({ colors: ['R'], cmc: 4 })
    const spell = card({ colors: ['R'], typeLine: 'Sorcery' })
    const ranked = adviseDraftPick([spell, creature], picks)
    expect(ranked[0].id).toBe(creature.id)
    expect(ranked[0].reasons).toContain('creatures')
  })

  it('never suggests a basic land over a spell', () => {
    const land = card({ typeLine: 'Basic Land — Forest', cmc: 0 })
    const spell = card({ colors: ['G'], typeLine: 'Sorcery' })
    expect(adviseDraftPick([land, spell], [])[0].id).toBe(spell.id)
  })

  it('is deterministic for equal scores', () => {
    const a = card({ id: 'a' })
    const b = card({ id: 'b' })
    expect(adviseDraftPick([b, a], []).map((x) => x.id)).toEqual(['a', 'b'])
  })
})
