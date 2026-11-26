import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useShuffles, CHIP_DECK_H, CHIP_DECK_W, type ShuffleFx } from './shuffleFx'
import { useSleeveFor } from '../appearance/useSleeve'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import './ShuffleOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

const FLICKS = 4

export function CardBack({ playerId, className, style }: { playerId: string; className: string; style?: Vars }) {
  const sleeve = useSleeveFor(playerId)
  return sleeve.kind === 'css' ? (
    <span className={`${className} sleeve-css-back`} style={{ ...style, background: sleeve.css }} data-sleeve-id={sleeve.id} />
  ) : (
    <img className={className} style={style} src={sleeve.imageUrl} alt="" draggable={false} data-sleeve-id={sleeve.id} />
  )
}

function ShuffleItem({ fx }: { fx: ShuffleFx }) {
  const deckRef = useRef<HTMLDivElement>(null)
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

  useLayoutEffect(() => {
    const deck = deckRef.current
    if (!deck) return
    const left = deck.querySelector<HTMLElement>('.shuffle-half.is-left')
    const right = deck.querySelector<HTMLElement>('.shuffle-half.is-right')
    const tl = fxTimeline()
    if (!tl || !left || !right) return

    const split = Math.max(18, w * 0.42)
    tl.to(left, { x: -split, rotation: -7, duration: 0.14, ease: ARENA_EASE.snapOut }, 0)
      .to(right, { x: split, rotation: 7, duration: 0.14, ease: ARENA_EASE.snapOut }, 0)
      .to([left, right], { x: 0, rotation: 0, duration: 0.12, ease: ARENA_EASE.slamIn }, 0.15)
      .call(() => {
        vfx.sparkBurst(fx.deckX, fx.deckY, 'W', { count: 8, speed: 120, size: 2.6, life: 0.26, gravity: 40 })
      }, undefined, 0.25)
      .to(left, { x: -split * 0.85, rotation: -5, duration: 0.12, ease: ARENA_EASE.snapOut }, 0.3)
      .to(right, { x: split * 0.85, rotation: 5, duration: 0.12, ease: ARENA_EASE.snapOut }, 0.3)
      .to([left, right], { x: 0, rotation: 0, duration: 0.12, ease: ARENA_EASE.pop }, 0.43)

    return () => { tl.kill() }
  }, [fx, w])

  return (
    <div className={`shuffle-fx is-${fx.mode}`} data-testid="fx-shuffle" data-mode={fx.mode} data-player-id={fx.playerId} style={style}>
      <div ref={deckRef} className="shuffle-deck">
        <CardBack playerId={fx.playerId} className="shuffle-card shuffle-base" />
        <CardBack playerId={fx.playerId} className="shuffle-card shuffle-half is-left" />
        <CardBack playerId={fx.playerId} className="shuffle-card shuffle-half is-right" />
        {Array.from({ length: FLICKS }, (_, i) => (
          <CardBack
            key={i}
            playerId={fx.playerId}
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
