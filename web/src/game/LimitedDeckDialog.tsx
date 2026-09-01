import { useStore, setState } from '../state/store'
import CardSlot from '../board/CardSlot'
import { useTranslation } from '../i18n'

export default function LimitedDeckDialog() {
  const { t } = useTranslation()
  const viewer = useStore((s) => s.viewer)
  if (!viewer) return null

  const close = () => setState({ viewer: null })

  return (
    <div className="feedback-backdrop" role="presentation" onClick={close}>
      <section
        className="feedback-dialog card-grid-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="card-grid-header">
          <div className="feedback-kicker">
            <span className="kicker-icon">🗂️</span> {t('dialogs', 'viewer_title')}
          </div>
          <div className="card-grid-title-row">
            <h2 id="viewer-title">{viewer.title}</h2>
            <span className="card-grid-count-badge">
              {viewer.cards.length} {viewer.cards.length === 1 ? t('dialogs', 'viewer_card_single') : t('dialogs', 'viewer_card_plural')}
            </span>
          </div>
        </header>
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
            <div className="card-grid-empty">
              <p>{t('dialogs', 'viewer_empty')}</p>
            </div>
          )}
        </div>
        <footer className="card-grid-actions">
          <button onClick={close}>{t('dialogs', 'viewer_close')}</button>
        </footer>
      </section>
    </div>
  )
}
