import { useState, useEffect } from 'react'
import { useGame, returnToLobby, concedeGame, useStore, useSettings, setSetting } from '../state/store'
import { FX_SPEEDS } from '../board/fx'
import { useFullscreen } from '../utils/fullscreen'
import { formatTimer, useTickingTimer } from '../utils/timer'
import { useTranslation } from '../i18n'
import HelpWikiModal from './HelpWikiModal'
import './Sidebar.css'

const ICON_PATHS = {
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  help: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  fullscreenExpand: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  fullscreenContract: 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
  exit: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
}

function TurnTimer({ secs, isTicking = false, label }: { secs: number; isTicking?: boolean; label?: string }) {
  const timeLeft = useTickingTimer(secs, isTicking)
  return (
    <span className="sidebar-timer-value" title={label}>
      {formatTimer(timeLeft)}
    </span>
  )
}

export default function Sidebar() {
  const game = useGame()
  const gameId = useStore((s) => s.gameId)
  const settings = useSettings()
  const [showHelp, setShowHelp] = useState(false)
  const [showFx, setShowFx] = useState(false)
  const [isFullscreenActive, toggleFullscreen] = useFullscreen()
  const { t } = useTranslation()

  const me = game?.players?.find((p) => p.controlled)

  // Keyboard shortcut F1 for Wiki
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setShowHelp((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handle = async (id: string) => {
    switch (id) {
      case 'exit': {
        const msg = me
          ? t('game', 'concede_prompt')
          : t('game', 'leave_spectate_prompt')
        if (confirm(msg)) {
          if (me && gameId) {
            await concedeGame(gameId)
          } else {
            returnToLobby()
          }
        }
        break
      }
      case 'help':
        setShowHelp(!showHelp)
        break
      case 'settings':
        setShowFx((prev) => !prev)
        break
      case 'fullscreen':
        toggleFullscreen()
        break
    }
  }

  const priorityPlayer = game?.players?.find((p) => p.hasPriority) ?? game?.players?.find((p) => p.isActive)
  const timerSecs = priorityPlayer?.priorityTimeLeftSecs ?? 0
  const isTimerTicking = !!priorityPlayer?.hasPriority
  const bufferSecs = game?.bufferTime ?? 0

  const navItems = [
    { id: 'settings', label: t('common', 'settings'), path: ICON_PATHS.settings, active: showFx },
    { id: 'help', label: t('game', 'help_wiki'), path: ICON_PATHS.help, active: showHelp },
    {
      id: 'fullscreen',
      label: isFullscreenActive ? t('game', 'exit_fullscreen') : t('game', 'enter_fullscreen'),
      path: isFullscreenActive ? ICON_PATHS.fullscreenContract : ICON_PATHS.fullscreenExpand,
      active: isFullscreenActive,
    },
    { id: 'exit', label: `${t('game', 'concede')} / ${t('game', 'return_to_lobby')}`, path: ICON_PATHS.exit, danger: true },
  ]

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-turn-info">
          <span className="sidebar-turn-label">{t('game', 'turn')}</span>
          <span className="sidebar-turn-value">{game?.turn ?? '—'}</span>
          <TurnTimer
            secs={timerSecs}
            isTicking={isTimerTicking}
            label={`${t('game', 'priority_time_left')} (${priorityPlayer?.name ?? t('common', 'player')})`}
          />
          <TurnTimer secs={bufferSecs} isTicking={false} label={t('game', 'buffer_time_left')} />
        </div>

        <div className="sidebar-icons-col">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-icon-btn ${item.danger ? 'danger' : ''} ${item.active ? 'active' : ''}`}
              title={item.label}
              onClick={() => handle(item.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.path} />
              </svg>
            </button>
          ))}
        </div>
      </nav>

      {showFx && (
        <div className="fx-popover" role="dialog" aria-label={t('common', 'settings')}>
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
        </div>
      )}

      {showHelp && <HelpWikiModal onClose={() => setShowHelp(false)} />}
    </>
  )
}