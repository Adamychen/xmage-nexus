import { useStore, setState } from '../state/store'
import Button from '../ui/Button'
import Chip from '../ui/Chip'
import EmptyState from '../ui/EmptyState'
import CardSlot from '../board/CardSlot'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'

export default function LimitedDeckDialog() {
  const { t } = useTranslation()
  const viewer = useStore((s) => s.viewer)
  if (!viewer) return null

  const close = () => setState({ viewer: null })

  return (
    <DialogShell
      labelledBy="viewer-title"
      titleId="viewer-title"
      size="lg"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog card-grid-dialog"
      kickerIcon="layers"
      kickerLabel={t('dialogs', 'viewer_title')}
      title={<>{viewer.title} <Chip tone="brand" size="md">
        {viewer.cards.length} {viewer.cards.length === 1 ? t('dialogs', 'viewer_card_single') : t('dialogs', 'viewer_card_plural')}
      </Chip></>}
      onBackdropClick={close}
    >
        <div className="card-grid-scroll-area">
          <div className="card-grid">
            {viewer.cards.map((card) => (
              <div key={card.id} className="card-grid-cell">
                <CardSlot card={card as never} cardId={card.id} />
                <span className="card-grid-label">{card.displayName ?? card.name}</span>
              </div>
            ))}
          </div>
          {viewer.cards.length === 0 && (
            <EmptyState>{t('dialogs', 'viewer_empty')}</EmptyState>
          )}
        </div>
        <footer className="card-grid-actions">
          <Button onClick={close}>{t('dialogs', 'viewer_close')}</Button>
        </footer>
    </DialogShell>
  )
}
