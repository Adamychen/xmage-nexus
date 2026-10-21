import type { CSSProperties } from 'react'
import { useShuffles, CHIP_DECK_H, CHIP_DECK_W, type ShuffleFx } from './shuffleFx'
import { useSleeveFor } from '../appearance/useSleeve'
import './ShuffleOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

const FLICKS = 4

export function CardBack({ playerId, mine, className, style }: { playerId: string; mine: boolean; className: string; style?: Vars }) {
  const sleeve = useSleeveFor(mine ? playerId : null)
  return sleeve.kind === 'css' ? (
    <span className={`${className} sleeve-css-back`} style={{ ...style, background: sleeve.css }} data-sleeve-id={sleeve.id} />
  ) : (
    <img className={className} style={style} src={sleeve.imageUrl} alt="" draggable={false} data-sleeve-id={sleeve.id} />
  )
}

function ShuffleItem({ fx }: { fx: ShuffleFx }) {
  const chip = fx.mode === 'chip'
  const w = chip ? CHIP_DECK_W : fx.w
  const h = chip ? CHIP_DECK_H : fx.h
  const style: Vars = {
    left: fx.deckX - w / 2,
    top: fx.deckY - h / 2,
    width: w,
    height: h,
    '--shuffle-dur': `${fx.duration}ms`,
    '--shuffle-from-x': `${fx.x + fx.w / 2 - fx.deckX}px`,
    '--shuffle-from-y': `${fx.y + fx.h / 2 - fx.deckY}px`,
  }
  return (
    <div className={`shuffle-fx is-${fx.mode}`} data-testid="fx-shuffle" data-mode={fx.mode} data-player-id={fx.playerId} style={style}>
      <div className="shuffle-deck">
        <CardBack playerId={fx.playerId} mine={fx.mine} className="shuffle-card shuffle-base" />
        <CardBack playerId={fx.playerId} mine={fx.mine} className="shuffle-card shuffle-half is-left" />
        <CardBack playerId={fx.playerId} mine={fx.mine} className="shuffle-card shuffle-half is-right" />
        {Array.from({ length: FLICKS }, (_, i) => (
          <CardBack
            key={i}
            playerId={fx.playerId}
            mine={fx.mine}
            className={`shuffle-card shuffle-flick ${i % 2 === 0 ? 'is-left' : 'is-right'}`}
            style={{ '--flick-at': (0.36 + i * 0.1).toFixed(2) }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ShuffleOverlay() {
  const shuffles = useShuffles()
  if (shuffles.length === 0) return null
  return (
    <div className="shuffle-overlay" aria-hidden="true">
      {shuffles.map((fx) => (
        <ShuffleItem key={fx.id} fx={fx} />
      ))}
    </div>
  )
}
