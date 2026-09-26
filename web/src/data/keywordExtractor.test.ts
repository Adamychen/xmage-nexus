import { describe, it, expect } from 'vitest'
import { extractKeywordsFromCard, extractOwnedKeywords } from './keywordExtractor'
import type { CardView } from '../net/types'

describe('keywordExtractor', () => {
  it('returns empty array when card is null or has no rules', () => {
    expect(extractKeywordsFromCard(null)).toEqual([])
    expect(extractKeywordsFromCard({ id: '1', name: 'Forest', rules: [] } as any)).toEqual([])
  })

  it('detects multiple simple keywords (e.g. Atraxa: Flying, Vigilance, Deathtouch, Lifelink, Proliferate)', () => {
    const atraxa: Partial<CardView> = {
      id: 'atraxa',
      name: "Atraxa, Praetors' Voice",
      rules: [
        'Flying, vigilance, deathtouch, lifelink',
        'At the beginning of your end step, proliferate.',
      ],
    }

    const kw = extractKeywordsFromCard(atraxa as CardView)
    const ids = kw.map((k) => k.id)

    expect(ids).toContain('flying')
    expect(ids).toContain('vigilance')
    expect(ids).toContain('deathtouch')
    expect(ids).toContain('lifelink')
    expect(ids).toContain('proliferate')
  })

  it('detects parameterized keywords like Ward and Scry', () => {
    const card: Partial<CardView> = {
      id: 'tivit',
      name: 'Tivit, Seller of Secrets',
      rules: [
        'Flying',
        'Ward {3}',
        'When Tivit enters, investigate or scry 2.',
      ],
    }

    const kw = extractKeywordsFromCard(card as CardView)
    const ward = kw.find((k) => k.id === 'ward')
    const scry = kw.find((k) => k.id === 'scry')
    const inv = kw.find((k) => k.id === 'investigate')

    expect(ward).toBeDefined()
    expect(ward?.name).toBe('Ward {3}')
    expect(ward?.parameter).toBe('{3}')

    expect(scry).toBeDefined()
    expect(scry?.name).toBe('Scry 2')

    expect(inv).toBeDefined()
  })

  it('deduplicates repeating keywords', () => {
    const card: Partial<CardView> = {
      id: 'double-fly',
      name: 'Bird',
      rules: [
        'Flying',
        'Other creatures have flying.',
      ],
    }

    const kw = extractKeywordsFromCard(card as CardView)
    expect(kw.filter((k) => k.id === 'flying')).toHaveLength(1)
  })

  describe('extractOwnedKeywords', () => {
    const ids = (rules: string[]) => extractOwnedKeywords({ id: 'c', name: 'C', rules } as unknown as CardView).map((k) => k.id)

    it('ignores keywords only referenced by another ability (Signal Pest)', () => {
      expect(ids([
        'Battle cry <i>(Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.)</i>',
        "{this} can't be blocked except by creatures with flying or reach.",
      ])).toEqual(['battle_cry'])
    })

    it('ignores keywords granted to other objects or tokens', () => {
      expect(ids([
        'Enchanted creature gets +2/+0 and has trample.',
        'I, II - Create a 2/2 white Knight creature token with vigilance.',
      ])).toEqual([])
    })

    it('keeps keyword lists, parameters and reminder text', () => {
      const kw = extractOwnedKeywords({ id: 'c', name: 'C', rules: [
        'Flying, vigilance, deathtouch, lifelink',
        'Ward {1} <i>(Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {1}.)</i>',
        'Protection from red',
      ] } as unknown as CardView)
      expect(kw.map((k) => k.id)).toEqual(expect.arrayContaining(['flying', 'vigilance', 'deathtouch', 'lifelink', 'ward', 'protection']))
      expect(kw.find((k) => k.id === 'ward')?.parameter).toBe('{1}')
      expect(kw.find((k) => k.id === 'protection')?.parameter).toBe('red')
    })

    it('does not pick up keywords from reminder text', () => {
      expect(ids(['Disguise {1}{W}  <i>(You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)</i>'])).toEqual(['disguise'])
    })
  })
})
