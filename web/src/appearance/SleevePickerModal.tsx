import { SLEEVES } from './sleeves'
import { useTranslation } from '../i18n'
import { getState } from '../state/state'
import { setSetting } from '../state/actions'
import DialogShell from '../ui/DialogShell'
import './SleevePickerModal.css'

interface Props {
  onClose: () => void
}

export default function SleevePickerModal({ onClose }: Props) {
  const { t } = useTranslation()
  const current = getState().settings.sleeveId

  return (
    <DialogShell
      labelledBy="sleeve-title"
      titleId="sleeve-title"
      legacyBackdropClass="overlay"
      legacyPanelClass="dialog sleeve-picker-dialog"
      kickerIcon="layers"
      kickerLabel={SLEEVES.find((s) => s.id === current)?.name ?? t('lobby', 'sleeve_pick_title')}
      title={t('lobby', 'sleeve_pick_title')}
      message={t('lobby', 'sleeve_pick_subtitle')}
      topRight={(
        <button type="button" className="sleeve-picker-close" onClick={onClose}>✕</button>
      )}
      onBackdropClick={onClose}
    >
        <div className="sleeve-picker-grid">
          {SLEEVES.map((s) => {
            const isSelected = s.id === current
            return (
              <button
                key={s.id}
                type="button"
                className={`sleeve-item ${isSelected ? 'selected' : ''}`}
                onClick={() => { setSetting('sleeveId', s.id); onClose() }}
                data-testid={`sleeve-${s.id}`}
                title={s.name}
              >
                <div className="sleeve-preview" style={s.kind === 'css' ? { background: s.css } : undefined}>
                  {s.kind === 'css' ? (
                    <span className="sleeve-preview-emblem" style={{ color: s.accent }}>{s.emblem}</span>
                  ) : (
                    <img src={s.imageUrl} alt={s.name} draggable={false} />
                  )}
                  {isSelected && <span className="sleeve-check">✓</span>}
                </div>
                <span className="sleeve-name">{s.name}</span>
              </button>
            )
          })}
        </div>
        <div className="sleeve-picker-footer">
          <button type="button" onClick={onClose}>{t('common', 'close')}</button>
        </div>
    </DialogShell>
  )
}
