import { useMemo, useRef } from 'react'
import type { CardView } from '../../net/types'
import FormattedText from '../../game/FormattedText'
import { symbolToSvgPath } from '../../decks/ArenaManaSymbols'
import { artCropUrl } from '../../board/compactCard'
import { useCardImageUrl } from '../useCardImageUrl'
import { cardLayout, type CardFace, type CardLayout, type RuleRow } from './cardLayout'
import { useTextFit } from './useTextFit'
import './RenderedCard.css'

function Pips({ symbols }: { symbols: string[] }) {
  if (symbols.length === 0) return null
  return (
    <span className="rc-cost" aria-label={symbols.join('')}>
      {symbols.map((sym, i) => {
        const clean = sym.replace(/^\{|\}$/g, '')
        return <img key={`${sym}-${i}`} className="rc-pip" src={symbolToSvgPath(clean)} alt={sym} draggable={false} />
      })}
    </span>
  )
}

function Rules({ rules, cardName }: { rules: string[]; cardName: string }) {
  return (
    <>
      {rules.map((rule, i) => (
        <p key={i} className="rc-rule">
          <FormattedText text={rule} cardName={cardName} />
        </p>
      ))}
    </>
  )
}

function Rows({ rows, cardName, kind }: { rows: RuleRow[]; cardName: string; kind: CardLayout['kind'] }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className={`rc-row${row.label ? ' has-label' : ''}`}>
          {row.label && <span className={`rc-row-label rc-row-label--${kind}`}>{row.label}</span>}
          <p className="rc-rule">
            <FormattedText text={row.text} cardName={cardName} />
          </p>
        </div>
      ))}
    </>
  )
}

function Half({ face }: { face: CardFace }) {
  return (
    <section className="rc-half">
      <header className="rc-half-head">
        <span className="rc-name">{face.name}</span>
        <Pips symbols={face.cost} />
      </header>
      <div className="rc-half-type">{face.typeLine}</div>
      <div className="rc-half-text">
        <Rules rules={face.rules} cardName={face.name} />
      </div>
    </section>
  )
}

function originalStat(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const v = value as { cardValue?: unknown; baseValue?: unknown }
    const raw = v.cardValue ?? v.baseValue
    return raw == null ? null : String(raw)
  }
  return null
}

function statTone(current: string, originalValue: unknown): string {
  const original = originalStat(originalValue)
  if (original == null || original === '' || original === current) return ''
  const a = Number(current)
  const b = Number(original)
  if (Number.isNaN(a) || Number.isNaN(b)) return ' is-changed'
  return a > b ? ' is-up' : ' is-down'
}

export interface RenderedCardProps {
  card: CardView
  className?: string
}

export default function RenderedCard({ card, className = '' }: RenderedCardProps) {
  const layout = useMemo(() => cardLayout(card), [card])
  const imageUrl = useCardImageUrl(layout.kind === 'hidden' ? null : card)
  const art = artCropUrl(imageUrl)
  const textRef = useRef<HTMLDivElement>(null)
  useTextFit(textRef, [layout.kind, layout.rules.join('|'), layout.halves?.length ?? 0])

  if (layout.kind === 'hidden') {
    return (
      <div className={`rc rc--hidden ${className}`.trim()} aria-hidden="true">
        <div className="rc-face" />
      </div>
    )
  }

  const showArt = layout.kind !== 'split' && layout.kind !== 'adventure' && layout.kind !== 'ability'
  const label = `${layout.name}${layout.typeLine ? `, ${layout.typeLine}` : ''}`
  const loyalty = layout.kind === 'planeswalker' ? layout.loyalty : ''
  const defense = layout.kind === 'battle' ? layout.defense : ''

  return (
    <article
      className={`rc rc--${layout.kind} rc-frame--${layout.frame}${layout.legendary ? ' is-legendary' : ''} ${className}`.trim()}
      aria-label={label}
      data-rarity={layout.rarity || undefined}
    >
      <div className="rc-face">
      {layout.halves ? (
        <div ref={textRef} className="rc-halves">
          <Half face={layout.halves[0]} />
          <Half face={layout.halves[1]} />
        </div>
      ) : (
        <>
          <header className="rc-head">
            <span className="rc-name">{layout.name}</span>
            <Pips symbols={layout.cost} />
          </header>
          {showArt && (
            <div className="rc-art">{art && <img src={art} alt="" draggable={false} loading="lazy" />}</div>
          )}
          <div className="rc-type">
            <span className="rc-type-text">{layout.typeLine}</span>
            {layout.rarity && <span className="rc-rarity" aria-hidden="true" />}
          </div>
          <div ref={textRef} className="rc-text">
            {layout.rows ? (
              <Rows rows={layout.rows} cardName={layout.name} kind={layout.kind} />
            ) : (
              <Rules rules={layout.rules} cardName={layout.name} />
            )}
          </div>
        </>
      )}
      {card.counters && card.counters.length > 0 && (
        <div className="rc-counters">
          {card.counters.map((c) => (
            <span key={c.name} className="rc-counter">
              {c.name} ×{c.count}
            </span>
          ))}
        </div>
      )}
      {layout.showStats && (
        <div className="rc-stats">
          <span className={`rc-power${statTone(layout.power, card.originalPower)}`}>{layout.power}</span>
          <span className="rc-stat-sep">/</span>
          <span className={`rc-toughness${statTone(layout.toughness, card.originalToughness)}`}>{layout.toughness}</span>
        </div>
      )}
      {(loyalty || defense) && (
        <div className="rc-badge" aria-label={loyalty ? `loyalty ${loyalty}` : `defense ${defense}`}>
          {loyalty || defense}
        </div>
      )}
      </div>
    </article>
  )
}
