import { useMemo, useState } from 'react'
import type { CardView } from '../net/types'
import RenderedCard from '../cards/rendered/RenderedCard'
import { cardLayout } from '../cards/rendered/cardLayout'
import { recordedFrames } from './galleryFixtures'

const RED = { white: false, blue: false, black: false, red: true, green: false }
const BLUE = { white: false, blue: true, black: false, red: false, green: false }
const GREEN = { white: false, blue: false, black: false, red: false, green: true }
const WHITE = { white: true, blue: false, black: false, red: false, green: false }
const BOTH = { white: false, blue: true, black: false, red: true, green: false }

function synth(over: Record<string, unknown>): CardView {
  return {
    name: 'Synthetic', manaValue: 0, rules: [], cardTypes: [], subTypes: [], superTypes: [], power: '', toughness: '', loyalty: '', defense: '',
    color: { white: false, blue: false, black: false, red: false, green: false }, manaCostLeftStr: [], manaCostRightStr: [], rarity: 'COMMON',
    ...over,
  } as unknown as CardView
}

const SYNTHETIC: CardView[] = [
  synth({
    name: 'Turn // Burn', color: RED, isSplitCard: true, cardTypes: ['INSTANT'], rarity: 'UNCOMMON',
    leftSplitName: 'Turn', leftSplitCostsStr: '{2}{U}', leftSplitTypeLine: 'Instant ', leftSplitRules: ['Target creature loses all abilities and becomes a red Weird with base power and toughness 0/1 until end of turn.'],
    rightSplitName: 'Burn', rightSplitCostsStr: '{1}{R}', rightSplitTypeLine: 'Instant ', rightSplitRules: ['Burn deals 2 damage to any target.'],
    rules: ['Fuse <i>(You may cast one or both halves of this card from your hand.)</i>'],
  }),
  synth({
    name: 'Cut // Ribbons', color: RED, isSplitCard: true, cardTypes: ['SORCERY'],
    leftSplitName: 'Cut', leftSplitCostsStr: '{1}{R}', leftSplitTypeLine: 'Sorcery ', leftSplitRules: ['Cut deals 4 damage to target creature.'],
    rightSplitName: 'Ribbons', rightSplitCostsStr: '{X}{B}{B}', rightSplitTypeLine: 'Sorcery — Aftermath ', rightSplitRules: ['Aftermath <i>(Cast this spell only from your graveyard.)</i>', 'Each opponent loses X life.'],
  }),
  synth({
    name: 'Bottomless Pool // Locker Room', color: BLUE, isSplitCard: true, cardTypes: ['ENCHANTMENT'], subTypes: ['ROOM'],
    leftSplitName: 'Bottomless Pool', leftSplitCostsStr: '{U}', leftSplitTypeLine: 'Enchantment — Room ', leftSplitRules: ['Whenever one or more creatures you control deal combat damage to a player, return one of them to its owner\'s hand.'],
    rightSplitName: 'Locker Room', rightSplitCostsStr: '{4}{U}', rightSplitTypeLine: 'Enchantment — Room ', rightSplitRules: ['Whenever one or more creatures you control deal combat damage to a player, draw a card.'],
  }),
  synth({
    name: 'Student of Warfare', color: WHITE, cardTypes: ['CREATURE'], subTypes: ['HUMAN', 'KNIGHT'], power: '1', toughness: '1', manaCostLeftStr: ['{W}'], rarity: 'RARE',
    rules: ['Level up {W} <i>({W}: Put a level counter on this. Level up only as a sorcery.)</i>', 'LEVEL 2-6', '3/3', 'First strike', 'LEVEL 7+', '4/4', 'Double strike'],
    counters: [{ name: 'level', count: 3 }],
  }),
  synth({
    name: 'Delver of Secrets', color: BLUE, cardTypes: ['CREATURE'], subTypes: ['HUMAN', 'WIZARD'], power: '1', toughness: '1', manaCostLeftStr: ['{U}'], transformable: true,
    rules: ['At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.'],
    secondCardFace: synth({ name: 'Insectile Aberration', color: BLUE, cardTypes: ['CREATURE'], subTypes: ['HUMAN', 'INSECT'], power: '3', toughness: '2', rules: ['Flying'] }),
  }),
  synth({
    name: 'Smuggler\'s Copter', cardTypes: ['ARTIFACT'], subTypes: ['VEHICLE'], power: '3', toughness: '3', manaCostLeftStr: ['{2}'], rarity: 'RARE',
    rules: ['Flying', 'Whenever {this} attacks or blocks, you may draw a card. If you do, discard a card.', 'Crew 1'],
  }),
  synth({
    name: 'Omnath, Locus of Creation', color: { ...BOTH, green: true, white: true }, superTypes: ['LEGENDARY'], cardTypes: ['CREATURE'], subTypes: ['ELEMENTAL'], power: '4', toughness: '4', rarity: 'MYTHIC',
    manaCostLeftStr: ['{R}', '{G}', '{W}', '{U}'],
    rules: ['When {this} enters the battlefield, draw a card.', 'Landfall — Whenever a land enters the battlefield under your control, you gain 4 life if this is the first time this ability has resolved this turn. If it\'s the second time, add {R}{G}{W}{U}. If it\'s the third time, {this} deals 4 damage to each opponent.', 'Whenever an opponent casts a spell, that player may pay {1}. If they do not, counter that spell and this ability deals 3 damage to them.', 'Whenever this creature attacks, destroy target nonland permanent an opponent controls. They create a token that is a copy of it.'],
  }),
  synth({
    name: 'Rampaging Baloths', color: GREEN, cardTypes: ['CREATURE'], subTypes: ['BEAST'], power: '6', toughness: '6', manaCostLeftStr: ['{4}', '{G}', '{G}'], rules: ['Trample', 'Landfall — Whenever a land enters the battlefield under your control, you may create a 4/4 green Beast creature token.'],
    originalPower: { cardValue: '6' }, originalToughness: { cardValue: '4' },
  }),
]

function collectCards(): CardView[] {
  const seen = new Map<string, CardView>()
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 8) return
    const obj = value as Record<string, unknown>
    if (typeof obj.name === 'string' && (Array.isArray(obj.cardTypes) || Array.isArray(obj.rules))) {
      const card = obj as unknown as CardView
      const key = `${cardLayout(card).kind}|${card.name}`
      if (!seen.has(key)) seen.set(key, card)
    }
    for (const child of Object.values(obj)) visit(child, depth + 1)
  }
  for (const frame of recordedFrames) visit(frame.gameView, 0)
  const all = [...SYNTHETIC, ...seen.values()]
  return all.sort((a, b) => cardLayout(a).kind.localeCompare(cardLayout(b).kind) || a.name.localeCompare(b.name))
}

export default function RenderedCardsGallery() {
  const cards = useMemo(collectCards, [])
  const [width, setWidth] = useState(260)
  return (
    <div style={{ padding: 'var(--sp-4)', height: '100%', overflow: 'auto', background: 'var(--ink-1)' }}>
      <label style={{ display: 'flex', gap: 'var(--sp-3)', color: 'var(--fg-1)', marginBottom: 'var(--sp-4)' }}>
        <span>{width}px</span>
        <input type="range" min={140} max={460} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
        {cards.map((card, i) => (
          <figure key={`${card.name}-${i}`} style={{ margin: 0, width }} data-layout={cardLayout(card).kind}>
            <RenderedCard card={card} />
            <figcaption style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-xs)' }}>{cardLayout(card).kind}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
