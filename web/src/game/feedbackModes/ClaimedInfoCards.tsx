import CardSlot from '../../board/CardSlot'
import { useTranslation } from '../../i18n'
import { PromptCardThumb, PromptCardZoomable, usePromptCardPreview } from '../promptCardPreview'
import { infoWindowTitle, useClaimedInfoWindows } from '../infoWindowState'
import './ClaimedInfoCards.css'

interface ClaimedInfoCardsProps {
  /** Same affordances as the floating viewer's PileOverlay: a card behind a
   *  decision (e.g. a companion's {3} while a prompt is up) stays clickable. */
  playableIds?: Set<string>
  onPlayCard?: (id: string) => void
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
}

/** The looked-at/revealed cards behind the pending decision (e.g. Jace, the
 *  Mind Sculptor's +2 top card), shown inside the prompt dialog. */
export default function ClaimedInfoCards({ playableIds, onPlayCard, targetIds, onTargetClick }: ClaimedInfoCardsProps) {
  const { t } = useTranslation()
  const windows = useClaimedInfoWindows()
  const cardPreview = usePromptCardPreview()

  if (windows.length === 0) return null
  return (
    <div className="feedback-info-cards" data-testid="feedback-info-cards">
      {windows.map((w) => (
        <section key={w.key} className="feedback-info-group" data-info-window={w.kind}>
          <div className="feedback-info-title">{infoWindowTitle(t, w.kind, w.name)}</div>
          <div className="feedback-info-row">
            {Object.entries(w.cards).map(([id, card]) => {
              const isPlayable = playableIds?.has(id) === true
              const isTarget = targetIds?.has(id) === true
              const onClick = isPlayable && onPlayCard
                ? () => onPlayCard(id)
                : isTarget && onTargetClick
                  ? () => onTargetClick(id)
                  : undefined
              // A card that plays or targets keeps its click and gets a zoom button; any other card
              // shows its preview wherever it is pointed at or touched.
              return onClick ? (
                <PromptCardZoomable key={id} preview={cardPreview} previewKey={`${w.key}:${id}`} card={card} className="feedback-info-card">
                  <CardSlot
                    cardId={id}
                    card={card}
                    isPlayable={isPlayable}
                    isTarget={isTarget}
                    onClick={onClick}
                  />
                </PromptCardZoomable>
              ) : (
                <PromptCardThumb key={id} preview={cardPreview} previewKey={`${w.key}:${id}`} card={card} className="feedback-info-card" />
              )
            })}
          </div>
        </section>
      ))}
      {cardPreview.preview}
    </div>
  )
}
