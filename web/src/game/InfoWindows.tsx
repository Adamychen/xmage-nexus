import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import PileOverlay from '../board/PileOverlay'
import { t as tStatic } from '../i18n'
import type { CardView, RevealedView } from '../net/types'

function sig(cards: Record<string, unknown>): string {
  return Object.keys(cards).sort().join(',')
}

/** Visores looked-at / companion: se abren solos mientras están en la vista
 *  (paridad con CardInfoWindowDialog del desktop) y se cierran al vaciarse. */
export default function InfoWindows() {
  // OJO: el default [] va FUERA del selector — useStore exige snapshots
  // cacheados y `?? []` dentro realojaría el array en cada snapshot (loop).
  const lookedAt = useStore((s) => s.game?.lookedAt) ?? []
  const companion = useStore((s) => s.game?.companion) ?? []
  const [hidden, setHidden] = useState<Record<string, string>>({})

  const windows = useMemo(() => {
    const collect = (views: RevealedView[], kind: 'lookedAt' | 'companion') =>
      views.flatMap((v) => {
        const cards = (v.cards ?? {}) as Record<string, CardView>
        if (Object.keys(cards).length === 0) return []
        return [{
          key: `${kind}:${v.name}`,
          title: tStatic('game', kind === 'lookedAt' ? 'looked_at_window' : 'companion_window', { name: v.name }),
          cards,
        }]
      })
    return [...collect(lookedAt, 'lookedAt'), ...collect(companion, 'companion')].filter(
      (w) => hidden[w.key] !== sig(w.cards),
    )
  }, [lookedAt, companion, hidden])

  if (windows.length === 0) return null
  return (
    <>
      {windows.map((w) => (
        <PileOverlay
          key={w.key}
          title={w.title}
          cards={w.cards}
          onClose={() => setHidden((h) => ({ ...h, [w.key]: sig(w.cards) }))}
        />
      ))}
    </>
  )
}
