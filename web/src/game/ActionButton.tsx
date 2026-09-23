import { useEffect, useRef, useState } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import PassMenu from './PassMenu'
import Icon, { type IconName } from '../ui/Icon'
import { activeSkipOf } from './skips'
import { controlInfo } from '../state/control'
import { formatTimer, useTickingTimer } from '../utils/timer'
import { LONG_WAIT_SECS, formatElapsed, useElapsedSeconds, waitingState, type WaitingState } from './waitingState'
import './ActionButton.css'

interface ActionButtonProps {
  game: GameView | null
  feedback: FeedbackPrompt | null
  gameId: string | null
  canPass: boolean
  onPass: () => void
  onSkip: (action: string) => void
  busy?: boolean
}

const SHORTCUT_HINT = /\s*[(（][^)）]*[)）]\s*$/

function WaitingClock({ waiting }: { waiting: WaitingState | null }) {
  const { t } = useTranslation()
  const elapsed = useElapsedSeconds(waiting?.key ?? null)
  const timeLeft = useTickingTimer(waiting?.timeLeftSecs ?? 0, waiting?.timeLeftSecs != null)
  if (!waiting) return null
  const long = elapsed >= LONG_WAIT_SECS
  return (
    <span
      className={`action-btn-sublabel action-waiting-clock ${long ? 'is-long' : ''}`}
      data-testid="waiting-clock"
      data-elapsed={elapsed}
      title={long ? t('game', 'waiting_long_hint') : undefined}
    >
      {t('game', 'waiting_thinking', { time: formatElapsed(elapsed) })}
      {waiting.timeLeftSecs != null && (
        <span className="action-waiting-left">
          {' · '}
          <Icon name="timer" size={10} /> {t('game', 'waiting_time_left', { time: formatTimer(timeLeft) })}
        </span>
      )}
    </span>
  )
}

export default function ActionButton({
  game,
  feedback,
  gameId: _gameId,
  canPass,
  onPass,
  onSkip,
  busy = false,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const me = game?.players?.find((p) => p.controlled)
  const waiting = waitingState(game, feedback)
  const stackItems = Object.keys(game?.stack ?? {}).length
  const activeSkip = activeSkipOf(me)
  const control = controlInfo(game)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const passLabel = t('game', 'pass_priority').replace(SHORTCUT_HINT, '')
  let label = passLabel
  let sublabel: string | null = null
  let modeClass = 'action-pass'
  let modeIcon: IconName = 'play'

  if (waiting) {
    label = t('game', 'waiting_for', { name: waiting.name })
    modeClass = 'action-waiting'
    modeIcon = 'hourglass'
  } else if (stackItems > 0) {
    label = t('game', 'resolve')
    sublabel = `${t('game', 'stack')} (${stackItems})`
    modeClass = 'action-resolve'
    modeIcon = 'zap'
  } else if (feedback?.mode === 'combat') {
    const isAtk = feedback.title.toLowerCase().includes('atacan') || feedback.title.toLowerCase().includes('attack')
    label = isAtk
      ? t('game', 'confirm_attackers')
      : t('game', 'confirm_blockers')
    modeClass = 'action-combat'
    modeIcon = 'swords'
  } else if (me?.hasPriority) {
    label = passLabel
    sublabel = me.isActive ? t('game', 'turn') : t('game', 'priority')
    modeClass = 'action-priority'
    modeIcon = 'play'
  } else if (control.priorityIsControlled) {
    label = passLabel
    sublabel = t('game', 'controlling_turn', { name: control.actingName ?? '' })
    modeClass = 'action-priority'
    modeIcon = 'play'
  } else if (!canPass) {
    label = `${t('common', 'loading')}`
    modeClass = 'action-waiting'
    modeIcon = 'hourglass'
  }

  if (activeSkip && modeClass !== 'action-waiting') {
    sublabel = t('game', 'skip_active_to', { dest: t('game', activeSkip.labelKey) })
  }

  const isInteractive = canPass && !busy && modeClass !== 'action-waiting'

  return (
    <div className="action-button-container" ref={containerRef}>
      <div className={`big-action-split ${activeSkip ? 'has-skip' : ''}`}>
        <button
          type="button"
          className={`big-action-btn ${modeClass} ${isInteractive ? 'interactive' : 'disabled'}`}
          disabled={!isInteractive}
          onClick={onPass}
          title={t('game', 'action_main_hint')}
        >
          <span className="action-btn-glow" aria-hidden="true" />
          <div className="action-btn-content">
            <span className="action-btn-label">
              <span className="action-btn-icon" aria-hidden="true"><Icon name={modeIcon} size={15} /></span>{' '}
              {busy ? t('game', 'action_sending') : label}
            </span>
            {sublabel && !busy && <span className="action-btn-sublabel">{sublabel}</span>}
            {waiting && !busy && <WaitingClock waiting={waiting} />}
          </div>
          <kbd className="action-btn-shortcut">{t('wiki', 'shortcuts_space').split(':')[0]}</kbd>
        </button>
        {!!me && (
          <button
            type="button"
            className={`big-action-toggle ${menuOpen ? 'is-open' : ''}`}
            data-testid="pass-split-toggle"
            title={t('game', 'pass_options')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            ▾
          </button>
        )}
      </div>
      {menuOpen && (
        <PassMenu
          game={game}
          onSkip={(action) => {
            setMenuOpen(false)
            onSkip(action)
          }}
        />
      )}
    </div>
  )
}
