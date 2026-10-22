import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import { HAND_RAIL_MAX_W, HAND_RAIL_MIN_W } from '../board/cardOverlays'
import OptionChoice from './OptionChoice'

export default function RenderedCardsSettings() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <OptionChoice
        kind="rendered"
        label={t('lobby', 'card_render_show')}
        hint={t('lobby', 'card_render_show_hint')}
        value={settings.cardRender === 'rendered'}
        onChange={(v) => setSetting('cardRender', v ? 'rendered' : 'image')}
      />
      <OptionChoice
        kind="boardFill"
        label={t('lobby', 'board_fill_show')}
        hint={t('lobby', 'board_fill_show_hint')}
        value={settings.boardFill}
        onChange={(v) => setSetting('boardFill', v)}
      />
      <OptionChoice
        kind="boardSpotlight"
        label={t('lobby', 'board_spotlight_show')}
        hint={t('lobby', 'board_spotlight_show_hint')}
        value={settings.boardSpotlight}
        onChange={(v) => setSetting('boardSpotlight', v)}
      />
      <OptionChoice
        kind="handRail"
        label={t('lobby', 'hand_rail_show')}
        hint={t('lobby', 'hand_rail_show_hint')}
        value={settings.handRail}
        onChange={(v) => setSetting('handRail', v)}
      />
      <OptionChoice
        kind="handRow"
        label={t('lobby', 'hand_row_show')}
        hint={t('lobby', 'hand_row_show_hint')}
        value={settings.handRow}
        onChange={(v) => setSetting('handRow', v)}
      />
      {settings.cardRender !== 'rendered' && (
        <OptionChoice
          kind="stackCaption"
          label={t('lobby', 'stack_caption_show')}
          hint={t('lobby', 'stack_caption_show_hint')}
          value={settings.stackCaption}
          onChange={(v) => setSetting('stackCaption', v)}
        />
      )}
      {(settings.handRail || settings.handRow) && (
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
