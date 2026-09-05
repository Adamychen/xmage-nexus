import { useState } from 'react'
import {
  returnToLobby,
  concedeGame,
  concedeMatch,
  openRollbackDialog,
  useGame,
  useSettings,
  setSetting,
  useStore,
} from '../state/store'
import { FX_SPEEDS } from '../board/fx'
import { useFullscreen } from '../utils/fullscreen'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import Icon from '../ui/Icon'
import { sendTriggerAutoOrder } from '../net/commands'
import { clearAutoAnswers, removeAutoAnswer } from './autoAnswers'
import AppearanceSettingsModal from '../appearance/AppearanceSettingsModal'
import HelpWikiModal from './HelpWikiModal'
import './GameMenu.css'

export default function GameMenu() {
  const { t } = useTranslation()
  const game = useGame()
  const gameId = useStore((s) => s.gameId)
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [showFx, setShowFx] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [isFullscreenActive, toggleFullscreen] = useFullscreen()

  const me = game?.players?.find((p) => p.controlled)
  const opps = game?.players?.filter((p) => !p.controlled) ?? []
  const isMultiplayer = opps.length >= 2
  const layoutMode: 'standard' | 'pod' | 'arena' =
    settings.boardLayout === 'arena' && isMultiplayer
      ? 'arena'
      : settings.boardLayout === 'pod' || (isMultiplayer && settings.boardLayout !== 'standard' && settings.boardLayout !== 'arena')
        ? 'pod'
        : 'standard'

  const close = () => {
    setOpen(false)
    setShowFx(false)
  }

  const toggleMenu = () => {
    soundManager.play('ui_click', 'ui')
    setOpen((prev) => !prev)
  }

  return (
    <div className="game-menu">
      <button
        type="button"
        className={`game-menu-btn ${open ? 'is-open' : ''}`}
        data-testid="game-menu-btn"
        title={t('game', 'game_menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="game-menu-overlay" onClick={close} />
          <div className="game-menu-panel" role="menu" data-testid="game-menu">
            {me && (
              <button
                type="button"
                className="leave-game-btn game-menu-item"
                onClick={async () => {
                  if (confirm(t('game', 'concede_confirm'))) {
                    if (gameId) await concedeGame(gameId)
                    close()
                  }
                }}
                title={t('game', 'concede_confirm')}
              >
                <Icon name="flag" size={13} /> {t('game', 'concede')}
              </button>
            )}
            <button
              type="button"
              className="leave-match-btn game-menu-item"
              onClick={async () => {
                const msg = me ? t('game', 'concede_prompt') : t('game', 'leave_spectate_prompt')
                if (confirm(msg)) {
                  if (me && gameId) {
                    await concedeMatch(gameId)
                  } else {
                    returnToLobby()
                  }
                  close()
                }
              }}
              title={me ? t('game', 'concede_prompt') : t('game', 'return_to_lobby')}
            >
              <Icon name="door" size={13} /> {t('game', 'leave')}
            </button>
            {game?.rollbackTurnsAllowed && !!me && (
              <button
                type="button"
                className="rollback-game-btn game-menu-item"
                onClick={() => {
                  openRollbackDialog()
                  close()
                }}
                title={t('game', 'rollback_title')}
              >
                ⏪ {t('game', 'rollback')}
              </button>
            )}
            {!!me && !!gameId && (
              <button
                type="button"
                className="game-menu-item"
                data-testid="game-menu-trigger-reset"
                title={t('game', 'trigger_menu_reset')}
                onClick={() => {
                  void sendTriggerAutoOrder('TRIGGER_AUTO_ORDER_RESET_ALL', gameId)
                  close()
                }}
              >
                🌀 {t('game', 'trigger_menu_reset')}
              </button>
            )}
            {!!me && (
              <>
                <div className="game-menu-divider" />
                <div className="game-menu-section-label" data-testid="game-menu-auto-answers-label">
                  {t('game', 'auto_answers_title', { count: settings.autoAnswers.length })}
                </div>
                {settings.autoAnswers.length === 0 && (
                  <div className="game-menu-auto-empty">{t('game', 'auto_answers_empty')}</div>
                )}
                {settings.autoAnswers.map((rule) => (
                  <div key={rule.id} className="game-menu-auto-row" data-testid={`game-menu-auto-rule-${rule.id}`}>
                    <span className="game-menu-auto-text" title={rule.pattern}>{rule.pattern}</span>
                    <span className={`game-menu-auto-badge ${rule.answer ? 'is-yes' : 'is-no'}`}>
                      {rule.answer ? t('common', 'yes') : t('common', 'no')}
                    </span>
                    <button
                      type="button"
                      className="game-menu-auto-delete"
                      title={t('common', 'delete') ?? ''}
                      aria-label={t('game', 'auto_answers_delete', { pattern: rule.pattern })}
                      data-testid={`game-menu-auto-delete-${rule.id}`}
                      onClick={() => setSetting('autoAnswers', removeAutoAnswer(settings.autoAnswers, rule.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {settings.autoAnswers.length > 0 && (
                  <button
                    type="button"
                    className="game-menu-item"
                    data-testid="game-menu-auto-clear"
                    onClick={() => {
                      setSetting('autoAnswers', clearAutoAnswers())
                      close()
                    }}
                  >
                    🗑️ {t('game', 'auto_answers_clear')}
                  </button>
                )}
              </>
            )}
            <div className="game-menu-divider" />
            <div className="game-menu-section-label">{t('game', 'board_view')}</div>
            {(['standard', 'pod', ...(isMultiplayer ? ['arena' as const] : [])] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={layoutMode === mode}
                className={`game-menu-item game-menu-radio ${layoutMode === mode ? 'is-active' : ''}`}
                data-testid={`game-menu-layout-${mode}`}
                onClick={() => {
                  setSetting('boardLayout', mode)
                  close()
                }}
              >
                <span className="game-menu-radio-label">
                  {t('lobby', mode === 'standard' ? 'board_standard' : mode === 'pod' ? 'board_pod' : 'board_arena')}
                </span>
                {layoutMode === mode && (
                  <span className="game-menu-radio-check" aria-hidden="true">✓</span>
                )}
              </button>
            ))}
            <button
              type="button"
              className="sleeve-picker-btn game-menu-item"
              data-testid="game-menu-appearance"
              onClick={() => setShowAppearance(true)}
              title={t('lobby', 'appearance_title')}
            >
              🎨 {t('lobby', 'appearance_title')}
            </button>
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-fx"
              aria-expanded={showFx}
              onClick={() => setShowFx((prev) => !prev)}
            >
              ⚙️ {t('common', 'settings')}
            </button>
            {showFx && (
              <div className="game-menu-fx" onClick={(e) => e.stopPropagation()}>
                <div className="fx-popover-row">
                  <div className="fx-popover-text">
                    <span className="fx-popover-label">{t('game', 'fx_effects')}</span>
                    <span className="fx-popover-hint">{t('game', 'fx_effects_hint')}</span>
                  </div>
                  <button
                    type="button"
                    className={`fx-toggle ${settings.effects ? 'on' : ''}`}
                    role="switch"
                    aria-checked={settings.effects}
                    title={t('game', 'fx_effects_hint')}
                    onClick={() => setSetting('effects', !settings.effects)}
                  >
                    <span className="fx-toggle-knob" />
                  </button>
                </div>
                <div className="fx-popover-row">
                  <span className="fx-popover-label">{t('game', 'fx_speed')}</span>
                  <div className="fx-speed-group">
                    {FX_SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`fx-speed-btn ${settings.animationSpeed === s ? 'active' : ''}`}
                        onClick={() => setSetting('animationSpeed', s)}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fx-popover-divider" />
                <div className="fx-popover-row">
                  <div className="fx-popover-text">
                    <span className="fx-popover-label">{t('game', 'sound_enabled')}</span>
                    <span className="fx-popover-hint">{t('game', 'sound_enabled_hint')}</span>
                  </div>
                  <button
                    type="button"
                    className={`fx-toggle ${settings.soundEnabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={settings.soundEnabled}
                    title={t('game', 'sound_enabled_hint')}
                    onClick={() => {
                      const next = !settings.soundEnabled
                      setSetting('soundEnabled', next)
                      if (next) soundManager.play('ui_click', 'ui')
                    }}
                  >
                    <span className="fx-toggle-knob" />
                  </button>
                </div>
                <div className="fx-popover-row">
                  <span className="fx-popover-label">{t('game', 'sound_volume_master')}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="audio-slider"
                    value={settings.masterVolume}
                    disabled={!settings.soundEnabled}
                    onChange={(e) => setSetting('masterVolume', parseFloat(e.target.value))}
                  />
                </div>
                <div className="fx-popover-row">
                  <span className="fx-popover-label">{t('game', 'sound_volume_sfx')}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="audio-slider"
                    value={settings.sfxVolume}
                    disabled={!settings.soundEnabled}
                    onChange={(e) => setSetting('sfxVolume', parseFloat(e.target.value))}
                  />
                </div>
                <div className="fx-popover-row">
                  <span className="fx-popover-label">{t('game', 'sound_volume_ui')}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="audio-slider"
                    value={settings.uiVolume}
                    disabled={!settings.soundEnabled}
                    onChange={(e) => setSetting('uiVolume', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-help"
              title={t('game', 'help_wiki')}
              onClick={() => setShowHelp(true)}
            >
              ❓ {t('game', 'help_wiki')}
            </button>
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-fullscreen"
              title={isFullscreenActive ? t('game', 'exit_fullscreen') : t('game', 'enter_fullscreen')}
              onClick={() => void toggleFullscreen()}
            >
              ⛶ {isFullscreenActive ? t('game', 'exit_fullscreen') : t('game', 'enter_fullscreen')}
            </button>
          </div>
        </>
      )}
      {showAppearance && <AppearanceSettingsModal onClose={() => setShowAppearance(false)} />}
      {showHelp && <HelpWikiModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
