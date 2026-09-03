import { SLEEVES } from './sleeves'
import { useTranslation } from '../i18n'
import { useSettings } from '../state/selectors'
import { setSetting } from '../state/actions'
import './AppearanceSettingsModal.css'
import './SleevePickerModal.css'

interface Props {
  onClose: () => void
}

const LAYOUTS: Array<{ id: 'standard' | 'pod' | 'arena'; labelKey: string; descKey: string; icon: string }> = [
  { id: 'standard', labelKey: 'board_standard', descKey: 'board_standard_desc', icon: '▭' },
  { id: 'pod', labelKey: 'board_pod', descKey: 'board_pod_desc', icon: '⊞' },
  { id: 'arena', labelKey: 'board_arena', descKey: 'board_arena_desc', icon: '⬒' },
]

export default function AppearanceSettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog panel appearance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="appearance-header">
          <h2>{t('lobby', 'appearance_title')}</h2>
          <button type="button" className="appearance-close" onClick={onClose}>✕</button>
        </div>
        <p className="appearance-subtitle">{t('lobby', 'appearance_subtitle')}</p>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'appearance_board_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'appearance_board_hint')}</p>
          <div className="board-layout-grid">
            {LAYOUTS.map((l) => {
              const isSelected = settings.boardLayout === l.id
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`board-layout-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSetting('boardLayout', l.id)}
                  data-testid={`board-layout-${l.id}`}
                >
                  <span className="board-layout-icon">{l.icon}</span>
                  <span className="board-layout-label">{t('lobby', l.labelKey as any)}</span>
                  <span className="board-layout-desc">{t('lobby', l.descKey as any)}</span>
                  {isSelected && <span className="board-layout-check">✓</span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'sleeve_pick_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'sleeve_pick_subtitle')}</p>
          <div className="appearance-sleeve-grid">
            {SLEEVES.map((s) => {
              const isSelected = settings.sleeveId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sleeve-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSetting('sleeveId', s.id)}
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
        </section>

        <div className="appearance-footer">
          <button type="button" className="primary" onClick={onClose}>{t('common', 'close')}</button>
        </div>
      </div>
    </div>
  )
}
