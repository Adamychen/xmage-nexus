import FormattedText from '../game/FormattedText'
import { KeywordCoin } from './KeywordGlyph'
import './AbilityCard.css'

/**
 * BRD-51: what a keyword looks like when it is explained: a plate in the keyword's own colour,
 * with its symbol on a square, its name, the English name beside it when the board is in another
 * language, and what it does. The same card is used under the pointer on a keyword badge and in
 * the panel beside a card, so the two never drift apart.
 */
export default function AbilityCard({
  id,
  category,
  name,
  secondary,
  summary,
  size = 22,
}: {
  id: string
  category: string
  name: string
  secondary?: string | null
  summary: string
  size?: number
}) {
  return (
    <div className={`ability-card kw-tone cat-${category} kw-${id}`}>
      <div className="ability-card-head">
        <KeywordCoin id={id} category={category} size={size} />
        <span className="ability-card-name">{name}</span>
        {secondary && <span className="ability-card-alt">{secondary}</span>}
      </div>
      <p className="ability-card-text">
        <FormattedText text={summary} />
      </p>
    </div>
  )
}
