import PileOverlay from '../board/PileOverlay'
import { t as tStatic } from '../i18n'
import { dismissInfoWindow, infoWindowTitle, useInfoWindows } from './infoWindowState'

interface InfoWindowsProps {
  /** Playable object ids (store): the companion's {3} and any "you may play
   *  that card" from a looked-at/revealed entry click through `onPlayCard`,
   *  mirroring the desktop CardInfoWindowDialog (which marks its cards
   *  playable and sends the card UUID on click). */
  playableIds?: Set<string>
  onPlayCard?: (id: string) => void
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
}

/** Looked-at / revealed / companion viewers (parity with the desktop
 *  CardInfoWindowDialog). While a prompt dialog shows the looked-at/revealed
 *  cards inline (`useClaimedInfoWindows`), only companion windows float here. */
export default function InfoWindows({ playableIds, onPlayCard, targetIds, onTargetClick }: InfoWindowsProps) {
  const { windows, claimed } = useInfoWindows()
  const visible = claimed ? windows.open.filter((w) => w.kind === 'companion') : windows.open

  if (visible.length === 0) return null
  return (
    <>
      {visible.map((w) => (
        <PileOverlay
          key={w.key}
          title={infoWindowTitle(tStatic, w.kind, w.name)}
          cards={w.cards}
          onClose={() => dismissInfoWindow(w.key)}
          playableIds={playableIds}
          onPlayCard={onPlayCard}
          targetIds={targetIds}
          onTargetClick={onTargetClick}
        />
      ))}
    </>
  )
}
