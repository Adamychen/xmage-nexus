import PileOverlay from '../board/PileOverlay'
import { t as tStatic } from '../i18n'
import { INFO_WINDOW_TITLE_KEY, dismissInfoWindow, useInfoWindows } from './infoWindowState'

/** Looked-at / revealed / companion viewers (parity with the desktop
 *  CardInfoWindowDialog). While a prompt dialog shows the looked-at/revealed
 *  cards inline (`useClaimedInfoWindows`), only companion windows float here. */
export default function InfoWindows() {
  const { windows, claimed } = useInfoWindows()
  const visible = claimed ? windows.open.filter((w) => w.kind === 'companion') : windows.open

  if (visible.length === 0) return null
  return (
    <>
      {visible.map((w) => (
        <PileOverlay
          key={w.key}
          title={tStatic('game', INFO_WINDOW_TITLE_KEY[w.kind], { name: w.name })}
          cards={w.cards}
          onClose={() => dismissInfoWindow(w.key)}
        />
      ))}
    </>
  )
}
