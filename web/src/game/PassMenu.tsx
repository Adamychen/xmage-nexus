import * as cmds from '../net/commands'
import MenuItem from '../ui/MenuItem'
import Checkbox from '../ui/Checkbox'
import { useSettings, setSetting, useStore } from '../state/store'
import type { GameView } from '../net/types'
import { useTranslation } from '../i18n'
import { SKIPS, CANCEL_SKIP_ACTION, CANCEL_SKIP_SHORTCUT, activeSkipOf } from './skips'
import './PassMenu.css'

interface PassMenuProps {
  game: GameView | null
  onSkip: (action: string) => void
}

export default function PassMenu({ game, onSkip }: PassMenuProps) {
  const { t } = useTranslation()
  const settings = useSettings()
  const gameId = useStore((s) => s.gameId)
  const me = game?.players?.find((p) => p.controlled)
  const activeSkip = activeSkipOf(me)

  return (
    <div className="pass-menu" role="menu" data-testid="pass-menu">
      <div className="pass-menu-section-label">{t('game', 'pass_options')}</div>
      {SKIPS.map((skip) => (
        <MenuItem
          key={skip.key}
          role="menuitem"
          selected={activeSkip?.key === skip.key}
          className="pass-menu-item"
          data-testid={`skip-${skip.key}`}
          title={`${t('game', skip.labelKey)} (${skip.shortcut})`}
          onClick={() => onSkip(skip.action)}
        >
          <span className="pass-menu-item-label">{t('game', skip.labelKey)}</span>
          <kbd className="pass-menu-key">{skip.shortcut}</kbd>
        </MenuItem>
      ))}
      {activeSkip && (
        <MenuItem
          role="menuitem"
          danger
          className="pass-menu-item"
          data-testid="skip-cancel"
          title={`${t('game', 'skip_cancel')} (${CANCEL_SKIP_SHORTCUT})`}
          onClick={() => onSkip(CANCEL_SKIP_ACTION)}
        >
          <span className="pass-menu-item-label">✕ {t('game', 'skip_cancel')}</span>
          <kbd className="pass-menu-key">{CANCEL_SKIP_SHORTCUT}</kbd>
        </MenuItem>
      )}
      <div className="pass-menu-divider" />
      <div className="pass-menu-section-label">{t('game', 'automation')}</div>
      <Checkbox
        className={`pass-menu-check hold-priority-toggle ${settings.holdPriority ? 'is-active' : ''}`}
        title={t('game', 'hold_priority_title')}
        onClick={(e) => e.stopPropagation()}
        checked={settings.holdPriority}
        onChange={(val) => {
          setSetting('holdPriority', val)
          if (gameId) void cmds.sendPlayerAction(val ? 'HOLD_PRIORITY' : 'UNHOLD_PRIORITY', gameId)
        }}
        icon="zap"
        label={t('game', 'hold_priority')}
      />
      <Checkbox
        className="pass-menu-check"
        onClick={(e) => e.stopPropagation()}
        checked={settings.autoPass}
        onChange={(next) => setSetting('autoPass', next)}
        label={t('game', 'auto_pass')}
      />
      <Checkbox
        className="pass-menu-check"
        onClick={(e) => e.stopPropagation()}
        checked={settings.smartStops}
        onChange={(next) => setSetting('smartStops', next)}
        label={t('game', 'smart_stops')}
        title={t('game', 'smart_stops_hint')}
        data-testid="smart-stops-toggle"
      />
    </div>
  )
}
