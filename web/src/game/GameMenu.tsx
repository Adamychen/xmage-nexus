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
import { useFullscreen } from '../utils/fullscreen'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import Icon from '../ui/Icon'
import { sendTriggerAutoOrder, sendManaPaymentMode, updateManaConfirmPreference } from '../net/commands'
import type { ManaPaymentAction } from '../net/commands'
import type { ManaPaymentStored } from '../state/persistence'
import { clearAutoAnswers, removeAutoAnswer } from './autoAnswers'
import { clearChoiceMemory, removeChoiceMemory } from './choiceMemory'
import SettingsModal from '../settings/SettingsModal'
import HelpWikiModal from './HelpWikiModal'
import { confirmDialog } from '../ui/confirmDialog'
import './GameMenu.css'

export default function GameMenu() {
  const { t } = useTranslation()
  const game = useGame()
  const gameId = useStore((s) => s.gameId)
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [isFullscreenActive, toggleFullscreen] = useFullscreen()

  const me = game?.players?.find((p) => p.controlled)

  const toggleManaPayment = (key: keyof ManaPaymentStored) => {
    const next = { ...settings.manaPayment, [key]: !settings.manaPayment[key] }
    setSetting('manaPayment', next)
    if (key === 'confirmEmptyPool') {
      void updateManaConfirmPreference(next.confirmEmptyPool)
      return
    }
    if (!gameId) return
    const action: ManaPaymentAction | null =
      key === 'auto'
        ? next.auto
          ? 'MANA_AUTO_PAYMENT_ON'
          : 'MANA_AUTO_PAYMENT_OFF'
        : key === 'restricted'
          ? next.restricted
            ? 'MANA_AUTO_PAYMENT_RESTRICTED_ON'
            : 'MANA_AUTO_PAYMENT_RESTRICTED_OFF'
          : key === 'useFirstAbility'
            ? next.useFirstAbility
              ? 'USE_FIRST_MANA_ABILITY_ON'
              : 'USE_FIRST_MANA_ABILITY_OFF'
            : null
    if (action) void sendManaPaymentMode(action, gameId)
  }

  const manaRows: Array<{ key: keyof ManaPaymentStored; label: string; tip: string; testid: string }> = [
    { key: 'auto', label: t('game', 'mana_payment_auto'), tip: t('game', 'mana_payment_auto_tip'), testid: 'game-menu-mana-auto' },
    { key: 'restricted', label: t('game', 'mana_payment_restricted'), tip: t('game', 'mana_payment_restricted_tip'), testid: 'game-menu-mana-restricted' },
    { key: 'useFirstAbility', label: t('game', 'mana_payment_first'), tip: t('game', 'mana_payment_first_tip'), testid: 'game-menu-mana-first' },
    { key: 'confirmEmptyPool', label: t('game', 'mana_payment_confirm'), tip: t('game', 'mana_payment_confirm_tip'), testid: 'game-menu-mana-confirm' },
  ]

  const close = () => {
    setOpen(false)
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
                  close()
                  if (await confirmDialog(t('game', 'concede_confirm'), { danger: true })) {
                    if (gameId) await concedeGame(gameId)
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
                close()
                if (await confirmDialog(msg, { danger: !!me })) {
                  if (me && gameId) {
                    await concedeMatch(gameId)
                  } else {
                    returnToLobby()
                  }
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
                <Icon name="undo" size={13} /> {t('game', 'rollback')}
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
                <Icon name="refresh" size={13} /> {t('game', 'trigger_menu_reset')}
              </button>
            )}
            {!!me && (
              <>
                <div className="game-menu-divider" />
                <div className="game-menu-section-label" data-testid="game-menu-mana-label">
                  {t('game', 'mana_payment_title')}
                </div>
                {manaRows.map((row) => (
                  <label key={row.key} className="game-menu-check" title={row.tip} data-testid={row.testid}>
                    <input
                      type="checkbox"
                      checked={settings.manaPayment[row.key]}
                      onChange={() => toggleManaPayment(row.key)}
                    />
                    <span>{row.label}</span>
                  </label>
                ))}
              </>
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
                    <Icon name="trash" size={13} /> {t('game', 'auto_answers_clear')}
                  </button>
                )}
                <div className="game-menu-section-label" data-testid="game-menu-choice-memory-label">
                  {t('game', 'choice_memory_title', { count: settings.choiceMemory.length })}
                </div>
                {settings.choiceMemory.length === 0 && (
                  <div className="game-menu-auto-empty">{t('game', 'choice_memory_empty')}</div>
                )}
                {settings.choiceMemory.map((rule) => (
                  <div key={rule.id} className="game-menu-auto-row" data-testid={`game-menu-choice-rule-${rule.id}`}>
                    <span className="game-menu-auto-text" title={`${rule.pattern} → ${rule.value}`}>{rule.value}</span>
                    <button
                      type="button"
                      className="game-menu-auto-delete"
                      title={t('common', 'delete') ?? ''}
                      aria-label={t('game', 'choice_memory_delete', { pattern: rule.pattern })}
                      data-testid={`game-menu-choice-delete-${rule.id}`}
                      onClick={() => setSetting('choiceMemory', removeChoiceMemory(settings.choiceMemory, rule.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {settings.choiceMemory.length > 0 && (
                  <button
                    type="button"
                    className="game-menu-item"
                    data-testid="game-menu-choice-clear"
                    onClick={() => {
                      setSetting('choiceMemory', clearChoiceMemory())
                      close()
                    }}
                  >
                    <Icon name="trash" size={13} /> {t('game', 'choice_memory_clear')}
                  </button>
                )}
              </>
            )}
            <div className="game-menu-divider" />
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-settings"
              onClick={() => {
                setShowSettings(true)
                close()
              }}
            >
              <Icon name="settings" size={13} /> {t('common', 'settings')}
            </button>
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-help"
              title={t('game', 'help_wiki')}
              onClick={() => setShowHelp(true)}
            >
              <Icon name="bookOpen" size={13} /> {t('game', 'help_wiki')}
            </button>
            <button
              type="button"
              className="game-menu-item"
              data-testid="game-menu-fullscreen"
              title={isFullscreenActive ? t('game', 'exit_fullscreen') : t('game', 'enter_fullscreen')}
              onClick={() => void toggleFullscreen()}
            >
              <Icon name="maximize" size={13} /> {isFullscreenActive ? t('game', 'exit_fullscreen') : t('game', 'enter_fullscreen')}
            </button>
          </div>
        </>
      )}
      {showSettings && <SettingsModal initialSection="gameplay" onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpWikiModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
