import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import Toggle from '../ui/Toggle'
import { HAND_RAIL_MAX_W, HAND_RAIL_MIN_W } from '../board/cardOverlays'

export default function RenderedCardsSettings() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <Toggle
        checked={settings.cardRender === 'rendered'}
        onChange={(v) => setSetting('cardRender', v ? 'rendered' : 'image')}
        label={t('lobby', 'card_render_show')}
        title={t('lobby', 'card_render_show_hint')}
      />
      <Toggle
        checked={settings.boardFill}
        onChange={(v) => setSetting('boardFill', v)}
        label={t('lobby', 'board_fill_show')}
        title={t('lobby', 'board_fill_show_hint')}
      />
      <Toggle
        checked={settings.handRail}
        onChange={(v) => setSetting('handRail', v)}
        label={t('lobby', 'hand_rail_show')}
        title={t('lobby', 'hand_rail_show_hint')}
      />
      {settings.handRail && (
        <label className="hand-rail-width-row">
          <span>{t('lobby', 'hand_rail_width')}</span>
          <input
            type="range"
            min={HAND_RAIL_MIN_W}
            max={HAND_RAIL_MAX_W}
            step={10}
            className="audio-slider"
            value={settings.handRailWidth}
            aria-label={t('lobby', 'hand_rail_width')}
            data-testid="hand-rail-width"
            onChange={(e) => setSetting('handRailWidth', Number(e.target.value))}
          />
          <span>{settings.handRailWidth}px</span>
        </label>
      )}
    </>
  )
}
