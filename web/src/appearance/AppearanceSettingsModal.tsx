import type { TranslationSchema } from '../i18n/types'
import CloseButton from '../ui/CloseButton'
import IconButton from '../ui/IconButton'
import Checkbox from '../ui/Checkbox'
import Toggle from '../ui/Toggle'
import { SLEEVES } from './sleeves'
import CustomSleeveTile from './CustomSleeveTile'
import CustomCardArtManager from './CustomCardArtManager'
import PlaymatPicker from './PlaymatPicker'
import { CARD_STYLES, TAP_STYLES } from '../board/compactCard'
import { PT_BADGE_MODES, SICKNESS_STYLES } from '../board/cardOverlays'
import { ZOOM_PRESETS, isZoomPreset, stepZoom, zoomPercent } from './zoom'
import { useTranslation } from '../i18n'
import { useSettings } from '../state/selectors'
import { setSetting } from '../state/actions'
import DialogShell from '../ui/DialogShell'
import './AppearanceSettingsModal.css'
import './SleevePickerModal.css'
import Button from '../ui/Button'

interface Props {
  onClose: () => void
}

const LAYOUTS: Array<{ id: 'standard' | 'pod' | 'arena'; labelKey: keyof TranslationSchema['lobby']; descKey: keyof TranslationSchema['lobby']; icon: string }> = [
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
        <CloseButton variant="plain" size="md" className="appearance-close" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'ui_scale_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'ui_scale_hint_lobby')}</p>
          <div className="ui-scale-stepper">
            <IconButton label={t('lobby', 'zoom_out')} size="lg"
              onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, -1))}
              data-testid="ui-scale-minus">
              −
            </IconButton>
            <button
              type="button"
              className="ui-scale-current"
              onClick={() => setSetting('uiScale', 1)}
              title={t('lobby', 'zoom_reset')}
              data-testid="ui-scale-current"
            >
              {zoomPercent(settings.uiScale)}%
            </button>
            <IconButton label={t('lobby', 'zoom_in')} size="lg"
              onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, 1))}
              data-testid="ui-scale-plus">
              +
            </IconButton>
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
          <Checkbox
            className="ui-scale-cjk-toggle"
            checked={settings.cjkBoost}
            onChange={(next) => setSetting('cjkBoost', next)}
            inputTestId="cjk-boost-toggle"
            label={t('lobby', 'cjk_boost_label')}
          />
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
                  <span className="board-layout-label">{t('lobby', l.labelKey)}</span>
                  <span className="board-layout-desc">{t('lobby', l.descKey)}</span>
                  {isSelected && <span className="board-layout-check">✓</span>}
                </button>
              )
            })}
          </div>
          <Checkbox
            className="ui-scale-cjk-toggle"
            checked={settings.transparentDialogs}
            onChange={(next) => setSetting('transparentDialogs', next)}
            inputTestId="transparent-dialogs-toggle"
            label={t('lobby', 'dialog_backdrop_label')}
          />
          <p className="ui-scale-hint">{t('lobby', 'dialog_backdrop_hint')}</p>
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'card_overlays_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'card_overlays_hint')}</p>
          <Toggle
            checked={settings.showHandCost}
            onChange={(v) => setSetting('showHandCost', v)}
            label={t('lobby', 'hand_cost_show')}
            title={t('lobby', 'hand_cost_show_hint')}
          />
          <div className="board-layout-grid">
            {PT_BADGE_MODES.map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                className={`board-layout-item ${settings.ptBadgeMode === mode ? 'selected' : ''}`}
                onClick={() => setSetting('ptBadgeMode', mode)}
                aria-pressed={settings.ptBadgeMode === mode}
                data-testid={`appearance-pt-badge-${mode}`}
              >
                <span className="board-layout-label">{t('lobby', `pt_badge_${mode}`)}</span>
                <span className="board-layout-desc">{t('lobby', `pt_badge_${mode}_desc`)}</span>
                {settings.ptBadgeMode === mode && <span className="board-layout-check">✓</span>}
              </Button>
            ))}
          </div>
          <div className="board-layout-grid">
            {SICKNESS_STYLES.map((style) => (
              <Button
                key={style}
                variant="ghost"
                className={`board-layout-item ${settings.sicknessStyle === style ? 'selected' : ''}`}
                onClick={() => setSetting('sicknessStyle', style)}
                aria-pressed={settings.sicknessStyle === style}
                data-testid={`appearance-sickness-style-${style}`}
              >
                <span className="board-layout-label">{t('lobby', `sickness_style_${style}`)}</span>
                <span className="board-layout-desc">{t('lobby', `sickness_style_${style}_desc`)}</span>
                {settings.sicknessStyle === style && <span className="board-layout-check">✓</span>}
              </Button>
            ))}
          </div>
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'card_style_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'card_style_hint')}</p>
          <div className="board-layout-grid">
            {CARD_STYLES.map((style) => {
              const isSelected = settings.cardStyle === style
              return (
                <Button
                  key={style}
                  variant="ghost"
                  className={`board-layout-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSetting('cardStyle', style)}
                  aria-pressed={isSelected}
                  data-testid={`card-style-${style}`}
                >
                  <span className="board-layout-label">{t('lobby', `card_style_${style}`)}</span>
                  <span className="board-layout-desc">{t('lobby', `card_style_${style}_desc`)}</span>
                  {isSelected && <span className="board-layout-check">✓</span>}
                </Button>
              )
            })}
          </div>
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'tap_style_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'tap_style_hint')}</p>
          <div className="board-layout-grid">
            {TAP_STYLES.map((style) => {
              const isSelected = settings.tapStyle === style
              return (
                <Button
                  key={style}
                  variant="ghost"
                  className={`board-layout-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSetting('tapStyle', style)}
                  aria-pressed={isSelected}
                  data-testid={`tap-style-${style}`}
                >
                  <span className="board-layout-label">{t('lobby', `tap_style_${style}`)}</span>
                  <span className="board-layout-desc">{t('lobby', `tap_style_${style}_desc`)}</span>
                  {isSelected && <span className="board-layout-check">✓</span>}
                </Button>
              )
            })}
          </div>
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'playmat_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'playmat_hint')}</p>
          <PlaymatPicker />
        </section>

        <section className="appearance-section">
          <h3 className="appearance-section-title">{t('lobby', 'custom_card_art_title')}</h3>
          <p className="appearance-section-hint">{t('lobby', 'custom_card_art_hint')}</p>
          <CustomCardArtManager />
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
            <CustomSleeveTile selectedId={settings.sleeveId} />
          </div>
        </section>

        <div className="appearance-footer">
          <Button variant="primary" type="button" onClick={onClose}>{t('common', 'close')}</Button>
        </div>
    </DialogShell>
  )
}
