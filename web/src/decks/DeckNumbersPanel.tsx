import { useMemo, type ComponentProps } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { DeckFormat } from './types'
import type { CardStripMeta } from './ArenaCardStrip'
import { BasicLandAdder } from './BasicLandAdder'
import { ManaPip, parseManaSymbols } from './ArenaManaSymbols'
import { manaShare } from './ManaPie'
import { cmcFromManaCost } from './deckUtils'
import { categorizeCard } from './cardCategory'
import { isMetaLoaded } from './metaLoaded'
import { useTranslation } from '../i18n'
import Button from '../ui/Button'
import './DeckNumbersPanel.css'

type LandAdderProps = Pick<ComponentProps<typeof BasicLandAdder>, 'onAddLand' | 'onRemoveLand' | 'onApplySuggestedLands'>

export interface DeckNumbersPanelProps extends LandAdderProps {
  cards: DeckCard[]
  metaOf: (card: DeckCard) => CardStripMeta | undefined
  format: DeckFormat
  metaMap: Map<string, CardStripMeta>
  onOpenInspector: () => void
}

type Colour = 'W' | 'U' | 'B' | 'R' | 'G'
const COLOURS: readonly Colour[] = ['W', 'U', 'B', 'R', 'G']
const CURVE_LAST = 6

interface DeckNumbers {
  curve: number[]
  creatures: number
  other: number
  lands: number
  averageMv: string
  pips: Record<Colour, number>
  pipTotal: number
  loading: number
}

function isColour(symbol: string): symbol is Colour {
  return (COLOURS as readonly string[]).includes(symbol)
}

export function computeDeckNumbers(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
): DeckNumbers {
  const curve = Array.from({ length: CURVE_LAST + 1 }, () => 0)
  const pips: Record<Colour, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  let creatures = 0
  let other = 0
  let lands = 0
  let loading = 0
  let spellCopies = 0
  let cmcTotal = 0

  for (const card of cards) {
    const meta = metaOf(card)
    if (!isMetaLoaded(meta)) {
      loading += card.amount
      continue
    }
    const category = categorizeCard(meta.typeLine)
    if (category === 'lands') {
      lands += card.amount
      continue
    }
    if (category === 'creatures') creatures += card.amount
    else other += card.amount

    const cmc = meta.cmc ?? cmcFromManaCost(meta.manaCost)
    curve[Math.min(CURVE_LAST, Math.floor(cmc))] += card.amount
    spellCopies += card.amount
    cmcTotal += cmc * card.amount

    for (const symbol of parseManaSymbols(meta.manaCost)) {
      const colours = symbol.toUpperCase().split('/').filter(isColour)
      for (const colour of colours) pips[colour] += card.amount / colours.length
    }
  }

  const pipTotal = COLOURS.reduce((sum, colour) => sum + pips[colour], 0)
  return {
    curve,
    creatures,
    other,
    lands,
    averageMv: (spellCopies > 0 ? cmcTotal / spellCopies : 0).toFixed(2),
    pips,
    pipTotal,
    loading,
  }
}

export function DeckNumbersPanel({
  cards,
  metaOf,
  format,
  metaMap,
  onAddLand,
  onRemoveLand,
  onApplySuggestedLands,
  onOpenInspector,
}: DeckNumbersPanelProps) {
  const { t } = useTranslation()
  const numbers = useMemo(() => computeDeckNumbers(cards, metaOf), [cards, metaOf])
  const curveMax = Math.max(1, ...numbers.curve)
  const curveLabel = (index: number) => (index === CURVE_LAST ? `${CURVE_LAST}+` : String(index))

  return (
    <section className="deck-numbers-panel" aria-label={t('decks', 'phone_curve')}>
      <div className="numbers-head">
        <h3 className="numbers-title">{t('decks', 'phone_curve')}</h3>
        <span className="numbers-avg">
          {t('decks', 'stats_avg_mv')} <strong>{numbers.averageMv}</strong>
        </span>
      </div>

      <div className="numbers-bars">
        {numbers.curve.map((count, index) => (
          <div key={index} className="numbers-bar-col" title={`${curveLabel(index)}: ${count}`}>
            <span className="numbers-bar-count">{count > 0 ? count : ''}</span>
            <div className="numbers-bar-track">
              <div className="numbers-bar-fill" style={{ height: `${(count / curveMax) * 100}%` }} />
            </div>
            <span className="numbers-bar-label">{curveLabel(index)}</span>
          </div>
        ))}
      </div>

      <div className="numbers-tiles">
        <div className="numbers-tile">
          <strong>{numbers.creatures}</strong>
          <span>{t('decks', 'stats_creatures')}</span>
        </div>
        <div className="numbers-tile">
          <strong>{numbers.other}</strong>
          <span>{t('decks', 'stats_other')}</span>
        </div>
        <div className="numbers-tile">
          <strong>{numbers.lands}</strong>
          <span>{t('decks', 'stats_lands')}</span>
        </div>
      </div>

      <div className="numbers-symbols">
        <h4 className="numbers-subtitle">{t('decks', 'stats_symbols')}</h4>
        <div className="numbers-share-bar" role="img" aria-label={t('decks', 'stats_symbols')}>
          {COLOURS.filter((c) => numbers.pips[c] > 0).map((c) => (
            <div
              key={c}
              className={`numbers-share-seg numbers-share-${c.toLowerCase()}`}
              style={{ width: `${(numbers.pips[c] / numbers.pipTotal) * 100}%` }}
            />
          ))}
        </div>
        <ul className="numbers-legend">
          {COLOURS.map((c) => (
            <li key={c} className="numbers-legend-row">
              <ManaPip symbol={c} size={14} />
              <span className="numbers-legend-name">{t('decks', `color_${c}`)}</span>
              <span className="numbers-legend-pct">{manaShare(numbers.pips[c], numbers.pipTotal)}</span>
            </li>
          ))}
        </ul>
      </div>

      {numbers.loading > 0 && (
        <p className="numbers-loading">{t('decks', 'stats_loading', { n: numbers.loading })}</p>
      )}

      <BasicLandAdder
        cards={cards}
        metaMap={metaMap}
        format={format}
        onAddLand={onAddLand}
        onRemoveLand={onRemoveLand}
        onApplySuggestedLands={onApplySuggestedLands}
      />

      <Button variant="secondary" size="sm" block className="numbers-full" onClick={onOpenInspector}>
        {t('decks', 'stats_full')}
      </Button>
    </section>
  )
}
