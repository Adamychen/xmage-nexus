import type { CSSProperties } from 'react'
import { useLibraryPeeks, type LibraryPeekFx } from './libraryPeekFx'
import { CardBack } from './ShuffleOverlay'
import './LibraryPeekOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

function PeekItem({ fx }: { fx: LibraryPeekFx }) {
  const style: Vars = {
    left: fx.deckX - fx.w / 2,
    top: fx.deckY - fx.h / 2,
    width: fx.w,
    height: fx.h,
    '--peek-dur': `${fx.duration}ms`,
    '--peek-dir': fx.up ? -1 : 1,
  }
  return (
    <div className="library-peek-fx" data-testid="fx-library-peek" data-player-id={fx.playerId} data-count={fx.count} style={style}>
      <CardBack playerId={fx.playerId} mine={fx.mine} className="peek-card peek-base" />
      {Array.from({ length: fx.count }, (_, i) => (
        <CardBack
          key={i}
          playerId={fx.playerId}
          mine={fx.mine}
          className="peek-card peek-lift"
          style={{ '--fan': (i - (fx.count - 1) / 2).toFixed(2), '--i': i }}
        />
      ))}
    </div>
  )
}

export default function LibraryPeekOverlay() {
  const peeks = useLibraryPeeks()
  if (peeks.length === 0) return null
  return (
    <div className="library-peek-overlay" aria-hidden="true">
      {peeks.map((fx) => (
        <PeekItem key={fx.id} fx={fx} />
      ))}
    </div>
  )
}
