import { useState } from 'react'
import CardSlot from '../../board/CardSlot'
import FloatingCardPreview from '../../board/FloatingCardPreview'
import { useTranslation } from '../../i18n'
import type { CardView, PermanentView } from '../../net/types'
import { infoWindowTitle, useClaimedInfoWindows } from '../infoWindowState'
import './ClaimedInfoCards.css'

/** The looked-at/revealed cards behind the pending decision (e.g. Jace, the
 *  Mind Sculptor's +2 top card), shown inside the prompt dialog. */
export default function ClaimedInfoCards() {
  const { t } = useTranslation()
  const windows = useClaimedInfoWindows()
  const [hover, setHover] = useState<{ card: CardView | PermanentView; rect: DOMRect | null } | null>(null)

  if (windows.length === 0) return null
  return (
    <div className="feedback-info-cards" data-testid="feedback-info-cards">
      {windows.map((w) => (
        <section key={w.key} className="feedback-info-group" data-info-window={w.kind}>
          <div className="feedback-info-title">{infoWindowTitle(t, w.kind, w.name)}</div>
          <div className="feedback-info-row">
            {Object.entries(w.cards).map(([id, card]) => (
              <CardSlot
                key={id}
                cardId={id}
                card={card}
                className="feedback-info-card"
                onHover={(c, rect) => setHover(c ? { card: c, rect: rect ?? null } : null)}
              />
            ))}
          </div>
        </section>
      ))}
      <FloatingCardPreview card={hover?.card ?? null} anchorRect={hover?.rect ?? null} inModal />
    </div>
  )
}
