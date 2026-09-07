import { SLEEVES } from './sleeves'
import { ZOOM_PRESETS, isZoomPreset, stepZoom, zoomPercent } from './zoom'
import { useTranslation } from '../i18n'
import { useSettings } from '../state/selectors'
import { setSetting } from '../state/actions'
import DialogShell from '../ui/DialogShell'
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

const UI_SCALE_DESC_KEYS: Record<string, 'ui_scale_compact' | 'ui_scale_normal' | 'ui_scale_large' | 'ui_scale_xlarge' | 'ui_scale_cjk'> = {
  '90%': 'ui_scale_compact',
  '100%': 'ui_scale_normal',
  '115%': 'ui_scale_large',
  '130%': 'ui_scale_xlarge',
  '150%': 'ui_scale_cjk',
}
const UI_SCALES = ZOOM_PRESETS.map((value) => {
  const label = `${Math.round(value * 100)}%`
  return { value, label, descKey: UI_SCALE_DESC_KEYS[label] }
})

export default function AppearanceSettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <DialogShell
      labelledBy="appearance-title"
      titleId="appearance-title"
      legacyBackdropClass="overlay"
      legacyPanelClass="dialog appearance-modal"
      kickerIcon="palette"
      kickerLabel={t('lobby', 'settings_interface')}
      title={t('lobby', 'appearance_title')}
      message={t('lobby', 'appearance_subtitle')}
      topRight={(
        <button type="button" className="appearance-close" onClick={onClose}>✕</button>
      )}
      onBackdropClick={onClose}
    >
        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'ui_scale_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'ui_scale_hint_lobby')}</p>
          <div className="ui-scale-stepper">
            <button
              type="button"
              className="ui-scale-step"
              onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, -1))}
              title={t('lobby', 'zoom_out')}
              aria-label={t('lobby', 'zoom_out')}
              data-testid="ui-scale-minus"
            >
              −
            </button>
            <button
              type="button"
              className="ui-scale-current"
              onClick={() => setSetting('uiScale', 1)}
              title={t('lobby', 'zoom_reset')}
              data-testid="ui-scale-current"
            >
              {zoomPercent(settings.uiScale)}%
            </button>
            <button
              type="button"
              className="ui-scale-step"
              onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, 1))}
              title={t('lobby', 'zoom_in')}
              aria-label={t('lobby', 'zoom_in')}
              data-testid="ui-scale-plus"
            >
              +
            </button>
          </div>
          <div className="ui-scale-grid">
            {UI_SCALES.map((o) => {
              const isSelected = isZoomPreset(settings.uiScale, o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  className={`ui-scale-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSetting('uiScale', o.value)}
                  data-testid={`ui-scale-${String(o.value).replace('.', '-')}`}
                >
                  <span className="ui-scale-label">{o.label}</span>
                  <span className="ui-scale-desc">{o.descKey ? t('lobby', o.descKey) : ''}</span>
                  {isSelected && <span className="ui-scale-check">✓</span>}
                </button>
              )
            })}
          </div>
          <label className="ui-scale-cjk-toggle">
            <input
              type="checkbox"
              checked={settings.cjkBoost}
              onChange={(e) => setSetting('cjkBoost', e.target.checked)}
              data-testid="cjk-boost-toggle"
            />
            <span>{t('lobby', 'cjk_boost_label')}</span>
          </label>
          <p className="ui-scale-hint">{t('lobby', 'cjk_boost_combo_hint')}</p>
        </section>

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
    </DialogShell>
  )
}
