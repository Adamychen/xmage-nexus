import type { CSSProperties } from 'react'
import type { CardView } from '../net/types'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { cardName } from '../cards/cardImages'
import { FLIGHT_CARD_ASPECT } from './flightManager'
import { useHandReveals, type HandRevealFx } from './handRevealFx'
import './HandRevealOverlay.css'

const CARD_BACK_URL = 'https://cards.scryfall.io/back.png'
const EDGE = 16
const GAP = 18

type Vars = CSSProperties & Record<`--${string}`, string | number>

function RevealCard({ card, style }: { card: CardView; style: Vars }) {
  const url = useCardImageUrl(card)
  return (
    <div className="hand-reveal-card" style={style} data-card-id={card.id}>
      <div className="hand-reveal-turn">
        <div className="hand-reveal-face">
          {url ? <img src={url} alt={cardName(card)} draggable={false} /> : <span className="hand-reveal-name">{cardName(card)}</span>}
        </div>
        <img className="hand-reveal-back" src={CARD_BACK_URL} alt="" draggable={false} />
      </div>
    </div>
  )
}

/** Lays the cards out as a fan beside their hand, inside the viewport. */
function Fan({ fx }: { fx: HandRevealFx }) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const n = fx.cards.length
  const cardW = Math.max(52, Math.min(96, vw * 0.07))
  const cardH = cardW / FLIGHT_CARD_ASPECT
  const step = Math.min(cardW * 0.66, (vw - 2 * EDGE - cardW) / Math.max(1, n - 1))
  const span = cardW + step * (n - 1)
  const cx = Math.min(Math.max(fx.x, EDGE + span / 2), vw - EDGE - span / 2)
  const rawCy = fx.below ? fx.y + fx.h / 2 + GAP + cardH / 2 : fx.y - fx.h / 2 - GAP - cardH / 2
  const cy = Math.min(Math.max(rawCy, EDGE + cardH / 2), vh - EDGE - cardH / 2)
  return (
    <div className="hand-reveal-fan" data-testid="hand-reveal" data-player-id={fx.playerId} data-count={n}>
      {fx.cards.map((card, i) => {
        const t = i - (n - 1) / 2
        const x = cx + t * step
        const y = cy + (fx.below ? 1 : -1) * t * t * 2.5
        const style: Vars = {
          left: x - cardW / 2,
          top: y - cardH / 2,
          width: cardW,
          height: cardH,
          zIndex: i + 1,
          '--dx0': `${fx.x - x}px`,
          '--dy0': `${fx.y - y}px`,
          '--rot': `${t * (fx.below ? -4 : 4)}deg`,
          '--card-dur': `${fx.duration - i * fx.stagger}ms`,
          '--card-delay': `${i * fx.stagger}ms`,
        }
        return <RevealCard key={card.id ?? i} card={card} style={style} />
      })}
    </div>
  )
}

export default function HandRevealOverlay() {
  const reveals = useHandReveals()
  if (reveals.length === 0) return null
  return (
    <div className="hand-reveal-overlay" aria-hidden="true">
      {reveals.map((fx) => <Fan key={fx.id} fx={fx} />)}
    </div>
  )
}
