import { useSettings, setSetting } from '../state/store'
import { useTranslation } from '../i18n'
import Toggle from '../ui/Toggle'

export default function GameUiSettings() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <Toggle
      checked={settings.gameUi === 'v2'}
      onChange={(v) => setSetting('gameUi', v ? 'v2' : 'v1')}
      label={t('lobby', 'game_ui_show')}
      title={t('lobby', 'game_ui_show_hint')}
      data-testid="game-ui-toggle"
    />
  )
}
