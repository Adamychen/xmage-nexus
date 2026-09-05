import * as cmds from '../net/commands'
import { useSettings, setSetting, useStore } from '../state/store'
import type { GameView } from '../net/types'
import { useTranslation } from '../i18n'
import { SKIPS, CANCEL_SKIP_ACTION, CANCEL_SKIP_SHORTCUT, activeSkipOf } from './skips'
import Icon from '../ui/Icon'
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
        <button
          key={skip.key}
          type="button"
          className={`pass-menu-item ${activeSkip?.key === skip.key ? 'is-active' : ''}`}
          data-testid={`skip-${skip.key}`}
          title={`${t('game', skip.labelKey)} (${skip.shortcut})`}
          onClick={() => onSkip(skip.action)}
        >
          <span className="pass-menu-item-label">{t('game', skip.labelKey)}</span>
          <kbd className="pass-menu-key">{skip.shortcut}</kbd>
        </button>
      ))}
      {activeSkip && (
        <button
          type="button"
          className="pass-menu-item pass-menu-cancel"
          data-testid="skip-cancel"
          title={`${t('game', 'skip_cancel')} (${CANCEL_SKIP_SHORTCUT})`}
          onClick={() => onSkip(CANCEL_SKIP_ACTION)}
        >
          <span className="pass-menu-item-label">✕ {t('game', 'skip_cancel')}</span>
          <kbd className="pass-menu-key">{CANCEL_SKIP_SHORTCUT}</kbd>
        </button>
      )}
      <div className="pass-menu-divider" />
      <div className="pass-menu-section-label">{t('game', 'automation')}</div>
      <label className={`toggle pass-menu-check hold-priority-toggle ${settings.holdPriority ? 'is-active' : ''}`} title={t('game', 'hold_priority_title')} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={settings.holdPriority}
          onChange={(e) => {
            const val = e.target.checked
            setSetting('holdPriority', val)
            if (gameId) void cmds.sendPlayerAction(val ? 'HOLD_PRIORITY' : 'UNHOLD_PRIORITY', gameId)
          }}
        />
        <Icon name="zap" size={12} /> {t('game', 'hold_priority')}
      </label>
      <label className="toggle pass-menu-check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={settings.autoPass}
          onChange={(e) => setSetting('autoPass', e.target.checked)}
        />
        {t('game', 'auto_pass')}
      </label>
    </div>
  )
}
